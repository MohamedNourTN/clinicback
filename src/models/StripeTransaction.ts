import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IStripeTransaction extends Document {
  _id: Types.ObjectId;
  tenant_id?: Types.ObjectId; // Optional, as some transactions might be system-wide
  stripe_payment_intent_id?: string;
  stripe_invoice_id?: string;
  stripe_subscription_id?: string;
  stripe_customer_id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded' | 'failed';
  type: 'subscription' | 'one_time' | 'refund' | 'dispute' | 'payout' | 'invoice';
  description: string;
  customer_email?: string;
  payment_method_type?: string;
  card_last4?: string;
  card_brand?: string;
  failure_code?: string;
  failure_message?: string;
  refunded_amount?: number;
  fee_amount?: number;
  net_amount?: number;
  metadata?: Record<string, any>;
  processed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const StripeTransactionSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  stripe_payment_intent_id: {
    type: String,
    sparse: true,
    index: true
  },
  stripe_invoice_id: {
    type: String,
    sparse: true,
    index: true
  },
  stripe_subscription_id: {
    type: String,
    sparse: true,
    index: true
  },
  stripe_customer_id: {
    type: String,
    required: [true, 'Stripe customer ID is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    uppercase: true,
    enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'],
    default: 'USD'
  },
  status: {
    type: String,
    enum: [
      'requires_payment_method', 'requires_confirmation', 'requires_action', 
      'processing', 'requires_capture', 'canceled', 'succeeded', 'failed'
    ],
    required: [true, 'Transaction status is required'],
    index: true
  },
  type: {
    type: String,
    enum: ['subscription', 'one_time', 'refund', 'dispute', 'payout', 'invoice'],
    required: [true, 'Transaction type is required'],
    index: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  customer_email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(value: string) {
        if (!value) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
      message: 'Customer email must be a valid email address'
    }
  },
  payment_method_type: {
    type: String,
    trim: true
  },
  card_last4: {
    type: String,
    trim: true,
    validate: {
      validator: function(value: string) {
        if (!value) return true;
        return /^\d{4}$/.test(value);
      },
      message: 'Card last 4 digits must be exactly 4 digits'
    }
  },
  card_brand: {
    type: String,
    trim: true,
    enum: ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay', 'unknown']
  },
  failure_code: {
    type: String,
    trim: true
  },
  failure_message: {
    type: String,
    trim: true,
    maxlength: [500, 'Failure message cannot exceed 500 characters']
  },
  refunded_amount: {
    type: Number,
    min: [0, 'Refunded amount cannot be negative'],
    default: 0
  },
  fee_amount: {
    type: Number,
    min: [0, 'Fee amount cannot be negative'],
    default: 0
  },
  net_amount: {
    type: Number,
    min: [0, 'Net amount cannot be negative']
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  processed_at: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance
StripeTransactionSchema.index({ tenant_id: 1, status: 1, created_at: -1 });
StripeTransactionSchema.index({ stripe_customer_id: 1, created_at: -1 });
StripeTransactionSchema.index({ status: 1, type: 1, created_at: -1 });
StripeTransactionSchema.index({ created_at: -1 }); // For date-based queries
StripeTransactionSchema.index({ type: 1, status: 1 });

// Virtual for formatted amount
StripeTransactionSchema.virtual('formatted_amount').get(function() {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency as string
  });
  return formatter.format((this.amount as number) / 100); // Stripe uses cents
});

// Virtual for formatted refunded amount
StripeTransactionSchema.virtual('formatted_refunded_amount').get(function() {
  if (!this.refunded_amount) return null;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency as string
  });
  return formatter.format((this.refunded_amount as number) / 100);
});

// Virtual for formatted net amount
StripeTransactionSchema.virtual('formatted_net_amount').get(function() {
  if (!this.net_amount) return null;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency as string
  });
  return formatter.format((this.net_amount as number) / 100);
});

// Virtual to check if transaction is successful
StripeTransactionSchema.virtual('is_successful').get(function() {
  return this.status === 'succeeded';
});

// Virtual to check if transaction is refundable
StripeTransactionSchema.virtual('is_refundable').get(function() {
  return this.status === 'succeeded' && (this.refunded_amount as number) < (this.amount as number);
});

// Export the model
const StripeTransaction = mongoose.model<IStripeTransaction>('StripeTransaction', StripeTransactionSchema);
export default StripeTransaction;
