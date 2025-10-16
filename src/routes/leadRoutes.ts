import { Router } from 'express';
import { body } from 'express-validator';
import { LeadController } from '../controllers';
import { authenticate, requireStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware for creating/updating leads
const leadValidation = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('source').isIn(['website', 'referral', 'social', 'advertisement', 'walk-in'])
    .withMessage('Invalid source. Must be one of: website, referral, social, advertisement, walk-in'),
  body('serviceInterest').notEmpty().withMessage('Service interest is required'),
  body('status').optional().isIn(['new', 'contacted', 'converted', 'lost'])
    .withMessage('Invalid status. Must be one of: new, contacted, converted, lost'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('assignedTo').optional().isString().withMessage('Assigned to must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string')
];

// Validation for lead to patient conversion
const conversionValidation = [
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('date_of_birth').isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('address').notEmpty().withMessage('Address is required'),
  body('emergency_contact.name').optional().isString().withMessage('Emergency contact name must be a string'),
  body('emergency_contact.relationship').optional().isString().withMessage('Emergency contact relationship must be a string'),
  body('emergency_contact.phone').optional().isString().withMessage('Emergency contact phone must be a string'),
  body('emergency_contact.email').optional().isEmail().withMessage('Please provide a valid emergency contact email'),
  body('insurance_info.provider').optional().isString().withMessage('Insurance provider must be a string'),
  body('insurance_info.policy_number').optional().isString().withMessage('Policy number must be a string'),
  body('insurance_info.group_number').optional().isString().withMessage('Group number must be a string')
];

// Basic CRUD routes (require authentication and clinic context)
router.post('/', authenticate, clinicContext, leadValidation, LeadController.createLead);
router.get('/', authenticate, clinicContext, LeadController.getAllLeads);
router.get('/stats', authenticate, clinicContext, LeadController.getLeadStats);
router.get('/assignee/:assignee', authenticate, clinicContext, LeadController.getLeadsByAssignee);
router.get('/:id', authenticate, clinicContext, LeadController.getLeadById);
router.put('/:id', authenticate, clinicContext, leadValidation, LeadController.updateLead);
router.delete('/:id', authenticate, clinicContext, ...requireStaff, LeadController.deleteLead);

// Special endpoints
router.patch('/:id/status', authenticate, clinicContext, LeadController.updateLeadStatus);
router.post('/:id/convert', authenticate, clinicContext, conversionValidation, LeadController.convertLeadToPatient);

export default router; 