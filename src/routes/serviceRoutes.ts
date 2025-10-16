import { Router } from 'express';
import { body } from 'express-validator';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getServiceStats,
  toggleServiceStatus
} from '../controllers/serviceController';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Apply authentication middleware first, then clinic context to all routes
router.use(authenticate);
router.use(clinicContext);

// Validation rules for service creation/update
const serviceValidation = [
  body('name')
    .notEmpty()
    .withMessage('Service name is required')
    .isLength({ max: 200 })
    .withMessage('Service name must be less than 200 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isLength({ max: 100 })
    .withMessage('Category must be less than 100 characters'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('duration')
    .isInt({ min: 1, max: 1440 })
    .withMessage('Duration must be between 1 and 1440 minutes'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('department')
    .notEmpty()
    .withMessage('Department is required')
    .isLength({ max: 100 })
    .withMessage('Department must be less than 100 characters'),
  body('maxBookingsPerDay')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max bookings per day must be between 1 and 1000'),
  body('prerequisites')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Prerequisites must be less than 500 characters'),
  body('specialInstructions')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Special instructions must be less than 1000 characters'),
  body('followUpRequired')
    .optional()
    .isBoolean()
    .withMessage('Follow-up required must be a boolean'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean')
];

// Routes
router.get('/stats', getServiceStats);
router.get('/', getServices);
router.get('/:id', getServiceById);
router.post('/', serviceValidation, createService);
router.put('/:id', serviceValidation, updateService);
router.patch('/:id/toggle-status', toggleServiceStatus);
router.delete('/:id', deleteService);

export default router; 