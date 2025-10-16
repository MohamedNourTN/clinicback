import { Router } from 'express';
import { AITestComparisonController, uploadMultiple } from '../controllers/aiTestComparisonController';
import { authenticate, authorize } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Apply authentication and clinic context to all routes
router.use(authenticate);
router.use(clinicContext);

/**
 * @swagger
 * /api/ai-test-comparison/compare:
 *   post:
 *     summary: Upload and compare multiple test reports using AI
 *     tags: [AI Test Comparison]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - test_reports
 *               - patient_id
 *             properties:
 *               test_reports:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Multiple test report files (JPEG, PNG, PDF) - minimum 2, maximum 10
 *               patient_id:
 *                 type: string
 *                 description: Patient ID for whom the test reports belong
 *               comparison_name:
 *                 type: string
 *                 description: Optional name for this comparison (auto-generated if not provided)
 *               custom_prompt:
 *                 type: string
 *                 description: Optional custom instructions for AI analysis and comparison
 *     responses:
 *       200:
 *         description: Test reports uploaded successfully, comparison in progress
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
 *                     comparison_id:
 *                       type: string
 *                     report_count:
 *                       type: integer
 *                     status:
 *                       type: string
 *       400:
 *         description: Bad request - invalid files, insufficient reports, or missing patient_id
 *       413:
 *         description: Payload too large - files exceed size limits
 *       422:
 *         description: Unprocessable entity - unsupported file types
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/compare', authorize('admin', 'doctor', 'nurse'), uploadMultiple.array('test_reports', 10), AITestComparisonController.compareTestReports);

/**
 * @swagger
 * /api/ai-test-comparison:
 *   get:
 *     summary: Get all AI test comparisons for the clinic
 *     tags: [AI Test Comparison]
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
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by comparison status
 *       - in: query
 *         name: patient_id
 *         schema:
 *           type: string
 *         description: Filter by patient ID
 *       - in: query
 *         name: doctor_id
 *         schema:
 *           type: string
 *         description: Filter by doctor ID
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter comparisons from this date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter comparisons until this date
 *     responses:
 *       200:
 *         description: List of AI test comparisons
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
 *                     properties:
 *                       _id:
 *                         type: string
 *                       comparison_name:
 *                         type: string
 *                       patient_id:
 *                         type: object
 *                         properties:
 *                           first_name:
 *                             type: string
 *                           last_name:
 *                             type: string
 *                       doctor_id:
 *                         type: object
 *                       report_count:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       comparison_date:
 *                         type: string
 *                         format: date-time
 *                       date_range:
 *                         type: object
 *                         properties:
 *                           start_date:
 *                             type: string
 *                             format: date
 *                           end_date:
 *                             type: string
 *                             format: date
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
router.get('/', authorize('admin', 'doctor', 'nurse'), AITestComparisonController.getAllComparisons);

/**
 * @swagger
 * /api/ai-test-comparison/stats:
 *   get:
 *     summary: Get AI test comparison statistics
 *     tags: [AI Test Comparison]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI test comparison statistics
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
 *                     total_comparisons:
 *                       type: integer
 *                       description: Total number of comparisons
 *                     this_month:
 *                       type: integer
 *                       description: Comparisons created this month
 *                     pending:
 *                       type: integer
 *                       description: Number of pending comparisons
 *                     processing:
 *                       type: integer
 *                       description: Number of comparisons currently processing
 *                     completed:
 *                       type: integer
 *                       description: Number of completed comparisons
 *                     failed:
 *                       type: integer
 *                       description: Number of failed comparisons
 */
router.get('/stats', authorize('admin', 'doctor', 'nurse'), AITestComparisonController.getComparisonStats);

/**
 * @swagger
 * /api/ai-test-comparison/{id}:
 *   get:
 *     summary: Get AI test comparison by ID
 *     tags: [AI Test Comparison]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comparison ID
 *     responses:
 *       200:
 *         description: AI test comparison details with complete analysis
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
 *                     _id:
 *                       type: string
 *                     comparison_name:
 *                       type: string
 *                     patient_id:
 *                       type: object
 *                     doctor_id:
 *                       type: object
 *                     report_count:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     processing_stage:
 *                       type: string
 *                     individual_analyses:
 *                       type: array
 *                       description: Analysis results for each uploaded report
 *                     parameter_comparisons:
 *                       type: array
 *                       description: Comparison data for each parameter across reports
 *                     comparison_analysis:
 *                       type: object
 *                       description: Overall comparison analysis and recommendations
 *                     date_range:
 *                       type: object
 *                       properties:
 *                         start_date:
 *                           type: string
 *                           format: date
 *                         end_date:
 *                           type: string
 *                           format: date
 *                     uploaded_files:
 *                       type: array
 *                       description: Information about uploaded files
 *                     processing_time_ms:
 *                       type: integer
 *                     comparison_date:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Comparison not found
 */
router.get('/:id', authorize('admin', 'doctor', 'nurse'), AITestComparisonController.getComparisonById);

/**
 * @swagger
 * /api/ai-test-comparison/{id}:
 *   delete:
 *     summary: Delete AI test comparison
 *     tags: [AI Test Comparison]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comparison ID
 *     responses:
 *       200:
 *         description: Comparison deleted successfully
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
 *         description: Comparison not found
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.delete('/:id', authorize('admin', 'doctor'), AITestComparisonController.deleteComparison);

export default router;
