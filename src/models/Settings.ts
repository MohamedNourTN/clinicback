import mongoose, { Schema, Document } from 'mongoose';

// Working hours interface
export interface IWorkingHours {
  isOpen: boolean;
  start: string;
  end: string;
}

// Settings interface
export interface ISettings extends Document {
  clinicId: string;
  clinic: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    description?: string;
    logo?: string;
  };
  workingHours: {
    monday: IWorkingHours;
    tuesday: IWorkingHours;
    wednesday: IWorkingHours;
    thursday: IWorkingHours;
    friday: IWorkingHours;
    saturday: IWorkingHours;
    sunday: IWorkingHours;
  };
  financial: {
    currency: string;
    taxRate: number;
    invoicePrefix: string;
    paymentTerms: number;
    defaultDiscount: number;
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    appointmentReminders: boolean;
    paymentReminders: boolean;
    lowStockAlerts: boolean;
    systemAlerts: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: number;
    passwordExpiry: number;
    backupFrequency: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Working hours schema
const workingHoursSchema = new Schema<IWorkingHours>({
  isOpen: {
    type: Boolean,
    required: true,
    default: true
  },
  start: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    default: '09:00'
  },
  end: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    default: '17:00'
  }
}, { _id: false });

// Settings schema
const settingsSchema = new Schema<ISettings>({
  clinicId: {
    type: String,
    required: true,
    unique: true
  },
  clinic: {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    website: {
      type: String,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    logo: {
      type: String,
      trim: true
    }
  },
  workingHours: {
    monday: {
      type: workingHoursSchema,
      default: { isOpen: true, start: '09:00', end: '17:00' }
    },
    tuesday: {
      type: workingHoursSchema,
      default: { isOpen: true, start: '09:00', end: '17:00' }
    },
    wednesday: {
      type: workingHoursSchema,
      default: { isOpen: true, start: '09:00', end: '17:00' }
    },
    thursday: {
      type: workingHoursSchema,
      default: { isOpen: true, start: '09:00', end: '17:00' }
    },
    friday: {
      type: workingHoursSchema,
      default: { isOpen: true, start: '09:00', end: '15:00' }
    },
    saturday: {
      type: workingHoursSchema,
      default: { isOpen: false, start: '09:00', end: '13:00' }
    },
    sunday: {
      type: workingHoursSchema,
      default: { isOpen: false, start: '10:00', end: '14:00' }
    }
  },
  financial: {
    currency: {
      type: String,
      required: true,
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED', 'SAR', 'NGN', 'VND', 'DOP'],
      default: 'USD'
    },
    taxRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 10
    },
    invoicePrefix: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
      default: 'INV'
    },
    paymentTerms: {
      type: Number,
      required: true,
      min: 0,
      max: 365,
      default: 30
    },
    defaultDiscount: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    }
  },
  notifications: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: true
    },
    appointmentReminders: {
      type: Boolean,
      default: true
    },
    paymentReminders: {
      type: Boolean,
      default: true
    },
    lowStockAlerts: {
      type: Boolean,
      default: true
    },
    systemAlerts: {
      type: Boolean,
      default: true
    }
  },
  security: {
    twoFactorAuth: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number,
      min: 15,
      max: 480,
      default: 60
    },
    passwordExpiry: {
      type: Number,
      min: 30,
      max: 365,
      default: 90
    },
    backupFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily'
    }
  }
}, {
  timestamps: true,
  collection: 'settings'
});

// Indexes
settingsSchema.index({ clinicId: 1 });
settingsSchema.index({ createdAt: 1 });
settingsSchema.index({ updatedAt: 1 });

// Instance methods
settingsSchema.methods.toJSON = function() {
  const settings = this.toObject();
  settings.id = settings._id;
  delete settings._id;
  delete settings.__v;
  return settings;
};

// Static methods
settingsSchema.statics.findByClinicId = function(clinicId: string) {
  return this.findOne({ clinicId });
};

settingsSchema.statics.createOrUpdateSettings = async function(clinicId: string, settingsData: any) {
  return this.findOneAndUpdate(
    { clinicId },
    { 
      ...settingsData,
      clinicId,
      updatedAt: new Date()
    },
    { 
      new: true, 
      upsert: true,
      runValidators: true
    }
  );
};

// Pre-save middleware
settingsSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  next();
});

// Create and export the model
const Settings = mongoose.model<ISettings>('Settings', settingsSchema);

export default Settings;
