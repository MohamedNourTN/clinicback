import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { TenantController } from '../../controllers/super-admin/TenantController';
import { 
  requireSuperAdmin, 
  auditSuperAdminAction 
} from '../../middleware/superAdminAuth';

const router = Router();

// Validation middleware for tenant creation/update
const tenantValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Organization name is required and must not exceed 100 characters'),
  body('slug')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Slug is required and must not exceed 50 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email cannot exceed 255 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  body('subdomain')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Subdomain cannot exceed 50 characters')
    .matches(/^[a-z0-9-]*$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens'),
  body('logo_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Logo URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Logo URL cannot exceed 500 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended', 'pending'])
    .withMessage('Status must be one of: active, inactive, suspended, pending')
];

// Validation for slug/subdomain checking
const slugValidation = [
  param('slug')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Slug must be between 1 and 50 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens')
];

const subdomainValidation = [
  param('subdomain')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Subdomain must be between 1 and 50 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens')
];

// Query validation for listing
const listQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term cannot exceed 100 characters'),
  query('status')
    .optional()
    .isIn(['all', 'active', 'inactive', 'suspended', 'pending'])
    .withMessage('Status must be one of: all, active, inactive, suspended, pending'),
  query('sortBy')
    .optional()
    .isIn(['name', 'slug', 'email', 'status', 'created_at', 'updated_at'])
    .withMessage('sortBy must be one of: name, slug, email, status, created_at, updated_at'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be either asc or desc')
];

/**
 * @route GET /api/super-admin/tenants
 * @desc Get all tenants with pagination and filtering
 * @access Private (Super Admin)
 */
router.get(
  '/',
  requireSuperAdmin,
  listQueryValidation,
  auditSuperAdminAction('GET_ALL_TENANTS'),
  TenantController.getAllTenants
);

/**
 * @route GET /api/super-admin/tenants/stats
 * @desc Get tenant statistics
 * @access Private (Super Admin)
 */
router.get(
  '/stats',
  requireSuperAdmin,
  auditSuperAdminAction('GET_TENANT_STATS'),
  TenantController.getTenantStats
);

/**
 * @route GET /api/super-admin/tenants/check-slug/:slug
 * @desc Check if slug is available
 * @access Private (Super Admin)
 */
router.get(
  '/check-slug/:slug',
  requireSuperAdmin,
  slugValidation,
  TenantController.checkSlugAvailability
);

/**
 * @route GET /api/super-admin/tenants/check-subdomain/:subdomain
 * @desc Check if subdomain is available
 * @access Private (Super Admin)
 */
router.get(
  '/check-subdomain/:subdomain',
  requireSuperAdmin,
  subdomainValidation,
  TenantController.checkSubdomainAvailability
);

/**
 * @route GET /api/super-admin/tenants/:id
 * @desc Get tenant by ID
 * @access Private (Super Admin)
 */
router.get(
  '/:id',
  requireSuperAdmin,
  param('id').isMongoId().withMessage('Invalid tenant ID'),
  auditSuperAdminAction('GET_TENANT_BY_ID'),
  TenantController.getTenantById
);

/**
 * @route POST /api/super-admin/tenants
 * @desc Create new tenant
 * @access Private (Super Admin)
 */
router.post(
  '/',
  requireSuperAdmin,
  tenantValidation,
  auditSuperAdminAction('CREATE_TENANT'),
  TenantController.createTenant
);

/**
 * @route PUT /api/super-admin/tenants/:id
 * @desc Update tenant
 * @access Private (Super Admin)
 */
router.put(
  '/:id',
  requireSuperAdmin,
  param('id').isMongoId().withMessage('Invalid tenant ID'),
  tenantValidation,
  auditSuperAdminAction('UPDATE_TENANT'),
  TenantController.updateTenant
);

/**
 * @route DELETE /api/super-admin/tenants/:id
 * @desc Soft delete tenant
 * @access Private (Super Admin)
 */
router.delete(
  '/:id',
  requireSuperAdmin,
  param('id').isMongoId().withMessage('Invalid tenant ID'),
  auditSuperAdminAction('DELETE_TENANT'),
  TenantController.deleteTenant
);

/**
 * @route PUT /api/super-admin/tenants/:id/restore
 * @desc Restore soft deleted tenant
 * @access Private (Super Admin)
 */
router.put(
  '/:id/restore',
  requireSuperAdmin,
  param('id').isMongoId().withMessage('Invalid tenant ID'),
  auditSuperAdminAction('RESTORE_TENANT'),
  TenantController.restoreTenant
);

export default router;
