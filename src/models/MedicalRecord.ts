import mongoose, { Document, Schema } from 'mongoose';

export interface IMedicalRecord extends Document {
  tenant_id: mongoose.Types.ObjectId;
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  visit_date: Date;
  chief_complaint: string;
  diagnosis: string;
  treatment: string;
  vital_signs: {
    temperature?: number;
    blood_pressure?: {
      systolic: number;
      diastolic: number;
    };
    heart_rate?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight?: number;
    height?: number;
  };
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes?: string;
  }[];
  allergies: {
    allergen: string;
    severity: 'mild' | 'moderate' | 'severe';
    reaction: string;
  }[];
  created_at: Date;
}

const MedicalRecordSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  patient_id: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  doctor_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor ID is required']
  },
  visit_date: {
    type: Date,
    required: [true, 'Visit date is required'],
    default: Date.now
  },
  chief_complaint: {
    type: String,
    required: [true, 'Chief complaint is required'],
    trim: true,
    maxlength: [1000, 'Chief complaint cannot exceed 1000 characters']
  },
  diagnosis: {
    type: String,
    required: [true, 'Diagnosis is required'],
    trim: true,
    maxlength: [2000, 'Diagnosis cannot exceed 2000 characters']
  },
  treatment: {
    type: String,
    required: [true, 'Treatment is required'],
    trim: true,
    maxlength: [2000, 'Treatment cannot exceed 2000 characters']
  },
  vital_signs: {
    temperature: {
      type: Number,
      min: [30, 'Temperature must be at least 30°C'],
      max: [50, 'Temperature cannot exceed 50°C']
    },
    blood_pressure: {
      systolic: {
        type: Number,
        min: [60, 'Systolic pressure must be at least 60 mmHg'],
        max: [300, 'Systolic pressure cannot exceed 300 mmHg']
      },
      diastolic: {
        type: Number,
        min: [30, 'Diastolic pressure must be at least 30 mmHg'],
        max: [200, 'Diastolic pressure cannot exceed 200 mmHg']
      }
    },
    heart_rate: {
      type: Number,
      min: [30, 'Heart rate must be at least 30 bpm'],
      max: [250, 'Heart rate cannot exceed 250 bpm']
    },
    respiratory_rate: {
      type: Number,
      min: [5, 'Respiratory rate must be at least 5 breaths/min'],
      max: [60, 'Respiratory rate cannot exceed 60 breaths/min']
    },
    oxygen_saturation: {
      type: Number,
      min: [70, 'Oxygen saturation must be at least 70%'],
      max: [100, 'Oxygen saturation cannot exceed 100%']
    },
    weight: {
      type: Number,
      min: [1, 'Weight must be at least 1 kg'],
      max: [500, 'Weight cannot exceed 500 kg']
    },
    height: {
      type: Number,
      min: [30, 'Height must be at least 30 cm'],
      max: [250, 'Height cannot exceed 250 cm']
    }
  },
  medications: [{
    name: {
      type: String,
      required: [true, 'Medication name is required'],
      trim: true
    },
    dosage: {
      type: String,
      required: [true, 'Medication dosage is required'],
      trim: true
    },
    frequency: {
      type: String,
      required: [true, 'Medication frequency is required'],
      trim: true
    },
    duration: {
      type: String,
      required: [true, 'Medication duration is required'],
      trim: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Medication notes cannot exceed 500 characters']
    }
  }],
  allergies: [{
    allergen: {
      type: String,
      required: [true, 'Allergen is required'],
      trim: true
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      required: [true, 'Allergy severity is required']
    },
    reaction: {
      type: String,
      required: [true, 'Allergic reaction is required'],
      trim: true
    }
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Create indexes for better query performance with tenant awareness
MedicalRecordSchema.index({ tenant_id: 1 });
MedicalRecordSchema.index({ tenant_id: 1, patient_id: 1, visit_date: -1 });
MedicalRecordSchema.index({ tenant_id: 1, doctor_id: 1, visit_date: -1 });
MedicalRecordSchema.index({ tenant_id: 1, visit_date: -1 });

export default mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema); 