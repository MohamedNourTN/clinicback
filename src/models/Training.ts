import mongoose, { Document, Schema } from 'mongoose';

export interface ITrainingModule {
  _id?: mongoose.Types.ObjectId;
  title: string;
  duration: string;
  lessons: string[];
  description?: string;
  order: number;
}

export interface ITraining extends Document {
  role: 'super_admin' | 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'accountant';
  name: string;
  description: string;
  overview: string;
  modules: ITrainingModule[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const TrainingModuleSchema: Schema = new Schema({
  title: {
    type: String,
    required: [true, 'Module title is required'],
    trim: true,
    maxlength: [200, 'Module title cannot exceed 200 characters']
  },
  duration: {
    type: String,
    required: [true, 'Module duration is required'],
    trim: true
  },
  lessons: [{
    type: String,
    required: [true, 'Lesson title is required'],
    trim: true,
    maxlength: [300, 'Lesson title cannot exceed 300 characters']
  }],
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Module description cannot exceed 1000 characters']
  },
  order: {
    type: Number,
    required: [true, 'Module order is required'],
    min: [1, 'Module order must be at least 1']
  }
});

const TrainingSchema: Schema = new Schema({
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant'],
    required: [true, 'Role is required'],
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Training name is required'],
    trim: true,
    maxlength: [200, 'Training name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Training description is required'],
    trim: true,
    maxlength: [500, 'Training description cannot exceed 500 characters']
  },
  overview: {
    type: String,
    required: [true, 'Training overview is required'],
    trim: true,
    maxlength: [1000, 'Training overview cannot exceed 1000 characters']
  },
  modules: [TrainingModuleSchema],
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for efficient queries
// Note: unique index on role already created by field definition
TrainingSchema.index({ is_active: 1 });

export default mongoose.model<ITraining>('Training', TrainingSchema); 