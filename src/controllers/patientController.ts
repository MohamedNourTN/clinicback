import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Patient, Appointment, Prescription } from '../models';
import { AuthRequest } from '../types/express';
import { getRoleBasedFilter, getTenantScopedFilter, addTenantToData, canAccessTenant } from '../middleware/auth';

export class PatientController {
  static async createPatient(req: AuthRequest, res: Response): Promise<void> {
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

      // Add tenant_id to patient data with validation
      const patientData = addTenantToData(req, {
        ...req.body,
        clinic_id: req.clinic_id
      });
      
      const patient = new Patient(patientData);
      await patient.save();

      res.status(201).json({
        success: true,
        message: 'Patient created successfully',
        data: { patient }
      });
    } catch (error: any) {
      console.error('Create patient error:', error);
      
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

  static async getAllPatients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Apply tenant-scoped filtering
      let filter: any = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id
      });

      // Search filter
      if (req.query.search) {
        filter.$or = [
          { first_name: { $regex: req.query.search, $options: 'i' } },
          { last_name: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { phone: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Gender filter
      if (req.query.gender) {
        filter.gender = req.query.gender;
      }

      // Apply role-based filtering
      const roleFilter = getRoleBasedFilter(req.user, 'patient');
      
      let patients: any[];
      let totalPatients: number;

      if (roleFilter._requiresDoctorPatientFilter && req.user?.role === 'doctor') {
        // TEMPORARY: Allow doctors to see all patients for development
        // TODO: Restore role-based filtering for production
        patients = await Patient.find(filter)
          .skip(skip)
          .limit(limit)
          .sort({ created_at: -1 });

        totalPatients = await Patient.countDocuments(filter);
        
        // ORIGINAL CODE (commented out for development):
        // For doctors, find patients they have appointments or prescriptions with
        // const doctorId = roleFilter._doctorId;
        // 
        // // Get patient IDs from appointments
        // const appointmentPatients = await Appointment.distinct('patient_id', { doctor_id: doctorId });
        // 
        // // Get patient IDs from prescriptions
        // const prescriptionPatients = await Prescription.distinct('patient_id', { doctor_id: doctorId });
        // 
        // // Combine patient IDs
        // const patientIds = [...new Set([...appointmentPatients, ...prescriptionPatients])];
        // 
        // if (patientIds.length === 0) {
        //   // Doctor has no patients assigned
        //   patients = [];
        //   totalPatients = 0;
        // } else {
        //   // Add patient ID filter to existing filters
        //   filter._id = { $in: patientIds };
        //   
        //   patients = await Patient.find(filter)
        //     .skip(skip)
        //     .limit(limit)
        //     .sort({ created_at: -1 });
        // 
        //   totalPatients = await Patient.countDocuments(filter);
        // }
      } else if (roleFilter._requiresNursePatientFilter && req.user?.role === 'nurse') {
        // For nurses, find patients they have appointments with (as assigned nurse)
        const nurseId = roleFilter._nurseId;
        
        // Get patient IDs from appointments where nurse is assigned
        const appointmentPatients = await Appointment.distinct('patient_id', { nurse_id: nurseId });
        
        if (appointmentPatients.length === 0) {
          // Nurse has no patients assigned
          patients = [];
          totalPatients = 0;
        } else {
          // Add patient ID filter to existing filters
          filter._id = { $in: appointmentPatients };
          
          patients = await Patient.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ created_at: -1 });

          totalPatients = await Patient.countDocuments(filter);
        }
      } else {
        // Admin and other roles can see all patients
        patients = await Patient.find(filter)
          .skip(skip)
          .limit(limit)
          .sort({ created_at: -1 });

        totalPatients = await Patient.countDocuments(filter);
      }

      // Calculate and populate last_visit for each patient
      for (let patient of patients) {
        const lastCompletedAppointment = await Appointment.findOne({
          tenant_id: req.tenant_id,
          clinic_id: req.clinic_id,
          patient_id: patient._id,
          status: 'completed'
        }).sort({ appointment_date: -1 }).select('appointment_date');

        if (lastCompletedAppointment) {
          patient.last_visit = lastCompletedAppointment.appointment_date;
          // Update the patient record in database
          await Patient.findByIdAndUpdate(patient._id, { 
            last_visit: lastCompletedAppointment.appointment_date 
          });
        }
      }

      res.json({
        success: true,
        data: {
          patients,
          pagination: {
            page,
            limit,
            total: totalPatients,
            pages: Math.ceil(totalPatients / limit)
          }
        }
      });
    } catch (error: any) {
      console.error('Get all patients error:', error);
      
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

  static async getPatientById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Check if user has permission to view this patient
      let hasPermission = false;
      
      if (req.user?.role === 'super_admin' || req.user?.role === 'admin') {
        hasPermission = true;
      } else if (req.user?.role === 'doctor') {
        // Check if doctor has appointments or prescriptions with this patient (with tenant filtering)
        const tenantFilter = { tenant_id: req.tenant_id };
        
        const appointmentExists = await Appointment.exists({ 
          ...tenantFilter,
          patient_id: id, 
          doctor_id: req.user._id 
        });
        const prescriptionExists = await Prescription.exists({ 
          ...tenantFilter,
          patient_id: id, 
          doctor_id: req.user._id 
        });
        
        hasPermission = !!(appointmentExists || prescriptionExists);
      } else if (req.user?.role === 'nurse') {
        // Check if nurse has appointments with this patient (as assigned nurse, with tenant filtering)
        const tenantFilter = { tenant_id: req.tenant_id };
        
        const appointmentExists = await Appointment.exists({ 
          ...tenantFilter,
          patient_id: id, 
          nurse_id: req.user._id 
        });
        
        hasPermission = !!appointmentExists;
      } else {
        // Other roles can see all patients for now
        hasPermission = true;
      }

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only view patients assigned to you.'
        });
        return;
      }

      // Apply tenant-scoped filtering for patient query
      const patientFilter = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      const patient = await Patient.findOne(patientFilter);

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      // Calculate and populate last_visit for this patient
      const lastCompletedAppointment = await Appointment.findOne({
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id,
        patient_id: patient._id,
        status: 'completed'
      }).sort({ appointment_date: -1 }).select('appointment_date');

      if (lastCompletedAppointment) {
        patient.last_visit = lastCompletedAppointment.appointment_date;
        // Update the patient record in database
        await Patient.findByIdAndUpdate(patient._id, { 
          last_visit: lastCompletedAppointment.appointment_date 
        });
      }

      res.json({
        success: true,
        data: { patient }
      });
    } catch (error: any) {
      console.error('Get patient by ID error:', error);
      
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

  static async updatePatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Check if user has permission to update this patient
      let hasPermission = false;
      
      if (req.user?.role === 'super_admin' || req.user?.role === 'admin') {
        hasPermission = true;
      } else if (req.user?.role === 'doctor') {
        // Check if doctor has appointments or prescriptions with this patient (with tenant filtering)
        const tenantFilter = { tenant_id: req.tenant_id };
        
        const appointmentExists = await Appointment.exists({ 
          ...tenantFilter,
          patient_id: id, 
          doctor_id: req.user._id 
        });
        const prescriptionExists = await Prescription.exists({ 
          ...tenantFilter,
          patient_id: id, 
          doctor_id: req.user._id 
        });
        
        hasPermission = !!(appointmentExists || prescriptionExists);
      } else if (req.user?.role === 'nurse') {
        // Check if nurse has appointments with this patient (as assigned nurse, with tenant filtering)
        const tenantFilter = { tenant_id: req.tenant_id };
        
        const appointmentExists = await Appointment.exists({ 
          ...tenantFilter,
          patient_id: id, 
          nurse_id: req.user._id 
        });
        
        hasPermission = !!appointmentExists;
      } else {
        // Other roles can update all patients for now
        hasPermission = true;
      }

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only update patients assigned to you.'
        });
        return;
      }

      // Apply tenant-scoped filtering for patient update
      const updateFilter = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      const patient = await Patient.findOneAndUpdate(
        updateFilter,
        req.body,
        { new: true, runValidators: true }
      );

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Patient updated successfully',
        data: { patient }
      });
    } catch (error: any) {
      console.error('Update patient error:', error);
      
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

  static async deletePatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Only admin can delete patients
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Access denied. Only administrators can delete patients.'
        });
        return;
      }

      // Apply tenant-scoped filtering for patient deletion
      const deleteFilter = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      const patient = await Patient.findOneAndDelete(deleteFilter);

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Patient deleted successfully'
      });
    } catch (error) {
      console.error('Delete patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getPatientStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Apply tenant-scoped filtering for patient stats
      let filter: any = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id
      });

      // Apply role-based filtering for stats
      if (req.user?.role === 'doctor') {
        // For doctors, get stats only for their patients
        const doctorId = req.user._id;
        
        // Apply tenant filtering to doctor's patient queries
        const tenantFilter = { tenant_id: req.tenant_id };
        
        // Get patient IDs from appointments
        const appointmentPatients = await Appointment.distinct('patient_id', { 
          ...tenantFilter,
          doctor_id: doctorId, 
          clinic_id: req.clinic_id 
        });
        
        // Get patient IDs from prescriptions
        const prescriptionPatients = await Prescription.distinct('patient_id', { 
          ...tenantFilter,
          doctor_id: doctorId, 
          clinic_id: req.clinic_id 
        });
        
        // Combine patient IDs
        const patientIds = [...new Set([...appointmentPatients, ...prescriptionPatients])];
        
        if (patientIds.length > 0) {
          filter._id = { $in: patientIds };
        } else {
          // Doctor has no patients
          res.json({
            success: true,
            data: {
              totalPatients: 0,
              genderStats: [],
              ageStats: [],
              recentRegistrations: 0
            }
          });
          return;
        }
      }

      const totalPatients = await Patient.countDocuments(filter);
      
      const genderStats = await Patient.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$gender',
            count: { $sum: 1 }
          }
        }
      ]);

      const ageStats = await Patient.aggregate([
        { $match: filter },
        {
          $addFields: {
            age: {
              $floor: {
                $divide: [
                  { $subtract: [new Date(), '$date_of_birth'] },
                  365.25 * 24 * 60 * 60 * 1000
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$age', 18] }, then: 'Under 18' },
                  { case: { $lt: ['$age', 35] }, then: '18-34' },
                  { case: { $lt: ['$age', 50] }, then: '35-49' },
                  { case: { $lt: ['$age', 65] }, then: '50-64' },
                  { case: { $gte: ['$age', 65] }, then: '65+' }
                ],
                default: 'Unknown'
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);

      const recentRegistrationsFilter = {
        ...filter,
        created_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      };
      const recentRegistrations = await Patient.countDocuments(recentRegistrationsFilter);

      res.json({
        success: true,
        data: {
          totalPatients,
          genderStats,
          ageStats,
          recentRegistrations
        }
      });
    } catch (error) {
      console.error('Get patient stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}