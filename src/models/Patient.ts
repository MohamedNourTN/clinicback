import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPatient extends Document {
  tenant_id: Types.ObjectId;
  clinic_id: Types.ObjectId;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  gender: 'male' | 'female' | 'other';
  phone: string;
  email: string;
  address: string;
  emergency_contact: {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  };
  insurance_info: {
    provider?: string;
    policy_number?: string;
    group_number?: string;
    expiry_date?: Date;
  };
  last_visit?: Date;
  age: number; // Virtual property
  full_name: string; // Virtual property
  created_at: Date;
  updated_at: Date;
}

const PatientSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
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
  date_of_birth: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function(value: Date) {
        return value <= new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required']
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
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  emergency_contact: {
    name: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    }
  },
  insurance_info: {
    provider: {
      type: String,
      trim: true
    },
    policy_number: {
      type: String,
      trim: true
    },
    group_number: {
      type: String,
      trim: true
    },
    expiry_date: {
      type: Date
    }
  },
  last_visit: {
    type: Date,
    required: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for better search performance with tenant awareness
PatientSchema.index({ tenant_id: 1 });
PatientSchema.index({ tenant_id: 1, clinic_id: 1 });
PatientSchema.index({ tenant_id: 1, clinic_id: 1, created_at: -1 });
PatientSchema.index({ tenant_id: 1, clinic_id: 1, email: 1 });
PatientSchema.index({ tenant_id: 1, clinic_id: 1, phone: 1 });
PatientSchema.index({ 
  tenant_id: 1,
  first_name: 'text', 
  last_name: 'text', 
  email: 'text',
  phone: 'text'
});

// Virtual for full name
PatientSchema.virtual('full_name').get(function() {
  return `${this.first_name} ${this.last_name}`;
});

// Virtual for age calculation
PatientSchema.virtual('age').get(function() {
  const today = new Date();
  const birthDate = new Date(this.date_of_birth as Date);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

export default mongoose.model<IPatient>('Patient', PatientSchema); 