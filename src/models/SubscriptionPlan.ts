import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  _id: Types.ObjectId;
  stripe_price_id: string;
  stripe_product_id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  interval_count: number;
  trial_period_days?: number;
  features: string[];
  max_clinics: number;
  max_users: number;
  max_patients: number;
  is_active: boolean;
  is_default: boolean; // Only one can be default
  created_by: Types.ObjectId; // Reference to SuperAdmin
  created_at: Date;
  updated_at: Date;
}

const SubscriptionPlanSchema: Schema = new Schema({
  stripe_price_id: {
    type: String,
    required: [true, 'Stripe price ID is required'],
    unique: true,
    trim: true,
    index: true
  },
  stripe_product_id: {
    type: String,
    required: [true, 'Stripe product ID is required'],
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true,
    maxlength: [100, 'Plan name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Plan description is required'],
    trim: true,
    maxlength: [500, 'Plan description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    uppercase: true,
    enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'],
    default: 'USD'
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    required: [true, 'Billing interval is required'],
    default: 'month'
  },
  interval_count: {
    type: Number,
    required: [true, 'Interval count is required'],
    min: [1, 'Interval count must be at least 1'],
    default: 1
  },
  trial_period_days: {
    type: Number,
    min: [0, 'Trial period cannot be negative'],
    max: [365, 'Trial period cannot exceed 365 days'],
    default: 0
  },
  features: [{
    type: String,
    trim: true,
    maxlength: [200, 'Feature description cannot exceed 200 characters']
  }],
  max_clinics: {
    type: Number,
    required: [true, 'Maximum clinics limit is required'],
    min: [1, 'Must allow at least 1 clinic'],
    default: 1
  },
  max_users: {
    type: Number,
    required: [true, 'Maximum users limit is required'],
    min: [1, 'Must allow at least 1 user'],
    default: 5
  },
  max_patients: {
    type: Number,
    required: [true, 'Maximum patients limit is required'],
    min: [1, 'Must allow at least 1 patient'],
    default: 100
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  is_default: {
    type: Boolean,
    default: false,
    index: true
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    required: [true, 'Created by is required']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance
SubscriptionPlanSchema.index({ is_active: 1, is_default: 1 });
SubscriptionPlanSchema.index({ stripe_price_id: 1 });
SubscriptionPlanSchema.index({ stripe_product_id: 1 });

// Ensure only one plan can be default
SubscriptionPlanSchema.pre('save', async function() {
  if (this.is_default && this.isModified('is_default')) {
    // Remove default from all other plans
    await (this.constructor as any).updateMany(
      { _id: { $ne: this._id } },
      { is_default: false }
    );
  }
});

// Virtual for formatted price
SubscriptionPlanSchema.virtual('formatted_price').get(function() {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency as string
  });
  return formatter.format((this.price as number) / 100); // Stripe uses cents
});

// Export the model
const SubscriptionPlan = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);
export default SubscriptionPlan;
