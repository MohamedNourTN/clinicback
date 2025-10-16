import { Router } from 'express';
import { body } from 'express-validator';
import { InvoiceController } from '../controllers';
import { clinicContext } from '../middleware/clinicContext';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication and clinic context middleware to all routes
router.use(authenticate);
router.use(clinicContext);

// Validation middleware
const invoiceValidation = [
  body('patient_id').isMongoId().withMessage('Valid patient ID is required'),
  body('total_amount').optional().isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('tax_amount').optional().isFloat({ min: 0 }).withMessage('Tax amount must be a positive number'),
  body('subtotal').optional().isFloat({ min: 0 }).withMessage('Subtotal must be a positive number'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be a positive number'),
  body('due_date').isISO8601().withMessage('Please provide a valid due date'),
  body('services').isArray({ min: 1 }).withMessage('At least one service is required'),
  body('services.*.description').notEmpty().withMessage('Service description is required'),
  body('services.*.quantity').isInt({ min: 1 }).withMessage('Service quantity must be at least 1'),
  body('services.*.unit_price').isFloat({ min: 0 }).withMessage('Service unit price must be positive'),
  body('services.*.total').isFloat({ min: 0 }).withMessage('Service total must be positive'),
  body('services.*.type').optional().isIn(['service', 'test', 'medication', 'procedure']).withMessage('Service type must be one of: service, test, medication, procedure')
];

// Routes
router.post('/', invoiceValidation, InvoiceController.createInvoice);
router.get('/', InvoiceController.getAllInvoices);
router.get('/overdue', InvoiceController.getOverdueInvoices);
router.get('/stats', InvoiceController.getInvoiceStats);
router.get('/:id', InvoiceController.getInvoiceById);
router.put('/:id', invoiceValidation, InvoiceController.updateInvoice);
router.delete('/:id', InvoiceController.deleteInvoice);
router.patch('/:id/mark-paid', InvoiceController.markAsPaid);

export default router; 