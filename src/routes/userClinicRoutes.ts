import { Router } from 'express';
import { body } from 'express-validator';
import { UserClinicController } from '../controllers/userClinicController';
import { authenticate } from '../middleware/auth';
import { optionalClinicContext, clinicContext } from '../middleware/clinicContext';

const router = Router();

/**
 * Validation middleware for clinic selection
 */
const selectClinicValidation = [
  body('clinic_id')
    .notEmpty()
    .withMessage('Clinic ID is required')
    .isMongoId()
    .withMessage('Valid clinic ID is required')
];

/**
 * Validation middleware for profile updates
 */
const profileUpdateValidation = [
  body('bio')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Bio cannot exceed 1000 characters'),
  
  body('specialization')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Specialization cannot exceed 200 characters'),
  
  body('department')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Department cannot exceed 100 characters')
];

// ============================================================================
// USER-CLINIC ROUTES
// ============================================================================

/**
 * @route GET /api/user/clinics
 * @desc Get all clinics that the current user has access to
 * @access Public
 */
router.get(
  '/clinics',
  UserClinicController.getUserClinics
);

/**
 * @route POST /api/user/select-clinic
 * @desc Select/Switch to a clinic and get new token with clinic context
 * @access Private
 */
router.post(
  '/select-clinic',
  authenticate,
  selectClinicValidation,
  UserClinicController.selectClinic
);

/**
 * @route POST /api/user/switch-clinic
 * @desc Switch to a different clinic (alias for select-clinic)
 * @access Private
 */
router.post(
  '/switch-clinic',
  authenticate,
  selectClinicValidation,
  UserClinicController.switchClinic
);

/**
 * @route GET /api/user/current-clinic
 * @desc Get current selected clinic details
 * @access Private
 * @middleware Requires clinic context
 */
router.get(
  '/current-clinic',
  authenticate,
  clinicContext,
  UserClinicController.getCurrentClinic
);

/**
 * @route POST /api/user/assign-to-all-clinics
 * @desc DEVELOPMENT ONLY: Assign current user to all clinics
 * @access Private
 */
router.post(
  '/assign-to-all-clinics',
  authenticate,
  UserClinicController.assignUserToAllClinics
);

/**
 * @route POST /api/user/clear-clinic
 * @desc Clear clinic selection and return to clinic selection state
 * @access Private
 */
router.post(
  '/clear-clinic',
  authenticate,
  UserClinicController.clearClinicSelection
);

/**
 * @route GET /api/user/clinic-permissions
 * @desc Get user's role and permissions in current clinic
 * @access Private
 * @middleware Requires clinic context
 */
router.get(
  '/clinic-permissions',
  authenticate,
  clinicContext,
  UserClinicController.getClinicPermissions
);

/**
 * @route PUT /api/user/clinic-profile
 * @desc Update user's profile within current clinic context
 * @access Private
 * @middleware Requires clinic context
 */
router.put(
  '/clinic-profile',
  authenticate,
  clinicContext,
  profileUpdateValidation,
  UserClinicController.updateClinicProfile
);

/**
 * @route GET /api/user/clinic-activity
 * @desc Get user's activity and stats in current clinic
 * @access Private
 * @middleware Requires clinic context
 */
router.get(
  '/clinic-activity',
  authenticate,
  clinicContext,
  UserClinicController.getClinicActivity
);

export default router; 