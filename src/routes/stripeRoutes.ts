import { Router } from 'express';
import { StripeController } from '../controllers/stripeController';
import { authenticateSuperAdmin } from '../middleware/superAdminAuth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply super admin authentication to all routes
router.use(authenticateSuperAdmin);

// ============ SUBSCRIPTION PLANS ROUTES ============

/**
 * @swagger
 * /api/stripe/plans:
 *   get:
 *     summary: Get all subscription plans
 *     tags: [Stripe Plans]
 *     security:
 *       - SuperAdminAuth: []
 *     parameters:
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active plans only
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/plans', 
  query('active_only').optional().isIn(['true', 'false']),
  validateRequest,
  StripeController.getPlans
);

/**
 * @swagger
 * /api/stripe/plans/sync:
 *   post:
 *     summary: Sync plans from Stripe to local database
 *     tags: [Stripe Plans]
 *     security:
 *       - SuperAdminAuth: []
 *     responses:
 *       200:
 *         description: Plans synced successfully
 *       500:
 *         description: Server error
 */
router.post('/plans/sync', 
  StripeController.syncPlansFromStripe
);

/**
 * @swagger
 * /api/stripe/plans:
 *   post:
 *     summary: Create a new subscription plan
 *     tags: [Stripe Plans]
 *     security:
 *       - SuperAdminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *               price:
 *                 type: number
 *                 minimum: 0
 *               currency:
 *                 type: string
 *                 enum: [USD, EUR, GBP, INR, CAD, AUD]
 *               interval:
 *                 type: string
 *                 enum: [month, year]
 *               interval_count:
 *                 type: integer
 *                 minimum: 1
 *               trial_period_days:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 365
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *               max_clinics:
 *                 type: integer
 *                 minimum: 1
 *               max_users:
 *                 type: integer
 *                 minimum: 1
 *               max_patients:
 *                 type: integer
 *                 minimum: 1
 *               is_default:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/plans', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Plan name must be between 2 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'])
    .withMessage('Invalid currency'),
  body('interval')
    .optional()
    .isIn(['month', 'year'])
    .withMessage('Interval must be month or year'),
  body('interval_count')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Interval count must be at least 1'),
  body('trial_period_days')
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage('Trial period must be between 0 and 365 days'),
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array'),
  body('max_clinics')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max clinics must be at least 1'),
  body('max_users')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max users must be at least 1'),
  body('max_patients')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max patients must be at least 1'),
  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean')
], validateRequest, StripeController.createPlan);

/**
 * @swagger
 * /api/stripe/plans/{id}:
 *   put:
 *     summary: Update a subscription plan
 *     tags: [Stripe Plans]
 *     security:
 *       - SuperAdminAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Server error
 */
router.put('/plans/:id', [
  param('id').isMongoId().withMessage('Invalid plan ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Plan name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean')
], validateRequest, StripeController.updatePlan);

/**
 * @swagger
 * /api/stripe/plans/{id}:
 *   delete:
 *     summary: Delete/Archive a subscription plan
 *     tags: [Stripe Plans]
 *     security:
 *       - SuperAdminAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan archived successfully
 *       400:
 *         description: Cannot delete plan with active subscriptions
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Server error
 */
router.delete('/plans/:id', [
  param('id').isMongoId().withMessage('Invalid plan ID')
], validateRequest, StripeController.deletePlan);

// ============ SUBSCRIPTIONS ROUTES ============

/**
 * @swagger
 * /api/stripe/subscriptions:
 *   get:
 *     summary: Get all subscriptions
 *     tags: [Stripe Subscriptions]
 *     security:
 *       - SuperAdminAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid]
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: plan_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscriptions retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/subscriptions', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn([
    'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  ]).withMessage('Invalid status'),
  query('tenant_id').optional().isMongoId().withMessage('Invalid tenant ID'),
  query('plan_id').optional().isMongoId().withMessage('Invalid plan ID')
], validateRequest, StripeController.getSubscriptions);

/**
 * @swagger
 * /api/stripe/subscriptions:
 *   post:
 *     summary: Create subscription for tenant
 *     tags: [Stripe Subscriptions]
 *     security:
 *       - SuperAdminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenant_id
 *               - plan_id
 *               - customer_email
 *             properties:
 *               tenant_id:
 *                 type: string
 *               plan_id:
 *                 type: string
 *               customer_email:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *       400:
 *         description: Validation error or tenant already has active subscription
 *       404:
 *         description: Tenant or plan not found
 *       500:
 *         description: Server error
 */
router.post('/subscriptions', [
  body('tenant_id')
    .isMongoId()
    .withMessage('Valid tenant ID is required'),
  body('plan_id')
    .isMongoId()
    .withMessage('Valid plan ID is required'),
  body('customer_email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address is required')
], validateRequest, StripeController.createSubscription);

/**
 * @swagger
 * /api/stripe/subscriptions/{id}/cancel:
 *   post:
 *     summary: Cancel subscription
 *     tags: [Stripe Subscriptions]
 *     security:
 *       - SuperAdminAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               immediately:
 *                 type: boolean
 *                 description: Cancel immediately or at period end
 *     responses:
 *       200:
 *         description: Subscription canceled successfully
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Server error
 */
router.post('/subscriptions/:id/cancel', [
  param('id').isMongoId().withMessage('Invalid subscription ID'),
  body('immediately')
    .optional()
    .isBoolean()
    .withMessage('immediately must be a boolean')
], validateRequest, StripeController.cancelSubscription);

// Admin payment methods routes
router.get('/admin/payment-methods', StripeController.getAdminPaymentMethods);
router.get('/admin/payment-methods/debug', StripeController.debugAdminPaymentMethods);
router.post('/admin/setup-intent', StripeController.createAdminSetupIntent);
router.delete('/admin/payment-methods/:payment_method_id', [
  param('payment_method_id').notEmpty().withMessage('Payment method ID is required')
], validateRequest, StripeController.deleteAdminPaymentMethod);
router.post('/subscriptions/:subscription_id/pay-on-behalf', [
  param('subscription_id').isMongoId().withMessage('Invalid subscription ID'),
  body('admin_payment_method_id').notEmpty().withMessage('Admin payment method ID is required')
], validateRequest, StripeController.paySubscriptionOnBehalf);

// ============ TRANSACTIONS ROUTES ============

/**
 * @swagger
 * /api/stripe/transactions:
 *   get:
 *     summary: Get all Stripe transactions
 *     tags: [Stripe Transactions]
 *     security:
 *       - SuperAdminAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [subscription, one_time, refund, dispute, payout, invoice]
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: customer_email
 *         schema:
 *           type: string
 *           format: email
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/transactions', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn([
    'subscription', 'one_time', 'refund', 'dispute', 'payout', 'invoice'
  ]).withMessage('Invalid transaction type'),
  query('tenant_id').optional().isMongoId().withMessage('Invalid tenant ID'),
  query('customer_email').optional().isEmail().withMessage('Invalid email format'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date format'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date format')
], validateRequest, StripeController.getTransactions);

// Sync transactions from Stripe
router.post('/transactions/sync', StripeController.syncTransactionsFromStripe);

// ============ ANALYTICS ROUTES ============

/**
 * @swagger
 * /api/stripe/analytics:
 *   get:
 *     summary: Get subscription analytics
 *     tags: [Stripe Analytics]
 *     security:
 *       - SuperAdminAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/analytics', [
  query('start_date').optional().isISO8601().withMessage('Invalid start date format'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date format')
], validateRequest, StripeController.getSubscriptionAnalytics);

// ============ WEBHOOK ROUTES ============

/**
 * @swagger
 * /api/stripe/webhook:
 *   post:
 *     summary: Handle Stripe webhooks
 *     tags: [Stripe Webhooks]
 *     description: Endpoint for Stripe webhook events (no authentication required)
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Webhook signature verification failed
 *       500:
 *         description: Webhook processing failed
 */
// Remove auth middleware for webhook endpoint
router.post('/webhook', StripeController.handleWebhook);

export default router;
