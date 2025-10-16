import mongoose, { Document, Schema, Types } from 'mongoose';

// Tooth numbering systems
export type ToothNumberingSystem = 'universal' | 'palmer' | 'fdi';

// Tooth surfaces
export type ToothSurface = 'mesial' | 'distal' | 'occlusal' | 'buccal' | 'lingual' | 'incisal';

// Dental condition types
export type DentalConditionType = 
  | 'healthy' 
  | 'caries' 
  | 'filling' 
  | 'crown' 
  | 'bridge' 
  | 'implant' 
  | 'extraction' 
  | 'root_canal' 
  | 'missing' 
  | 'fractured' 
  | 'wear' 
  | 'restoration_needed'
  | 'sealant'
  | 'veneer'
  | 'temporary_filling'
  | 'periapical_lesion';

// Treatment status
export type TreatmentStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

// Treatment priority
export type TreatmentPriority = 'low' | 'medium' | 'high' | 'urgent';

// Individual tooth condition interface
export interface IToothCondition {
  tooth_number: number; // Universal numbering (1-32 for permanent, 55-85 for primary)
  tooth_name?: string; // e.g., "Upper Right Central Incisor"
  surfaces: {
    surface: ToothSurface;
    condition: DentalConditionType;
    notes?: string;
    color_code?: string; // Hex color for visual representation
    date_diagnosed?: Date;
    severity?: 'mild' | 'moderate' | 'severe';
  }[];
  overall_condition: DentalConditionType;
  mobility?: number; // 0-3 scale for tooth mobility
  periodontal_pocket_depth?: {
    mesial?: number;
    distal?: number;
    buccal?: number;
    lingual?: number;
  };
  treatment_plan?: {
    planned_treatment: string;
    priority: TreatmentPriority;
    estimated_cost?: number;
    estimated_duration?: string; // e.g., "30 minutes"
    status: TreatmentStatus;
    planned_date?: Date;
    completed_date?: Date;
    notes?: string;
  };
  attachments?: {
    file_name: string;
    file_url: string;
    file_type: 'image' | 'xray' | 'document';
    uploaded_date: Date;
    description?: string;
  }[];
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// Main Odontogram interface
export interface IOdontogram extends Document {
  clinic_id: Types.ObjectId;
  patient_id: Types.ObjectId;
  doctor_id: Types.ObjectId;
  examination_date: Date;
  numbering_system: ToothNumberingSystem;
  patient_type: 'adult' | 'child'; // To handle different tooth sets
  teeth_conditions: IToothCondition[];
  general_notes?: string;
  treatment_summary?: {
    total_planned_treatments: number;
    completed_treatments: number;
    in_progress_treatments: number;
    estimated_total_cost?: number;
  };
  periodontal_assessment?: {
    bleeding_on_probing: boolean;
    plaque_index?: number; // 0-3 scale
    gingival_index?: number; // 0-3 scale
    calculus_present: boolean;
    general_notes?: string;
  };
  version: number; // For tracking odontogram versions
  is_active: boolean; // Current active odontogram for patient
  created_at: Date;
  updated_at: Date;
  
  // Virtual properties
  treatment_progress?: number; // Percentage
  pending_treatments?: number;
  
  // Methods
  calculateTreatmentSummary(): void;
}

// Tooth Condition Schema
const ToothConditionSchema: Schema = new Schema({
  tooth_number: {
    type: Number,
    required: [true, 'Tooth number is required'],
    min: [1, 'Invalid tooth number'],
    max: [85, 'Invalid tooth number']
  },
  tooth_name: {
    type: String,
    trim: true
  },
  surfaces: [{
    surface: {
      type: String,
      enum: ['mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'incisal'],
      required: [true, 'Surface type is required']
    },
    condition: {
      type: String,
      enum: [
        'healthy', 'caries', 'filling', 'crown', 'bridge', 'implant', 
        'extraction', 'root_canal', 'missing', 'fractured', 'wear', 
        'restoration_needed', 'sealant', 'veneer', 'temporary_filling', 
        'periapical_lesion'
      ],
      required: [true, 'Condition is required']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    color_code: {
      type: String,
      match: [/^#[0-9A-F]{6}$/i, 'Invalid color code format']
    },
    date_diagnosed: {
      type: Date,
      default: Date.now
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    }
  }],
  overall_condition: {
    type: String,
    enum: [
      'healthy', 'caries', 'filling', 'crown', 'bridge', 'implant', 
      'extraction', 'root_canal', 'missing', 'fractured', 'wear', 
      'restoration_needed', 'sealant', 'veneer', 'temporary_filling', 
      'periapical_lesion'
    ],
    required: [true, 'Overall condition is required']
  },
  mobility: {
    type: Number,
    min: [0, 'Mobility must be between 0-3'],
    max: [3, 'Mobility must be between 0-3']
  },
  periodontal_pocket_depth: {
    mesial: {
      type: Number,
      min: [0, 'Pocket depth must be positive'],
      max: [20, 'Pocket depth seems unrealistic']
    },
    distal: {
      type: Number,
      min: [0, 'Pocket depth must be positive'],
      max: [20, 'Pocket depth seems unrealistic']
    },
    buccal: {
      type: Number,
      min: [0, 'Pocket depth must be positive'],
      max: [20, 'Pocket depth seems unrealistic']
    },
    lingual: {
      type: Number,
      min: [0, 'Pocket depth must be positive'],
      max: [20, 'Pocket depth seems unrealistic']
    }
  },
  treatment_plan: {
    planned_treatment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Treatment plan cannot exceed 1000 characters']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    estimated_cost: {
      type: Number,
      min: [0, 'Cost must be positive']
    },
    estimated_duration: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['planned', 'in_progress', 'completed', 'cancelled'],
      default: 'planned'
    },
    planned_date: {
      type: Date
    },
    completed_date: {
      type: Date
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Treatment notes cannot exceed 1000 characters']
    }
  },
  attachments: [{
    file_name: {
      type: String,
      required: [true, 'File name is required'],
      trim: true
    },
    file_url: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true
    },
    file_type: {
      type: String,
      enum: ['image', 'xray', 'document'],
      required: [true, 'File type is required']
    },
    uploaded_date: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    }
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Main Odontogram Schema
const OdontogramSchema: Schema = new Schema({
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required'],
    index: true
  },
  patient_id: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required'],
    index: true
  },
  doctor_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor ID is required']
  },
  examination_date: {
    type: Date,
    required: [true, 'Examination date is required'],
    default: Date.now
  },
  numbering_system: {
    type: String,
    enum: ['universal', 'palmer', 'fdi'],
    default: 'universal',
    required: [true, 'Numbering system is required']
  },
  patient_type: {
    type: String,
    enum: ['adult', 'child'],
    required: [true, 'Patient type is required'],
    default: 'adult'
  },
  teeth_conditions: [ToothConditionSchema],
  general_notes: {
    type: String,
    trim: true,
    maxlength: [5000, 'General notes cannot exceed 5000 characters']
  },
  treatment_summary: {
    total_planned_treatments: {
      type: Number,
      default: 0,
      min: [0, 'Total planned treatments must be positive']
    },
    completed_treatments: {
      type: Number,
      default: 0,
      min: [0, 'Completed treatments must be positive']
    },
    in_progress_treatments: {
      type: Number,
      default: 0,
      min: [0, 'In progress treatments must be positive']
    },
    estimated_total_cost: {
      type: Number,
      min: [0, 'Total cost must be positive']
    }
  },
  periodontal_assessment: {
    bleeding_on_probing: {
      type: Boolean,
      default: false
    },
    plaque_index: {
      type: Number,
      min: [0, 'Plaque index must be between 0-3'],
      max: [3, 'Plaque index must be between 0-3']
    },
    gingival_index: {
      type: Number,
      min: [0, 'Gingival index must be between 0-3'],
      max: [3, 'Gingival index must be between 0-3']
    },
    calculus_present: {
      type: Boolean,
      default: false
    },
    general_notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Periodontal notes cannot exceed 1000 characters']
    }
  },
  version: {
    type: Number,
    default: 1,
    min: [1, 'Version must be at least 1']
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for better query performance
OdontogramSchema.index({ clinic_id: 1 });
OdontogramSchema.index({ clinic_id: 1, patient_id: 1 });
OdontogramSchema.index({ clinic_id: 1, patient_id: 1, is_active: 1 });
OdontogramSchema.index({ clinic_id: 1, examination_date: -1 });
OdontogramSchema.index({ doctor_id: 1, examination_date: -1 });
OdontogramSchema.index({ patient_id: 1, version: -1 });

// Pre-save middleware to ensure only one active odontogram per patient
OdontogramSchema.pre('save', async function(next) {
  if (this.isNew && this.is_active) {
    // Deactivate all other odontograms for this patient
    await mongoose.model('Odontogram').updateMany(
      { 
        patient_id: this.patient_id, 
        clinic_id: this.clinic_id,
        _id: { $ne: this._id }
      },
      { is_active: false }
    );
  }
  next();
});

// Virtual to get treatment progress percentage
OdontogramSchema.virtual('treatment_progress').get(function(this: IOdontogram) {
  if (!this.treatment_summary || !this.treatment_summary.total_planned_treatments || this.treatment_summary.total_planned_treatments === 0) {
    return 0;
  }
  return Math.round(
    (this.treatment_summary.completed_treatments / this.treatment_summary.total_planned_treatments) * 100
  );
});

// Virtual to get pending treatments count
OdontogramSchema.virtual('pending_treatments').get(function(this: IOdontogram) {
  if (!this.treatment_summary) {
    return 0;
  }
  return (this.treatment_summary.total_planned_treatments || 0) - 
         (this.treatment_summary.completed_treatments || 0) - 
         (this.treatment_summary.in_progress_treatments || 0);
});

// Method to calculate treatment summary
OdontogramSchema.methods.calculateTreatmentSummary = function(this: IOdontogram) {
  let totalPlanned = 0;
  let completed = 0;
  let inProgress = 0;
  let totalCost = 0;

  this.teeth_conditions.forEach((tooth: IToothCondition) => {
    if (tooth.treatment_plan) {
      totalPlanned++;
      if (tooth.treatment_plan.status === 'completed') {
        completed++;
      } else if (tooth.treatment_plan.status === 'in_progress') {
        inProgress++;
      }
      if (tooth.treatment_plan.estimated_cost) {
        totalCost += tooth.treatment_plan.estimated_cost;
      }
    }
  });

  this.treatment_summary = {
    total_planned_treatments: totalPlanned,
    completed_treatments: completed,
    in_progress_treatments: inProgress,
    estimated_total_cost: totalCost
  };
};

// Ensure virtuals are included in JSON output
OdontogramSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.id; // Remove the virtual id field that mongoose adds
    return ret;
  }
});

OdontogramSchema.set('toObject', { virtuals: true });

export default mongoose.model<IOdontogram>('Odontogram', OdontogramSchema);
