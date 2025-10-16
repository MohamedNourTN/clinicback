import mongoose, { Document, Schema } from 'mongoose';

export interface ITestMethodology extends Document {
  name: string;
  code: string;
  description: string;
  category: string;
  equipment: string;
  principles: string;
  applications: string[];
  advantages: string;
  limitations: string;
  clinic_id: mongoose.Types.ObjectId;
  isActive: boolean;
  created_at: Date;
  updated_at: Date;
}

const TestMethodologySchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Methodology name is required'],
    trim: true,
    maxlength: [100, 'Methodology name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Methodology code is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Methodology code cannot exceed 20 characters']
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
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  equipment: {
    type: String,
    required: [true, 'Equipment information is required'],
    trim: true,
    maxlength: [500, 'Equipment information cannot exceed 500 characters']
  },
  principles: {
    type: String,
    required: [true, 'Principles are required'],
    trim: true,
    maxlength: [1000, 'Principles cannot exceed 1000 characters']
  },
  applications: [{
    type: String,
    trim: true,
    required: true
  }],
  advantages: {
    type: String,
    required: [true, 'Advantages are required'],
    trim: true,
    maxlength: [1000, 'Advantages cannot exceed 1000 characters']
  },
  limitations: {
    type: String,
    required: [true, 'Limitations are required'],
    trim: true,
    maxlength: [1000, 'Limitations cannot exceed 1000 characters']
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

// Create indexes for better performance
TestMethodologySchema.index({ name: 'text', code: 'text', description: 'text' });
TestMethodologySchema.index({ category: 1 });
TestMethodologySchema.index({ isActive: 1 });
TestMethodologySchema.index({ clinic_id: 1 });

// Compound indexes for clinic-based queries
TestMethodologySchema.index({ clinic_id: 1, name: 1 }, { unique: true });
TestMethodologySchema.index({ clinic_id: 1, code: 1 }, { unique: true });
TestMethodologySchema.index({ clinic_id: 1, category: 1 });
TestMethodologySchema.index({ clinic_id: 1, isActive: 1 });

// Pre-save middleware to ensure code is uppercase
TestMethodologySchema.pre('save', function(this: ITestMethodology, next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  next();
});

export default mongoose.model<ITestMethodology>('TestMethodology', TestMethodologySchema); 