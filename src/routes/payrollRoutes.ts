import { Router } from 'express';
import { body } from 'express-validator';
import { PayrollController } from '../controllers/payrollController';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Apply authentication middleware first, then clinic context to all routes
router.use(authenticate);
router.use(clinicContext);

// Validation middleware
const payrollValidation = [
  body('employee_id').isMongoId().withMessage('Valid employee ID is required'),
  body('month').isIn(['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'])
                .withMessage('Invalid month'),
  body('year').isInt({ min: 2020, max: new Date().getFullYear() + 1 }).withMessage('Invalid year'),
  body('base_salary').isFloat({ min: 0 }).withMessage('Base salary must be a positive number'),
  body('overtime').optional().isFloat({ min: 0 }).withMessage('Overtime must be a positive number'),
  body('bonus').optional().isFloat({ min: 0 }).withMessage('Bonus must be a positive number'),
  body('allowances').optional().isFloat({ min: 0 }).withMessage('Allowances must be a positive number'),
  body('deductions').optional().isFloat({ min: 0 }).withMessage('Deductions must be a positive number'),
  body('tax').optional().isFloat({ min: 0 }).withMessage('Tax must be a positive number'),
  body('working_days').isInt({ min: 0, max: 31 }).withMessage('Working days must be between 0 and 31'),
  body('total_days').isInt({ min: 28, max: 31 }).withMessage('Total days must be between 28 and 31'),
  body('leaves').optional().isInt({ min: 0 }).withMessage('Leaves must be a positive number'),
  body('status').optional().isIn(['draft', 'pending', 'processed', 'paid']).withMessage('Invalid status')
];

const statusUpdateValidation = [
  body('status').isIn(['draft', 'pending', 'processed', 'paid']).withMessage('Invalid payroll status')
];

const generatePayrollValidation = [
  body('month').isIn(['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'])
                .withMessage('Invalid month'),
  body('year').isInt({ min: 2020, max: new Date().getFullYear() + 1 }).withMessage('Invalid year'),
  body('employee_ids').optional().isArray().withMessage('Employee IDs must be an array'),
  body('employee_ids.*').optional().isMongoId().withMessage('Each employee ID must be valid')
];

// Routes
router.post('/', payrollValidation, PayrollController.createPayroll);
router.get('/', PayrollController.getAllPayrolls);
router.get('/stats', PayrollController.getPayrollStats);
router.post('/generate', generatePayrollValidation, PayrollController.generatePayroll);
router.get('/:id', PayrollController.getPayrollById);
router.put('/:id', payrollValidation, PayrollController.updatePayroll);
router.patch('/:id/status', statusUpdateValidation, PayrollController.updatePayrollStatus);
router.delete('/:id', PayrollController.deletePayroll);

export default router;
