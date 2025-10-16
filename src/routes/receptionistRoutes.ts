import { Router } from 'express';
import { body, param } from 'express-validator';
import { ReceptionistController } from '../controllers/receptionistController';
import { authenticate, requireStaff } from '../middleware/auth';

const router = Router();

// All receptionist routes require authentication and staff privileges
router.use(authenticate);
router.use(requireStaff);

/**
 * @swagger
 * /api/receptionist/dashboard:
 *   get:
 *     tags:
 *       - Receptionist
 *     summary: Get receptionist dashboard statistics
 *     description: Returns today's appointments, walk-ins, pending check-ins, and other receptionist metrics
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         todayAppointments:
 *                           type: number
 *                           example: 15
 *                         todayWalkIns:
 *                           type: number
 *                           example: 3
 *                         pendingCheckIns:
 *                           type: number
 *                           example: 5
 *                         callsToday:
 *                           type: number
 *                           example: 12
 *                     upcomingAppointments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           patient:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           time:
 *                             type: string
 *                             format: date-time
 *                           doctor:
 *                             type: string
 *                           type:
 *                             type: string
 *                           status:
 *                             type: string
 *                     currentPatients:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           checkedIn:
 *                             type: string
 *                             format: date-time
 *                           doctor:
 *                             type: string
 *                           status:
 *                             type: string
 *                           waitTime:
 *                             type: number
 *                     pendingTasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           task:
 *                             type: string
 *                           patient:
 *                             type: string
 *                           priority:
 *                             type: string
 *                           time:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Staff access required
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard', ReceptionistController.getDashboardStats);

/**
 * @swagger
 * /api/receptionist/checkin/{appointmentId}:
 *   post:
 *     tags:
 *       - Receptionist
 *     summary: Check in a patient for their appointment
 *     description: Updates appointment status to indicate patient has checked in
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: appointmentId
 *         in: path
 *         required: true
 *         description: ID of the appointment to check in
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Patient checked in successfully
 *       404:
 *         description: Appointment not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/checkin/:appointmentId', [
  param('appointmentId').isMongoId().withMessage('Valid appointment ID is required')
], ReceptionistController.checkInPatient);

/**
 * @swagger
 * /api/receptionist/walkins:
 *   get:
 *     tags:
 *       - Receptionist
 *     summary: Get today's walk-in patients
 *     description: Returns list of walk-in leads for today
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Walk-ins retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/walkins', ReceptionistController.getTodayWalkIns);

/**
 * @swagger
 * /api/receptionist/walkins:
 *   post:
 *     tags:
 *       - Receptionist
 *     summary: Register a walk-in patient
 *     description: Creates a new lead record for a walk-in patient
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - first_name
 *               - last_name
 *               - phone
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: "John"
 *               last_name:
 *                 type: string
 *                 example: "Doe"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               email:
 *                 type: string
 *                 example: "john.doe@email.com"
 *               notes:
 *                 type: string
 *                 example: "Walk-in patient with flu symptoms"
 *     responses:
 *       201:
 *         description: Walk-in registered successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/walkins', [
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], ReceptionistController.createWalkIn);

/**
 * @swagger
 * /api/receptionist/queue:
 *   get:
 *     tags:
 *       - Receptionist
 *     summary: Get appointment queue for today
 *     description: Returns appointments grouped by status (waiting, in progress, completed, etc.)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointment queue retrieved successfully
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
 *                     queue:
 *                       type: object
 *                       properties:
 *                         waiting:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Appointment'
 *                         inProgress:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Appointment'
 *                         completed:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Appointment'
 *                         cancelled:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Appointment'
 *                         noShow:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Appointment'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/queue', ReceptionistController.getAppointmentQueue);

/**
 * @swagger
 * /api/receptionist/appointments/{appointmentId}/status:
 *   put:
 *     tags:
 *       - Receptionist
 *     summary: Update appointment status
 *     description: Updates the status of an appointment (for check-in, completion, etc.)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: appointmentId
 *         in: path
 *         required: true
 *         description: ID of the appointment to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [scheduled, confirmed, in-progress, completed, cancelled, no-show]
 *                 example: "in-progress"
 *     responses:
 *       200:
 *         description: Appointment status updated successfully
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Appointment not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/appointments/:appointmentId/status', [
  param('appointmentId').isMongoId().withMessage('Valid appointment ID is required'),
  body('status').isIn(['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'])
                .withMessage('Invalid status')
], ReceptionistController.updateAppointmentStatus);

export default router; 