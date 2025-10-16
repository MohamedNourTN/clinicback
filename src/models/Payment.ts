import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  invoice_id?: mongoose.Types.ObjectId; // Optional for standalone payment links
  patient_id: mongoose.Types.ObjectId;
  amount: number;
  currency: string; // Add currency field
  method: 'credit_card' | 'cash' | 'bank_transfer' | 'upi' | 'insurance' | 'stripe';
  status: 'completed' | 'pending' | 'processing' | 'failed' | 'refunded';
  transaction_id?: string;
  card_last4?: string;
  insurance_provider?: string;
  processing_fee: number;
  net_amount: number;
  payment_date: Date;
  failure_reason?: string;
  description: string;
  
  // Stripe-specific fields
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  stripe_customer_id?: string;
  payment_link?: string;
  customer_email?: string;
  
  created_at: Date;
  updated_at: Date;
}

const PaymentSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  invoice_id: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice',
    required: false // Optional for standalone payment links
  },
  patient_id: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Payment amount must be a valid positive number'
    }
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'USD',
    uppercase: true,
    validate: {
      validator: function(value: string) {
        // Basic currency code validation (3 letters)
        return /^[A-Z]{3}$/.test(value);
      },
      message: 'Currency must be a valid 3-letter currency code'
    }
  },
  method: {
    type: String,
    enum: ['credit_card', 'cash', 'bank_transfer', 'upi', 'insurance', 'stripe'],
    required: [true, 'Payment method is required']
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'processing', 'failed', 'refunded'],
    required: [true, 'Payment status is required'],
    default: 'pending'
  },
  transaction_id: {
    type: String,
    trim: true,
    maxlength: [100, 'Transaction ID cannot exceed 100 characters']
  },
  card_last4: {
    type: String,
    trim: true,
    maxlength: [4, 'Card last 4 digits cannot exceed 4 characters'],
    minlength: [4, 'Card last 4 digits must be exactly 4 characters']
  },
  insurance_provider: {
    type: String,
    trim: true,
    maxlength: [200, 'Insurance provider name cannot exceed 200 characters']
  },
  processing_fee: {
    type: Number,
    required: [true, 'Processing fee is required'],
    min: [0, 'Processing fee cannot be negative'],
    default: 0
  },
  net_amount: {
    type: Number,
    min: [0, 'Net amount cannot be negative']
  },
  payment_date: {
    type: Date,
    required: [true, 'Payment date is required'],
    default: Date.now
  },
  failure_reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Failure reason cannot exceed 500 characters']
  },
  description: {
    type: String,
    required: [true, 'Payment description is required'],
    trim: true,
    maxlength: [500, 'Payment description cannot exceed 500 characters']
  },
  
  // Stripe-specific fields
  stripe_payment_intent_id: {
    type: String,
    trim: true,
    sparse: true, // Allow multiple null/undefined values
    index: true
  },
  stripe_checkout_session_id: {
    type: String,
    trim: true,
    sparse: true, // Allow multiple null/undefined values
    index: true
  },
  stripe_customer_id: {
    type: String,
    trim: true,
    sparse: true
  },
  payment_link: {
    type: String,
    trim: true,
    validate: {
      validator: function(value: string) {
        if (!value) return true; // Allow empty values
        return /^https?:\/\/.+/.test(value);
      },
      message: 'Payment link must be a valid URL'
    }
  },
  customer_email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(value: string) {
        if (!value) return true; // Allow empty values
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
      message: 'Customer email must be a valid email address'
    }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create tenant and clinic-aware indexes for better query performance
PaymentSchema.index({ tenant_id: 1 });
PaymentSchema.index({ tenant_id: 1, clinic_id: 1 });
PaymentSchema.index({ tenant_id: 1, clinic_id: 1, invoice_id: 1 });
PaymentSchema.index({ tenant_id: 1, clinic_id: 1, patient_id: 1, payment_date: -1 });
PaymentSchema.index({ tenant_id: 1, clinic_id: 1, status: 1, payment_date: -1 });
PaymentSchema.index({ tenant_id: 1, clinic_id: 1, method: 1 });
PaymentSchema.index({ tenant_id: 1, clinic_id: 1, payment_date: -1 });

// Stripe-specific indexes
PaymentSchema.index({ stripe_payment_intent_id: 1 }, { sparse: true });
PaymentSchema.index({ stripe_checkout_session_id: 1 }, { sparse: true });
PaymentSchema.index({ tenant_id: 1, clinic_id: 1, customer_email: 1 });

// Pre-save middleware to calculate net amount
PaymentSchema.pre('save', function(next) {
  // Always calculate net_amount for new documents or when amount/processing_fee are modified
  if (this.isNew || this.isModified('amount') || this.isModified('processing_fee')) {
    this.net_amount = (this.amount as number) - (this.processing_fee as number);
  }
  next();
});

// Virtual to generate payment ID for display
PaymentSchema.virtual('payment_id').get(function() {
  return `PAY-${(this._id as any).toString().slice(-6).toUpperCase()}`;
});

export default mongoose.model<IPayment>('Payment', PaymentSchema); 