import mongoose, { Document, Schema } from 'mongoose';

export interface IAppointment extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  nurse_id?: mongoose.Types.ObjectId;
  appointment_date: Date;
  duration: number;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  type: string;
  reason?: string;
  notes: string;
  created_at: Date;
  updated_at: Date;
}

const AppointmentSchema: Schema = new Schema({
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
  doctor_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor ID is required']
  },
  nurse_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    validate: {
      validator: async function(value: mongoose.Types.ObjectId) {
        if (!value) return true; // Optional field
        const User = mongoose.model('User');
        const nurse = await User.findById(value);
        return nurse && nurse.role === 'nurse';
      },
      message: 'Selected user must be a nurse'
    }
  },
  appointment_date: {
    type: Date,
    required: [true, 'Appointment date is required'],
    validate: {
      validator: function(value: Date) {
        // For new appointments, require future dates
        // For updates, be more flexible - allow today or future dates
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        return new Date(value) >= today;
      },
      message: 'Appointment date cannot be in the past'
    }
  },
  duration: {
    type: Number,
    required: [true, 'Appointment duration is required'],
    min: [15, 'Appointment duration must be at least 15 minutes'],
    max: [240, 'Appointment duration cannot exceed 4 hours'],
    default: 30
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    required: [true, 'Appointment status is required'],
    default: 'scheduled'
  },
  type: {
    type: String,
    required: [true, 'Appointment type is required'],
    trim: true,
    maxlength: [100, 'Appointment type cannot exceed 100 characters'],
    enum: [
      'consultation',
      'follow-up',
      'check-up',
      'vaccination',
      'procedure',
      'emergency',
      'screening',
      'therapy',
      'other'
    ]
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [200, 'Reason cannot exceed 200 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for better query performance with tenant awareness
AppointmentSchema.index({ tenant_id: 1 });
AppointmentSchema.index({ tenant_id: 1, clinic_id: 1 });
AppointmentSchema.index({ tenant_id: 1, clinic_id: 1, appointment_date: 1 });
AppointmentSchema.index({ tenant_id: 1, clinic_id: 1, patient_id: 1, appointment_date: 1 });
AppointmentSchema.index({ tenant_id: 1, clinic_id: 1, appointment_date: 1, status: 1 });
AppointmentSchema.index({ tenant_id: 1, clinic_id: 1, nurse_id: 1, appointment_date: 1 });

// Prevent double booking - same doctor at the same time within same tenant/clinic
AppointmentSchema.index(
  { tenant_id: 1, clinic_id: 1, doctor_id: 1, appointment_date: 1 },
  { 
    unique: true,
    partialFilterExpression: { 
      status: { $nin: ['cancelled', 'no-show'] } 
    }
  }
);

// Virtual to calculate end time
AppointmentSchema.virtual('end_time').get(function() {
  const appointmentDate = this.appointment_date as Date;
  const duration = this.duration as number;
  return new Date(appointmentDate.getTime() + (duration * 60000));
});

// Method to check if appointment is upcoming
AppointmentSchema.methods.isUpcoming = function(this: IAppointment) {
  return this.appointment_date > new Date() && this.status !== 'cancelled';
};

// Method to check if appointment can be cancelled
AppointmentSchema.methods.canBeCancelled = function(this: IAppointment) {
  const now = new Date();
  const appointmentTime = new Date(this.appointment_date);
  const timeDiff = appointmentTime.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 3600);
  
  return hoursDiff >= 24 && ['scheduled', 'confirmed'].includes(this.status);
};

export default mongoose.model<IAppointment>('Appointment', AppointmentSchema); 