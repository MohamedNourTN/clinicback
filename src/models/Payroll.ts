import mongoose, { Document, Schema } from 'mongoose';

export interface IPayroll extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  employee_id: mongoose.Types.ObjectId;
  month: string;
  year: number;
  base_salary: number;
  overtime: number;
  bonus: number;
  allowances: number;
  deductions: number;
  tax: number;
  net_salary: number;
  status: 'draft' | 'pending' | 'processed' | 'paid';
  pay_date?: Date;
  working_days: number;
  total_days: number;
  leaves: number;
  created_at: Date;
  updated_at: Date;
}

const PayrollSchema: Schema = new Schema({
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
  employee_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee ID is required']
  },
  month: {
    type: String,
    required: [true, 'Month is required'],
    enum: ['January', 'February', 'March', 'April', 'May', 'June', 
           'July', 'August', 'September', 'October', 'November', 'December']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2020, 'Year cannot be before 2020'],
    max: [new Date().getFullYear() + 1, 'Year cannot be more than next year']
  },
  base_salary: {
    type: Number,
    required: [true, 'Base salary is required'],
    min: [0, 'Base salary cannot be negative'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Base salary must be a valid positive number'
    }
  },
  overtime: {
    type: Number,
    required: [true, 'Overtime amount is required'],
    min: [0, 'Overtime cannot be negative'],
    default: 0
  },
  bonus: {
    type: Number,
    required: [true, 'Bonus amount is required'],
    min: [0, 'Bonus cannot be negative'],
    default: 0
  },
  allowances: {
    type: Number,
    required: [true, 'Allowances amount is required'],
    min: [0, 'Allowances cannot be negative'],
    default: 0
  },
  deductions: {
    type: Number,
    required: [true, 'Deductions amount is required'],
    min: [0, 'Deductions cannot be negative'],
    default: 0
  },
  tax: {
    type: Number,
    required: [true, 'Tax amount is required'],
    min: [0, 'Tax cannot be negative'],
    default: 0
  },
  net_salary: {
    type: Number,
    required: [true, 'Net salary is required'],
    min: [0, 'Net salary cannot be negative']
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'processed', 'paid'],
    required: [true, 'Payroll status is required'],
    default: 'draft'
  },
  pay_date: {
    type: Date
  },
  working_days: {
    type: Number,
    required: [true, 'Working days is required'],
    min: [0, 'Working days cannot be negative'],
    max: [31, 'Working days cannot exceed 31']
  },
  total_days: {
    type: Number,
    required: [true, 'Total days is required'],
    min: [28, 'Total days cannot be less than 28'],
    max: [31, 'Total days cannot exceed 31']
  },
  leaves: {
    type: Number,
    required: [true, 'Leaves count is required'],
    min: [0, 'Leaves cannot be negative'],
    default: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create tenant and clinic-aware indexes for better query performance
PayrollSchema.index({ tenant_id: 1 });
PayrollSchema.index({ tenant_id: 1, clinic_id: 1 });
PayrollSchema.index({ tenant_id: 1, clinic_id: 1, employee_id: 1, month: 1, year: 1 }, { unique: true }); // Unique per tenant/clinic
PayrollSchema.index({ tenant_id: 1, clinic_id: 1, status: 1, year: -1, month: 1 });
PayrollSchema.index({ tenant_id: 1, clinic_id: 1, year: -1, month: 1 });
PayrollSchema.index({ tenant_id: 1, clinic_id: 1, pay_date: -1 });
PayrollSchema.index({ tenant_id: 1, clinic_id: 1, employee_id: 1 });

// Pre-save middleware to calculate net salary
PayrollSchema.pre('save', function(next) {
  if (this.isModified('base_salary') || this.isModified('overtime') || 
      this.isModified('bonus') || this.isModified('allowances') || 
      this.isModified('deductions') || this.isModified('tax')) {
    
    const gross = (this.base_salary as number) + (this.overtime as number) + (this.bonus as number) + (this.allowances as number);
    this.net_salary = gross - (this.deductions as number) - (this.tax as number);
  }
  next();
});

// Virtual to generate payroll ID for display
PayrollSchema.virtual('payroll_id').get(function() {
  return `PAY-${(this._id as any).toString().slice(-6).toUpperCase()}`;
});

// Virtual to calculate gross salary
PayrollSchema.virtual('gross_salary').get(function() {
  return (this.base_salary as number) + (this.overtime as number) + (this.bonus as number) + (this.allowances as number);
});

// Method to calculate attendance percentage
PayrollSchema.methods.getAttendancePercentage = function() {
  return ((this.working_days / this.total_days) * 100).toFixed(2);
};

export default mongoose.model<IPayroll>('Payroll', PayrollSchema); 