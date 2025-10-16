import mongoose, { Document, Schema } from 'mongoose';

export interface IXrayAnalysis extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  image_url: string;
  image_filename: string;
  custom_prompt?: string;
  analysis_result: string;
  analysis_date: Date;
  status: 'pending' | 'completed' | 'failed';
  confidence_score?: number;
  findings: {
    cavities?: boolean;
    wisdom_teeth?: string;
    bone_density?: string;
    infections?: boolean;
    abnormalities?: string[];
  };
  recommendations?: string;
  created_at: Date;
  updated_at: Date;
}

const XrayAnalysisSchema = new Schema<IXrayAnalysis>({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required'],
    index: true
  },
  patient_id: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image_url: {
    type: String,
    required: true
  },
  image_filename: {
    type: String,
    required: true
  },
  custom_prompt: {
    type: String,
    default: ''
  },
  analysis_result: {
    type: String,
    required: true
  },
  analysis_date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  confidence_score: {
    type: Number,
    min: 0,
    max: 100
  },
  findings: {
    cavities: { type: Boolean, default: false },
    wisdom_teeth: { type: String, default: '' },
    bone_density: { type: String, default: '' },
    infections: { type: Boolean, default: false },
    abnormalities: [{ type: String }]
  },
  recommendations: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

XrayAnalysisSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Create indexes for better query performance with tenant awareness
XrayAnalysisSchema.index({ tenant_id: 1 });
XrayAnalysisSchema.index({ tenant_id: 1, clinic_id: 1 });
XrayAnalysisSchema.index({ tenant_id: 1, clinic_id: 1, patient_id: 1, analysis_date: -1 });
XrayAnalysisSchema.index({ tenant_id: 1, clinic_id: 1, doctor_id: 1, created_at: -1 });
XrayAnalysisSchema.index({ tenant_id: 1, clinic_id: 1, status: 1 });

export default mongoose.model<IXrayAnalysis>('XrayAnalysis', XrayAnalysisSchema); 