import { Request, Response } from 'express';
import { Patient, Appointment, User, Lead } from '../models';
import { AuthRequest } from '../types/express';

export class ReceptionistController {
  
  // Get receptionist dashboard statistics
  static async getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      // Get today's appointments
      const todayAppointments = await Appointment.countDocuments({
        appointment_date: {
          $gte: today,
          $lt: tomorrow
        }
      });

      // Get walk-ins today (leads with source 'walk-in' created today)
      const todayWalkIns = await Lead.countDocuments({
        source: 'walk-in',
        created_at: {
          $gte: today,
          $lt: tomorrow
        }
      });

      // Get pending check-ins (scheduled/confirmed appointments for today)
      const pendingCheckIns = await Appointment.countDocuments({
        appointment_date: {
          $gte: today,
          $lt: tomorrow
        },
        status: { $in: ['scheduled', 'confirmed'] }
      });

      // Mock calls today (this would be tracked in a separate call log system)
      const callsToday = 12; // This would come from a call tracking system

      // Get upcoming appointments for today
      const upcomingAppointments = await Appointment.find({
        appointment_date: {
          $gte: now,
          $lt: tomorrow
        },
        status: { $nin: ['cancelled', 'completed', 'no-show'] }
      })
      .populate('patient_id', 'first_name last_name phone')
      .populate('doctor_id', 'first_name last_name')
      .sort({ appointment_date: 1 })
      .limit(10);

      // Get current patients (checked-in patients - appointments in progress)
      const currentPatients = await Appointment.find({
        appointment_date: {
          $gte: today,
          $lt: tomorrow
        },
        status: 'in-progress'
      })
      .populate('patient_id', 'first_name last_name')
      .populate('doctor_id', 'first_name last_name')
      .sort({ appointment_date: 1 });

      // Get recent leads/inquiries as pending tasks
      const pendingTasks = await Lead.find({
        status: { $in: ['new', 'contacted'] },
        created_at: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      })
      .sort({ created_at: -1 })
      .limit(10);

      res.json({
        success: true,
        data: {
          stats: {
            todayAppointments,
            todayWalkIns,
            pendingCheckIns,
            callsToday
          },
          upcomingAppointments: upcomingAppointments.map(apt => ({
            id: apt._id,
            patient: (apt.patient_id as any) ? `${(apt.patient_id as any).first_name} ${(apt.patient_id as any).last_name}` : 'Unknown Patient',
            phone: (apt.patient_id as any)?.phone || 'N/A',
            time: apt.appointment_date,
            doctor: (apt.doctor_id as any) ? `${(apt.doctor_id as any).first_name} ${(apt.doctor_id as any).last_name}` : 'Unknown Doctor',
            type: apt.type || 'consultation',
            status: apt.status,
            duration: apt.duration
          })),
          currentPatients: currentPatients.map(apt => ({
            id: apt._id,
            name: (apt.patient_id as any) ? `${(apt.patient_id as any).first_name} ${(apt.patient_id as any).last_name}` : 'Unknown Patient',
            checkedIn: apt.appointment_date,
            doctor: (apt.doctor_id as any) ? `${(apt.doctor_id as any).first_name} ${(apt.doctor_id as any).last_name}` : 'Unknown Doctor',
            status: 'in-consultation',
            waitTime: Math.floor((now.getTime() - apt.appointment_date.getTime()) / (1000 * 60)) // minutes
          })),
          pendingTasks: pendingTasks.map(lead => ({
            id: lead._id,
            task: `Follow up with ${(lead as any).firstName} ${(lead as any).lastName}`,
            patient: `${(lead as any).firstName} ${(lead as any).lastName}`,
            priority: 'medium',
            time: lead.created_at,
            phone: lead.phone,
            source: lead.source
          }))
        }
      });
    } catch (error) {
      console.error('Get receptionist dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Check in a patient
  static async checkInPatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
        return;
      }

      // Update appointment status to checked-in or in-progress
      appointment.status = 'in-progress';
      await appointment.save();

      res.json({
        success: true,
        message: 'Patient checked in successfully',
        data: { appointment }
      });
    } catch (error) {
      console.error('Check in patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get walk-in leads for today
  static async getTodayWalkIns(req: AuthRequest, res: Response): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const walkIns = await Lead.find({
        source: 'walk-in',
        created_at: {
          $gte: today,
          $lt: tomorrow
        }
      }).sort({ created_at: -1 });

      res.json({
        success: true,
        data: { walkIns }
      });
    } catch (error) {
      console.error('Get today walk-ins error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Create walk-in lead
  static async createWalkIn(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { first_name, last_name, phone, email, notes } = req.body;

      const walkIn = new Lead({
        firstName: first_name,
        lastName: last_name,
        phone,
        email,
        source: 'walk-in',
        status: 'new',
        notes: notes || 'Walk-in patient',
        assigned_to: req.user?._id // Assign to current receptionist
      });

      await walkIn.save();

      res.status(201).json({
        success: true,
        message: 'Walk-in registered successfully',
        data: { walkIn }
      });
    } catch (error) {
      console.error('Create walk-in error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get appointment queue (appointments for today by status)
  static async getAppointmentQueue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const appointments = await Appointment.find({
        appointment_date: {
          $gte: today,
          $lt: tomorrow
        }
      })
      .populate('patient_id', 'first_name last_name phone')
      .populate('doctor_id', 'first_name last_name')
      .sort({ appointment_date: 1 });

      // Group by status
      const queue = {
        waiting: appointments.filter(apt => apt.status === 'scheduled' || apt.status === 'confirmed'),
        inProgress: appointments.filter(apt => apt.status === 'in-progress'),
        completed: appointments.filter(apt => apt.status === 'completed'),
        cancelled: appointments.filter(apt => apt.status === 'cancelled'),
        noShow: appointments.filter(apt => apt.status === 'no-show')
      };

      res.json({
        success: true,
        data: { queue }
      });
    } catch (error) {
      console.error('Get appointment queue error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update appointment status (for check-in, completion, etc.)
  static async updateAppointmentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { appointmentId } = req.params;
      const { status } = req.body;

      const validStatuses = ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
        return;
      }

      const appointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { status },
        { new: true }
      ).populate('patient_id', 'first_name last_name')
       .populate('doctor_id', 'first_name last_name');

      if (!appointment) {
        res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Appointment status updated successfully',
        data: { appointment }
      });
    } catch (error) {
      console.error('Update appointment status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 