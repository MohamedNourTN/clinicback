import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

// Define the schedule structure
interface DaySchedule {
  start: string;
  end: string;
  isWorking: boolean;
}

interface WorkSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'super_admin' | 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'accountant' | 'staff';
  phone: string;
  is_active: boolean;
  base_currency: string;
  address?: string;
  bio?: string;
  date_of_birth?: Date;
  specialization?: string;
  license_number?: string;
  department?: string;
  avatar?: string;
  schedule?: WorkSchedule;
  sales_percentage?: number;
  created_at: Date;
  updated_at: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Define day schedule schema
const DayScheduleSchema = new Schema({
  start: {
    type: String,
    required: true,
    default: "09:00",
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  end: {
    type: String,
    required: true,
    default: "17:00",
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  isWorking: {
    type: Boolean,
    required: true,
    default: true
  }
}, { _id: false });

// Define work schedule schema
const WorkScheduleSchema = new Schema({
  monday: { type: DayScheduleSchema, default: { start: "09:00", end: "17:00", isWorking: true } },
  tuesday: { type: DayScheduleSchema, default: { start: "09:00", end: "17:00", isWorking: true } },
  wednesday: { type: DayScheduleSchema, default: { start: "09:00", end: "17:00", isWorking: true } },
  thursday: { type: DayScheduleSchema, default: { start: "09:00", end: "17:00", isWorking: true } },
  friday: { type: DayScheduleSchema, default: { start: "09:00", end: "17:00", isWorking: true } },
  saturday: { type: DayScheduleSchema, default: { start: "00:00", end: "00:00", isWorking: false } },
  sunday: { type: DayScheduleSchema, default: { start: "00:00", end: "00:00", isWorking: false } }
}, { _id: false });

const UserSchema: Schema = new Schema({
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
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password_hash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  first_name: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [100, 'First name cannot exceed 100 characters']
  },
  last_name: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [100, 'Last name cannot exceed 100 characters']
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'staff'],
    required: [true, 'Role is required'],
    default: 'staff'
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  is_active: {
    type: Boolean,
    default: true
  },
  base_currency: {
    type: String,
    required: [true, 'Base currency is required'],
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED', 'SAR', 'NGN', 'VND', 'DOP'],
    trim: true
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [1000, 'Bio cannot exceed 1000 characters']
  },
  date_of_birth: {
    type: Date
  },
  specialization: {
    type: String,
    trim: true,
    maxlength: [200, 'Specialization cannot exceed 200 characters']
  },
  license_number: {
    type: String,
    trim: true,
    maxlength: [100, 'License number cannot exceed 100 characters']
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters']
  },
  avatar: {
    type: String,
    trim: true,
    maxlength: [500, 'Avatar URL cannot exceed 500 characters']
  },
  schedule: {
    type: WorkScheduleSchema,
    default: () => ({
      monday: { start: "09:00", end: "17:00", isWorking: true },
      tuesday: { start: "09:00", end: "17:00", isWorking: true },
      wednesday: { start: "09:00", end: "17:00", isWorking: true },
      thursday: { start: "09:00", end: "17:00", isWorking: true },
      friday: { start: "09:00", end: "17:00", isWorking: true },
      saturday: { start: "00:00", end: "00:00", isWorking: false },
      sunday: { start: "00:00", end: "00:00", isWorking: false }
    })
  },
  sales_percentage: {
    type: Number,
    min: [0, 'Sales percentage cannot be negative'],
    max: [100, 'Sales percentage cannot exceed 100%'],
    default: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create tenant and clinic-aware indexes for better query performance
UserSchema.index({ tenant_id: 1 });
UserSchema.index({ tenant_id: 1, clinic_id: 1 });
UserSchema.index({ tenant_id: 1, email: 1 }, { unique: true }); // Unique email per tenant
UserSchema.index({ tenant_id: 1, clinic_id: 1, email: 1 });
UserSchema.index({ tenant_id: 1, clinic_id: 1, role: 1 });
UserSchema.index({ tenant_id: 1, clinic_id: 1, is_active: 1 });
UserSchema.index({ tenant_id: 1, clinic_id: 1, department: 1 });
UserSchema.index({ tenant_id: 1, clinic_id: 1, first_name: 1, last_name: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash as string, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

// Remove password from JSON output
UserSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password_hash;
  return userObject;
};

export default mongoose.model<IUser>('User', UserSchema); 