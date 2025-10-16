import { Router } from 'express';
import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import { OdontogramController } from '../controllers';
import { authenticate, requireMedicalStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware for odontogram creation/update
const odontogramValidation = [
  body('examination_date').optional().isISO8601().withMessage('Please provide a valid examination date'),
  body('numbering_system').optional().isIn(['universal', 'palmer', 'fdi']).withMessage('Invalid numbering system'),
  body('patient_type').optional().isIn(['adult', 'child']).withMessage('Invalid patient type'),
  body('general_notes').optional().isString().isLength({ max: 5000 }).withMessage('General notes cannot exceed 5000 characters'),
  
  // Periodontal assessment validation
  body('periodontal_assessment.bleeding_on_probing').optional().isBoolean().withMessage('Bleeding on probing must be a boolean'),
  body('periodontal_assessment.plaque_index').optional().isFloat({ min: 0, max: 3 }).withMessage('Plaque index must be between 0-3'),
  body('periodontal_assessment.gingival_index').optional().isFloat({ min: 0, max: 3 }).withMessage('Gingival index must be between 0-3'),
  body('periodontal_assessment.calculus_present').optional().isBoolean().withMessage('Calculus present must be a boolean'),
  body('periodontal_assessment.general_notes').optional().isString().isLength({ max: 1000 }).withMessage('Periodontal notes cannot exceed 1000 characters'),
  
  // Teeth conditions validation
  body('teeth_conditions').optional().isArray().withMessage('Teeth conditions must be an array'),
  body('teeth_conditions.*.tooth_number').if(body('teeth_conditions').exists()).isInt({ min: 1, max: 85 }).withMessage('Invalid tooth number'),
  body('teeth_conditions.*.tooth_name').optional().isString().withMessage('Tooth name must be a string'),
  body('teeth_conditions.*.overall_condition').if(body('teeth_conditions').exists()).isIn([
    'healthy', 'caries', 'filling', 'crown', 'bridge', 'implant', 
    'extraction', 'root_canal', 'missing', 'fractured', 'wear', 
    'restoration_needed', 'sealant', 'veneer', 'temporary_filling', 
    'periapical_lesion'
  ]).withMessage('Invalid overall condition'),
  body('teeth_conditions.*.mobility').optional().isFloat({ min: 0, max: 3 }).withMessage('Mobility must be between 0-3'),
  body('teeth_conditions.*.notes').optional().isString().isLength({ max: 2000 }).withMessage('Tooth notes cannot exceed 2000 characters'),
  
  // Surface conditions validation
  body('teeth_conditions.*.surfaces').optional().isArray().withMessage('Surfaces must be an array'),
  body('teeth_conditions.*.surfaces.*.surface').if(body('teeth_conditions.*.surfaces').exists()).isIn([
    'mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'incisal'
  ]).withMessage('Invalid surface type'),
  body('teeth_conditions.*.surfaces.*.condition').if(body('teeth_conditions.*.surfaces').exists()).isIn([
    'healthy', 'caries', 'filling', 'crown', 'bridge', 'implant', 
    'extraction', 'root_canal', 'missing', 'fractured', 'wear', 
    'restoration_needed', 'sealant', 'veneer', 'temporary_filling', 
    'periapical_lesion'
  ]).withMessage('Invalid surface condition'),
  body('teeth_conditions.*.surfaces.*.severity').optional().isIn(['mild', 'moderate', 'severe']).withMessage('Invalid severity'),
  body('teeth_conditions.*.surfaces.*.notes').optional().isString().isLength({ max: 500 }).withMessage('Surface notes cannot exceed 500 characters'),
  body('teeth_conditions.*.surfaces.*.color_code').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color code format'),
  
  // Treatment plan validation
  body('teeth_conditions.*.treatment_plan.planned_treatment').optional().isString().isLength({ max: 1000 }).withMessage('Planned treatment cannot exceed 1000 characters'),
  body('teeth_conditions.*.treatment_plan.priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid treatment priority'),
  body('teeth_conditions.*.treatment_plan.estimated_cost').optional().isFloat({ min: 0 }).withMessage('Estimated cost must be positive'),
  body('teeth_conditions.*.treatment_plan.estimated_duration').optional().isString().withMessage('Estimated duration must be a string'),
  body('teeth_conditions.*.treatment_plan.status').optional().isIn(['planned', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid treatment status'),
  body('teeth_conditions.*.treatment_plan.planned_date').optional().isISO8601().withMessage('Please provide a valid planned date'),
  body('teeth_conditions.*.treatment_plan.completed_date').optional().isISO8601().withMessage('Please provide a valid completed date'),
  body('teeth_conditions.*.treatment_plan.notes').optional().isString().isLength({ max: 1000 }).withMessage('Treatment notes cannot exceed 1000 characters'),
  
  // Periodontal pocket depth validation
  body('teeth_conditions.*.periodontal_pocket_depth.mesial').optional().isFloat({ min: 0, max: 20 }).withMessage('Mesial pocket depth must be between 0-20'),
  body('teeth_conditions.*.periodontal_pocket_depth.distal').optional().isFloat({ min: 0, max: 20 }).withMessage('Distal pocket depth must be between 0-20'),
  body('teeth_conditions.*.periodontal_pocket_depth.buccal').optional().isFloat({ min: 0, max: 20 }).withMessage('Buccal pocket depth must be between 0-20'),
  body('teeth_conditions.*.periodontal_pocket_depth.lingual').optional().isFloat({ min: 0, max: 20 }).withMessage('Lingual pocket depth must be between 0-20'),
  
  // Attachments validation
  body('teeth_conditions.*.attachments').optional().isArray().withMessage('Attachments must be an array'),
  body('teeth_conditions.*.attachments.*.file_name').if(body('teeth_conditions.*.attachments').exists()).notEmpty().withMessage('File name is required'),
  body('teeth_conditions.*.attachments.*.file_url').if(body('teeth_conditions.*.attachments').exists()).notEmpty().withMessage('File URL is required'),
  body('teeth_conditions.*.attachments.*.file_type').if(body('teeth_conditions.*.attachments').exists()).isIn(['image', 'xray', 'document']).withMessage('Invalid file type'),
  body('teeth_conditions.*.attachments.*.description').optional().isString().isLength({ max: 500 }).withMessage('Attachment description cannot exceed 500 characters')
];

// Validation middleware for tooth condition update
const toothConditionValidation = [
  param('tooth_number').isInt({ min: 1, max: 85 }).withMessage('Invalid tooth number'),
  body('tooth_name').optional().isString().withMessage('Tooth name must be a string'),
  body('overall_condition').optional().isIn([
    'healthy', 'caries', 'filling', 'crown', 'bridge', 'implant', 
    'extraction', 'root_canal', 'missing', 'fractured', 'wear', 
    'restoration_needed', 'sealant', 'veneer', 'temporary_filling', 
    'periapical_lesion'
  ]).withMessage('Invalid overall condition'),
  body('mobility').optional().isFloat({ min: 0, max: 3 }).withMessage('Mobility must be between 0-3'),
  body('notes').optional().isString().isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),
  
  // Surface conditions validation
  body('surfaces').optional().isArray().withMessage('Surfaces must be an array'),
  body('surfaces.*.surface').if(body('surfaces').exists()).isIn([
    'mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'incisal'
  ]).withMessage('Invalid surface type'),
  body('surfaces.*.condition').if(body('surfaces').exists()).isIn([
    'healthy', 'caries', 'filling', 'crown', 'bridge', 'implant', 
    'extraction', 'root_canal', 'missing', 'fractured', 'wear', 
    'restoration_needed', 'sealant', 'veneer', 'temporary_filling', 
    'periapical_lesion'
  ]).withMessage('Invalid surface condition'),
  body('surfaces.*.severity').optional().isIn(['mild', 'moderate', 'severe']).withMessage('Invalid severity'),
  body('surfaces.*.notes').optional().isString().isLength({ max: 500 }).withMessage('Surface notes cannot exceed 500 characters'),
  body('surfaces.*.color_code').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color code format'),
  
  // Treatment plan validation
  body('treatment_plan.planned_treatment').optional().isString().isLength({ max: 1000 }).withMessage('Planned treatment cannot exceed 1000 characters'),
  body('treatment_plan.priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid treatment priority'),
  body('treatment_plan.estimated_cost').optional().isFloat({ min: 0 }).withMessage('Estimated cost must be positive'),
  body('treatment_plan.estimated_duration').optional().isString().withMessage('Estimated duration must be a string'),
  body('treatment_plan.status').optional().isIn(['planned', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid treatment status'),
  body('treatment_plan.planned_date').optional().isISO8601().withMessage('Please provide a valid planned date'),
  body('treatment_plan.completed_date').optional().isISO8601().withMessage('Please provide a valid completed date'),
  body('treatment_plan.notes').optional().isString().isLength({ max: 1000 }).withMessage('Treatment notes cannot exceed 1000 characters'),
  
  // Periodontal pocket depth validation
  body('periodontal_pocket_depth.mesial').optional().isFloat({ min: 0, max: 20 }).withMessage('Mesial pocket depth must be between 0-20'),
  body('periodontal_pocket_depth.distal').optional().isFloat({ min: 0, max: 20 }).withMessage('Distal pocket depth must be between 0-20'),
  body('periodontal_pocket_depth.buccal').optional().isFloat({ min: 0, max: 20 }).withMessage('Buccal pocket depth must be between 0-20'),
  body('periodontal_pocket_depth.lingual').optional().isFloat({ min: 0, max: 20 }).withMessage('Lingual pocket depth must be between 0-20'),
  
  // Attachments validation
  body('attachments').optional().isArray().withMessage('Attachments must be an array'),
  body('attachments.*.file_name').if(body('attachments').exists()).notEmpty().withMessage('File name is required'),
  body('attachments.*.file_url').if(body('attachments').exists()).notEmpty().withMessage('File URL is required'),
  body('attachments.*.file_type').if(body('attachments').exists()).isIn(['image', 'xray', 'document']).withMessage('Invalid file type'),
  body('attachments.*.description').optional().isString().isLength({ max: 500 }).withMessage('Attachment description cannot exceed 500 characters')
];

// Parameter validation
const idValidation = [
  param('id').isMongoId().withMessage('Invalid odontogram ID')
];

const patientIdValidation = [
  param('patient_id').isMongoId().withMessage('Invalid patient ID')
];

// Query validation for filtering
const queryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('patient_id').optional().isMongoId().withMessage('Invalid patient ID'),
  query('doctor_id').optional().isMongoId().withMessage('Invalid doctor ID'),
  query('active_only').optional().isBoolean().withMessage('Active only must be a boolean'),
  query('start_date').optional().isISO8601().withMessage('Please provide a valid start date'),
  query('end_date').optional().isISO8601().withMessage('Please provide a valid end date')
];

// Routes - All routes require authentication, clinic context, and medical staff privileges

// Create new odontogram for a patient
router.post(
  '/patient/:patient_id',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  patientIdValidation,
  odontogramValidation,
  OdontogramController.createOdontogram
);

// Get all odontograms with filtering
router.get(
  '/',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  queryValidation,
  OdontogramController.getAllOdontograms
);

// Get specific odontogram by ID
router.get(
  '/:id',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  idValidation,
  OdontogramController.getOdontogramById
);

// Get active odontogram for a patient
router.get(
  '/patient/:patient_id/active',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  patientIdValidation,
  OdontogramController.getActiveOdontogramByPatient
);

// Get odontogram history for a patient
router.get(
  '/patient/:patient_id/history',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  patientIdValidation,
  queryValidation,
  OdontogramController.getOdontogramHistory
);

// Get treatment summary (clinic-wide or for specific patient)
router.get(
  '/summary/treatment',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  OdontogramController.getTreatmentSummary
);

// Get treatment summary for specific patient
router.get(
  '/patient/:patient_id/summary',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  patientIdValidation,
  OdontogramController.getTreatmentSummary
);

// Update odontogram
router.put(
  '/:id',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  idValidation,
  odontogramValidation,
  OdontogramController.updateOdontogram
);

// Update specific tooth condition
router.put(
  '/:id/tooth/:tooth_number',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  idValidation,
  toothConditionValidation,
  OdontogramController.updateToothCondition
);

// Set odontogram as active
router.patch(
  '/:id/activate',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  idValidation,
  OdontogramController.setActiveOdontogram
);

// Delete odontogram
router.delete(
  '/:id',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  idValidation,
  OdontogramController.deleteOdontogram
);

// Recalculate treatment summaries (admin utility)
router.post(
  '/admin/recalculate-summaries',
  authenticate,
  clinicContext,
  requireMedicalStaff,
  OdontogramController.recalculateTreatmentSummaries
);





export default router;
