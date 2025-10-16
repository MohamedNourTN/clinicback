import mongoose, { Document, Schema } from 'mongoose';

export interface ITurnaroundTime extends Document {
  name: string;
  code: string;
  duration: string;
  durationMinutes: number;
  priority: 'stat' | 'urgent' | 'routine' | 'extended';
  category: string;
  description: string;
  examples: string[];
  clinic_id: mongoose.Types.ObjectId;
  isActive: boolean;
  created_at: Date;
  updated_at: Date;
}

const TurnaroundTimeSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Turnaround time name is required'],
    trim: true,
    maxlength: [100, 'Turnaround time name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Turnaround time code is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Turnaround time code cannot exceed 20 characters']
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true,
    maxlength: [50, 'Duration cannot exceed 50 characters']
  },
  durationMinutes: {
    type: Number,
    required: [true, 'Duration in minutes is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: {
      values: ['stat', 'urgent', 'routine', 'extended'],
      message: 'Invalid priority level'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  examples: [{
    type: String,
    trim: true,
    required: true
  }],
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for better performance
TurnaroundTimeSchema.index({ name: 'text', code: 'text', description: 'text' });
TurnaroundTimeSchema.index({ priority: 1 });
TurnaroundTimeSchema.index({ isActive: 1 });
TurnaroundTimeSchema.index({ durationMinutes: 1 });
TurnaroundTimeSchema.index({ clinic_id: 1 });

// Compound indexes for clinic-based queries
TurnaroundTimeSchema.index({ clinic_id: 1, name: 1 }, { unique: true });
TurnaroundTimeSchema.index({ clinic_id: 1, code: 1 }, { unique: true });
TurnaroundTimeSchema.index({ clinic_id: 1, priority: 1 });
TurnaroundTimeSchema.index({ clinic_id: 1, isActive: 1 });
TurnaroundTimeSchema.index({ clinic_id: 1, durationMinutes: 1 });

// Pre-save middleware to ensure code is uppercase
TurnaroundTimeSchema.pre('save', function(this: ITurnaroundTime, next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  next();
});

export default mongoose.model<ITurnaroundTime>('TurnaroundTime', TurnaroundTimeSchema); 