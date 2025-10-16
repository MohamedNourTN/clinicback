import { Router } from 'express';
import { body } from 'express-validator';
import { PrescriptionController } from '../controllers';
import { authenticate, requireMedicalStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware for medication
const medicationValidation = [
  body('name').notEmpty().withMessage('Medication name is required'),
  body('dosage').notEmpty().withMessage('Dosage is required'),
  body('frequency').notEmpty().withMessage('Frequency is required'),
  body('duration').notEmpty().withMessage('Duration is required'),
  body('instructions').notEmpty().withMessage('Instructions are required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer')
];

// Validation middleware for prescription
const prescriptionValidation = [
  body('patient_id').isMongoId().withMessage('Valid patient ID is required'),
  body('doctor_id').isMongoId().withMessage('Valid doctor ID is required'),
  body('appointment_id').optional().isMongoId().withMessage('Valid appointment ID is required'),
  body('diagnosis').notEmpty().withMessage('Diagnosis is required'),
  body('medications').isArray({ min: 1 }).withMessage('At least one medication is required'),
  body('medications.*.name').notEmpty().withMessage('Medication name is required'),
  body('medications.*.dosage').notEmpty().withMessage('Dosage is required'),
  body('medications.*.frequency').notEmpty().withMessage('Frequency is required'),
  body('medications.*.duration').notEmpty().withMessage('Duration is required'),
  body('medications.*.instructions').notEmpty().withMessage('Instructions are required'),
  body('medications.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('status').optional().isIn(['active', 'completed', 'pending', 'cancelled', 'expired']).withMessage('Invalid status'),
  body('follow_up_date').optional().isISO8601().withMessage('Please provide a valid follow-up date'),
  body('pharmacy_dispensed').optional().isBoolean().withMessage('Pharmacy dispensed must be a boolean'),
  body('dispensed_date').optional().isISO8601().withMessage('Please provide a valid dispensed date')
];

// Status update validation
const statusValidation = [
  body('status').isIn(['active', 'completed', 'pending', 'cancelled', 'expired']).withMessage('Invalid status')
];

// Routes - All prescription operations require authentication and clinic context
router.post('/', authenticate, clinicContext, prescriptionValidation, PrescriptionController.createPrescription);
router.get('/', authenticate, clinicContext, PrescriptionController.getAllPrescriptions);
router.get('/stats', authenticate, clinicContext, PrescriptionController.getPrescriptionStats);
router.get('/patient/:patientId', authenticate, clinicContext, PrescriptionController.getPrescriptionsByPatient);
router.get('/doctor/:doctorId', authenticate, clinicContext, PrescriptionController.getPrescriptionsByDoctor);
router.get('/:id', authenticate, clinicContext, PrescriptionController.getPrescriptionById);
router.put('/:id', authenticate, clinicContext, prescriptionValidation, PrescriptionController.updatePrescription);
router.patch('/:id/status', authenticate, clinicContext, statusValidation, PrescriptionController.updatePrescriptionStatus);
router.patch('/:id/send-to-pharmacy', authenticate, clinicContext, PrescriptionController.sendToPharmacy);
router.delete('/:id', authenticate, clinicContext, PrescriptionController.deletePrescription);

export default router; 