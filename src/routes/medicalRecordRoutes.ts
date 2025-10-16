import { Router } from 'express';
import { body } from 'express-validator';
import { MedicalRecordController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware
const medicalRecordValidation = [
  body('patient_id').isMongoId().withMessage('Valid patient ID is required'),
  body('doctor_id').isMongoId().withMessage('Valid doctor ID is required'),
  body('visit_date').optional().isISO8601().withMessage('Please provide a valid visit date'),
  body('chief_complaint').notEmpty().withMessage('Chief complaint is required'),
  body('diagnosis').notEmpty().withMessage('Diagnosis is required'),
  body('treatment').notEmpty().withMessage('Treatment is required'),
  body('vital_signs.temperature').optional().isFloat({ min: 30, max: 50 }).withMessage('Temperature must be between 30-50°C'),
  body('vital_signs.blood_pressure.systolic').optional().isInt({ min: 60, max: 300 }).withMessage('Systolic pressure must be between 60-300 mmHg'),
  body('vital_signs.blood_pressure.diastolic').optional().isInt({ min: 30, max: 200 }).withMessage('Diastolic pressure must be between 30-200 mmHg'),
  body('vital_signs.heart_rate').optional().isInt({ min: 30, max: 250 }).withMessage('Heart rate must be between 30-250 bpm'),
  body('vital_signs.respiratory_rate').optional().isInt({ min: 5, max: 60 }).withMessage('Respiratory rate must be between 5-60 breaths/min'),
  body('vital_signs.oxygen_saturation').optional().isInt({ min: 70, max: 100 }).withMessage('Oxygen saturation must be between 70-100%'),
  body('vital_signs.weight').optional().isFloat({ min: 1, max: 500 }).withMessage('Weight must be between 1-500 kg'),
  body('vital_signs.height').optional().isFloat({ min: 30, max: 250 }).withMessage('Height must be between 30-250 cm')
];

// Routes - All routes require authentication and clinic context
router.post('/', authenticate, clinicContext, medicalRecordValidation, MedicalRecordController.createMedicalRecord);
router.get('/patient/:patientId', authenticate, clinicContext, MedicalRecordController.getMedicalRecordsByPatient);
router.get('/patient/:patientId/history', authenticate, clinicContext, MedicalRecordController.getPatientHistory);
router.get('/:id', authenticate, clinicContext, MedicalRecordController.getMedicalRecordById);
router.put('/:id', authenticate, clinicContext, medicalRecordValidation, MedicalRecordController.updateMedicalRecord);
router.delete('/:id', authenticate, clinicContext, MedicalRecordController.deleteMedicalRecord);

export default router; 