import express from 'express';
import { XrayAnalysisController, upload } from '../controllers/xrayAnalysisController';
import { authenticate, authorize } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = express.Router();

// Timeout middleware for X-ray analysis (extend timeout to 10 minutes)
const extendTimeout = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.setTimeout(10 * 60 * 1000); // 10 minutes
  res.setTimeout(10 * 60 * 1000); // 10 minutes
  next();
};

// Health check endpoint (no auth required for testing)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'X-ray Analysis API is running',
    timestamp: new Date().toISOString(),
    geminiApiKeyConfigured: !!process.env.GEMINI_API_KEY
  });
});

// All other routes require authentication and clinic context
router.use(authenticate);
router.use(clinicContext);

/**
 * @swagger
 * /api/xray-analysis:
 *   post:
 *     summary: Upload and analyze X-ray image
 *     tags: [X-ray Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               xray_image:
 *                 type: string
 *                 format: binary
 *                 description: X-ray image file (JPEG, JPG, PNG)
 *               patient_id:
 *                 type: string
 *                 description: Patient ID
 *               custom_prompt:
 *                 type: string
 *                 description: Custom analysis prompt (optional)
 *             required:
 *               - xray_image
 *               - patient_id
 *     responses:
 *       200:
 *         description: X-ray analysis completed successfully
 *       400:
 *         description: Bad request - missing required fields
 *       500:
 *         description: Internal server error
 */
router.post('/', 
  extendTimeout,
  authorize('doctor', 'admin'), 
  upload.single('xray_image'), 
  XrayAnalysisController.analyzeXray
);

/**
 * @swagger
 * /api/xray-analysis:
 *   get:
 *     summary: Get all X-ray analyses with pagination and filters
 *     tags: [X-ray Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed]
 *         description: Filter by analysis status
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter analyses from this date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter analyses to this date
 *     responses:
 *       200:
 *         description: List of X-ray analyses
 *       500:
 *         description: Internal server error
 */
router.get('/', 
  authorize('doctor', 'admin', 'nurse'), 
  XrayAnalysisController.getAllAnalyses
);

/**
 * @swagger
 * /api/xray-analysis/stats:
 *   get:
 *     summary: Get X-ray analysis statistics
 *     tags: [X-ray Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analysis statistics
 *       500:
 *         description: Internal server error
 */
router.get('/stats', 
  authorize('doctor', 'admin'), 
  XrayAnalysisController.getAnalysisStats
);

/**
 * @swagger
 * /api/xray-analysis/patient/{patient_id}:
 *   get:
 *     summary: Get all X-ray analyses for a specific patient
 *     tags: [X-ray Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patient_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of patient's X-ray analyses
 *       500:
 *         description: Internal server error
 */
router.get('/patient/:patient_id', 
  authorize('doctor', 'admin', 'nurse'), 
  XrayAnalysisController.getPatientAnalyses
);

/**
 * @swagger
 * /api/xray-analysis/{id}:
 *   get:
 *     summary: Get X-ray analysis by ID
 *     tags: [X-ray Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Analysis ID
 *     responses:
 *       200:
 *         description: X-ray analysis details
 *       404:
 *         description: Analysis not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', 
  authorize('doctor', 'admin', 'nurse'), 
  XrayAnalysisController.getAnalysisById
);

/**
 * @swagger
 * /api/xray-analysis/{id}:
 *   delete:
 *     summary: Delete X-ray analysis
 *     tags: [X-ray Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Analysis ID
 *     responses:
 *       200:
 *         description: Analysis deleted successfully
 *       404:
 *         description: Analysis not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', 
  authorize('doctor', 'admin'), 
  XrayAnalysisController.deleteAnalysis
);

export default router; 