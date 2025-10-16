import { Router } from 'express';
import { DashboardController } from '../controllers';
import { authenticate, requireAdmin, requireAnalyticsAccess } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// All dashboard routes require authentication, clinic context, and admin/accountant privileges
router.use(authenticate);
router.use(clinicContext);
router.use(requireAnalyticsAccess);

/**
 * @swagger
 * /api/dashboard/admin:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get comprehensive admin dashboard statistics
 *     description: Returns overview stats, appointment data, revenue trends, low stock items, recent appointments, and system health
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalPatients:
 *                           type: number
 *                           example: 1250
 *                         todayAppointments:
 *                           type: number
 *                           example: 15
 *                         monthlyRevenue:
 *                           type: number
 *                           example: 25000
 *                         lowStockCount:
 *                           type: number
 *                           example: 3
 *                         totalDoctors:
 *                           type: number
 *                           example: 8
 *                         totalStaff:
 *                           type: number
 *                           example: 25
 *                     appointmentStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "completed"
 *                           count:
 *                             type: number
 *                             example: 150
 *                     revenueData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               year:
 *                                 type: number
 *                                 example: 2024
 *                               month:
 *                                 type: number
 *                                 example: 6
 *                           revenue:
 *                             type: number
 *                             example: 12500
 *                           count:
 *                             type: number
 *                             example: 45
 *                     lowStockItems:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/InventoryItem'
 *                     recentAppointments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Appointment'
 *                     systemHealth:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: number
 *                         activeUsers:
 *                           type: number
 *                         systemUptime:
 *                           type: string
 *                         lastBackup:
 *                           type: string
 *                           format: date-time
 *                         apiResponseTime:
 *                           type: string
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin or Accountant access required
 *       500:
 *         description: Internal server error
 */
router.get('/admin', DashboardController.getAdminDashboardStats);

/**
 * @swagger
 * /api/dashboard/revenue:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get revenue analytics with trends
 *     description: Returns revenue and expense data for specified time period
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
 *         description: Revenue analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     revenueData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               year:
 *                                 type: number
 *                               month:
 *                                 type: number
 *                           revenue:
 *                             type: number
 *                           count:
 *                             type: number
 *                     expenseData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               year:
 *                                 type: number
 *                               month:
 *                                 type: number
 *                           expenses:
 *                             type: number
 *                     period:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin or Accountant access required
 *       500:
 *         description: Internal server error
 */
router.get('/revenue', DashboardController.getRevenueAnalytics);

/**
 * @swagger
 * /api/dashboard/operations:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get operational metrics and alerts
 *     description: Returns appointment metrics, patient metrics, and inventory alerts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operational metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointments:
 *                       type: object
 *                       properties:
 *                         today:
 *                           type: number
 *                         thisWeek:
 *                           type: number
 *                         thisMonth:
 *                           type: number
 *                         byStatus:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               count:
 *                                 type: number
 *                     patients:
 *                       type: object
 *                       properties:
 *                         today:
 *                           type: number
 *                         thisWeek:
 *                           type: number
 *                         thisMonth:
 *                           type: number
 *                     inventoryAlerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/InventoryItem'
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin or Accountant access required
 *       500:
 *         description: Internal server error
 */
router.get('/operations', DashboardController.getOperationalMetrics);

/**
 * @swagger
 * /api/dashboard/system-health:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get system health status and alerts
 *     description: Returns system health checks, alerts, and performance metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     healthChecks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           service:
 *                             type: string
 *                           status:
 *                             type: string
 *                           responseTime:
 *                             type: string
 *                           usage:
 *                             type: string
 *                     systemAlerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [info, warning, error]
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           severity:
 *                             type: string
 *                             enum: [low, medium, high]
 *                     performanceMetrics:
 *                       type: object
 *                       properties:
 *                         uptime:
 *                           type: string
 *                         averageResponseTime:
 *                           type: string
 *                         requestsToday:
 *                           type: number
 *                         errorsToday:
 *                           type: number
 *                         lastBackup:
 *                           type: string
 *                           format: date-time
 *                     overallStatus:
 *                       type: string
 *                       enum: [healthy, warning, critical]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/system-health', DashboardController.getSystemHealth);

export default router; 