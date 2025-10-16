import mongoose, { Document, Schema } from 'mongoose';

export interface ILabVendor extends Document {
  clinic_id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  type: 'diagnostic_lab' | 'pathology_lab' | 'imaging_center' | 'reference_lab' | 'specialty_lab';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  website?: string;
  license: string;
  accreditation: string[];
  specialties: string[];
  rating: number;
  totalTests: number;
  averageTurnaround: string;
  pricing: 'budget' | 'moderate' | 'premium';
  contractStart: Date;
  contractEnd: Date;
  lastTestDate?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

const LabVendorSchema: Schema = new Schema({
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Lab vendor name is required'],
    trim: true,
    maxlength: [200, 'Lab vendor name cannot exceed 200 characters']
  },
  code: {
    type: String,
    required: [true, 'Lab vendor code is required'],
    trim: true,
    uppercase: true,
    maxlength: [10, 'Lab vendor code cannot exceed 10 characters'],
    match: [/^[A-Z0-9]+$/, 'Lab vendor code must contain only uppercase letters and numbers']
  },
  type: {
    type: String,
    enum: ['diagnostic_lab', 'pathology_lab', 'imaging_center', 'reference_lab', 'specialty_lab'],
    required: [true, 'Lab vendor type is required']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'suspended'],
    default: 'pending',
    required: [true, 'Status is required']
  },
  contactPerson: {
    type: String,
    required: [true, 'Contact person is required'],
    trim: true,
    maxlength: [100, 'Contact person name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
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
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [300, 'Address cannot exceed 300 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [100, 'City cannot exceed 100 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    maxlength: [100, 'State cannot exceed 100 characters']
  },
  zipCode: {
    type: String,
    required: [true, 'Zip code is required'],
    trim: true,
    maxlength: [20, 'Zip code cannot exceed 20 characters']
  },
  website: {
    type: String,
    trim: true,
    maxlength: [200, 'Website URL cannot exceed 200 characters'],
    match: [/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/, 'Please enter a valid website URL']
  },
  license: {
    type: String,
    required: [true, 'License number is required'],
    trim: true,
    maxlength: [50, 'License number cannot exceed 50 characters']
  },
  accreditation: [{
    type: String,
    trim: true,
    maxlength: [100, 'Accreditation name cannot exceed 100 characters']
  }],
  specialties: [{
    type: String,
    trim: true,
    maxlength: [100, 'Specialty name cannot exceed 100 characters']
  }],
  rating: {
    type: Number,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5'],
    default: 0
  },
  totalTests: {
    type: Number,
    min: [0, 'Total tests cannot be negative'],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Total tests must be an integer'
    }
  },
  averageTurnaround: {
    type: String,
    required: [true, 'Average turnaround time is required'],
    trim: true,
    maxlength: [50, 'Average turnaround cannot exceed 50 characters']
  },
  pricing: {
    type: String,
    enum: ['budget', 'moderate', 'premium'],
    required: [true, 'Pricing tier is required']
  },
  contractStart: {
    type: Date,
    required: [true, 'Contract start date is required']
  },
  contractEnd: {
    type: Date,
    required: [true, 'Contract end date is required'],
    validate: {
      validator: function(this: ILabVendor, value: Date) {
        return value > this.contractStart;
      },
      message: 'Contract end date must be after start date'
    }
  },
  lastTestDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create clinic-aware indexes for better query performance
LabVendorSchema.index({ clinic_id: 1 });
LabVendorSchema.index({ clinic_id: 1, code: 1 }, { unique: true }); // Unique code per clinic
LabVendorSchema.index({ clinic_id: 1, status: 1 });
LabVendorSchema.index({ clinic_id: 1, type: 1 });
LabVendorSchema.index({ clinic_id: 1, contractStart: 1, contractEnd: 1 });
LabVendorSchema.index({ 
  clinic_id: 1,
  name: 'text', 
  code: 'text', 
  contactPerson: 'text',
  specialties: 'text',
  city: 'text',
  state: 'text'
}); // Text search within clinic

export default mongoose.model<ILabVendor>('LabVendor', LabVendorSchema); 