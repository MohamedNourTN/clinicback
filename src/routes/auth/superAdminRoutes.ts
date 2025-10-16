import { Router } from 'express';
import { body } from 'express-validator';
import { SuperAdminAuthController } from '../../controllers/auth/SuperAdminAuthController';
import { 
  requireSuperAdmin, 
  superAdminLoginRateLimit, 
  auditSuperAdminAction 
} from '../../middleware/superAdminAuth';

const router = Router();

// Validation middleware for super admin registration/creation
const superAdminCreateValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('first_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must not exceed 100 characters'),
  body('last_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required and must not exceed 100 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters')
];

// Validation middleware for super admin login
const superAdminLoginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Validation middleware for profile updates
const updateProfileValidation = [
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must not exceed 100 characters'),
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must not exceed 100 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  body('avatar')
    .optional()
    .trim()
    .isURL()
    .withMessage('Avatar must be a valid URL')
];

// Validation middleware for password change
const changePasswordValidation = [
  body('current_password')
    .notEmpty()
    .withMessage('Current password is required'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

// PUBLIC ROUTES

/**
 * @route POST /api/super-admin/auth/login
 * @desc Super Admin login
 * @access Public
 */
router.post(
  '/login',
  superAdminLoginRateLimit,
  superAdminLoginValidation,
  auditSuperAdminAction('LOGIN_ATTEMPT'),
  SuperAdminAuthController.login
);

// PROTECTED ROUTES (Require Super Admin Authentication)

/**
 * @route GET /api/super-admin/auth/profile
 * @desc Get current super admin profile
 * @access Private (Super Admin)
 */
router.get(
  '/profile',
  requireSuperAdmin,
  auditSuperAdminAction('GET_PROFILE'),
  SuperAdminAuthController.getProfile
);

/**
 * @route PUT /api/super-admin/auth/profile
 * @desc Update super admin profile
 * @access Private (Super Admin)
 */
router.put(
  '/profile',
  requireSuperAdmin,
  updateProfileValidation,
  auditSuperAdminAction('UPDATE_PROFILE'),
  SuperAdminAuthController.updateProfile
);

/**
 * @route PUT /api/super-admin/auth/change-password
 * @desc Change super admin password
 * @access Private (Super Admin)
 */
router.put(
  '/change-password',
  requireSuperAdmin,
  changePasswordValidation,
  auditSuperAdminAction('CHANGE_PASSWORD'),
  SuperAdminAuthController.changePassword
);

// SUPER ADMIN MANAGEMENT ROUTES

/**
 * @route GET /api/super-admin/auth/admins
 * @desc Get all super admins
 * @access Private (Super Admin)
 */
router.get(
  '/admins',
  requireSuperAdmin,
  auditSuperAdminAction('GET_ALL_SUPER_ADMINS'),
  SuperAdminAuthController.getAllSuperAdmins
);

/**
 * @route POST /api/super-admin/auth/admins
 * @desc Create new super admin
 * @access Private (Super Admin)
 */
router.post(
  '/admins',
  requireSuperAdmin,
  superAdminCreateValidation,
  auditSuperAdminAction('CREATE_SUPER_ADMIN'),
  SuperAdminAuthController.createSuperAdmin
);

/**
 * @route PUT /api/super-admin/auth/admins/:id/deactivate
 * @desc Deactivate super admin
 * @access Private (Super Admin)
 */
router.put(
  '/admins/:id/deactivate',
  requireSuperAdmin,
  auditSuperAdminAction('DEACTIVATE_SUPER_ADMIN'),
  SuperAdminAuthController.deactivateSuperAdmin
);

/**
 * @route PUT /api/super-admin/auth/admins/:id/activate
 * @desc Activate super admin
 * @access Private (Super Admin)
 */
router.put(
  '/admins/:id/activate',
  requireSuperAdmin,
  auditSuperAdminAction('ACTIVATE_SUPER_ADMIN'),
  SuperAdminAuthController.activateSuperAdmin
);

/**
 * @route PUT /api/super-admin/auth/admins/:id/unlock
 * @desc Unlock super admin account
 * @access Private (Super Admin)
 */
router.put(
  '/admins/:id/unlock',
  requireSuperAdmin,
  auditSuperAdminAction('UNLOCK_SUPER_ADMIN'),
  SuperAdminAuthController.unlockSuperAdmin
);

export default router;
