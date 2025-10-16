import { Router } from 'express';
import { body } from 'express-validator';
import { PaymentController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';
import express from 'express';

const router = Router();

// Apply authentication and clinic context middleware to all routes
router.use(authenticate);
router.use(clinicContext);

// Validation middleware
const paymentValidation = [
  body('invoice_id').optional().isMongoId().withMessage('Valid invoice ID is required'),
  body('patient_id').isMongoId().withMessage('Valid patient ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('method').isIn(['credit_card', 'cash', 'bank_transfer', 'upi', 'insurance', 'stripe']).withMessage('Invalid payment method'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a valid 3-letter code'),
  body('status').optional().isIn(['completed', 'pending', 'processing', 'failed', 'refunded']).withMessage('Invalid payment status'),
  body('processing_fee').optional().isFloat({ min: 0 }).withMessage('Processing fee must be a positive number'),
  body('description').notEmpty().withMessage('Payment description is required'),
  body('card_last4').optional().isLength({ min: 4, max: 4 }).withMessage('Card last 4 digits must be exactly 4 characters'),
  body('insurance_provider').optional().isLength({ max: 200 }).withMessage('Insurance provider name cannot exceed 200 characters'),
  body('customer_email').optional().isEmail().withMessage('Customer email must be valid')
];

// Stripe payment link validation
const stripePaymentLinkValidation = [
  body('amount').isFloat({ min: 0.50 }).withMessage('Amount must be at least $0.50'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a valid 3-letter code'),
  body('description').notEmpty().withMessage('Payment description is required'),
  body('customer_email').isEmail().withMessage('Valid customer email is required'),
  body('patient_id').isMongoId().withMessage('Valid patient ID is required'),
  body('success_url').optional().custom((value) => {
    if (!value || value === '') return true;
    return /^https?:\/\/.+/.test(value);
  }).withMessage('Success URL must be valid'),
  body('cancel_url').optional().custom((value) => {
    if (!value || value === '') return true;
    return /^https?:\/\/.+/.test(value);
  }).withMessage('Cancel URL must be valid')
];

// Stripe refund validation
const stripeRefundValidation = [
  body('amount').optional().isFloat({ min: 0 }).withMessage('Refund amount must be a positive number'),
  body('reason').optional().isIn(['duplicate', 'fraudulent', 'requested_by_customer']).withMessage('Invalid refund reason')
];

const statusUpdateValidation = [
  body('status').isIn(['completed', 'pending', 'processing', 'failed', 'refunded']).withMessage('Invalid payment status'),
  body('failure_reason').optional().isLength({ max: 500 }).withMessage('Failure reason cannot exceed 500 characters')
];

const refundValidation = [
  body('refund_amount').isFloat({ min: 0 }).withMessage('Refund amount must be a positive number'),
  body('reason').notEmpty().withMessage('Refund reason is required')
];

const invoicePaymentValidation = [
  body('invoice_id').isMongoId().withMessage('Valid invoice ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('method').isIn(['credit_card', 'cash', 'bank_transfer', 'upi', 'insurance']).withMessage('Invalid payment method'),
  body('description').notEmpty().withMessage('Payment description is required'),
  body('transaction_id').optional().isLength({ max: 100 }).withMessage('Transaction ID cannot exceed 100 characters')
];

// Routes
router.post('/', paymentValidation, PaymentController.createPayment);
router.get('/', PaymentController.getAllPayments);
router.get('/stats', PaymentController.getPaymentStats);
router.post('/record-invoice-payment', invoicePaymentValidation, PaymentController.recordInvoicePayment);
router.get('/:id', PaymentController.getPaymentById);
router.put('/:id', paymentValidation, PaymentController.updatePayment);
router.patch('/:id/status', statusUpdateValidation, PaymentController.updatePaymentStatus);
router.post('/:id/refund', refundValidation, PaymentController.initiateRefund);

// ===== STRIPE ROUTES =====

// Create Stripe payment link
router.post('/create-payment-link', stripePaymentLinkValidation, PaymentController.createStripePaymentLink);

// Get payment link details
router.get('/payment-link/:payment_id', PaymentController.getPaymentLinkDetails);

// Stripe webhook (without auth middleware for webhook verification)
router.post('/webhook', 
  express.raw({ type: 'application/json' }), // Parse raw body for webhook signature verification
  (req: any, res: any, next: any) => {
    // Temporarily disable auth and clinic context for webhook
    PaymentController.handleStripeWebhook(req, res);
  }
);

// Create Stripe refund
router.post('/:id/stripe-refund', stripeRefundValidation, PaymentController.createStripeRefund);

// Get Stripe statistics
router.get('/stripe/stats', PaymentController.getStripeStats);

// Resend payment link
router.post('/payment-link/:payment_id/resend', PaymentController.resendPaymentLink);

export default router; 