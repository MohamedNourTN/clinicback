import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITenantSubscription extends Document {
  _id: Types.ObjectId;
  tenant_id: Types.ObjectId;
  plan_id: Types.ObjectId;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  current_period_start: Date;
  current_period_end: Date;
  trial_start?: Date;
  trial_end?: Date;
  cancel_at_period_end: boolean;
  canceled_at?: Date;
  ended_at?: Date;
  price_amount: number;
  currency: string;
  payment_method?: string;
  next_payment_attempt?: Date;
  last_payment_date?: Date;
  created_by: Types.ObjectId; // Reference to SuperAdmin who created
  created_at: Date;
  updated_at: Date;
}

const TenantSubscriptionSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  plan_id: {
    type: Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: [true, 'Plan ID is required'],
    index: true
  },
  stripe_subscription_id: {
    type: String,
    required: [true, 'Stripe subscription ID is required'],
    unique: true,
    trim: true,
    index: true
  },
  stripe_customer_id: {
    type: String,
    required: [true, 'Stripe customer ID is required'],
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'],
    required: [true, 'Subscription status is required'],
    index: true
  },
  current_period_start: {
    type: Date,
    required: [true, 'Current period start is required']
  },
  current_period_end: {
    type: Date,
    required: [true, 'Current period end is required']
  },
  trial_start: {
    type: Date
  },
  trial_end: {
    type: Date
  },
  cancel_at_period_end: {
    type: Boolean,
    default: false
  },
  canceled_at: {
    type: Date
  },
  ended_at: {
    type: Date
  },
  price_amount: {
    type: Number,
    required: [true, 'Price amount is required'],
    min: [0, 'Price amount cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    uppercase: true,
    enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'],
    default: 'USD'
  },
  payment_method: {
    type: String,
    trim: true
  },
  next_payment_attempt: {
    type: Date
  },
  last_payment_date: {
    type: Date
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
TenantSubscriptionSchema.index({ tenant_id: 1, status: 1 });
TenantSubscriptionSchema.index({ stripe_subscription_id: 1, status: 1 });
TenantSubscriptionSchema.index({ status: 1, current_period_end: 1 });
TenantSubscriptionSchema.index({ current_period_end: 1 }); // For renewal checks

// Ensure only one active subscription per tenant
TenantSubscriptionSchema.index(
  { tenant_id: 1, status: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { 
      status: { $in: ['active', 'trialing', 'past_due'] } 
    } 
  }
);

// Virtual for formatted price
TenantSubscriptionSchema.virtual('formatted_price').get(function() {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency as string
  });
  return formatter.format((this.price_amount as number) / 100); // Stripe uses cents
});

// Virtual to check if subscription is in trial
TenantSubscriptionSchema.virtual('is_trial').get(function() {
  return this.status === 'trialing' && this.trial_end && new Date() < new Date(this.trial_end as string);
});

// Virtual to check if subscription is past due
TenantSubscriptionSchema.virtual('is_past_due').get(function() {
  return this.status === 'past_due' || (this.current_period_end && new Date() > new Date(this.current_period_end as string) && this.status === 'active');
});

// Virtual to get days until renewal
TenantSubscriptionSchema.virtual('days_until_renewal').get(function() {
  if (!this.current_period_end) return null;
  const diffTime = new Date(this.current_period_end as string).getTime() - new Date().getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Export the model
const TenantSubscription = mongoose.model<ITenantSubscription>('TenantSubscription', TenantSubscriptionSchema);
export default TenantSubscription;
