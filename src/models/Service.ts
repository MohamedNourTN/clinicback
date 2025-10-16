import mongoose, { Document, Schema } from 'mongoose';

export interface IService extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  name: string;
  category: string;
  description: string;
  duration: number; // in minutes
  price: number;
  department: string;
  isActive: boolean;
  prerequisites?: string;
  followUpRequired: boolean;
  maxBookingsPerDay: number;
  specialInstructions?: string;
  created_at: Date;
  updated_at: Date;
}

const ServiceSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    max: 1440 // Max 24 hours
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  department: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  prerequisites: {
    type: String,
    trim: true,
    maxlength: 500
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  maxBookingsPerDay: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  specialInstructions: {
    type: String,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance with tenant awareness
ServiceSchema.index({ tenant_id: 1 });
ServiceSchema.index({ tenant_id: 1, clinic_id: 1 });
ServiceSchema.index({ tenant_id: 1, clinic_id: 1, name: 1 });
ServiceSchema.index({ tenant_id: 1, clinic_id: 1, category: 1 });
ServiceSchema.index({ tenant_id: 1, clinic_id: 1, department: 1 });
ServiceSchema.index({ tenant_id: 1, clinic_id: 1, isActive: 1 });
ServiceSchema.index({ tenant_id: 1, clinic_id: 1, price: 1 });
ServiceSchema.index({ tenant_id: 1, clinic_id: 1, isActive: 1, category: 1 }); // Compound index for common queries

export default mongoose.model<IService>('Service', ServiceSchema); 