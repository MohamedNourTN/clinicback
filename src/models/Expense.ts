import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  amount: number;
  category: 'supplies' | 'equipment' | 'utilities' | 'maintenance' | 'staff' | 'marketing' | 'insurance' | 'rent' | 'other';
  vendor?: string;
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'check';
  date: Date;
  status: 'pending' | 'paid' | 'cancelled';
  receipt_url?: string;
  notes?: string;
  created_by: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const ExpenseSchema: Schema = new Schema({
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
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive']
  },
  category: {
    type: String,
    enum: ['supplies', 'equipment', 'utilities', 'maintenance', 'staff', 'marketing', 'insurance', 'rent', 'other'],
    required: [true, 'Category is required']
  },
  vendor: {
    type: String,
    trim: true,
    maxlength: [100, 'Vendor name cannot exceed 100 characters']
  },
  payment_method: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'check'],
    required: [true, 'Payment method is required']
  },
  date: {
    type: Date,
    required: [true, 'Expense date is required']
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending',
    required: [true, 'Status is required']
  },
  receipt_url: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance with tenant awareness
ExpenseSchema.index({ tenant_id: 1 });
ExpenseSchema.index({ tenant_id: 1, clinic_id: 1 });
ExpenseSchema.index({ tenant_id: 1, clinic_id: 1, date: -1 });
ExpenseSchema.index({ tenant_id: 1, clinic_id: 1, category: 1 });
ExpenseSchema.index({ tenant_id: 1, clinic_id: 1, status: 1 });
ExpenseSchema.index({ tenant_id: 1, clinic_id: 1, created_by: 1 });
ExpenseSchema.index({ tenant_id: 1, clinic_id: 1, date: -1, status: 1 });

export default mongoose.model<IExpense>('Expense', ExpenseSchema); 