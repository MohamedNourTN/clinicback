import { Router } from 'express';
import { body } from 'express-validator';
import { ExpenseController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Apply authentication and clinic context middleware to all routes
router.use(authenticate);
router.use(clinicContext);

// Validation middleware
const expenseValidation = [
  body('title').notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description').optional()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('category').isIn(['supplies', 'equipment', 'utilities', 'maintenance', 'staff', 'marketing', 'insurance', 'rent', 'other'])
    .withMessage('Invalid category'),
  body('vendor').optional()
    .isLength({ max: 100 }).withMessage('Vendor name cannot exceed 100 characters'),
  body('payment_method').isIn(['cash', 'card', 'bank_transfer', 'check'])
    .withMessage('Invalid payment method'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('status').optional().isIn(['pending', 'paid', 'cancelled'])
    .withMessage('Invalid status'),
  body('receipt_url').optional(),
  body('notes').optional()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
];

const updateExpenseValidation = [
  body('title').optional().notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description').optional()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('category').optional().isIn(['supplies', 'equipment', 'utilities', 'maintenance', 'staff', 'marketing', 'insurance', 'rent', 'other'])
    .withMessage('Invalid category'),
  body('vendor').optional()
    .isLength({ max: 100 }).withMessage('Vendor name cannot exceed 100 characters'),
  body('payment_method').optional().isIn(['cash', 'card', 'bank_transfer', 'check'])
    .withMessage('Invalid payment method'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('status').optional().isIn(['pending', 'paid', 'cancelled'])
    .withMessage('Invalid status'),
  body('receipt_url').optional(),
  body('notes').optional()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
];

const bulkExpenseValidation = [
  body('expenses').isArray({ min: 1 }).withMessage('Expenses array is required and cannot be empty'),
  body('expenses.*.title').notEmpty().withMessage('Each expense must have a title')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('expenses.*.amount').isFloat({ min: 0 }).withMessage('Each expense amount must be a positive number'),
  body('expenses.*.category').isIn(['supplies', 'equipment', 'utilities', 'maintenance', 'staff', 'marketing', 'insurance', 'rent', 'other'])
    .withMessage('Each expense must have a valid category'),
  body('expenses.*.payment_method').isIn(['cash', 'card', 'bank_transfer', 'check'])
    .withMessage('Each expense must have a valid payment method'),
  body('expenses.*.date').isISO8601().withMessage('Each expense must have a valid date')
];

// Routes
router.post('/', expenseValidation, ExpenseController.createExpense);
router.get('/', ExpenseController.getAllExpenses);
router.get('/stats', ExpenseController.getExpenseStats);
router.get('/categories', ExpenseController.getExpenseCategories);
router.get('/recent', ExpenseController.getRecentExpenses);
router.post('/bulk', bulkExpenseValidation, ExpenseController.bulkCreateExpenses);
router.get('/:id', ExpenseController.getExpenseById);
router.put('/:id', updateExpenseValidation, ExpenseController.updateExpense);
router.delete('/:id', ExpenseController.deleteExpense);

export default router;
