import Stripe from 'stripe';
import Payment from '../models/Payment';
import Patient from '../models/Patient';
import { Types } from 'mongoose';

// Initialize Stripe with the secret key
const stripeKey = process.env.STRIPE_SECRET_KEY || '';

if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY is not set in environment variables');
  throw new Error('STRIPE_SECRET_KEY is required for payment functionality');
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export interface CreatePaymentLinkParams {
  amount: number;
  currency: string;
  description: string;
  customer_email: string;
  patient_id: string;
  clinic_id: string;
  success_url?: string;
  cancel_url?: string;
  metadata?: Record<string, string>;
}

export interface StripeCustomerParams {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export class StripeService {
  
  /**
   * Create or retrieve a Stripe customer
   */
  static async createOrGetCustomer(params: StripeCustomerParams): Promise<Stripe.Customer> {
    try {
      // Check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email: params.email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email: params.email,
        name: params.name,
        phone: params.phone,
        metadata: params.metadata || {}
      });

      return customer;
    } catch (error: any) {
      console.error('Error creating/getting Stripe customer:', error);
      throw new Error(`Failed to create Stripe customer: ${error.message}`);
    }
  }

  /**
   * Create a payment link using Stripe Checkout Session
   */
  static async createPaymentLink(params: CreatePaymentLinkParams): Promise<{
    payment_link: string;
    checkout_session: Stripe.Checkout.Session;
    payment_record: any;
  }> {
    try {
      // Validate required environment variables
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
      }

      // Get patient details for customer creation
      const patient = await Patient.findById(params.patient_id);
      if (!patient) {
        throw new Error('Patient not found');
      }

      // Create or get Stripe customer
      const customer = await this.createOrGetCustomer({
        email: params.customer_email,
        name: `${patient.first_name} ${patient.last_name}`,
        phone: patient.phone,
        metadata: {
          patient_id: params.patient_id,
          clinic_id: params.clinic_id
        }
      });

      // Create payment record in database first
      const paymentRecord = new Payment({
        clinic_id: new Types.ObjectId(params.clinic_id),
        patient_id: new Types.ObjectId(params.patient_id),
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        method: 'stripe',
        status: 'pending',
        processing_fee: 0, // Will be updated after payment
        net_amount: params.amount,
        payment_date: new Date(),
        description: params.description,
        customer_email: params.customer_email,
        stripe_customer_id: customer.id
      });

      await paymentRecord.save();

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: params.currency.toLowerCase(),
              product_data: {
                name: params.description,
                description: `Payment for patient: ${patient.first_name} ${patient.last_name}`,
              },
              unit_amount: Math.round(params.amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: params.success_url || `${process.env.FRONTEND_URL || 'http://localhost:5174'}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: params.cancel_url || `${process.env.FRONTEND_URL || 'http://localhost:5174'}/payments/cancelled`,
        metadata: {
          payment_id: (paymentRecord._id as Types.ObjectId).toString(),
          patient_id: params.patient_id,
          clinic_id: params.clinic_id,
          ...(params.metadata || {})
        },
        payment_intent_data: {
          metadata: {
            payment_id: (paymentRecord._id as Types.ObjectId).toString(),
            patient_id: params.patient_id,
            clinic_id: params.clinic_id
          }
        },
        expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Expires in 24 hours
      });

      // Update payment record with Stripe session info
      paymentRecord.stripe_checkout_session_id = session.id;
      paymentRecord.payment_link = session.url || '';
      await paymentRecord.save();

      console.log('Payment link created successfully:', {
        payment_id: paymentRecord._id,
        session_id: session.id,
        customer_id: customer.id
      });

      return {
        payment_link: session.url || '',
        checkout_session: session,
        payment_record: paymentRecord
      };

    } catch (error: any) {
      console.error('Error creating payment link:', error);
      throw new Error(`Failed to create payment link: ${error.message}`);
    }
  }

  /**
   * Retrieve checkout session details
   */
  static async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'payment_intent.charges', 'customer']
      });
      return session;
    } catch (error: any) {
      console.error('Error retrieving checkout session:', error);
      throw new Error(`Failed to retrieve checkout session: ${error.message}`);
    }
  }

  /**
   * Handle successful payment
   */
  static async handleSuccessfulPayment(sessionId: string): Promise<void> {
    try {
      const session = await this.getCheckoutSession(sessionId);
      
      if (!session.metadata?.payment_id) {
        throw new Error('Payment ID not found in session metadata');
      }

      const payment = await Payment.findById(session.metadata.payment_id);
      if (!payment) {
        throw new Error('Payment record not found');
      }

      // Update payment status
      payment.status = 'completed';
      payment.stripe_payment_intent_id = typeof session.payment_intent === 'string' 
        ? session.payment_intent 
        : session.payment_intent?.id || '';
      payment.transaction_id = typeof session.payment_intent === 'string' 
        ? session.payment_intent 
        : session.payment_intent?.id || '';
      payment.payment_date = new Date();

      // Calculate processing fee (Stripe's fee)
      if (session.payment_intent && typeof session.payment_intent === 'object') {
        const paymentIntent = session.payment_intent as Stripe.PaymentIntent & {
          charges: Stripe.ApiList<Stripe.Charge>;
        };
        if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
          const charge = paymentIntent.charges.data[0];
          payment.processing_fee = (charge.application_fee_amount || 0) / 100;
          payment.net_amount = payment.amount - payment.processing_fee;
        }
      }

      await payment.save();

      console.log('Payment marked as successful:', {
        payment_id: payment._id,
        session_id: sessionId,
        amount: payment.amount
      });

    } catch (error: any) {
      console.error('Error handling successful payment:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  static async handleFailedPayment(paymentIntentId: string, failureReason?: string): Promise<void> {
    try {
      const payment = await Payment.findOne({
        stripe_payment_intent_id: paymentIntentId
      });

      if (!payment) {
        console.warn('Payment record not found for failed payment intent:', paymentIntentId);
        return;
      }

      payment.status = 'failed';
      payment.failure_reason = failureReason || 'Payment failed';
      await payment.save();

      console.log('Payment marked as failed:', {
        payment_id: payment._id,
        payment_intent_id: paymentIntentId,
        reason: failureReason
      });

    } catch (error: any) {
      console.error('Error handling failed payment:', error);
      throw error;
    }
  }

  /**
   * Create a refund
   */
  static async createRefund(paymentId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new Error('Can only refund completed payments');
      }

      if (!payment.stripe_payment_intent_id) {
        throw new Error('Stripe payment intent ID not found');
      }

      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents if specified
        reason: reason as any || 'requested_by_customer',
        metadata: {
          payment_id: paymentId,
          clinic_id: payment.clinic_id.toString()
        }
      });

      // Update payment status
      payment.status = 'refunded';
      await payment.save();

      console.log('Refund created successfully:', {
        payment_id: paymentId,
        refund_id: refund.id,
        amount: refund.amount / 100
      });

      return refund;

    } catch (error: any) {
      console.error('Error creating refund:', error);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(body: string, signature: string): Stripe.Event {
    try {
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
      }

      return stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error: any) {
      console.error('Webhook signature verification failed:', error);
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }

  /**
   * Get payment statistics for a clinic
   */
  static async getPaymentStats(clinicId: string, startDate?: Date, endDate?: Date) {
    try {
      const matchFilter: any = {
        clinic_id: new Types.ObjectId(clinicId),
        method: 'stripe'
      };

      if (startDate || endDate) {
        matchFilter.payment_date = {};
        if (startDate) matchFilter.payment_date.$gte = startDate;
        if (endDate) matchFilter.payment_date.$lte = endDate;
      }

      const stats = await Payment.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total_amount: { $sum: '$amount' },
            total_fees: { $sum: '$processing_fee' }
          }
        }
      ]);

      const summary = {
        total_payments: 0,
        successful_payments: 0,
        failed_payments: 0,
        pending_payments: 0,
        total_amount: 0,
        total_fees: 0,
        net_amount: 0
      };

      stats.forEach(stat => {
        summary.total_payments += stat.count;
        summary.total_amount += stat.total_amount;
        summary.total_fees += stat.total_fees;

        switch (stat._id) {
          case 'completed':
            summary.successful_payments = stat.count;
            break;
          case 'failed':
            summary.failed_payments = stat.count;
            break;
          case 'pending':
            summary.pending_payments = stat.count;
            break;
        }
      });

      summary.net_amount = summary.total_amount - summary.total_fees;

      return summary;

    } catch (error: any) {
      console.error('Error getting payment stats:', error);
      throw new Error(`Failed to get payment stats: ${error.message}`);
    }
  }
}

export default StripeService;
