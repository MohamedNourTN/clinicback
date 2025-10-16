import { Router } from 'express';
import { body } from 'express-validator';
import { TestCategoryController } from '../controllers';
import { authenticate, requireMedicalStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware
const categoryValidation = [
  body('name').notEmpty().withMessage('Category name is required'),
  body('code').notEmpty().withMessage('Category code is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('color').matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Please provide a valid hex color'),
  body('icon').isIn(['beaker', 'test-tube', 'heart', 'zap', 'microscope', 'folder']).withMessage('Invalid icon type'),
  body('testCount').optional().isInt({ min: 0 }).withMessage('Test count must be a non-negative integer'),
  body('commonTests').optional().isArray().withMessage('Common tests must be an array'),
  body('sortOrder').optional().isInt().withMessage('Sort order must be an integer')
];

// Routes - All test category operations require authentication and clinic context
router.post('/', authenticate, clinicContext, categoryValidation, TestCategoryController.createCategory);
router.get('/', authenticate, clinicContext, TestCategoryController.getAllCategories);
router.get('/stats', authenticate, clinicContext, TestCategoryController.getCategoryStats);
router.get('/:id', authenticate, clinicContext, TestCategoryController.getCategoryById);
router.put('/:id', authenticate, clinicContext, categoryValidation, TestCategoryController.updateCategory);
router.patch('/:id/toggle', authenticate, clinicContext, TestCategoryController.toggleStatus);
router.delete('/:id', authenticate, clinicContext, ...requireMedicalStaff, TestCategoryController.deleteCategory);

export default router; 