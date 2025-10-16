import mongoose, { Document, Schema } from 'mongoose';

export interface ILead extends Document {
  tenant_id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  source: 'website' | 'referral' | 'social' | 'advertisement' | 'walk-in';
  serviceInterest: string;
  status: 'new' | 'contacted' | 'converted' | 'lost';
  assignedTo?: string;
  notes?: string;
  clinic_id: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const LeadSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [100, 'First name cannot exceed 100 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [100, 'Last name cannot exceed 100 characters']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  source: {
    type: String,
    enum: ['website', 'referral', 'social', 'advertisement', 'walk-in'],
    required: [true, 'Lead source is required']
  },
  serviceInterest: {
    type: String,
    required: [true, 'Service interest is required'],
    trim: true,
    maxlength: [200, 'Service interest cannot exceed 200 characters']
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'converted', 'lost'],
    default: 'new',
    required: [true, 'Status is required']
  },
  assignedTo: {
    type: String,
    trim: true,
    maxlength: [100, 'Assigned to cannot exceed 100 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create index for better search performance
LeadSchema.index({ 
  firstName: 'text', 
  lastName: 'text', 
  email: 'text',
  phone: 'text'
});

// Index for filtering by status and source with tenant awareness
LeadSchema.index({ tenant_id: 1 });
LeadSchema.index({ tenant_id: 1, status: 1 });
LeadSchema.index({ tenant_id: 1, source: 1 });
LeadSchema.index({ tenant_id: 1, assignedTo: 1 });
LeadSchema.index({ tenant_id: 1, clinic_id: 1 });

// Compound index for common queries
LeadSchema.index({ tenant_id: 1, clinic_id: 1, status: 1 });
LeadSchema.index({ tenant_id: 1, clinic_id: 1, source: 1 });
LeadSchema.index({ tenant_id: 1, clinic_id: 1, created_at: -1 });
LeadSchema.index({ tenant_id: 1, status: 1, source: 1 });
LeadSchema.index({ tenant_id: 1, created_at: -1 });

// Virtual for full name
LeadSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

export default mongoose.model<ILead>('Lead', LeadSchema); 