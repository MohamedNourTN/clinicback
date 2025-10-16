import { Router } from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers';

const router = Router();

// Validation middleware
const registerValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'staff']).withMessage('Invalid role'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('clinic_id').notEmpty().withMessage('Clinic ID is required').isMongoId().withMessage('Invalid clinic ID format')
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Authentication routes
router.post('/register', registerValidation, UserController.register);
router.post('/login', loginValidation, UserController.login);

export default router; 