import { Router } from 'express';
import { AITestAnalysisController, upload } from '../controllers/aiTestAnalysisController';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Apply authentication and clinic context to all routes
router.use(authenticate);
router.use(clinicContext);

/**
 * @swagger
 * /api/ai-test-analysis/analyze:
 *   post:
 *     summary: Upload and analyze test report using AI
 *     tags: [AI Test Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - test_report
 *               - patient_id
 *             properties:
 *               test_report:
 *                 type: string
 *                 format: binary
 *                 description: Test report image (JPEG, PNG) or PDF file
 *               patient_id:
 *                 type: string
 *                 description: Patient ID for whom the test report belongs
 *               custom_prompt:
 *                 type: string
 *                 description: Optional custom instructions for AI analysis
 *     responses:
 *       200:
 *         description: Test report analyzed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     analysis_result:
 *                       type: string
 *                     structured_data:
 *                       type: object
 *                     file_url:
 *                       type: string
 *                     analysis_date:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - missing file or patient_id
 *       408:
 *         description: Request timeout - analysis took too long
 *       422:
 *         description: Unprocessable entity - AI service returned empty result
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/analyze', upload.single('test_report'), AITestAnalysisController.analyzeTestReport);

/**
 * @swagger
 * /api/ai-test-analysis:
 *   get:
 *     summary: Get all AI test analyses for the clinic
 *     tags: [AI Test Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [processing, completed, failed]
 *         description: Filter by analysis status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in test names and analysis results
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
 *         description: Filter analyses until this date
 *     responses:
 *       200:
 *         description: List of AI test analyses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current_page:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *                     total_items:
 *                       type: integer
 *                     items_per_page:
 *                       type: integer
 */
router.get('/', AITestAnalysisController.getAllAnalyses);

/**
 * @swagger
 * /api/ai-test-analysis/stats:
 *   get:
 *     summary: Get AI test analysis statistics
 *     tags: [AI Test Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI test analysis statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_analyses:
 *                       type: integer
 *                     completed_analyses:
 *                       type: integer
 *                     processing_analyses:
 *                       type: integer
 *                     failed_analyses:
 *                       type: integer
 *                     recent_analyses:
 *                       type: integer
 *                     top_test_types:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           testName:
 *                             type: string
 *                           count:
 *                             type: integer
 */
router.get('/stats', AITestAnalysisController.getAnalysisStats);

/**
 * @swagger
 * /api/ai-test-analysis/{id}:
 *   get:
 *     summary: Get AI test analysis by ID
 *     tags: [AI Test Analysis]
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
 *         description: AI test analysis details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Analysis not found
 */
router.get('/:id', AITestAnalysisController.getAnalysisById);

/**
 * @swagger
 * /api/ai-test-analysis/{id}:
 *   delete:
 *     summary: Delete AI test analysis
 *     tags: [AI Test Analysis]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Analysis not found
 */
router.delete('/:id', AITestAnalysisController.deleteAnalysis);

export default router;
