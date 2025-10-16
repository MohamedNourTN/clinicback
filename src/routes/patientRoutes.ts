import { Router } from 'express';
import { body } from 'express-validator';
import { PatientController } from '../controllers';
import { authenticate, requireMedicalStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware
const patientValidation = [
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('date_of_birth').isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('address').notEmpty().withMessage('Address is required'),
  body('emergency_contact.name').optional().isString().withMessage('Emergency contact name must be a string'),
  body('emergency_contact.relationship').optional().isString().withMessage('Emergency contact relationship must be a string'),
  body('emergency_contact.phone').optional().isString().withMessage('Emergency contact phone must be a string'),
  body('emergency_contact.email').optional().isEmail().withMessage('Please provide a valid emergency contact email'),
  body('insurance_info.provider').optional().isString().withMessage('Insurance provider must be a string'),
  body('insurance_info.policy_number').optional().isString().withMessage('Policy number must be a string'),
  body('insurance_info.group_number').optional().isString().withMessage('Group number must be a string'),
  body('insurance_info.expiry_date').optional().isISO8601().withMessage('Please provide a valid expiry date')
];

// Routes - All routes require authentication and clinic context
router.post('/', authenticate, clinicContext, patientValidation, PatientController.createPatient);
router.get('/', authenticate, clinicContext, PatientController.getAllPatients);
router.get('/stats', authenticate, clinicContext, PatientController.getPatientStats);
router.get('/:id', authenticate, clinicContext, PatientController.getPatientById);
router.put('/:id', authenticate, clinicContext, patientValidation, PatientController.updatePatient);
router.delete('/:id', authenticate, clinicContext, PatientController.deletePatient);

export default router; 