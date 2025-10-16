import { Router } from 'express';
import { requireAnalyticsAccess } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';
import { AnalyticsController } from '../controllers/analyticsController';

const router = Router();

// All analytics routes require admin or accountant authentication AND clinic context
router.use(requireAnalyticsAccess);
router.use(clinicContext);

/**
 * @swagger
 * /api/analytics/overview:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get comprehensive analytics overview
 *     description: Returns revenue, expense, and patient data for specified time period
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         description: Time period for analytics
 *         schema:
 *           type: string
 *           enum: [1month, 3months, 6months, 1year]
 *           default: 6months
 *     responses:
 *       200:
 *         description: Analytics overview retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin or Accountant access required
 */
router.get('/overview', AnalyticsController.getAnalyticsOverview);

/**
 * @swagger
 * /api/analytics/departments:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get department performance analytics
 *     description: Returns revenue and patient count by department
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department analytics retrieved successfully
 */
router.get('/departments', AnalyticsController.getDepartmentAnalytics);

/**
 * @swagger
 * /api/analytics/appointments:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get appointment status analytics
 *     description: Returns appointment status distribution with percentages
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointment analytics retrieved successfully
 */
router.get('/appointments', AnalyticsController.getAppointmentAnalytics);

/**
 * @swagger
 * /api/analytics/demographics:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get patient demographics
 *     description: Returns age and gender distribution of patients
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Demographics analytics retrieved successfully
 */
router.get('/demographics', AnalyticsController.getPatientDemographics);

/**
 * @swagger
 * /api/analytics/services:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get top services analytics
 *     description: Returns most requested services and their revenue
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Services analytics retrieved successfully
 */
router.get('/services', AnalyticsController.getTopServices);

/**
 * @swagger
 * /api/analytics/payments:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get payment methods analytics
 *     description: Returns payment method distribution and amounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment analytics retrieved successfully
 */
router.get('/payments', AnalyticsController.getPaymentMethodAnalytics);

/**
 * @swagger
 * /api/analytics/stats:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get analytics key statistics
 *     description: Returns current month stats and growth percentages
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics stats retrieved successfully
 */
router.get('/stats', AnalyticsController.getAnalyticsStats);

export default router; 