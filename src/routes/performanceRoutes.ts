import { Router } from 'express';
import { query } from 'express-validator';
import { PerformanceController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Apply authentication and clinic context middleware to all routes
router.use(authenticate);
router.use(clinicContext);

// Validation middleware for date queries
const dateRangeValidation = [
  query('start_date').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('end_date').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('period').optional().isIn(['monthly', 'quarterly', 'yearly']).withMessage('Period must be monthly, quarterly, or yearly'),
  query('compare_with_previous').optional().isBoolean().withMessage('Compare with previous must be a boolean')
];

const moduleValidation = [
  query('module').optional().isIn(['invoices', 'payments', 'payroll', 'expenses']).withMessage('Invalid module name'),
  query('metric').optional().isIn(['amount', 'count', 'average']).withMessage('Invalid metric type')
];

const comparisonValidation = [
  query('current_start').isISO8601().withMessage('Current start date is required and must be valid'),
  query('current_end').isISO8601().withMessage('Current end date is required and must be valid'),
  query('previous_start').isISO8601().withMessage('Previous start date is required and must be valid'),
  query('previous_end').isISO8601().withMessage('Previous end date is required and must be valid')
];

const doctorPayoutValidation = [
  query('year').optional().isInt({ min: 2000, max: 3000 }).withMessage('Year must be a valid integer between 2000 and 3000'),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be an integer between 1 and 12')
];

// Routes
router.get('/overview', dateRangeValidation, PerformanceController.getPerformanceOverview);
router.get('/module/:module', [...dateRangeValidation, ...moduleValidation], PerformanceController.getModulePerformance);
router.get('/compare', comparisonValidation, PerformanceController.getComparativePerformance);
router.get('/doctors/payouts', doctorPayoutValidation, PerformanceController.getDoctorPayouts);

export default router;
