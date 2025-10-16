import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoice extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  patient_id: mongoose.Types.ObjectId;
  appointment_id?: mongoose.Types.ObjectId;
  invoice_number: string;
  total_amount: number;
  tax_amount: number;
  subtotal: number;
  discount: number;
  // Updated status to include 'partial' for partial payments
  status: 'draft' | 'sent' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  issue_date: Date;
  due_date: Date;
  payment_method?: string;
  // New fields for partial payment tracking
  total_paid_amount: number;
  due_amount: number;
  payment_history: Array<{
    payment_id: mongoose.Types.ObjectId;
    amount: number;
    payment_date: Date;
    method: string;
    transaction_id?: string;
  }>;
  services: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    type: 'service' | 'test' | 'medication' | 'procedure';
  }[];
  created_at: Date;
  updated_at: Date;
  paid_at?: Date;
  
  // Method declarations
  daysOverdue(): number;
  addPayment(paymentId: mongoose.Types.ObjectId, amount: number, method: string, transactionId?: string): this;
  getPaymentPercentage(): number;
}

const InvoiceSchema: Schema = new Schema({
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
  patient_id: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  appointment_id: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  invoice_number: {
    type: String,
    unique: true,
    trim: true,
    maxlength: [50, 'Invoice number cannot exceed 50 characters']
  },
  total_amount: {
    type: Number,
    min: [0, 'Total amount cannot be negative'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Total amount must be a valid positive number'
    }
  },
  tax_amount: {
    type: Number,
    min: [0, 'Tax amount cannot be negative'],
    default: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Tax amount must be a valid positive number'
    }
  },
  subtotal: {
    type: Number,
    min: [0, 'Subtotal cannot be negative'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Subtotal must be a valid positive number'
    }
  },
  discount: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    default: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Discount must be a valid positive number'
    }
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'pending', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
    required: [true, 'Invoice status is required'],
    default: 'draft'
  },
  issue_date: {
    type: Date,
    required: [true, 'Issue date is required'],
    default: Date.now
  },
  due_date: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(value: Date) {
        return value >= new Date(Date.now() - 24 * 60 * 60 * 1000); // Allow today or future dates
      },
      message: 'Due date cannot be more than 1 day in the past'
    }
  },
  payment_method: {
    type: String,
    trim: true,
    maxlength: [100, 'Payment method cannot exceed 100 characters']
  },
  services: [{
    id: {
      type: String
    },
    description: {
      type: String,
      required: [true, 'Service description is required'],
      trim: true,
      maxlength: [500, 'Service description cannot exceed 500 characters']
    },
    quantity: {
      type: Number,
      required: [true, 'Service quantity is required'],
      min: [1, 'Service quantity must be at least 1']
    },
    unit_price: {
      type: Number,
      required: [true, 'Service unit price is required'],
      min: [0, 'Service unit price cannot be negative']
    },
    total: {
      type: Number,
      required: [true, 'Service total is required'],
      min: [0, 'Service total cannot be negative']
    },
    type: {
      type: String,
      enum: ['service', 'test', 'medication', 'procedure'],
      required: [true, 'Service type is required'],
      default: 'service'
    }
  }],
  paid_at: {
    type: Date
  },
  total_paid_amount: {
    type: Number,
    min: [0, 'Total paid amount cannot be negative'],
    default: 0,
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Total paid amount must be a valid positive number'
    }
  },
  due_amount: {
    type: Number,
    min: [0, 'Due amount cannot be negative'],
    default: function(this: IInvoice) { return this.total_amount || 0; },
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Due amount must be a valid positive number'
    }
  },
  payment_history: [{
    payment_id: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Payment amount cannot be negative']
    },
    payment_date: {
      type: Date,
      required: true,
      default: Date.now
    },
    method: {
      type: String,
      required: true,
      trim: true
    },
    transaction_id: {
      type: String,
      trim: true
    }
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create tenant and clinic-aware indexes for better query performance
InvoiceSchema.index({ tenant_id: 1 });
InvoiceSchema.index({ tenant_id: 1, clinic_id: 1 });
InvoiceSchema.index({ tenant_id: 1, clinic_id: 1, patient_id: 1, created_at: -1 });
InvoiceSchema.index({ tenant_id: 1, clinic_id: 1, status: 1, due_date: 1 });
InvoiceSchema.index({ tenant_id: 1, clinic_id: 1, created_at: -1 });

// Pre-save middleware to generate invoice number and calculate totals
InvoiceSchema.pre<IInvoice>('save', async function(next) {
  // Generate invoice number if not provided
  if (!this.invoice_number) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Invoice').countDocuments({
      created_at: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.invoice_number = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // Generate service IDs if not provided
  if (this.isModified('services')) {
    this.services.forEach((service: any, index: number) => {
      if (!service.id) {
        service.id = `SRV-${Date.now()}-${index + 1}`;
      }
    });
  }

  // Calculate totals if services have changed
  if (this.isModified('services') || this.isModified('discount') || this.isModified('tax_amount')) {
    this.subtotal = this.services.reduce((sum: number, service: any) => sum + service.total, 0);
    
    // Ensure tax_amount and discount have defaults if not provided
    if (this.tax_amount === undefined) this.tax_amount = 0;
    if (this.discount === undefined) this.discount = 0;
    
    this.total_amount = this.subtotal + this.tax_amount - this.discount;
    
    // Update due amount if total amount changed (only for new invoices or when amounts are being recalculated)
    if (this.isNew || this.total_paid_amount === undefined) {
      this.total_paid_amount = 0;
      this.due_amount = this.total_amount;
    } else {
      // Recalculate due amount based on current payments
      this.due_amount = this.total_amount - (this.total_paid_amount || 0);
    }
  }

  next();
});

// Virtual for gross amount (subtotal + tax)
InvoiceSchema.virtual('gross_amount').get(function(this: IInvoice) {
  return this.subtotal + this.tax_amount;
});

// Virtual to check if invoice is overdue
InvoiceSchema.virtual('is_overdue').get(function(this: IInvoice) {
  return this.status === 'pending' && new Date() > this.due_date;
});

// Method to calculate days overdue
InvoiceSchema.methods.daysOverdue = function(this: IInvoice): number {
  if (!['pending', 'partial'].includes(this.status) || new Date() <= this.due_date) {
    return 0;
  }
  const timeDiff = new Date().getTime() - this.due_date.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

// Method to add payment to invoice
InvoiceSchema.methods.addPayment = function(this: IInvoice, paymentId: mongoose.Types.ObjectId, amount: number, method: string, transactionId?: string): IInvoice {
  // Add to payment history
  this.payment_history.push({
    payment_id: paymentId,
    amount: amount,
    payment_date: new Date(),
    method: method,
    transaction_id: transactionId
  });
  
  // Update paid amount and due amount
  this.total_paid_amount = (this.total_paid_amount || 0) + amount;
  this.due_amount = this.total_amount - this.total_paid_amount;
  
  // Update status based on payment
  if (this.due_amount <= 0) {
    this.status = 'paid';
    this.paid_at = new Date();
    this.due_amount = 0; // Ensure it's not negative
  } else if (this.total_paid_amount > 0) {
    this.status = 'partial';
  }
  
  return this;
};

// Method to get payment percentage
InvoiceSchema.methods.getPaymentPercentage = function(this: IInvoice): number {
  if (this.total_amount <= 0) return 0;
  return Math.round((this.total_paid_amount / this.total_amount) * 100);
};

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema); 