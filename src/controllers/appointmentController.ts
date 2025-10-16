import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Appointment } from '../models';
import { AuthRequest } from '../types/express';
import { getRoleBasedFilter, getTenantScopedFilter, addTenantToData } from '../middleware/auth';

export class AppointmentController {
  static async createAppointment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      // Add tenant_id to appointment data with validation
      const appointmentData = addTenantToData(req, {
        ...req.body,
        clinic_id: req.clinic_id
      });
      
      const appointment = new Appointment(appointmentData);
      await appointment.save();

      // Populate patient, doctor, and nurse details
      await appointment.populate(['patient_id', 'doctor_id', 'nurse_id']);

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        data: { appointment }
      });
    } catch (error: any) {
      console.error('Create appointment error:', error);
      
      if (error.message === 'Tenant context is required for this operation') {
        res.status(400).json({
          success: false,
          message: 'Tenant information is required'
        });
        return;
      }
      
      if (error.code === 11000) {
        res.status(409).json({
          success: false,
          message: 'Doctor is already booked at this time'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllAppointments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Apply tenant-scoped filtering
      let filter: any = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id
      });

      // Date range filter
      if (req.query.start_date && req.query.end_date) {
        filter.appointment_date = {
          $gte: new Date(req.query.start_date as string),
          $lte: new Date(req.query.end_date as string)
        };
      }

      // Status filter
      if (req.query.status) {
        filter.status = req.query.status;
      }

      // Doctor filter (from query params)
      if (req.query.doctor_id) {
        filter.doctor_id = req.query.doctor_id;
      }

      // Patient filter
      if (req.query.patient_id) {
        filter.patient_id = req.query.patient_id;
      }

      // Apply role-based filtering
      const roleFilter = getRoleBasedFilter(req.user, 'appointment');
      filter = { ...filter, ...roleFilter };

      const appointments = await Appointment.find(filter)
        .populate('patient_id', 'first_name last_name email phone')
        .populate('doctor_id', 'first_name last_name role')
        .populate('nurse_id', 'first_name last_name role')
        .skip(skip)
        .limit(limit)
        .sort({ appointment_date: -1 });

      const totalAppointments = await Appointment.countDocuments(filter);

      res.json({
        success: true,
        data: {
          appointments,
          pagination: {
            page,
            limit,
            total: totalAppointments,
            pages: Math.ceil(totalAppointments / limit)
          }
        }
      });
    } catch (error: any) {
      console.error('Get all appointments error:', error);
      
      if (error.message === 'Tenant context is required for this operation') {
        res.status(400).json({
          success: false,
          message: 'Tenant information is required'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAppointmentById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Apply tenant-scoped filtering
      let filter: any = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      // Apply role-based filtering
      const roleFilter = getRoleBasedFilter(req.user, 'appointment');
      filter = { ...filter, ...roleFilter };

      const appointment = await Appointment.findOne(filter)
        .populate('patient_id')
        .populate('doctor_id', '-password_hash')
        .populate('nurse_id', '-password_hash');

      if (!appointment) {
        res.status(404).json({
          success: false,
          message: 'Appointment not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: { appointment }
      });
    } catch (error: any) {
      console.error('Get appointment by ID error:', error);
      
      if (error.message === 'Tenant context is required for this operation') {
        res.status(400).json({
          success: false,
          message: 'Tenant information is required'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateAppointment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      
      let filter: any = { _id: id };
      
      // Apply role-based filtering
      const roleFilter = getRoleBasedFilter(req.user, 'appointment');
      filter = { ...filter, ...roleFilter };

      const appointment = await Appointment.findOneAndUpdate(
        filter,
        req.body,
        { new: true, runValidators: true }
      )
      .populate('patient_id')
      .populate('doctor_id', '-password_hash')
      .populate('nurse_id', '-password_hash');

      if (!appointment) {
        res.status(404).json({
          success: false,
          message: 'Appointment not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Appointment updated successfully',
        data: { appointment }
      });
    } catch (error) {
      console.error('Update appointment error:', error);
      
      // Handle specific Mongoose validation errors
      if (error instanceof Error && error.name === 'ValidationError') {
        const validationError = error as any;
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: Object.values(validationError.errors).map((err: any) => ({
            field: err.path,
            message: err.message
          }))
        });
        return;
      }
      
      // Handle duplicate key errors (e.g., doctor double booking)
      if (error instanceof Error && (error as any).code === 11000) {
        res.status(409).json({
          success: false,
          message: 'Doctor is already booked at this time'
        });
        return;
      }
      
      // Handle CastError (invalid ObjectId)
      if (error instanceof Error && error.name === 'CastError') {
        res.status(400).json({
          success: false,
          message: 'Invalid appointment ID format'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async cancelAppointment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      let filter: any = { _id: id };
      
      // Apply role-based filtering
      const roleFilter = getRoleBasedFilter(req.user, 'appointment');
      filter = { ...filter, ...roleFilter };

      const appointment = await Appointment.findOneAndUpdate(
        filter,
        { status: 'cancelled' },
        { new: true }
      );

      if (!appointment) {
        res.status(404).json({
          success: false,
          message: 'Appointment not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Appointment cancelled successfully',
        data: { appointment }
      });
    } catch (error) {
      console.error('Cancel appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getDoctorSchedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { doctorId } = req.params;
      const { date } = req.query;

      if (!date) {
        res.status(400).json({
          success: false,
          message: 'Date parameter is required'
        });
        return;
      }

      // Check if user can access this doctor's schedule
      if (req.user?.role === 'doctor' && (req.user as any)._id.toString() !== doctorId) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own schedule.'
        });
        return;
      }

      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const appointments = await Appointment.find({
        doctor_id: doctorId,
        appointment_date: {
          $gte: startDate,
          $lt: endDate
        },
        status: { $nin: ['cancelled', 'no-show'] }
      })
      .populate('patient_id', 'first_name last_name')
      .sort({ appointment_date: -1 });

      res.json({
        success: true,
        data: { appointments }
      });
    } catch (error) {
      console.error('Get doctor schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getUpcomingAppointments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      let filter: any = {
        appointment_date: { $gte: new Date() },
        status: { $nin: ['cancelled', 'completed', 'no-show'] }
      };

      // Apply role-based filtering
      const roleFilter = getRoleBasedFilter(req.user, 'appointment');
      filter = { ...filter, ...roleFilter };
      
      const appointments = await Appointment.find(filter)
        .populate('patient_id', 'first_name last_name phone')
        .populate('doctor_id', 'first_name last_name')
        .sort({ appointment_date: -1 })
        .limit(limit);

      res.json({
        success: true,
        data: { appointments }
      });
    } catch (error) {
      console.error('Get upcoming appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAppointmentStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      let filter: any = {};

      // Apply role-based filtering
      const roleFilter = getRoleBasedFilter(req.user, 'appointment');
      filter = { ...filter, ...roleFilter };

      const totalAppointments = await Appointment.countDocuments(filter);
      
      const statusStats = await Appointment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayAppointments = await Appointment.countDocuments({
        ...filter,
        appointment_date: {
          $gte: todayStart,
          $lte: todayEnd
        }
      });

      const thisWeekStart = new Date();
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      const weeklyAppointments = await Appointment.countDocuments({
        ...filter,
        appointment_date: { $gte: thisWeekStart }
      });

      res.json({
        success: true,
        data: {
          totalAppointments,
          statusStats,
          todayAppointments,
          weeklyAppointments
        }
      });
    } catch (error) {
      console.error('Get appointment stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Public method for patients to view their appointments without authentication
  static async getPublicPatientAppointments(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Validate patient ID format
      if (!patientId || patientId.length !== 24) {
        res.status(400).json({
          success: false,
          message: 'Invalid patient ID format'
        });
        return;
      }

      let filter: any = { patient_id: patientId };

      // Optional status filter
      if (req.query.status) {
        filter.status = req.query.status;
      }

      // Optional date range filter
      if (req.query.start_date && req.query.end_date) {
        filter.appointment_date = {
          $gte: new Date(req.query.start_date as string),
          $lte: new Date(req.query.end_date as string)
        };
      }

      const appointments = await Appointment.find(filter)
        .populate('patient_id', 'first_name last_name email phone date_of_birth')
        .populate('doctor_id', 'first_name last_name role department')
        .populate('nurse_id', 'first_name last_name role')
        .skip(skip)
        .limit(limit)
        .sort({ appointment_date: -1 });

      const totalAppointments = await Appointment.countDocuments(filter);

      // Also get some basic patient info for display
      const patientInfo = appointments.length > 0 ? appointments[0].patient_id : null;

      res.json({
        success: true,
        data: {
          patient: patientInfo,
          appointments,
          pagination: {
            page,
            limit,
            total: totalAppointments,
            pages: Math.ceil(totalAppointments / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get public patient appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 