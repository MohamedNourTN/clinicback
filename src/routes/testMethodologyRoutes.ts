import { Router } from 'express';
import { body } from 'express-validator';
import { TestMethodologyController } from '../controllers';
import { authenticate, requireMedicalStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware
const methodologyValidation = [
  body('name').notEmpty().withMessage('Methodology name is required'),
  body('code').notEmpty().withMessage('Methodology code is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('equipment').notEmpty().withMessage('Equipment information is required'),
  body('principles').notEmpty().withMessage('Principles are required'),
  body('advantages').notEmpty().withMessage('Advantages are required'),
  body('limitations').notEmpty().withMessage('Limitations are required'),
  body('applications').isArray({ min: 1 }).withMessage('At least one application is required'),
  body('applications.*').notEmpty().withMessage('Application cannot be empty')
];

// Routes - All test methodology operations require authentication and clinic context
router.post('/', authenticate, clinicContext, methodologyValidation, TestMethodologyController.createMethodology);
router.get('/', authenticate, clinicContext, TestMethodologyController.getAllMethodologies);
router.get('/stats', authenticate, clinicContext, TestMethodologyController.getMethodologyStats);
router.get('/:id', authenticate, clinicContext, TestMethodologyController.getMethodologyById);
router.put('/:id', authenticate, clinicContext, methodologyValidation, TestMethodologyController.updateMethodology);
router.patch('/:id/toggle', authenticate, clinicContext, TestMethodologyController.toggleStatus);
router.delete('/:id', authenticate, clinicContext, ...requireMedicalStaff, TestMethodologyController.deleteMethodology);

export default router; 