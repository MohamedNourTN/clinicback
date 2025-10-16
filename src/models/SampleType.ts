import mongoose, { Document, Schema } from 'mongoose';

export interface ISampleType extends Document {
  tenant_id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description: string;
  category: 'blood' | 'urine' | 'body_fluid' | 'tissue' | 'swab' | 'other';
  collectionMethod: string;
  container: string;
  preservative?: string;
  storageTemp: string;
  storageTime: string;
  volume: string;
  specialInstructions?: string;
  commonTests: string[];
  clinic_id: mongoose.Types.ObjectId;
  isActive: boolean;
  created_at: Date;
  updated_at: Date;
}

const SampleTypeSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Sample type name is required'],
    trim: true,
    maxlength: [100, 'Sample type name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Sample type code is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Sample type code cannot exceed 20 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['blood', 'urine', 'body_fluid', 'tissue', 'swab', 'other'],
      message: 'Invalid sample category'
    }
  },
  collectionMethod: {
    type: String,
    required: [true, 'Collection method is required'],
    trim: true,
    maxlength: [200, 'Collection method cannot exceed 200 characters']
  },
  container: {
    type: String,
    required: [true, 'Container information is required'],
    trim: true,
    maxlength: [200, 'Container information cannot exceed 200 characters']
  },
  preservative: {
    type: String,
    trim: true,
    maxlength: [100, 'Preservative information cannot exceed 100 characters']
  },
  storageTemp: {
    type: String,
    required: [true, 'Storage temperature is required'],
    trim: true,
    maxlength: [50, 'Storage temperature cannot exceed 50 characters']
  },
  storageTime: {
    type: String,
    required: [true, 'Storage time is required'],
    trim: true,
    maxlength: [100, 'Storage time cannot exceed 100 characters']
  },
  volume: {
    type: String,
    required: [true, 'Volume requirement is required'],
    trim: true,
    maxlength: [50, 'Volume requirement cannot exceed 50 characters']
  },
  specialInstructions: {
    type: String,
    trim: true,
    maxlength: [1000, 'Special instructions cannot exceed 1000 characters']
  },
  commonTests: [{
    type: String,
    trim: true
  }],
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
SampleTypeSchema.index({ tenant_id: 1 });
SampleTypeSchema.index({ tenant_id: 1, name: 'text', code: 'text', description: 'text' });
SampleTypeSchema.index({ tenant_id: 1, category: 1 });
SampleTypeSchema.index({ tenant_id: 1, isActive: 1 });
SampleTypeSchema.index({ tenant_id: 1, clinic_id: 1 });

// Compound indexes for tenant/clinic-based queries
SampleTypeSchema.index({ tenant_id: 1, clinic_id: 1, name: 1 }, { unique: true });
SampleTypeSchema.index({ tenant_id: 1, clinic_id: 1, code: 1 }, { unique: true });
SampleTypeSchema.index({ tenant_id: 1, clinic_id: 1, category: 1 });
SampleTypeSchema.index({ tenant_id: 1, clinic_id: 1, isActive: 1 });

// Pre-save middleware to ensure code is uppercase
SampleTypeSchema.pre('save', function(this: ISampleType, next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  next();
});

export default mongoose.model<ISampleType>('SampleType', SampleTypeSchema); 