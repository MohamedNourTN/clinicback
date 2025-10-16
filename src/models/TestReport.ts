import mongoose, { Document, Schema } from 'mongoose';

export interface ITestReport extends Document {
  tenant_id: mongoose.Types.ObjectId;
  reportNumber: string;
  patientId: mongoose.Types.ObjectId;
  patientName: string;
  patientAge: number;
  patientGender: 'male' | 'female' | 'other';
  testId: mongoose.Types.ObjectId;
  testName: string;
  testCode: string;
  category: string;
  externalVendor: string;
  testDate: Date;
  recordedDate: Date;
  recordedBy: string;
  status: 'pending' | 'recorded' | 'verified' | 'delivered';
  results?: any;
  normalRange?: string;
  units?: string;
  notes?: string;
  attachments?: {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }[];
  interpretation?: string;
  verifiedBy?: string;
  verifiedDate?: Date;
  clinic_id: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
  updateStatus(newStatus: 'pending' | 'recorded' | 'verified' | 'delivered', verifiedBy?: string): Promise<this>;
}

const TestReportSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  reportNumber: {
    type: String,
    required: [true, 'Report number is required'],
    trim: true,
    maxlength: [50, 'Report number cannot exceed 50 characters']
  },
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  patientName: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true,
    maxlength: [200, 'Patient name cannot exceed 200 characters']
  },
  patientAge: {
    type: Number,
    required: [true, 'Patient age is required'],
    min: [0, 'Patient age cannot be negative'],
    max: [150, 'Patient age cannot exceed 150']
  },
  patientGender: {
    type: String,
    required: [true, 'Patient gender is required'],
    enum: {
      values: ['male', 'female', 'other'],
      message: 'Invalid gender'
    }
  },
  testId: {
    type: Schema.Types.ObjectId,
    ref: 'Test',
    required: [true, 'Test ID is required']
  },
  testName: {
    type: String,
    required: [true, 'Test name is required'],
    trim: true,
    maxlength: [200, 'Test name cannot exceed 200 characters']
  },
  testCode: {
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
  externalVendor: {
    type: String,
    required: [true, 'External vendor is required'],
    trim: true,
    maxlength: [200, 'External vendor cannot exceed 200 characters']
  },
  testDate: {
    type: Date,
    required: [true, 'Test date is required']
  },
  recordedDate: {
    type: Date,
    required: [true, 'Recorded date is required']
  },
  recordedBy: {
    type: String,
    required: [true, 'Recorded by is required'],
    trim: true,
    maxlength: [100, 'Recorded by cannot exceed 100 characters']
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'recorded', 'verified', 'delivered'],
      message: 'Invalid status'
    },
    default: 'pending'
  },
  results: {
    type: Schema.Types.Mixed,
    default: null
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
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  attachments: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      trim: true
    },
    size: {
      type: Number,
      required: true,
      min: 0
    },
    url: {
      type: String,
      required: true,
      trim: true
    }
  }],
  interpretation: {
    type: String,
    trim: true,
    maxlength: [2000, 'Interpretation cannot exceed 2000 characters']
  },
  verifiedBy: {
    type: String,
    trim: true,
    maxlength: [100, 'Verified by cannot exceed 100 characters']
  },
  verifiedDate: {
    type: Date
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for better performance with tenant awareness
TestReportSchema.index({ tenant_id: 1 });
TestReportSchema.index({ tenant_id: 1, patientId: 1 });
TestReportSchema.index({ tenant_id: 1, testId: 1 });
TestReportSchema.index({ tenant_id: 1, status: 1 });
TestReportSchema.index({ tenant_id: 1, testDate: -1 });
TestReportSchema.index({ tenant_id: 1, recordedDate: -1 });
TestReportSchema.index({ tenant_id: 1, category: 1 });
TestReportSchema.index({ tenant_id: 1, externalVendor: 1 });
TestReportSchema.index({ tenant_id: 1, clinic_id: 1 });
TestReportSchema.index({ 
  tenant_id: 1,
  patientName: 'text', 
  testName: 'text', 
  reportNumber: 'text',
  externalVendor: 'text'
});

// Compound indexes for tenant/clinic-based queries
TestReportSchema.index({ tenant_id: 1, clinic_id: 1, reportNumber: 1 }, { unique: true });
TestReportSchema.index({ tenant_id: 1, clinic_id: 1, patientId: 1 });
TestReportSchema.index({ tenant_id: 1, clinic_id: 1, testId: 1 });
TestReportSchema.index({ tenant_id: 1, clinic_id: 1, status: 1 });
TestReportSchema.index({ tenant_id: 1, clinic_id: 1, testDate: -1 });
TestReportSchema.index({ tenant_id: 1, clinic_id: 1, recordedDate: -1 });
TestReportSchema.index({ tenant_id: 1, clinic_id: 1, category: 1 });
TestReportSchema.index({ tenant_id: 1, clinic_id: 1, externalVendor: 1 });

// Pre-save middleware
TestReportSchema.pre('save', function(this: ITestReport, next) {
  if (this.isModified('testCode')) {
    this.testCode = this.testCode.toUpperCase();
  }
  
  // Auto-generate report number if not provided
  if (!this.reportNumber) {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    this.reportNumber = `RPT${year}${timestamp}`;
  }
  
  next();
});

// Method to update status with appropriate validations
TestReportSchema.methods.updateStatus = function(this: ITestReport, newStatus: 'pending' | 'recorded' | 'verified' | 'delivered', verifiedBy?: string) {
  const validTransitions: { [key: string]: string[] } = {
    'pending': ['recorded'],
    'recorded': ['verified'],
    'verified': ['delivered'],
    'delivered': []
  };

  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }

  this.status = newStatus;
  
  if (newStatus === 'verified') {
    this.verifiedBy = verifiedBy;
    this.verifiedDate = new Date();
  }
  
  return this.save();
};

export default mongoose.model<ITestReport>('TestReport', TestReportSchema); 