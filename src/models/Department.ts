import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartment extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description: string;
  head: string;
  location: string;
  phone: string;
  email: string;
  staffCount: number;
  budget: number;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

const DepartmentSchema: Schema = new Schema({
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
  code: {
    type: String,
    required: [true, 'Department code is required'],
    trim: true,
    uppercase: true,
    maxlength: [10, 'Department code cannot exceed 10 characters'],
    match: [/^[A-Z0-9]+$/, 'Department code must contain only uppercase letters and numbers']
  },
  name: {
    type: String,
    required: [true, 'Department name is required'],
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Department description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  head: {
    type: String,
    required: [true, 'Department head is required'],
    trim: true,
    maxlength: [100, 'Department head name cannot exceed 100 characters']
  },
  location: {
    type: String,
    required: [true, 'Department location is required'],
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  staffCount: {
    type: Number,
    required: [true, 'Staff count is required'],
    min: [0, 'Staff count cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Staff count must be an integer'
    }
  },
  budget: {
    type: Number,
    required: [true, 'Budget is required'],
    min: [0, 'Budget cannot be negative']
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    required: [true, 'Status is required']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create tenant-aware indexes for better performance
DepartmentSchema.index({ tenant_id: 1 });
DepartmentSchema.index({ tenant_id: 1, clinic_id: 1 });
DepartmentSchema.index({ tenant_id: 1, clinic_id: 1, code: 1 }, { unique: true }); // Unique code per clinic
DepartmentSchema.index({ tenant_id: 1, clinic_id: 1, status: 1 });
DepartmentSchema.index({ tenant_id: 1, clinic_id: 1, name: 1 });

// Create text index for search within tenant/clinic context
DepartmentSchema.index({ 
  tenant_id: 1,
  clinic_id: 1,
  name: 'text', 
  code: 'text', 
  description: 'text',
  head: 'text'
});

export default mongoose.model<IDepartment>('Department', DepartmentSchema); 