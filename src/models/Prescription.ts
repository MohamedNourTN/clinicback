import mongoose, { Document, Schema } from 'mongoose';

export interface IMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
}

export interface IPrescription extends Document {
  tenant_id: mongoose.Types.ObjectId;
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  appointment_id?: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  prescription_id: string; // Custom ID like RX-001
  diagnosis: string;
  medications: IMedication[];
  status: 'active' | 'completed' | 'pending' | 'cancelled' | 'expired';
  notes?: string;
  follow_up_date?: Date;
  pharmacy_dispensed: boolean;
  dispensed_date?: Date;
  created_at: Date;
  updated_at: Date;
}

const MedicationSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Medication name is required'],
    trim: true
  },
  dosage: {
    type: String,
    required: [true, 'Dosage is required'],
    trim: true
  },
  frequency: {
    type: String,
    required: [true, 'Frequency is required'],
    trim: true
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true
  },
  instructions: {
    type: String,
    required: [true, 'Instructions are required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  }
});

const PrescriptionSchema: Schema = new Schema({
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
  appointment_id: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  prescription_id: {
    type: String,
    required: [true, 'Prescription ID is required'],
    unique: true,
    trim: true
  },
  diagnosis: {
    type: String,
    required: [true, 'Diagnosis is required'],
    trim: true
  },
  medications: {
    type: [MedicationSchema],
    required: [true, 'At least one medication is required'],
    validate: {
      validator: function(medications: IMedication[]) {
        return medications && medications.length > 0;
      },
      message: 'At least one medication is required'
    }
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'pending', 'cancelled', 'expired'],
    default: 'pending',
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  follow_up_date: {
    type: Date
  },
  pharmacy_dispensed: {
    type: Boolean,
    default: false
  },
  dispensed_date: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for better search performance with tenant awareness
// Note: prescription_id already has unique index from schema definition
PrescriptionSchema.index({ tenant_id: 1 });
PrescriptionSchema.index({ tenant_id: 1, patient_id: 1 });
PrescriptionSchema.index({ tenant_id: 1, doctor_id: 1 });
PrescriptionSchema.index({ tenant_id: 1, status: 1 });
PrescriptionSchema.index({ tenant_id: 1, clinic_id: 1 });
PrescriptionSchema.index({ tenant_id: 1, created_at: -1 });

// Compound indexes for tenant/clinic-based queries
PrescriptionSchema.index({ tenant_id: 1, clinic_id: 1, status: 1 });
PrescriptionSchema.index({ tenant_id: 1, clinic_id: 1, patient_id: 1 });
PrescriptionSchema.index({ tenant_id: 1, clinic_id: 1, doctor_id: 1 });
PrescriptionSchema.index({ tenant_id: 1, clinic_id: 1, created_at: -1 });

// Note: Prescription ID is now generated in the controller before saving

export default mongoose.model<IPrescription>('Prescription', PrescriptionSchema); 