import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface ISuperAdmin extends Document {
  _id: Types.ObjectId;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  last_login?: Date;
  login_attempts?: number;
  locked_until?: Date;
  avatar?: string;
  phone?: string;
  two_factor_enabled: boolean;
  two_factor_secret?: string;
  created_at: Date;
  updated_at: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  isLocked(): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
}

// Interface for SuperAdmin model with static methods
export interface ISuperAdminModel extends mongoose.Model<ISuperAdmin> {
  findActiveByEmail(email: string): Promise<ISuperAdmin | null>;
}

const SuperAdminSchema: Schema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    index: true
  },
  password_hash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
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
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  last_login: {
    type: Date
  },
  login_attempts: {
    type: Number,
    default: 0
  },
  locked_until: {
    type: Date
  },
  avatar: {
    type: String,
    trim: true,
    maxlength: [500, 'Avatar URL cannot exceed 500 characters']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  two_factor_enabled: {
    type: Boolean,
    default: false
  },
  two_factor_secret: {
    type: String,
    select: false // Don't include this in queries by default
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for better query performance
SuperAdminSchema.index({ email: 1, is_active: 1 });
SuperAdminSchema.index({ created_at: -1 });

// Hash password before saving
SuperAdminSchema.pre('save', async function(next) {
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
SuperAdminSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

// Check if account is locked
SuperAdminSchema.methods.isLocked = function(): boolean {
  return !!(this.locked_until && this.locked_until > Date.now());
};

// Increment login attempts
SuperAdminSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.locked_until && this.locked_until < Date.now()) {
    const updates: any = {
      login_attempts: 1
    };
    delete updates.locked_until;
    await this.updateOne(updates);
    return;
  }
  
  const updates: any = { $inc: { login_attempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.login_attempts + 1 >= 5 && !this.isLocked()) {
    updates.locked_until = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  }
  
  await this.updateOne(updates);
};

// Reset login attempts on successful login
SuperAdminSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  const updates: any = {
    login_attempts: 0,
    last_login: new Date()
  };
  
  // Remove lock if it exists
  if (this.locked_until) {
    delete updates.locked_until;
  }
  
  await this.updateOne(updates);
};

// Remove password and sensitive fields from JSON output
SuperAdminSchema.methods.toJSON = function() {
  const superAdminObject = this.toObject();
  delete superAdminObject.password_hash;
  delete superAdminObject.two_factor_secret;
  delete superAdminObject.login_attempts;
  delete superAdminObject.locked_until;
  return superAdminObject;
};

// Static method to find active super admin by email
SuperAdminSchema.statics.findActiveByEmail = function(email: string) {
  return this.findOne({ 
    email: email.toLowerCase(), 
    is_active: true 
  });
};

export default mongoose.model<ISuperAdmin, ISuperAdminModel>('SuperAdmin', SuperAdminSchema);
