import { Schema, Document, model } from 'mongoose';

// Individual test report data structure
interface TestReportData {
  file_name: string;
  file_type: string;
  analysis_date: Date;
  test_name: string;
  test_category?: string;
  test_results: {
    parameter: string;
    value: string;
    reference_range: string;
    status: 'Normal' | 'High' | 'Low' | 'Abnormal' | 'Borderline';
    unit: string;
  }[];
  abnormal_findings?: {
    parameter: string;
    value: string;
    reference_range: string;
    status: 'High' | 'Low' | 'Abnormal' | 'Borderline';
    clinical_significance: string;
  }[];
  clinical_interpretation?: {
    summary: string;
    key_concerns: string[];
    condition_indicators: string[];
  };
}

// Comparison result for a single parameter across reports
interface ParameterComparison {
  parameter: string;
  unit: string;
  reference_range: string;
  values: {
    report_index: number;
    date: Date;
    value: string;
    status: 'Normal' | 'High' | 'Low' | 'Abnormal' | 'Borderline';
    file_name: string;
  }[];
  trend: 'increasing' | 'decreasing' | 'stable' | 'fluctuating' | 'insufficient_data';
  trend_analysis: string;
  is_concerning: boolean;
  clinical_significance?: string;
}

// Overall comparison analysis
interface ComparisonAnalysis {
  overall_trend: string;
  key_changes: string[];
  concerning_parameters: string[];
  improved_parameters: string[];
  stable_parameters: string[];
  recommendations: {
    category: 'immediate' | 'follow_up' | 'lifestyle' | 'dietary' | 'medication';
    action: string;
    priority: 'high' | 'medium' | 'low';
    timeline: string;
  }[];
  patient_summary: {
    overall_status: string;
    main_findings: string;
    next_steps: string;
  };
}

export interface IAITestComparison extends Document {
  // Basic info
  tenant_id: Schema.Types.ObjectId;
  clinic_id: Schema.Types.ObjectId;
  patient_id: Schema.Types.ObjectId;
  doctor_id: Schema.Types.ObjectId;
  
  // Comparison metadata
  comparison_name: string;
  comparison_date: Date;
  report_count: number;
  date_range: {
    start_date: Date;
    end_date: Date;
  };
  
  // File information
  uploaded_files: {
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    upload_order: number;
  }[];
  
  // Individual report analyses
  individual_analyses: TestReportData[];
  
  // Comparison results
  parameter_comparisons: ParameterComparison[];
  
  // Overall analysis
  comparison_analysis: ComparisonAnalysis;
  
  // Processing status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_stage: string;
  error_message?: string;
  
  // AI processing details
  ai_model_used: string;
  processing_time_ms: number;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

const AITestComparisonSchema = new Schema<IAITestComparison>({
  // Basic info
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  patient_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Comparison metadata
  comparison_name: {
    type: String,
    required: true,
    trim: true
  },
  comparison_date: {
    type: Date,
    default: Date.now
  },
  report_count: {
    type: Number,
    required: true,
    min: 2,
    max: 10
  },
  date_range: {
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true }
  },
  
  // File information
  uploaded_files: [{
    file_name: { type: String, required: true },
    file_path: { type: String, required: true },
    file_type: { type: String, required: true },
    file_size: { type: Number, required: true },
    upload_order: { type: Number, required: true }
  }],
  
  // Individual report analyses
  individual_analyses: [{
    file_name: { type: String, required: true },
    file_type: { type: String, required: true },
    analysis_date: { type: Date, required: true },
    test_name: { type: String, required: true },
    test_category: { type: String, default: '' },
    
    test_results: [{
      parameter: { type: String, required: true },
      value: { type: String, required: true },
      reference_range: { type: String, required: true },
      status: { type: String, enum: ['Normal', 'High', 'Low', 'Abnormal', 'Borderline'], required: true },
      unit: { type: String, required: true }
    }],
    
    abnormal_findings: [{
      parameter: { type: String, required: true },
      value: { type: String, required: true },
      reference_range: { type: String, required: true },
      status: { type: String, enum: ['High', 'Low', 'Abnormal', 'Borderline'], required: true },
      clinical_significance: { type: String, required: true }
    }],
    
    clinical_interpretation: {
      summary: { type: String, default: '' },
      key_concerns: [{ type: String }],
      condition_indicators: [{ type: String }]
    }
  }],
  
  // Comparison results
  parameter_comparisons: [{
    parameter: { type: String, required: true },
    unit: { type: String, required: true },
    reference_range: { type: String, required: true },
    
    values: [{
      report_index: { type: Number, required: true },
      date: { type: Date, required: true },
      value: { type: String, required: true },
      status: { type: String, enum: ['Normal', 'High', 'Low', 'Abnormal', 'Borderline'], required: true },
      file_name: { type: String, required: true }
    }],
    
    trend: {
      type: String,
      enum: ['increasing', 'decreasing', 'stable', 'fluctuating', 'insufficient_data'],
      required: true
    },
    trend_analysis: { type: String, required: true },
    is_concerning: { type: Boolean, default: false },
    clinical_significance: { type: String, default: '' }
  }],
  
  // Overall analysis
  comparison_analysis: {
    overall_trend: { type: String, required: true },
    key_changes: [{ type: String }],
    concerning_parameters: [{ type: String }],
    improved_parameters: [{ type: String }],
    stable_parameters: [{ type: String }],
    
    recommendations: [{
      category: {
        type: String,
        enum: ['immediate', 'follow_up', 'lifestyle', 'dietary', 'medication'],
        required: true
      },
      action: { type: String, required: true },
      priority: { type: String, enum: ['high', 'medium', 'low'], required: true },
      timeline: { type: String, required: true }
    }],
    
    patient_summary: {
      overall_status: { type: String, required: true },
      main_findings: { type: String, required: true },
      next_steps: { type: String, required: true }
    }
  },
  
  // Processing status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processing_stage: {
    type: String,
    default: ''
  },
  error_message: {
    type: String,
    default: ''
  },
  
  // AI processing details
  ai_model_used: {
    type: String,
    default: 'google-gemini-1.5-flash'
  },
  processing_time_ms: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance with tenant awareness
AITestComparisonSchema.index({ tenant_id: 1 });
AITestComparisonSchema.index({ tenant_id: 1, clinic_id: 1, patient_id: 1 });
AITestComparisonSchema.index({ tenant_id: 1, comparison_date: -1 });
AITestComparisonSchema.index({ tenant_id: 1, status: 1 });
AITestComparisonSchema.index({ tenant_id: 1, doctor_id: 1 });

const AITestComparison = model<IAITestComparison>('AITestComparison', AITestComparisonSchema);

export default AITestComparison;
