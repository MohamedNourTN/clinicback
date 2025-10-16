import { Response } from 'express';
import { validationResult } from 'express-validator';
import { MedicalRecord } from '../models';
import { AuthRequest } from '../types/express';
import { getTenantScopedFilter, addTenantToData } from '../middleware/auth';

export class MedicalRecordController {
  static async createMedicalRecord(req: AuthRequest, res: Response): Promise<void> {
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

      // Add tenant_id to medical record data with validation
      const medicalRecordData = addTenantToData(req, {
        ...req.body,
        clinic_id: req.clinic_id
      });

      const medicalRecord = new MedicalRecord(medicalRecordData);
      await medicalRecord.save();

      // Populate patient and doctor details
      await medicalRecord.populate([
        { path: 'patient_id', select: 'first_name last_name email phone' },
        { path: 'doctor_id', select: 'first_name last_name role' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Medical record created successfully',
        data: { medicalRecord }
      });
    } catch (error) {
      console.error('Create medical record error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getMedicalRecordsByPatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Apply tenant-scoped filtering
      const filter = getTenantScopedFilter(req, {
        patient_id: patientId,
        clinic_id: req.clinic_id
      });

      const medicalRecords = await MedicalRecord.find(filter)
        .populate('doctor_id', 'first_name last_name role')
        .skip(skip)
        .limit(limit)
        .sort({ visit_date: -1 });

      const totalRecords = await MedicalRecord.countDocuments(filter);

      res.json({
        success: true,
        data: {
          medicalRecords,
          pagination: {
            page,
            limit,
            total: totalRecords,
            pages: Math.ceil(totalRecords / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get medical records by patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getMedicalRecordById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Apply tenant-scoped filtering for medical record query
      const recordFilter = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      const medicalRecord = await MedicalRecord.findOne(recordFilter)
        .populate('patient_id', 'first_name last_name email phone date_of_birth')
        .populate('doctor_id', 'first_name last_name role');

      if (!medicalRecord) {
        res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { medicalRecord }
      });
    } catch (error) {
      console.error('Get medical record by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateMedicalRecord(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const medicalRecord = await MedicalRecord.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id }, // CLINIC FILTER: Only update medical record from current clinic
        req.body,
        { new: true, runValidators: true }
      )
      .populate('patient_id', 'first_name last_name email phone')
      .populate('doctor_id', 'first_name last_name role');

      if (!medicalRecord) {
        res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Medical record updated successfully',
        data: { medicalRecord }
      });
    } catch (error) {
      console.error('Update medical record error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteMedicalRecord(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const medicalRecord = await MedicalRecord.findOneAndDelete({ 
        _id: id, 
        clinic_id: req.clinic_id // CLINIC FILTER: Only delete medical record from current clinic
      });

      if (!medicalRecord) {
        res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Medical record deleted successfully'
      });
    } catch (error) {
      console.error('Delete medical record error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getPatientHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;

      const filter = { 
        patient_id: patientId,
        clinic_id: req.clinic_id // CLINIC FILTER: Only get medical records from current clinic
      };

      const medicalRecords = await MedicalRecord.find(filter)
        .populate('doctor_id', 'first_name last_name role')
        .sort({ visit_date: -1 });

      // Get chronic conditions
      const chronicConditions = await MedicalRecord.aggregate([
        { $match: filter },
        { $unwind: '$diagnosis' },
        { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
        { $match: { count: { $gte: 2 } } },
        { $sort: { count: -1 } }
      ]);

      // Get allergies
      const allergies = await MedicalRecord.aggregate([
        { $match: filter },
        { $unwind: '$allergies' },
        { $group: { _id: '$allergies' } }
      ]);

      // Get current medications
      const currentMedications = await MedicalRecord.aggregate([
        { $match: filter },
        { $sort: { visit_date: -1 } },
        { $limit: 1 },
        { $unwind: '$medications' },
        { $project: { medication: '$medications' } }
      ]);

      res.json({
        success: true,
        data: {
          medicalRecords,
          chronicConditions: chronicConditions.map(c => c._id),
          allergies: allergies.map(a => a._id),
          currentMedications: currentMedications.map(m => m.medication)
        }
      });
    } catch (error) {
      console.error('Get patient history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 