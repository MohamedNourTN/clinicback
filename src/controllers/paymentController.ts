import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Payment, Invoice, Patient } from '../models';
import { AuthRequest } from '../types/express';
import mongoose from 'mongoose';
import StripeService from '../utils/stripe';
import Stripe from 'stripe';

export class PaymentController {
  // Create a new payment
  static async createPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const paymentData = {
        ...req.body,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      };
      
      const payment = new Payment(paymentData);
      await payment.save();

      // If payment is completed, update invoice with partial payment logic
      if (payment.status === 'completed' && payment.invoice_id) {
        const invoice = await Invoice.findById(payment.invoice_id);
        if (invoice) {
          invoice.addPayment(
            payment._id as mongoose.Types.ObjectId,
            payment.amount,
            payment.method,
            payment.transaction_id
          );
          await invoice.save();
        }
      }

      const populatedPayment = await Payment.findById(payment._id)
        .populate('invoice_id', 'invoice_number total_amount')
        .populate('patient_id', 'first_name last_name email');

      res.status(201).json({
        success: true,
        message: 'Payment created successfully',
        data: populatedPayment
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create payment',
        error: error.message
      });
    }
  }

  // Get all payments with filters
  static async getAllPayments(req: AuthRequest, res: Response) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        method, 
        patient_id,
        start_date, 
        end_date 
      } = req.query;

      const query: any = {
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      };
      
      if (status) query.status = status;
      if (method) query.method = method;
      if (patient_id) query.patient_id = patient_id;
      
      if (start_date || end_date) {
        query.payment_date = {};
        if (start_date) query.payment_date.$gte = new Date(start_date as string);
        if (end_date) query.payment_date.$lte = new Date(end_date as string);
      }

      const skip = (Number(page) - 1) * Number(limit);

      const payments = await Payment.find(query)
        .populate('invoice_id', 'invoice_number total_amount')
        .populate('patient_id', 'first_name last_name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Payment.countDocuments(query);

      res.json({
        success: true,
        data: {
          items: payments,
          pagination: {
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            total: total,
            limit: Number(limit)
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payments',
        error: error.message
      });
    }
  }

  // Get payment by ID
  static async getPaymentById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
        return;
      }

      const payment = await Payment.findOne({
        _id: id,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      })
        .populate('invoice_id', 'invoice_number total_amount services')
        .populate('patient_id', 'first_name last_name email phone');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      res.json({
        success: true,
        data: payment
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment',
        error: error.message
      });
    }
  }

  // Update payment
  static async updatePayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
        return;
      }

      const payment = await Payment.findOneAndUpdate(
        { _id: id, tenant_id: req.tenant_id, clinic_id: req.clinic_id },
        req.body,
        { new: true, runValidators: true }
      )
        .populate('invoice_id', 'invoice_number total_amount')
        .populate('patient_id', 'first_name last_name email');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      // Update invoice status if payment is completed
      if (payment.status === 'completed') {
        await Invoice.findByIdAndUpdate(payment.invoice_id, {
          status: 'paid',
          paid_at: payment.payment_date,
          payment_method: payment.method
        });
      }

      res.json({
        success: true,
        message: 'Payment updated successfully',
        data: payment
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update payment',
        error: error.message
      });
    }
  }

  // Update payment status
  static async updatePaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, failure_reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
        return;
      }

      const updateData: any = { status };
      if (failure_reason) updateData.failure_reason = failure_reason;
      if (status === 'completed') updateData.payment_date = new Date();

      const payment = await Payment.findOneAndUpdate(
        { _id: id, tenant_id: req.tenant_id, clinic_id: req.clinic_id },
        updateData,
        { new: true }
      )
        .populate('invoice_id', 'invoice_number total_amount')
        .populate('patient_id', 'first_name last_name email');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      // Update invoice status if payment is completed
      if (status === 'completed' && payment.invoice_id) {
        const invoice = await Invoice.findById(payment.invoice_id);
        if (invoice) {
          invoice.addPayment(
            payment._id as mongoose.Types.ObjectId,
            payment.amount,
            payment.method,
            payment.transaction_id
          );
          await invoice.save();
        }
      }

      res.json({
        success: true,
        message: 'Payment status updated successfully',
        data: payment
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update payment status',
        error: error.message
      });
    }
  }

  // Get payment statistics
  static async getPaymentStats(req: AuthRequest, res: Response) {
    try {
      const { start_date, end_date } = req.query;
      
      const dateFilter: any = {
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      };
      if (start_date || end_date) {
        dateFilter.payment_date = {};
        if (start_date) dateFilter.payment_date.$gte = new Date(start_date as string);
        if (end_date) dateFilter.payment_date.$lte = new Date(end_date as string);
      }

      // Get current month dates for monthly revenue calculation
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [stats, monthlyStats] = await Promise.all([
        // Total stats calculation
        Payment.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: null,
              total_payments: { $sum: 1 },
              total_revenue: { 
                $sum: { 
                  $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] 
                } 
              },
              completed_payments: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
              },
              failed_payments: {
                $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
              },
              pending_payments: {
                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
              },
              processing_payments: {
                $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
              }
            }
          }
        ]),
        // Current month revenue calculation
        Payment.aggregate([
          { 
            $match: { 
              tenant_id: req.tenant_id,
              clinic_id: req.clinic_id,
              status: 'completed',
              payment_date: { 
                $gte: startOfMonth,
                $lt: startOfNextMonth
              }
            } 
          },
          {
            $group: {
              _id: null,
              monthly_revenue: { $sum: '$amount' },
              monthly_payments_count: { $sum: 1 }
            }
          }
        ])
      ]);

      const methodStats = await Payment.aggregate([
        { $match: { ...dateFilter, status: 'completed' } },
        {
          $group: {
            _id: '$method',
            count: { $sum: 1 },
            total_amount: { $sum: '$amount' }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            ...(stats[0] || {
              total_payments: 0,
              total_revenue: 0,
              completed_payments: 0,
              failed_payments: 0,
              pending_payments: 0,
              processing_payments: 0
            }),
            monthly_revenue: monthlyStats[0]?.monthly_revenue || 0,
            monthly_payments_count: monthlyStats[0]?.monthly_payments_count || 0
          },
          by_method: methodStats
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment statistics',
        error: error.message
      });
    }
  }

  // Initiate refund
  static async initiateRefund(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { refund_amount, reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
        return;
      }

      const payment = await Payment.findOne({
        _id: id,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      });
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      if (payment.status !== 'completed') {
        res.status(400).json({
          success: false,
          message: 'Can only refund completed payments'
        });
        return;
      }

      // Create refund record (you might want a separate Refund model)
      payment.status = 'refunded';
      payment.failure_reason = reason;
      await payment.save();

      // Update invoice status back to pending if fully refunded
      if (refund_amount >= payment.amount) {
        await Invoice.findByIdAndUpdate(payment.invoice_id, {
          status: 'pending',
          paid_at: undefined,
          payment_method: undefined
        });
      }

      res.json({
        success: true,
        message: 'Refund initiated successfully',
        data: payment
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to initiate refund',
        error: error.message
      });
    }
  }

  // Record payment against an invoice (supports partial payments)
  static async recordInvoicePayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { 
        invoice_id, 
        amount, 
        method, 
        transaction_id, 
        description 
      } = req.body;

      // Validate required fields
      if (!invoice_id || !amount || !method || !description) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: invoice_id, amount, method, description'
        });
        return;
      }

      // Validate invoice exists and belongs to the clinic
      const invoice = await Invoice.findOne({
        _id: invoice_id,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      }).populate('patient_id', 'first_name last_name email');

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found or does not belong to your clinic'
        });
        return;
      }

      // Check if invoice is in a state that allows payments
      if (['paid', 'cancelled', 'refunded'].includes(invoice.status)) {
        res.status(400).json({
          success: false,
          message: `Cannot record payment for invoice with status: ${invoice.status}`
        });
        return;
      }

      // Validate payment amount
      const paymentAmount = parseFloat(amount);
      if (paymentAmount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Payment amount must be greater than 0'
        });
        return;
      }

      if (paymentAmount > invoice.due_amount) {
        res.status(400).json({
          success: false,
          message: `Payment amount (${paymentAmount}) cannot exceed due amount (${invoice.due_amount})`
        });
        return;
      }

      // Create the payment record
      const paymentData = {
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id,
        invoice_id: invoice._id,
        patient_id: invoice.patient_id._id,
        amount: paymentAmount,
        currency: 'USD', // You might want to get this from invoice or clinic settings
        method: method,
        status: 'completed',
        transaction_id: transaction_id,
        processing_fee: 0,
        net_amount: paymentAmount,
        payment_date: new Date(),
        description: description
      };

      const payment = new Payment(paymentData);
      await payment.save();

      // Update invoice with the payment
      invoice.addPayment(
        payment._id as mongoose.Types.ObjectId,
        paymentAmount,
        method,
        transaction_id
      );
      await invoice.save();

      // Populate the payment for response
      const populatedPayment = await Payment.findById(payment._id)
        .populate('invoice_id', 'invoice_number total_amount total_paid_amount due_amount status')
        .populate('patient_id', 'first_name last_name email');

      res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: {
          payment: populatedPayment,
          invoice_status: invoice.status,
          remaining_due: invoice.due_amount
        }
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to record payment',
        error: error.message
      });
    }
  }

  // ===== STRIPE PAYMENT METHODS =====

  /**
   * Create a Stripe payment link
   */
  static async createStripePaymentLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { amount, currency = 'USD', description, customer_email, patient_id, success_url, cancel_url, metadata } = req.body;

      // Validate required fields
      if (!amount || !description || !customer_email || !patient_id) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: amount, description, customer_email, patient_id'
        });
        return;
      }

      // Validate patient exists and belongs to the clinic
      const patient = await Patient.findOne({
        _id: patient_id,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      });

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found or does not belong to your clinic'
        });
        return;
      }

      // Create payment link using Stripe service
      const result = await StripeService.createPaymentLink({
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        description,
        customer_email,
        patient_id,
        clinic_id: req.clinic_id!,
        success_url,
        cancel_url,
        metadata
      });

      res.status(201).json({
        success: true,
        message: 'Payment link created successfully',
        data: {
          payment_id: result.payment_record._id,
          payment_link: result.payment_link,
          checkout_session_id: result.checkout_session.id,
          expires_at: result.checkout_session.expires_at,
          amount,
          currency: currency.toUpperCase(),
          customer_email,
          patient: {
            id: patient._id,
            name: `${patient.first_name} ${patient.last_name}`,
            email: patient.email
          }
        }
      });

    } catch (error: any) {
      console.error('Error creating Stripe payment link:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment link',
        error: error.message
      });
    }
  }

  /**
   * Get payment link details
   */
  static async getPaymentLinkDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { payment_id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(payment_id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
        return;
      }

      const payment = await Payment.findOne({
        _id: payment_id,
        clinic_id: req.clinic_id,
        method: 'stripe'
      })
        .populate('patient_id', 'first_name last_name email phone')
        .populate('invoice_id', 'invoice_number total_amount');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      // Get additional details from Stripe if available
      let stripeDetails: Stripe.Checkout.Session | null = null;
      if (payment.stripe_checkout_session_id) {
        try {
          stripeDetails = await StripeService.getCheckoutSession(payment.stripe_checkout_session_id);
        } catch (stripeError) {
          console.warn('Could not fetch Stripe details:', stripeError);
        }
      }

      res.json({
        success: true,
        data: {
          ...payment.toObject(),
          stripe_details: stripeDetails ? {
            status: stripeDetails.status,
            expires_at: stripeDetails.expires_at,
            url: stripeDetails.url
          } : null
        }
      });

    } catch (error: any) {
      console.error('Error getting payment link details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment link details',
        error: error.message
      });
    }
  }

  /**
   * Stripe webhook handler
   */
  static async handleStripeWebhook(req: any, res: Response): Promise<void> {
    let event: Stripe.Event;

    try {
      const signature = req.headers['stripe-signature'];
      
      if (!signature) {
        res.status(400).json({
          success: false,
          message: 'Missing Stripe signature'
        });
        return;
      }

      // Verify webhook signature
      event = StripeService.verifyWebhookSignature(req.body, signature);

    } catch (error: any) {
      console.error('Webhook signature verification failed:', error);
      res.status(400).json({
        success: false,
        message: 'Webhook signature verification failed',
        error: error.message
      });
      return;
    }

    try {
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          console.log('Checkout session completed:', session.id);
          
          if (session.metadata?.payment_id) {
            await StripeService.handleSuccessfulPayment(session.id);
            console.log('Payment marked as successful:', session.metadata.payment_id);
          }
          break;

        case 'payment_intent.payment_failed':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log('Payment intent failed:', paymentIntent.id);
          
          const failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
          await StripeService.handleFailedPayment(paymentIntent.id, failureReason);
          console.log('Payment marked as failed:', paymentIntent.id);
          break;

        case 'payment_intent.succeeded':
          const succeededIntent = event.data.object as Stripe.PaymentIntent;
          console.log('Payment intent succeeded:', succeededIntent.id);
          // This is handled by checkout.session.completed, but we can add additional logic here if needed
          break;

        case 'charge.dispute.created':
          const dispute = event.data.object as Stripe.Dispute;
          console.log('Charge dispute created:', dispute.id);
          // Handle dispute creation - maybe notify admin
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({
        success: true,
        message: 'Webhook handled successfully'
      });

    } catch (error: any) {
      console.error('Error handling webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Error handling webhook',
        error: error.message
      });
    }
  }

  /**
   * Create Stripe refund
   */
  static async createStripeRefund(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
        return;
      }

      const payment = await Payment.findOne({
        _id: id,
        clinic_id: req.clinic_id,
        method: 'stripe'
      });

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Stripe payment not found'
        });
        return;
      }

      if (payment.status !== 'completed') {
        res.status(400).json({
          success: false,
          message: 'Can only refund completed payments'
        });
        return;
      }

      // Create refund through Stripe
      const refund = await StripeService.createRefund(id, amount, reason);

      // Get updated payment details
      const updatedPayment = await Payment.findById(id)
        .populate('patient_id', 'first_name last_name email')
        .populate('invoice_id', 'invoice_number total_amount');

      res.json({
        success: true,
        message: 'Stripe refund created successfully',
        data: {
          payment: updatedPayment,
          refund: {
            id: refund.id,
            amount: refund.amount / 100, // Convert from cents
            status: refund.status,
            reason: refund.reason,
            created: refund.created
          }
        }
      });

    } catch (error: any) {
      console.error('Error creating Stripe refund:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create refund',
        error: error.message
      });
    }
  }

  /**
   * Get Stripe payment statistics
   */
  static async getStripeStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { start_date, end_date } = req.query;

      const startDate = start_date ? new Date(start_date as string) : undefined;
      const endDate = end_date ? new Date(end_date as string) : undefined;

      const stats = await StripeService.getPaymentStats(req.clinic_id!, startDate, endDate);

      res.json({
        success: true,
        message: 'Stripe statistics retrieved successfully',
        data: stats
      });

    } catch (error: any) {
      console.error('Error getting Stripe stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Stripe statistics',
        error: error.message
      });
    }
  }

  /**
   * Verify payment by Stripe session ID (public endpoint for success page)
   */
  static async verifyPaymentBySessionId(req: any, res: Response): Promise<void> {
    try {
      const { session_id } = req.params;

      if (!session_id) {
        res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
        return;
      }

      // Find payment by Stripe checkout session ID
      let payment = await Payment.findOne({
        stripe_checkout_session_id: session_id
      })
        .populate('patient_id', 'first_name last_name email')
        .populate('invoice_id', 'invoice_number total_amount');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found for this session'
        });
        return;
      }

      // Get additional details from Stripe
      let stripeDetails: Stripe.Checkout.Session | null = null;
      try {
        stripeDetails = await StripeService.getCheckoutSession(session_id);
        
        // If the Stripe session is completed but our payment is still pending, update it
        if (stripeDetails && 
            stripeDetails.status === 'complete' && 
            stripeDetails.payment_status === 'paid' && 
            payment.status === 'pending') {
          
          console.log(`Updating payment status from pending to completed for session: ${session_id}`);
          
          // Update payment using the existing service method
          await StripeService.handleSuccessfulPayment(session_id);
          
          // Reload the updated payment
          payment = await Payment.findOne({
            stripe_checkout_session_id: session_id
          })
            .populate('patient_id', 'first_name last_name email')
            .populate('invoice_id', 'invoice_number total_amount');
        }
      } catch (stripeError) {
        console.warn('Could not fetch Stripe session details:', stripeError);
      }

      // Double check that payment still exists after potential update
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found after verification'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Payment details retrieved successfully',
        data: {
          payment_id: payment._id,
          session_id: session_id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          description: payment.description,
          customer_email: payment.customer_email,
          payment_date: payment.payment_date,
          patient: payment.patient_id,
          invoice: payment.invoice_id,
          stripe_details: stripeDetails ? {
            status: stripeDetails.status,
            payment_status: stripeDetails.payment_status
          } : null
        }
      });

    } catch (error: any) {
      console.error('Error verifying payment by session ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify payment',
        error: error.message
      });
    }
  }

  /**
   * Resend payment link
   */
  static async resendPaymentLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { payment_id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(payment_id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
        return;
      }

      const payment = await Payment.findOne({
        _id: payment_id,
        clinic_id: req.clinic_id,
        method: 'stripe',
        status: 'pending'
      })
        .populate('patient_id', 'first_name last_name email');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Pending Stripe payment not found'
        });
        return;
      }

      if (!payment.payment_link) {
        res.status(400).json({
          success: false,
          message: 'Payment link not available'
        });
        return;
      }

      // Here you could integrate with your email service to send the link
      // For now, we'll just return the payment link

      res.json({
        success: true,
        message: 'Payment link retrieved successfully',
        data: {
          payment_id: payment._id,
          payment_link: payment.payment_link,
          customer_email: payment.customer_email,
          amount: payment.amount,
          currency: payment.currency,
          description: payment.description,
          patient: payment.patient_id
        }
      });

    } catch (error: any) {
      console.error('Error resending payment link:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend payment link',
        error: error.message
      });
    }
  }
}

export default PaymentController; 