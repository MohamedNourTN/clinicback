import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { ClinicController } from '../controllers/clinicController';
import { authenticate } from '../middleware/auth';
import { clinicContext, optionalClinicContext } from '../middleware/clinicContext';

const router = Router();

/**
 * Validation middleware for clinic creation
 */
const createClinicValidation = [
  body('name')
    .notEmpty()
    .withMessage('Clinic name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Clinic name must be between 2 and 200 characters'),
  
  body('code')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Clinic code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Clinic code must contain only uppercase letters and numbers'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  // Address validation
  body('address.street')
    .notEmpty()
    .withMessage('Street address is required')
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters'),
  
  body('address.city')
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  
  body('address.state')
    .notEmpty()
    .withMessage('State is required')
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters'),
  
  body('address.zipCode')
    .notEmpty()
    .withMessage('Zip code is required')
    .isLength({ max: 20 })
    .withMessage('Zip code cannot exceed 20 characters'),
  
  body('address.country')
    .notEmpty()
    .withMessage('Country is required')
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),

  // Contact validation
  body('contact.phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  
  body('contact.email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('contact.website')
    .optional()
    .isURL()
    .withMessage('Valid website URL is required'),

  // Settings validation
  body('settings.timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  
  body('settings.currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED', 'SAR', 'NGN', 'VND'])
    .withMessage('Invalid currency'),
  
  body('settings.language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'hi', 'zh', 'ja'])
    .withMessage('Invalid language')
];

/**
 * Validation middleware for clinic updates
 */
const updateClinicValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid clinic ID'),
  
  body('name')
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage('Clinic name must be between 2 and 200 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  // Address validation (optional for updates)
  body('address.street')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters'),
  
  body('address.city')
    .optional()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  
  body('address.state')
    .optional()
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters'),
  
  body('address.zipCode')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Zip code cannot exceed 20 characters'),
  
  body('address.country')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),

  // Contact validation (optional for updates)
  body('contact.phone')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('contact.website')
    .optional()
    .isURL()
    .withMessage('Valid website URL is required'),

  // Settings validation (optional for updates)
  body('settings.timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  
  body('settings.currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED', 'SAR', 'NGN', 'VND'])
    .withMessage('Invalid currency'),
  
  body('settings.language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'hi', 'zh', 'ja'])
    .withMessage('Invalid language')
];

/**
 * Validation middleware for user-clinic operations
 */
const userClinicValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid clinic ID'),
  
  body('user_id')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  
  body('role')
    .isIn(['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'staff'])
    .withMessage('Invalid role'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
];

/**
 * Validation middleware for updating user in clinic
 */
const updateUserClinicValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid clinic ID'),
  
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  
  body('role')
    .optional()
    .isIn(['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'staff'])
    .withMessage('Invalid role'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
];

/**
 * Parameter validation middleware
 */
const paramValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid clinic ID')
];

const userParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid clinic ID'),
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID')
];

/**
 * Query validation for pagination
 */
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('role')
    .optional()
    .isIn(['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'staff'])
    .withMessage('Invalid role filter')
];

// ============================================================================
// CLINIC ROUTES
// ============================================================================

/**
 * @route GET /api/clinics/all
 * @desc Get all clinics for admin management
 * @access Private (Admin only)
 */
router.get(
  '/all',
  authenticate,
  ClinicController.getAllClinics
);

/**
 * @route GET /api/clinics
 * @desc Get all clinics that the current user has access to
 * @access Private
 */
router.get(
  '/',
  authenticate,
  ClinicController.getUserClinics
);

/**
 * @route GET /api/clinics/current
 * @desc Get current selected clinic details
 * @access Private
 * @middleware Requires clinic context
 */
router.get(
  '/current',
  authenticate,
  clinicContext,
  ClinicController.getCurrentClinic
);

/**
 * @route POST /api/clinics
 * @desc Create a new clinic
 * @access Private (Any authenticated user)
 */
router.post(
  '/',
  authenticate,
  createClinicValidation,
  ClinicController.createClinic
);

/**
 * @route GET /api/clinics/:id
 * @desc Get clinic by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  paramValidation,
  ClinicController.getClinicById
);

/**
 * @route PUT /api/clinics/:id
 * @desc Update clinic
 * @access Private (Clinic Admin)
 */
router.put(
  '/:id',
  authenticate,
  updateClinicValidation,
  ClinicController.updateClinic
);

/**
 * @route DELETE /api/clinics/:id
 * @desc Deactivate clinic (soft delete)
 * @access Private (Super Admin)
 */
router.delete(
  '/:id',
  authenticate,
  paramValidation,
  ClinicController.deactivateClinic
);

/**
 * @route GET /api/clinics/:id/stats
 * @desc Get clinic statistics
 * @access Private
 */
router.get(
  '/:id/stats',
  authenticate,
  paramValidation,
  ClinicController.getClinicStats
);

// ============================================================================
// USER-CLINIC MANAGEMENT ROUTES
// ============================================================================

/**
 * @route GET /api/clinics/user/:userId/access
 * @desc Get user's clinic access for admin management
 * @access Private (Admin only)
 */
router.get(
  '/user/:userId/access',
  authenticate,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  ClinicController.getUserClinicAccess
);

/**
 * @route GET /api/clinics/:id/users
 * @desc Get all users in a clinic
 * @access Private (Clinic Admin)
 */
router.get(
  '/:id/users',
  authenticate,
  paramValidation,
  paginationValidation,
  ClinicController.getClinicUsers
);

/**
 * @route POST /api/clinics/:id/users
 * @desc Add user to clinic
 * @access Private (Clinic Admin)
 */
router.post(
  '/:id/users',
  authenticate,
  userClinicValidation,
  ClinicController.addUserToClinic
);

/**
 * @route PUT /api/clinics/:id/users/:userId
 * @desc Update user role/permissions in clinic
 * @access Private (Clinic Admin)
 */
router.put(
  '/:id/users/:userId',
  authenticate,
  updateUserClinicValidation,
  ClinicController.updateUserInClinic
);

/**
 * @route DELETE /api/clinics/:id/users/:userId
 * @desc Remove user from clinic
 * @access Private (Clinic Admin)
 */
router.delete(
  '/:id/users/:userId',
  authenticate,
  userParamValidation,
  ClinicController.removeUserFromClinic
);

export default router; 