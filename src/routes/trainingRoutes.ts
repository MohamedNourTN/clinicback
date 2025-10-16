import { Router } from 'express';
import { body, param } from 'express-validator';
import { TrainingController } from '../controllers/trainingController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required for getting training content)
// Get all trainings or filter by role
router.get('/', TrainingController.getTrainings);

// Get training by role
router.get('/role/:role', [
  param('role').isIn(['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant']).withMessage('Invalid role')
], TrainingController.getTrainingByRole);

// Protected routes (authentication required)
// Get user's training progress
router.get('/progress', authenticate, TrainingController.getUserProgress);

// Start training for a user
router.post('/start', [
  authenticate,
  body('trainingId').notEmpty().withMessage('Training ID is required'),
  body('role').optional().isIn(['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant']).withMessage('Invalid role')
], TrainingController.startTraining);

// Update module progress
router.put('/progress/:progressId/module', [
  authenticate,
  param('progressId').isMongoId().withMessage('Invalid progress ID'),
  body('moduleId').notEmpty().withMessage('Module ID is required'),
  body('completed').isBoolean().withMessage('Completed must be a boolean'),
  body('lessonsCompleted').optional().isArray().withMessage('Lessons completed must be an array'),
  body('progressPercentage').optional().isNumeric().isFloat({ min: 0, max: 100 }).withMessage('Progress percentage must be between 0 and 100')
], TrainingController.updateModuleProgress);

// Complete training
router.put('/progress/:progressId/complete', [
  authenticate,
  param('progressId').isMongoId().withMessage('Invalid progress ID')
], TrainingController.completeTraining);

// Issue certificate
router.post('/progress/:progressId/certificate', [
  authenticate,
  param('progressId').isMongoId().withMessage('Invalid progress ID')
], TrainingController.issueCertificate);

// Admin routes
// Create or update training content
router.post('/admin/content', [
  authenticate,
  body('role').isIn(['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant']).withMessage('Invalid role'),
  body('name').notEmpty().withMessage('Training name is required'),
  body('description').notEmpty().withMessage('Training description is required'),
  body('overview').notEmpty().withMessage('Training overview is required'),
  body('modules').isArray({ min: 1 }).withMessage('At least one module is required'),
  body('modules.*.title').notEmpty().withMessage('Module title is required'),
  body('modules.*.duration').notEmpty().withMessage('Module duration is required'),
  body('modules.*.lessons').isArray({ min: 1 }).withMessage('At least one lesson is required per module'),
  body('modules.*.order').isNumeric().withMessage('Module order must be a number')
], TrainingController.createOrUpdateTraining);

// Get all users' training progress (admin only)
router.get('/admin/progress', authenticate, TrainingController.getAllTrainingProgress);

// Admin: Issue certificate for any user (admin only)
router.post('/admin/progress/:progressId/certificate', [
  authenticate,
  param('progressId').isMongoId().withMessage('Invalid progress ID')
], TrainingController.adminIssueCertificate);

// Get training analytics
router.get('/admin/analytics', authenticate, TrainingController.getTrainingAnalytics);

export default router; 