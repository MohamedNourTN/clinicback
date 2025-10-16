import { Router } from 'express';
import { body } from 'express-validator';
import { SuperAdminUserController } from '../../controllers/super-admin/SuperAdminUserController';
import { authenticateSuperAdmin } from '../../middleware/superAdminAuth';

const router = Router();

// Apply super admin authentication to all routes
router.use(authenticateSuperAdmin);

// Validation rules
const createUserValidation = [
  body('first_name')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('last_name')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('tenant_id')
    .notEmpty()
    .withMessage('Tenant ID is required')
    .isMongoId()
    .withMessage('Invalid tenant ID format'),
  
  body('role')
    .isIn(['super_admin', 'admin'])
    .withMessage('Role must be either super_admin or admin'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean'),
  
];

const updateUserValidation = [
  body('first_name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('last_name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('tenant_id')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenant ID format'),
  
  body('role')
    .optional()
    .isIn(['super_admin', 'admin'])
    .withMessage('Role must be either super_admin or admin'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean'),
  
];

/**
 * @route GET /api/super-admin/users/stats
 * @desc Get user statistics
 * @access Super Admin
 */
router.get('/stats', SuperAdminUserController.getUserStats);

/**
 * @route GET /api/super-admin/users
 * @desc Get all admin users
 * @access Super Admin
 */
router.get('/', SuperAdminUserController.getAllUsers);

/**
 * @route POST /api/super-admin/users
 * @desc Create a new admin user
 * @access Super Admin
 */
router.post('/', createUserValidation, SuperAdminUserController.createUser);

/**
 * @route GET /api/super-admin/users/:id
 * @desc Get user by ID
 * @access Super Admin
 */
router.get('/:id', SuperAdminUserController.getUserById);

/**
 * @route PUT /api/super-admin/users/:id
 * @desc Update user
 * @access Super Admin
 */
router.put('/:id', updateUserValidation, SuperAdminUserController.updateUser);

/**
 * @route DELETE /api/super-admin/users/:id
 * @desc Delete user
 * @access Super Admin
 */
router.delete('/:id', SuperAdminUserController.deleteUser);

/**
 * @route PATCH /api/super-admin/users/:id/toggle-status
 * @desc Toggle user active status
 * @access Super Admin
 */
router.patch('/:id/toggle-status', SuperAdminUserController.toggleUserStatus);

/**
 * @route PATCH /api/super-admin/users/:id/reset-password
 * @desc Reset user password to default
 * @access Super Admin
 */
router.patch('/:id/reset-password', SuperAdminUserController.resetUserPassword);

export default router;
