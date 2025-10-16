import { Router } from 'express';
import PublicTenantController from '../../controllers/publicv2/PublicTenantController';

const router = Router();

/**
 * Public Tenant Routes
 * These routes don't require authentication
 * Used for tenant selection and validation
 */

/**
 * @route   GET /api/public/tenants
 * @desc    Get all active tenants for tenant selection
 * @access  Public
 */
router.get('/', PublicTenantController.getActiveTenants);

/**
 * @route   GET /api/public/tenants/subdomain/:subdomain
 * @desc    Get tenant by subdomain
 * @access  Public
 */
router.get('/subdomain/:subdomain', PublicTenantController.getTenantBySubdomain);

/**
 * @route   GET /api/public/tenants/validate/:subdomain
 * @desc    Validate tenant subdomain
 * @access  Public
 */
router.get('/validate/:subdomain', PublicTenantController.validateTenantSubdomain);

export default router;
