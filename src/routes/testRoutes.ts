import { Router } from 'express';
import { body } from 'express-validator';
import { TestController } from '../controllers';
import { authenticate, requireMedicalStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware
const testValidation = [
  body('name').notEmpty().withMessage('Test name is required'),
  body('code').notEmpty().withMessage('Test code is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('turnaroundTime').notEmpty().withMessage('Turnaround time is required'),
  body('normalRange').optional().isLength({ max: 500 }).withMessage('Normal range cannot exceed 500 characters'),
  body('units').optional().isLength({ max: 50 }).withMessage('Units cannot exceed 50 characters'),
  body('methodology').optional().isLength({ max: 200 }).withMessage('Methodology cannot exceed 200 characters'),
  body('sampleType').optional().isLength({ max: 100 }).withMessage('Sample type cannot exceed 100 characters')
];

// Routes - All test operations require authentication and clinic context
router.post('/', authenticate, clinicContext, testValidation, TestController.createTest);
router.get('/', authenticate, clinicContext, TestController.getAllTests);
router.get('/stats', authenticate, clinicContext, TestController.getTestStats);
router.get('/:id', authenticate, clinicContext, TestController.getTestById);
router.put('/:id', authenticate, clinicContext, testValidation, TestController.updateTest);
router.patch('/:id/toggle', authenticate, clinicContext, TestController.toggleStatus);
router.delete('/:id', authenticate, clinicContext, ...requireMedicalStaff, TestController.deleteTest);

export default router; 