import mongoose, { Document, Schema } from 'mongoose';

export interface ITestCategory extends Document {
  tenant_id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description: string;
  department: string;
  color: string;
  icon: string;
  testCount: number;
  commonTests: string[];
  clinic_id: mongoose.Types.ObjectId;
  isActive: boolean;
  sortOrder: number;
  created_at: Date;
  updated_at: Date;
}

const TestCategorySchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Category code is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Category code cannot exceed 20 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters']
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  },
  icon: {
    type: String,
    required: [true, 'Icon is required'],
    enum: ['beaker', 'test-tube', 'heart', 'zap', 'microscope', 'folder'],
    default: 'folder'
  },
  testCount: {
    type: Number,
    default: 0,
    min: [0, 'Test count cannot be negative']
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
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for better performance with tenant awareness
TestCategorySchema.index({ tenant_id: 1 });
TestCategorySchema.index({ tenant_id: 1, name: 'text', code: 'text', description: 'text' });
TestCategorySchema.index({ tenant_id: 1, department: 1 });
TestCategorySchema.index({ tenant_id: 1, isActive: 1 });
TestCategorySchema.index({ tenant_id: 1, sortOrder: 1 });
TestCategorySchema.index({ tenant_id: 1, clinic_id: 1 });

// Compound indexes for tenant/clinic-based queries
TestCategorySchema.index({ tenant_id: 1, clinic_id: 1, name: 1 }, { unique: true });
TestCategorySchema.index({ tenant_id: 1, clinic_id: 1, code: 1 }, { unique: true });
TestCategorySchema.index({ tenant_id: 1, clinic_id: 1, department: 1 });
TestCategorySchema.index({ tenant_id: 1, clinic_id: 1, isActive: 1 });
TestCategorySchema.index({ tenant_id: 1, clinic_id: 1, sortOrder: 1 });

// Pre-save middleware to ensure code is uppercase
TestCategorySchema.pre('save', function(this: ITestCategory, next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  next();
});

export default mongoose.model<ITestCategory>('TestCategory', TestCategorySchema); 