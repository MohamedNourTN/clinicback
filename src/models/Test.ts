import mongoose, { Document, Schema } from 'mongoose';

export interface ITest extends Document {
  tenant_id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  category: string;
  description: string;
  normalRange?: string;
  units?: string;
  methodology?: string;
  turnaroundTime: string;
  sampleType?: string;
  clinic_id: mongoose.Types.ObjectId;
  isActive: boolean;
  created_at: Date;
  updated_at: Date;
}

const TestSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Test name is required'],
    trim: true,
    maxlength: [200, 'Test name cannot exceed 200 characters']
  },
  code: {
    type: String,
    required: [true, 'Test code is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Test code cannot exceed 20 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  normalRange: {
    type: String,
    trim: true,
    maxlength: [500, 'Normal range cannot exceed 500 characters']
  },
  units: {
    type: String,
    trim: true,
    maxlength: [50, 'Units cannot exceed 50 characters']
  },
  methodology: {
    type: String,
    trim: true,
    maxlength: [200, 'Methodology cannot exceed 200 characters']
  },
  turnaroundTime: {
    type: String,
    required: [true, 'Turnaround time is required'],
    trim: true,
    maxlength: [100, 'Turnaround time cannot exceed 100 characters']
  },
  sampleType: {
    type: String,
    trim: true,
    maxlength: [100, 'Sample type cannot exceed 100 characters']
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for better performance with tenant awareness
TestSchema.index({ tenant_id: 1 });
TestSchema.index({ tenant_id: 1, name: 'text', code: 'text', description: 'text' });
TestSchema.index({ tenant_id: 1, category: 1 });
TestSchema.index({ tenant_id: 1, isActive: 1 });
TestSchema.index({ tenant_id: 1, methodology: 1 });
TestSchema.index({ tenant_id: 1, clinic_id: 1 });

// Compound indexes for tenant/clinic-based queries
TestSchema.index({ tenant_id: 1, clinic_id: 1, name: 1 }, { unique: true });
TestSchema.index({ tenant_id: 1, clinic_id: 1, code: 1 }, { unique: true });
TestSchema.index({ tenant_id: 1, clinic_id: 1, category: 1 });
TestSchema.index({ tenant_id: 1, clinic_id: 1, isActive: 1 });
TestSchema.index({ tenant_id: 1, clinic_id: 1, methodology: 1 });

// Pre-save middleware to ensure code is uppercase
TestSchema.pre('save', function(this: ITest, next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  next();
});

export default mongoose.model<ITest>('Test', TestSchema); 