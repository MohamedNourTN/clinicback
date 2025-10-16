import { Router } from 'express';
import { body } from 'express-validator';
import { TurnaroundTimeController } from '../controllers';
import { authenticate, requireMedicalStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware
const turnaroundTimeValidation = [
  body('name').notEmpty().withMessage('Turnaround time name is required'),
  body('code').notEmpty().withMessage('Turnaround time code is required'),
  body('duration').notEmpty().withMessage('Duration is required'),
  body('durationMinutes').isInt({ min: 1 }).withMessage('Duration in minutes must be at least 1'),
  body('priority').isIn(['stat', 'urgent', 'routine', 'extended']).withMessage('Invalid priority level'),
  body('category').notEmpty().withMessage('Category is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('examples').isArray({ min: 1 }).withMessage('At least one example is required'),
  body('examples.*').notEmpty().withMessage('Example cannot be empty')
];

// Routes - All turnaround time operations require authentication and clinic context
router.post('/', authenticate, clinicContext, turnaroundTimeValidation, TurnaroundTimeController.createTurnaroundTime);
router.get('/', authenticate, clinicContext, TurnaroundTimeController.getAllTurnaroundTimes);
router.get('/stats', authenticate, clinicContext, TurnaroundTimeController.getTurnaroundTimeStats);
router.get('/:id', authenticate, clinicContext, TurnaroundTimeController.getTurnaroundTimeById);
router.put('/:id', authenticate, clinicContext, turnaroundTimeValidation, TurnaroundTimeController.updateTurnaroundTime);
router.patch('/:id/toggle', authenticate, clinicContext, TurnaroundTimeController.toggleStatus);
router.delete('/:id', authenticate, clinicContext, ...requireMedicalStaff, TurnaroundTimeController.deleteTurnaroundTime);

export default router; 