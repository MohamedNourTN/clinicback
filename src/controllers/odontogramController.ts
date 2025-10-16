import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Odontogram, Patient, IOdontogram, IToothCondition } from '../models';
import { AuthRequest } from '../types/express';
import { getRoleBasedFilter } from '../middleware/auth';

export class OdontogramController {
  // Create a new odontogram for a patient
  static async createOdontogram(req: AuthRequest, res: Response): Promise<void> {
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

      const { patient_id } = req.params;
      
      // Verify patient exists and belongs to the clinic
      const patient = await Patient.findOne({
        _id: patient_id,
        clinic_id: req.clinic_id
      });

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      // Get the latest version number for this patient
      const latestOdontogram = await Odontogram.findOne({
        patient_id,
        clinic_id: req.clinic_id
      }).sort({ version: -1 });

      const nextVersion = latestOdontogram ? latestOdontogram.version + 1 : 1;

      const odontogramData = {
        ...req.body,
        clinic_id: req.clinic_id,
        patient_id,
        doctor_id: req.user?._id,
        version: nextVersion
      };

      const odontogram = new Odontogram(odontogramData);
      
      // Calculate treatment summary before saving
      odontogram.calculateTreatmentSummary();
      
      await odontogram.save();

      // Populate related fields for response
      await odontogram.populate([
        { path: 'patient_id', select: 'first_name last_name full_name age' },
        { path: 'doctor_id', select: 'first_name last_name' },
        { path: 'clinic_id', select: 'name' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Odontogram created successfully',
        data: { odontogram }
      });
    } catch (error) {
      console.error('Create odontogram error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get all odontograms with filtering and pagination
  static async getAllOdontograms(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let filter: any = {
        clinic_id: req.clinic_id
      };

      // Patient filter
      if (req.query.patient_id) {
        filter.patient_id = req.query.patient_id;
      }

      // Doctor filter
      if (req.query.doctor_id) {
        filter.doctor_id = req.query.doctor_id;
      }

      // Active only filter
      if (req.query.active_only === 'true') {
        filter.is_active = true;
      }

      // Date range filter
      if (req.query.start_date || req.query.end_date) {
        filter.examination_date = {};
        if (req.query.start_date) {
          filter.examination_date.$gte = new Date(req.query.start_date as string);
        }
        if (req.query.end_date) {
          filter.examination_date.$lte = new Date(req.query.end_date as string);
        }
      }

      // Apply role-based filtering
      const roleFilter = getRoleBasedFilter(req.user, 'odontogram');
      if (roleFilter._requiresDoctorPatientFilter && req.user?.role === 'doctor') {
        filter.doctor_id = req.user._id;
      }

      const odontograms = await Odontogram.find(filter)
        .populate([
          { 
            path: 'patient_id', 
            select: 'first_name last_name date_of_birth phone email',
            options: { virtuals: true }
          },
          { path: 'doctor_id', select: 'first_name last_name' },
          { path: 'clinic_id', select: 'name' }
        ])
        .skip(skip)
        .limit(limit)
        .sort({ examination_date: -1 });

      const totalOdontograms = await Odontogram.countDocuments(filter);
      const totalPages = Math.ceil(totalOdontograms / limit);

      res.status(200).json({
        success: true,
        data: {
          odontograms,
          pagination: {
            current_page: page,
            total_pages: totalPages,
            total_items: totalOdontograms,
            items_per_page: limit
          }
        }
      });
    } catch (error) {
      console.error('Get all odontograms error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get a specific odontogram by ID
  static async getOdontogramById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const odontogram = await Odontogram.findOne({
        _id: id,
        clinic_id: req.clinic_id
      }).populate([
        { 
          path: 'patient_id', 
          select: 'first_name last_name phone email date_of_birth gender',
          options: { virtuals: true }
        },
        { path: 'doctor_id', select: 'first_name last_name' },
        { path: 'clinic_id', select: 'name' }
      ]);

      if (!odontogram) {
        res.status(404).json({
          success: false,
          message: 'Odontogram not found'
        });
        return;
      }

      // Apply role-based access control
      const roleFilter = getRoleBasedFilter(req.user, 'odontogram');
      if (roleFilter._requiresDoctorPatientFilter && req.user?.role === 'doctor') {
        if (odontogram.doctor_id.toString() !== req.user._id.toString()) {
          res.status(403).json({
            success: false,
            message: 'Access denied'
          });
          return;
        }
      }

      res.status(200).json({
        success: true,
        data: { odontogram }
      });
    } catch (error) {
      console.error('Get odontogram by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get active odontogram for a patient
  static async getActiveOdontogramByPatient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { patient_id } = req.params;

      // Verify patient exists and belongs to the clinic
      const patient = await Patient.findOne({
        _id: patient_id,
        clinic_id: req.clinic_id
      });

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      const odontogram = await Odontogram.findOne({
        patient_id,
        clinic_id: req.clinic_id,
        is_active: true
      }).populate([
        { 
          path: 'patient_id', 
          select: 'first_name last_name phone email date_of_birth gender',
          options: { virtuals: true }
        },
        { path: 'doctor_id', select: 'first_name last_name' },
        { path: 'clinic_id', select: 'name' }
      ]);

      if (!odontogram) {
        res.status(404).json({
          success: false,
          message: 'No active odontogram found for this patient'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { odontogram }
      });
    } catch (error) {
      console.error('Get active odontogram error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get odontogram history for a patient
  static async getOdontogramHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { patient_id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Verify patient exists and belongs to the clinic
      const patient = await Patient.findOne({
        _id: patient_id,
        clinic_id: req.clinic_id
      });

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      const odontograms = await Odontogram.find({
        patient_id,
        clinic_id: req.clinic_id
      })
        .populate([
          { 
            path: 'patient_id', 
            select: 'first_name last_name phone email date_of_birth gender',
            options: { virtuals: true }
          },
          { path: 'doctor_id', select: 'first_name last_name' },
          { path: 'clinic_id', select: 'name' }
        ])
        .skip(skip)
        .limit(limit)
        .sort({ version: -1 });

      const totalOdontograms = await Odontogram.countDocuments({
        patient_id,
        clinic_id: req.clinic_id
      });

      const totalPages = Math.ceil(totalOdontograms / limit);

      res.status(200).json({
        success: true,
        data: {
          patient: {
            _id: patient._id,
            full_name: patient.full_name,
            age: patient.age
          },
          odontograms,
          pagination: {
            current_page: page,
            total_pages: totalPages,
            total_items: totalOdontograms,
            items_per_page: limit
          }
        }
      });
    } catch (error) {
      console.error('Get odontogram history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update an odontogram
  static async updateOdontogram(req: AuthRequest, res: Response): Promise<void> {
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

      const odontogram = await Odontogram.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!odontogram) {
        res.status(404).json({
          success: false,
          message: 'Odontogram not found'
        });
        return;
      }

      // Apply role-based access control
      const roleFilter = getRoleBasedFilter(req.user, 'odontogram');
      if (roleFilter._requiresDoctorPatientFilter && req.user?.role === 'doctor') {
        if (odontogram.doctor_id.toString() !== req.user._id.toString()) {
          res.status(403).json({
            success: false,
            message: 'Access denied'
          });
          return;
        }
      }

      // Update the odontogram
      Object.assign(odontogram, req.body);
      
      // Recalculate treatment summary
      odontogram.calculateTreatmentSummary();
      
      await odontogram.save();

      // Populate related fields for response
      await odontogram.populate([
        { path: 'patient_id', select: 'first_name last_name full_name age' },
        { path: 'doctor_id', select: 'first_name last_name' },
        { path: 'clinic_id', select: 'name' }
      ]);

      res.status(200).json({
        success: true,
        message: 'Odontogram updated successfully',
        data: { odontogram }
      });
    } catch (error) {
      console.error('Update odontogram error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update specific tooth condition
  static async updateToothCondition(req: AuthRequest, res: Response): Promise<void> {
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

      const { id, tooth_number } = req.params;

      const odontogram = await Odontogram.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!odontogram) {
        res.status(404).json({
          success: false,
          message: 'Odontogram not found'
        });
        return;
      }

      // Apply role-based access control
      const roleFilter = getRoleBasedFilter(req.user, 'odontogram');
      if (roleFilter._requiresDoctorPatientFilter && req.user?.role === 'doctor') {
        if (odontogram.doctor_id.toString() !== req.user._id.toString()) {
          res.status(403).json({
            success: false,
            message: 'Access denied'
          });
          return;
        }
      }

      const toothNum = parseInt(tooth_number);
      const toothIndex = odontogram.teeth_conditions.findIndex(
        (tooth: IToothCondition) => tooth.tooth_number === toothNum
      );

      if (toothIndex === -1) {
        // Add new tooth condition
        odontogram.teeth_conditions.push({
          tooth_number: toothNum,
          ...req.body
        } as IToothCondition);
      } else {
        // Update existing tooth condition
        Object.assign(odontogram.teeth_conditions[toothIndex], req.body);
      }

      // Recalculate treatment summary
      odontogram.calculateTreatmentSummary();
      
      await odontogram.save();

      // Log for debugging
      console.log('Treatment Summary After Update:', {
        total_planned: odontogram.treatment_summary?.total_planned_treatments,
        completed: odontogram.treatment_summary?.completed_treatments,
        in_progress: odontogram.treatment_summary?.in_progress_treatments,
        progress_percentage: odontogram.treatment_progress,
        pending: odontogram.pending_treatments
      });

      // Populate the response with full data including virtuals
      const updatedOdontogram = await Odontogram.findById(odontogram._id)
        .populate([
          { 
            path: 'patient_id', 
            select: 'first_name last_name phone email date_of_birth gender',
            options: { virtuals: true }
          },
          { path: 'doctor_id', select: 'first_name last_name' },
          { path: 'clinic_id', select: 'name' }
        ]);

      res.status(200).json({
        success: true,
        message: 'Tooth condition updated successfully',
        data: { 
          odontogram: updatedOdontogram,
          updated_tooth: updatedOdontogram?.teeth_conditions.find(
            (tooth: IToothCondition) => tooth.tooth_number === toothNum
          )
        }
      });
    } catch (error) {
      console.error('Update tooth condition error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Delete an odontogram
  static async deleteOdontogram(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const odontogram = await Odontogram.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!odontogram) {
        res.status(404).json({
          success: false,
          message: 'Odontogram not found'
        });
        return;
      }

      // Apply role-based access control
      const roleFilter = getRoleBasedFilter(req.user, 'odontogram');
      if (roleFilter._requiresDoctorPatientFilter && req.user?.role === 'doctor') {
        if (odontogram.doctor_id.toString() !== req.user._id.toString()) {
          res.status(403).json({
            success: false,
            message: 'Access denied'
          });
          return;
        }
      }

      await Odontogram.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Odontogram deleted successfully'
      });
    } catch (error) {
      console.error('Delete odontogram error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Set odontogram as active (deactivates others for the same patient)
  static async setActiveOdontogram(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const odontogram = await Odontogram.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!odontogram) {
        res.status(404).json({
          success: false,
          message: 'Odontogram not found'
        });
        return;
      }

      // Deactivate all other odontograms for this patient
      await Odontogram.updateMany(
        { 
          patient_id: odontogram.patient_id,
          clinic_id: req.clinic_id,
          _id: { $ne: id }
        },
        { is_active: false }
      );

      // Activate this odontogram
      odontogram.is_active = true;
      await odontogram.save();

      res.status(200).json({
        success: true,
        message: 'Odontogram set as active successfully',
        data: { odontogram }
      });
    } catch (error) {
      console.error('Set active odontogram error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get treatment summary statistics
  static async getTreatmentSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { patient_id } = req.params;

      if (patient_id) {
        // Get summary for specific patient
        const odontogram = await Odontogram.findOne({
          patient_id,
          clinic_id: req.clinic_id,
          is_active: true
        });

        if (!odontogram) {
          res.status(404).json({
            success: false,
            message: 'No active odontogram found for this patient'
          });
          return;
        }

        res.status(200).json({
          success: true,
          data: {
            patient_summary: odontogram.treatment_summary,
            treatment_progress: odontogram.treatment_progress,
            pending_treatments: odontogram.pending_treatments
          }
        });
      } else {
        // Get clinic-wide summary using active odontograms only
        // Convert clinic_id to ObjectId for proper matching
        const mongoose = require('mongoose');
        const clinicObjectId = typeof req.clinic_id === 'string' 
          ? new mongoose.Types.ObjectId(req.clinic_id)
          : req.clinic_id;

        const pipeline = [
          { 
            $match: { 
              clinic_id: clinicObjectId,
              is_active: true  // Only include active odontograms
            } 
          },
          {
            $group: {
              _id: null,
              total_patients: { $sum: 1 },
              total_planned_treatments: { $sum: { $ifNull: ['$treatment_summary.total_planned_treatments', 0] } },
              total_completed_treatments: { $sum: { $ifNull: ['$treatment_summary.completed_treatments', 0] } },
              total_in_progress_treatments: { $sum: { $ifNull: ['$treatment_summary.in_progress_treatments', 0] } },
              total_estimated_cost: { $sum: { $ifNull: ['$treatment_summary.estimated_total_cost', 0] } }
            }
          }
        ];

        const summary = await Odontogram.aggregate(pipeline);

        // Debug: Log the actual request details
        console.log('=== TREATMENT SUMMARY DEBUG ===');
        console.log('Original Clinic ID:', req.clinic_id);
        console.log('Converted Clinic ID:', clinicObjectId);
        console.log('Pipeline match condition:', JSON.stringify(pipeline[0].$match));
        console.log('Aggregation result:', JSON.stringify(summary));
        console.log('================================');

        let result = summary[0] || {
          total_patients: 0,
          total_planned_treatments: 0,
          total_completed_treatments: 0,
          total_in_progress_treatments: 0,
          total_estimated_cost: 0
        };



        // If no summary found, ensure all active odontograms have calculated summaries
        if (result.total_patients === 0) {
          const activeOdontograms = await Odontogram.find({ 
            clinic_id: req.clinic_id,
            is_active: true 
          });
          
          // Ensure all active odontograms have calculated treatment summaries
          let updated = false;
          for (const odontogram of activeOdontograms) {
            if (!odontogram.treatment_summary || 
                odontogram.treatment_summary.total_planned_treatments === undefined) {
              odontogram.calculateTreatmentSummary();
              await odontogram.save();
              updated = true;
            }
          }

          // Re-run the aggregation if we updated any summaries
          if (updated) {
            const updatedSummary = await Odontogram.aggregate(pipeline);
            result = updatedSummary[0] || result;
          }
        }

        result.total_pending_treatments = result.total_planned_treatments - 
                                         result.total_completed_treatments - 
                                         result.total_in_progress_treatments;
        
        result.completion_rate = result.total_planned_treatments > 0 
          ? Math.round((result.total_completed_treatments / result.total_planned_treatments) * 100)
          : 0;

        res.status(200).json({
          success: true,
          data: { clinic_summary: result }
        });
      }
    } catch (error) {
      console.error('Get treatment summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Recalculate treatment summaries for all odontograms
  static async recalculateTreatmentSummaries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const odontograms = await Odontogram.find({ clinic_id: req.clinic_id });
      
      let updated = 0;
      for (const odontogram of odontograms) {
        const oldSummary = JSON.stringify(odontogram.treatment_summary);
        odontogram.calculateTreatmentSummary();
        const newSummary = JSON.stringify(odontogram.treatment_summary);
        
        // Only save if summary changed
        if (oldSummary !== newSummary) {
          await odontogram.save();
          updated++;
        }
      }

      res.status(200).json({
        success: true,
        data: {
          message: `Recalculated treatment summaries for ${updated} odontograms`,
          total_processed: odontograms.length,
          updated_count: updated
        }
      });
    } catch (error) {
      console.error('Recalculate treatment summaries error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
