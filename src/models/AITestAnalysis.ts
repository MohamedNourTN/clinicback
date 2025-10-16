import mongoose, { Document, Schema } from 'mongoose';

// New JSON structure interfaces
interface TestResult {
  parameter: string;
  value: string;
  reference_range: string;
  status: 'Normal' | 'High' | 'Low' | 'Abnormal';
  unit: string;
}

interface AbnormalFinding {
  parameter: string;
  value: string;
  reference_range: string;
  status: 'High' | 'Low' | 'Abnormal';
  clinical_significance: string;
}

interface ClinicalInterpretation {
  summary: string;
  key_concerns: string[];
  condition_indicators: string[];
}

interface Recommendation {
  category: 'immediate' | 'follow_up' | 'lifestyle' | 'dietary' | 'medication';
  action: string;
  priority: 'high' | 'medium' | 'low';
  timeline: string;
}

interface PatientSummary {
  overall_status: string;
  main_findings: string;
  next_steps: string;
}

export interface IAITestAnalysis extends Document {
  tenant_id: mongoose.Types.ObjectId;
  clinic_id: mongoose.Types.ObjectId;
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  file_url: string;
  file_name: string;
  file_type: string;
  custom_prompt?: string;
  analysis_result: string;
  structured_data: {
    // New JSON structure fields
    test_name: string;
    test_category?: string;
    test_results?: TestResult[];
    abnormal_findings?: AbnormalFinding[] | string[]; // Support both new and old format
    clinical_interpretation?: ClinicalInterpretation;
    recommendations?: Recommendation[] | string[]; // Support both new and old format
    patient_summary?: PatientSummary;
    // Legacy fields for backward compatibility
    test_values?: string[];
    reference_ranges?: string[];
    interpretation?: string;
  };
  status: 'processing' | 'completed' | 'failed';
  confidence_score?: number;
  analysis_date: Date;
  created_at: Date;
  updated_at: Date;
}

const AITestAnalysisSchema = new Schema<IAITestAnalysis>({
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
    required: true
  },
  doctor_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  file_url: {
    type: String,
    required: true
  },
  file_name: {
    type: String,
    required: true
  },
  file_type: {
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  },
  custom_prompt: {
    type: String,
    default: ''
  },
  analysis_result: {
    type: String,
    required: true
  },
  structured_data: {
    // Core test identification
    test_name: { 
      type: String, 
      default: '' 
    },
    test_category: {
      type: String,
      default: ''
    },
    
    // New JSON structure fields
    test_results: [{
      parameter: { type: String },
      value: { type: String },
      reference_range: { type: String },
      status: { 
        type: String, 
        enum: ['Normal', 'High', 'Low', 'Abnormal', 'Borderline']
      },
      unit: { type: String }
    }],
    
    abnormal_findings: [{
      type: Schema.Types.Mixed // Allow both objects and strings
    }],
    
    clinical_interpretation: {
      summary: { type: String, default: '' },
      key_concerns: [{ type: String }],
      condition_indicators: [{ type: String }]
    },
    
    recommendations: [{
      type: Schema.Types.Mixed // Allow both objects and strings
    }],
    
    patient_summary: {
      overall_status: { type: String, default: '' },
      main_findings: { type: String, default: '' },
      next_steps: { type: String, default: '' }
    },
    
    // Legacy fields for backward compatibility
    test_values: [{ 
      type: String 
    }],
    reference_ranges: [{ 
      type: String 
    }],
    interpretation: { 
      type: String, 
      default: '' 
    }
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  confidence_score: {
    type: Number,
    min: 0,
    max: 100
  },
  analysis_date: {
    type: Date,
    default: Date.now
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

AITestAnalysisSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Create indexes for better query performance with tenant awareness
AITestAnalysisSchema.index({ tenant_id: 1 });
AITestAnalysisSchema.index({ tenant_id: 1, clinic_id: 1 });
AITestAnalysisSchema.index({ tenant_id: 1, clinic_id: 1, patient_id: 1, analysis_date: -1 });
AITestAnalysisSchema.index({ tenant_id: 1, clinic_id: 1, doctor_id: 1, created_at: -1 });
AITestAnalysisSchema.index({ tenant_id: 1, clinic_id: 1, status: 1 });
AITestAnalysisSchema.index({ tenant_id: 1, clinic_id: 1, 'structured_data.test_name': 1 });
AITestAnalysisSchema.index({ tenant_id: 1, clinic_id: 1, analysis_date: -1 });

export default mongoose.model<IAITestAnalysis>('AITestAnalysis', AITestAnalysisSchema);
