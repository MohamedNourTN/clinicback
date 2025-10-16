import { Router } from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers';
import { s3AvatarUpload } from '../utils/s3';
import { CurrencyUtils } from '../utils/currency';
import { authenticate, requireAdmin, requireMedicalStaff, requireAllRoles } from '../middleware/auth';

const router = Router();

// Validation middleware
const updateProfileValidation = [
  body('first_name').optional().notEmpty().withMessage('First name cannot be empty').isLength({ max: 100 }).withMessage('First name cannot exceed 100 characters'),
  body('last_name').optional().notEmpty().withMessage('Last name cannot be empty').isLength({ max: 100 }).withMessage('Last name cannot exceed 100 characters'),
  body('phone').optional().notEmpty().withMessage('Phone cannot be empty').isLength({ max: 20 }).withMessage('Phone cannot exceed 20 characters'),
  body('base_currency').optional().isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED', 'SAR', 'NGN', 'VND', 'DOP']).withMessage('Invalid currency code'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
  body('bio').optional().isLength({ max: 1000 }).withMessage('Bio cannot exceed 1000 characters'),
  body('date_of_birth').optional().isDate().withMessage('Invalid date format'),
  body('specialization').optional().isLength({ max: 200 }).withMessage('Specialization cannot exceed 200 characters'),
  body('license_number').optional().isLength({ max: 100 }).withMessage('License number cannot exceed 100 characters'),
  body('department').optional().isLength({ max: 100 }).withMessage('Department cannot exceed 100 characters')
];

const changePasswordValidation = [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const adminChangePasswordValidation = [
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const updateScheduleValidation = [
  body('schedule').isObject().withMessage('Schedule must be an object'),
  body('schedule.monday').isObject().withMessage('Monday schedule is required'),
  body('schedule.tuesday').isObject().withMessage('Tuesday schedule is required'),
  body('schedule.wednesday').isObject().withMessage('Wednesday schedule is required'),
  body('schedule.thursday').isObject().withMessage('Thursday schedule is required'),
  body('schedule.friday').isObject().withMessage('Friday schedule is required'),
  body('schedule.saturday').isObject().withMessage('Saturday schedule is required'),
  body('schedule.sunday').isObject().withMessage('Sunday schedule is required'),
  // Validate each day has required fields
  body('schedule.*.start').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format'),
  body('schedule.*.end').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format'),
  body('schedule.*.isWorking').isBoolean().withMessage('isWorking must be a boolean'),
];

// Profile routes (require authentication middleware)
router.get('/profile', authenticate, UserController.getProfile);
router.put('/profile', authenticate, updateProfileValidation, UserController.updateProfile);
router.put('/change-password', authenticate, changePasswordValidation, UserController.changePassword);

// Avatar routes
router.post('/avatar', authenticate, s3AvatarUpload.single('avatar'), UserController.uploadAvatar);
router.delete('/avatar', authenticate, UserController.removeAvatar);

// Schedule routes
router.put('/:id/schedule', authenticate, updateScheduleValidation, UserController.updateUserSchedule);

// Currency routes
router.get('/currencies', (req, res) => {
  res.json({
    success: true,
    data: {
      currencies: CurrencyUtils.getAllCurrencies()
    }
  });
});

// Doctor routes (accessible by medical staff for appointments)
router.get('/doctors', requireMedicalStaff, UserController.getDoctors);

// Nurse routes (accessible by medical staff for appointments)
router.get('/nurses', requireMedicalStaff, UserController.getNurses);

// Public routes (no authentication required)
router.get('/demo', UserController.getDemoUsers);

// Admin routes (require admin authorization middleware)
router.get('/all', requireAdmin, UserController.getAllUsersForAdmin);
router.get('/', requireAllRoles, UserController.getAllUsers);
router.get('/:id', requireAdmin, UserController.getUserById);
router.put('/:id', requireAdmin, UserController.updateUser);
router.patch('/:id/deactivate', requireAdmin, UserController.deactivateUser);
router.patch('/:id/activate', requireAdmin, UserController.activateUser);
router.put('/:id/password', requireAdmin, adminChangePasswordValidation, UserController.adminChangeUserPassword);

export default router; 