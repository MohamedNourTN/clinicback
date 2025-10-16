import mongoose, { Document, Schema } from 'mongoose';

export interface IModuleProgress {
  module_id: string;
  module_title: string;
  completed: boolean;
  completed_at?: Date;
  lessons_completed: string[];
  progress_percentage: number;
}

export interface ITrainingProgress extends Document {
  user_id: mongoose.Types.ObjectId;
  training_id: mongoose.Types.ObjectId;
  role: 'super_admin' | 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'accountant';
  overall_progress: number;
  modules_progress: IModuleProgress[];
  started_at: Date;
  last_accessed: Date;
  completed_at?: Date;
  is_completed: boolean;
  certificate_issued: boolean;
  created_at: Date;
  updated_at: Date;
}

const ModuleProgressSchema: Schema = new Schema({
  module_id: {
    type: String,
    required: [true, 'Module ID is required']
  },
  module_title: {
    type: String,
    required: [true, 'Module title is required'],
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  completed_at: {
    type: Date
  },
  lessons_completed: [{
    type: String,
    trim: true
  }],
  progress_percentage: {
    type: Number,
    default: 0,
    min: [0, 'Progress percentage cannot be negative'],
    max: [100, 'Progress percentage cannot exceed 100']
  }
});

const TrainingProgressSchema: Schema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  training_id: {
    type: Schema.Types.ObjectId,
    ref: 'Training',
    required: [true, 'Training ID is required']
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant'],
    required: [true, 'Role is required']
  },
  overall_progress: {
    type: Number,
    default: 0,
    min: [0, 'Overall progress cannot be negative'],
    max: [100, 'Overall progress cannot exceed 100']
  },
  modules_progress: [ModuleProgressSchema],
  started_at: {
    type: Date,
    default: Date.now
  },
  last_accessed: {
    type: Date,
    default: Date.now
  },
  completed_at: {
    type: Date
  },
  is_completed: {
    type: Boolean,
    default: false
  },
  certificate_issued: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for efficient queries
TrainingProgressSchema.index({ user_id: 1, training_id: 1 }, { unique: true });
TrainingProgressSchema.index({ user_id: 1 });
TrainingProgressSchema.index({ role: 1 });
TrainingProgressSchema.index({ is_completed: 1 });

// Pre-save middleware to update last_accessed
TrainingProgressSchema.pre('save', function(next) {
  this.last_accessed = new Date();
  
  // Auto-complete if all modules are completed
  if (this.modules_progress && Array.isArray(this.modules_progress) && this.modules_progress.length > 0) {
    const completedModules = this.modules_progress.filter((m: any) => m.completed).length;
    const totalModules = this.modules_progress.length;
    
    this.overall_progress = Math.round((completedModules / totalModules) * 100);
    
    if (completedModules === totalModules && !this.is_completed) {
      this.is_completed = true;
      this.completed_at = new Date();
    }
  }
  
  next();
});

export default mongoose.model<ITrainingProgress>('TrainingProgress', TrainingProgressSchema); 