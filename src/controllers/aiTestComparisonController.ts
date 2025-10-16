import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fromPath } from 'pdf2pic';
import pdf from 'pdf-parse';
import AITestComparison from '../models/AITestComparison';
import { AuthRequest } from '../types/express';

// Configure multer for multiple file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/ai-test-comparisons';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `comparison-report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, PNG, and PDF files are allowed'), false);
  }
};

export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 10 // Maximum 10 files for comparison
  }
});

export class AITestComparisonController {
  
  /**
   * Compare multiple test reports using AI
   */
  public static async compareTestReports(req: AuthRequest, res: Response) {
    const startTime = Date.now();
    
    try {
      const { patient_id, comparison_name, custom_prompt } = req.body;
      const files = req.files as Express.Multer.File[];

      // Validation
      if (!files || files.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'At least 2 test reports are required for comparison'
        });
      }

      if (files.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 10 test reports can be compared at once'
        });
      }

      if (!patient_id) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID is required'
        });
      }

      // Create initial comparison record
      const comparison = new AITestComparison({
        clinic_id: req.clinic_id,
        patient_id,
        doctor_id: req.user?._id,
        comparison_name: comparison_name || `Test Comparison - ${new Date().toLocaleDateString()}`,
        report_count: files.length,
        uploaded_files: files.map((file, index) => ({
          file_name: file.originalname,
          file_path: file.path,
          file_type: file.mimetype,
          file_size: file.size,
          upload_order: index
        })),
        // Initialize required date_range with placeholder dates (will be updated during processing)
        date_range: {
          start_date: new Date(),
          end_date: new Date()
        },
        // Initialize required comparison_analysis with placeholder data (will be updated during processing)
        comparison_analysis: {
          overall_trend: 'Processing...',
          key_changes: [],
          concerning_parameters: [],
          improved_parameters: [],
          stable_parameters: [],
          recommendations: [],
          patient_summary: {
            overall_status: 'Processing test comparison...',
            main_findings: 'Analysis in progress...',
            next_steps: 'Please wait while we analyze your reports...'
          }
        },
        // Initialize arrays
        individual_analyses: [],
        parameter_comparisons: [],
        status: 'processing',
        processing_stage: 'Starting analysis...'
      });

      await comparison.save();

      // Process files asynchronously
      AITestComparisonController.processComparisonAsync((comparison._id as any).toString(), files, custom_prompt);

      res.status(200).json({
        success: true,
        message: 'Test reports uploaded successfully. AI comparison is in progress.',
        data: {
          comparison_id: comparison._id,
          report_count: files.length,
          status: 'processing'
        }
      });

    } catch (error: any) {
      console.error('Comparison error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process test reports',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  /**
   * Process comparison asynchronously
   */
  private static async processComparisonAsync(comparisonId: string, files: Express.Multer.File[], customPrompt?: string) {
    try {
      const comparison = await AITestComparison.findById(comparisonId);
      if (!comparison) return;

      // Update processing stage
      comparison.processing_stage = 'Analyzing individual reports...';
      await comparison.save();

      // Analyze each file individually
      const individualAnalyses: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        comparison.processing_stage = `Analyzing report ${i + 1} of ${files.length}: ${file.originalname}`;
        await comparison.save();

        const analysis = await AITestComparisonController.analyzeIndividualReport(file, customPrompt);
        individualAnalyses.push(analysis);
      }

      // Update processing stage
      comparison.processing_stage = 'Comparing parameters across reports...';
      await comparison.save();

      // Compare reports and generate parameter comparisons
      const parameterComparisons = await AITestComparisonController.compareParameters(individualAnalyses);

      // Generate overall comparison analysis
      comparison.processing_stage = 'Generating comprehensive comparison analysis...';
      await comparison.save();

      const comparisonAnalysis = await AITestComparisonController.generateComparisonAnalysis(individualAnalyses, parameterComparisons);

      // Calculate date range
      const dates = individualAnalyses.map(a => new Date(a.analysis_date)).filter(d => !isNaN(d.getTime()));
      const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

      // Update comparison with results
      comparison.individual_analyses = individualAnalyses;
      comparison.parameter_comparisons = parameterComparisons;
      comparison.comparison_analysis = comparisonAnalysis;
      comparison.date_range = { start_date: startDate, end_date: endDate };
      comparison.status = 'completed';
      comparison.processing_stage = 'Comparison completed successfully';
      comparison.processing_time_ms = Date.now() - Date.parse(comparison.created_at.toString());

      await comparison.save();

    } catch (error: any) {
      console.error('Async processing error:', error);
      
      try {
        const comparison = await AITestComparison.findById(comparisonId);
        if (comparison) {
          comparison.status = 'failed';
          comparison.error_message = error.message || 'Unknown error occurred during processing';
          comparison.processing_stage = 'Processing failed';
          await comparison.save();
        }
      } catch (updateError) {
        console.error('Failed to update comparison status:', updateError);
      }
    }
  }

  /**
   * Analyze individual test report
   */
  private static async analyzeIndividualReport(file: Express.Multer.File, customPrompt?: string): Promise<any> {
    try {
      let textContent = '';
      let imageBuffers: Buffer[] = [];

      // Process different file types
      if (file.mimetype === 'application/pdf') {
        // Extract text from PDF
        const pdfBuffer = fs.readFileSync(file.path);
        const pdfData = await pdf(pdfBuffer);
        textContent = pdfData.text;

        // Convert PDF pages to images (first 5 pages only)
        const pdf2picOptions = {
          density: 150,
          saveFilename: "page",
          savePath: path.dirname(file.path),
          format: "png",
          width: 800,
          height: 800
        };

        try {
          const convertedImages = await fromPath(file.path, pdf2picOptions);
          
          if (Array.isArray(convertedImages)) {
            const maxPages = Math.min(convertedImages.length, 5);
            for (let i = 0; i < maxPages; i++) {
              const imagePath = convertedImages[i].path;
              if (fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                if (imageBuffer.length < 4 * 1024 * 1024) { // Under 4MB
                  imageBuffers.push(imageBuffer);
                }
                // Clean up temporary image
                fs.unlinkSync(imagePath);
              }
            }
          } else if ((convertedImages as any).path) {
            const imageBuffer = fs.readFileSync((convertedImages as any).path);
            if (imageBuffer.length < 4 * 1024 * 1024) {
              imageBuffers.push(imageBuffer);
            }
            fs.unlinkSync((convertedImages as any).path);
          }
        } catch (conversionError) {
          console.warn('PDF conversion failed, using text-only analysis:', conversionError);
        }
      } else {
        // Handle image files
        const imageBuffer = fs.readFileSync(file.path);
        if (imageBuffer.length < 4 * 1024 * 1024) {
          imageBuffers.push(imageBuffer);
        }
      }

      // Analyze with Gemini AI
      const analysisResult = await AITestComparisonController.analyzeWithGemini(textContent, imageBuffers, customPrompt);
      
      // Parse the structured data
      const structuredData = AITestComparisonController.parseStructuredData(analysisResult);

      return {
        file_name: file.originalname,
        file_type: file.mimetype,
        analysis_date: AITestComparisonController.extractDateFromContent(analysisResult, file.originalname),
        test_name: structuredData.test_name || 'Unknown Test',
        test_category: structuredData.test_category || '',
        test_results: structuredData.test_results || [],
        abnormal_findings: structuredData.abnormal_findings || [],
        clinical_interpretation: structuredData.clinical_interpretation || {}
      };

    } catch (error: any) {
      console.error('Individual analysis error:', error);
      return {
        file_name: file.originalname,
        file_type: file.mimetype,
        analysis_date: new Date(),
        test_name: 'Analysis Failed',
        test_category: 'Error',
        test_results: [],
        abnormal_findings: [],
        clinical_interpretation: { summary: `Analysis failed: ${error.message}` }
      };
    }
  }

  /**
   * Analyze content with Gemini AI
   */
  private static async analyzeWithGemini(textContent: string, imageBuffers: Buffer[], customPrompt?: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const genAI = new GoogleGenAI({ apiKey: apiKey as string });
    const prompt = customPrompt || AITestComparisonController.getDefaultPrompt();

    try {
      let parts: any[] = [{ text: prompt }];

      // Add text content if available
      if (textContent.trim()) {
        parts.push({ text: `Extracted Text Content: ${textContent}` });
      }

      // Add images if available
      if (imageBuffers.length > 0) {
        for (const buffer of imageBuffers) {
          parts.push({
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: 'image/png'
            }
          });
        }
      }

      if (parts.length === 1) {
        throw new Error('No content to analyze (no text or images)');
      }

      const result = await genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: parts
          }
        ]
      });
      
      if (result && result.candidates && result.candidates.length > 0) {
        const candidate = result.candidates[0];
        if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          const part = candidate.content.parts[0];
          if (part && part.text) {
            return part.text;
          }
        }
      }
      
      throw new Error('No valid response from Gemini AI');

    } catch (error: any) {
      console.error('Gemini AI error:', error);
      
      // Fallback to text-only analysis if image processing fails
      if (textContent.trim() && imageBuffers.length > 0) {
        console.log('Retrying with text-only analysis...');
        try {
          const result = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  { text: `Extracted Text Content: ${textContent}` }
                ]
              }
            ]
          });
          
          if (result && result.candidates && result.candidates.length > 0) {
            const candidate = result.candidates[0];
            if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              const part = candidate.content.parts[0];
              if (part && part.text) {
                return part.text;
              }
            }
          }
          
          throw new Error('No valid response from text-only analysis');
        } catch (textError) {
          console.error('Text-only analysis also failed:', textError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Compare parameters across reports
   */
  private static async compareParameters(individualAnalyses: any[]): Promise<any[]> {
    const parameterMap = new Map<string, any>();

    // Collect all parameters from all reports
    individualAnalyses.forEach((analysis, index) => {
      if (analysis.test_results) {
        analysis.test_results.forEach((result: any) => {
          const paramKey = result.parameter.toLowerCase().trim();
          
          if (!parameterMap.has(paramKey)) {
            parameterMap.set(paramKey, {
              parameter: result.parameter,
              unit: result.unit,
              reference_range: result.reference_range,
              values: [],
              trend: 'insufficient_data',
              trend_analysis: 'Awaiting trend analysis',
              is_concerning: false,
              clinical_significance: ''
            });
          }

          parameterMap.get(paramKey).values.push({
            report_index: index,
            date: analysis.analysis_date,
            value: result.value,
            status: result.status,
            file_name: analysis.file_name
          });
        });
      }
    });

    // Analyze trends for each parameter
    const parameterComparisons = Array.from(parameterMap.values()).map(param => {
      // Sort values by date
      param.values.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Analyze trend
      if (param.values.length >= 2) {
        const trendAnalysis = AITestComparisonController.analyzeTrend(param.values, param.parameter);
        param.trend = trendAnalysis.trend;
        param.trend_analysis = trendAnalysis.analysis || 'Trend analysis completed';
        param.is_concerning = trendAnalysis.is_concerning;
        param.clinical_significance = trendAnalysis.clinical_significance || '';
      } else {
        // Ensure trend_analysis is never empty for single data points
        param.trend_analysis = `${param.parameter} has only one data point. Trend analysis requires multiple values over time.`;
      }

      // Final safety check to ensure trend_analysis is never empty
      if (!param.trend_analysis || param.trend_analysis.trim() === '') {
        param.trend_analysis = 'Trend analysis data not available';
      }

      return param;
    });

    return parameterComparisons;
  }

  /**
   * Analyze trend for a parameter
   */
  private static analyzeTrend(values: any[], parameter: string): any {
    if (values.length < 2) {
      return {
        trend: 'insufficient_data',
        analysis: 'Not enough data points for trend analysis',
        is_concerning: false,
        clinical_significance: ''
      };
    }

    // Extract numeric values where possible
    const numericValues = values.map(v => {
      const match = v.value.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : null;
    }).filter(v => v !== null);

    if (numericValues.length < 2) {
      return {
        trend: 'insufficient_data',
        analysis: 'Values cannot be numerically compared',
        is_concerning: false,
        clinical_significance: ''
      };
    }

    // Calculate trend
    const firstValue = numericValues[0];
    const lastValue = numericValues[numericValues.length - 1];
    const percentChange = ((lastValue - firstValue) / firstValue) * 100;

    let trend = 'stable';
    let is_concerning = false;

    if (Math.abs(percentChange) > 20) {
      trend = percentChange > 0 ? 'increasing' : 'decreasing';
      
      // Check if trend is concerning based on parameter type and direction
      if (parameter.toLowerCase().includes('cholesterol') || 
          parameter.toLowerCase().includes('glucose') ||
          parameter.toLowerCase().includes('pressure')) {
        is_concerning = percentChange > 0;
      } else if (parameter.toLowerCase().includes('hemoglobin') ||
                 parameter.toLowerCase().includes('rbc')) {
        is_concerning = Math.abs(percentChange) > 15;
      }
    } else if (numericValues.length > 2) {
      // Check for fluctuation
      const variations: number[] = [];
      for (let i = 1; i < numericValues.length; i++) {
        variations.push(Math.abs((numericValues[i] - numericValues[i-1]) / numericValues[i-1]) * 100);
      }
      const avgVariation = variations.reduce((a, b) => a + b, 0) / variations.length;
      if (avgVariation > 15) {
        trend = 'fluctuating';
        is_concerning = true;
      }
    }

    const analysis = `${parameter} shows a ${trend} pattern over time. ` +
                    `Change from first to last: ${percentChange.toFixed(1)}%. ` +
                    `Values range: ${Math.min(...numericValues)} to ${Math.max(...numericValues)}.`;

    return {
      trend,
      analysis,
      is_concerning,
      clinical_significance: is_concerning ? `Concerning ${trend} trend in ${parameter} requires attention` : ''
    };
  }

  /**
   * Generate comprehensive comparison analysis
   */
  private static async generateComparisonAnalysis(individualAnalyses: any[], parameterComparisons: any[]): Promise<any> {
    const concerningParams = parameterComparisons.filter(p => p.is_concerning).map(p => p.parameter);
    const improvingParams = parameterComparisons.filter(p => p.trend === 'decreasing' && 
      (p.parameter.toLowerCase().includes('cholesterol') || p.parameter.toLowerCase().includes('glucose'))).map(p => p.parameter);
    const stableParams = parameterComparisons.filter(p => p.trend === 'stable').map(p => p.parameter);

    const keyChanges = parameterComparisons
      .filter(p => p.trend !== 'stable' && p.trend !== 'insufficient_data')
      .map(p => `${p.parameter}: ${p.trend} trend`)
      .slice(0, 5);

    return {
      overall_trend: concerningParams.length > improvingParams.length + stableParams.length ? 
        'Some concerning changes noted' : 'Generally stable with some variations',
      key_changes: keyChanges,
      concerning_parameters: concerningParams,
      improved_parameters: improvingParams,
      stable_parameters: stableParams.slice(0, 10),
      recommendations: [
        {
          category: 'follow_up',
          action: 'Review these results with your healthcare provider for proper interpretation',
          priority: 'high',
          timeline: 'Within 1-2 weeks'
        },
        {
          category: 'lifestyle',
          action: 'Maintain consistent lifestyle and medication compliance between tests',
          priority: 'medium',
          timeline: 'Ongoing'
        }
      ],
      patient_summary: {
        overall_status: concerningParams.length === 0 ? 
          'Your test results show good consistency over time' :
          'Some parameters show changes that may need attention',
        main_findings: `Compared ${individualAnalyses.length} test reports. ${concerningParams.length} parameters need attention, ${stableParams.length} are stable.`,
        next_steps: 'Discuss these trends with your doctor to understand their clinical significance.'
      }
    };
  }

  /**
   * Parse structured data from AI response
   */
  private static parseStructuredData(analysisText: string): any {
    try {
      // Clean the response text - remove any markdown code blocks or extra formatting
      let cleanedText = analysisText.trim();
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      cleanedText = cleanedText.trim();
      
      // Parse the JSON response
      const jsonResponse = JSON.parse(cleanedText);
      
      return {
        test_name: jsonResponse.test_identification?.test_name || '',
        test_category: jsonResponse.test_identification?.test_category || '',
        test_results: jsonResponse.test_results || [],
        abnormal_findings: jsonResponse.abnormal_findings || [],
        clinical_interpretation: jsonResponse.clinical_interpretation || {}
      };
      
    } catch (error: any) {
      console.error('Error parsing JSON structured data:', error.message);
      
      // Fallback to text parsing if JSON parsing fails
      const fallbackData: any = {
        test_name: 'Parsed from text',
        test_category: '',
        test_results: [],
        abnormal_findings: [],
        clinical_interpretation: { summary: analysisText.substring(0, 500) }
      };

      // Try to extract some basic info from text
      const lines = analysisText.split('\n');
      const testResults: any[] = [];
      
      lines.forEach(line => {
        // Look for patterns like "Parameter: Value (Range)"
        const match = line.match(/(.+?):\s*(.+?)\s*\((.+?)\)/);
        if (match) {
          testResults.push({
            parameter: match[1].trim(),
            value: match[2].trim(),
            reference_range: match[3].trim(),
            status: 'Unknown',
            unit: ''
          });
        }
      });

      fallbackData.test_results = testResults;
      return fallbackData;
    }
  }

  /**
   * Extract date from content or filename
   */
  private static extractDateFromContent(content: string, filename: string): Date {
    // Try to extract date from content
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{4}-\d{2}-\d{2}/,
      /\d{1,2}-\d{1,2}-\d{4}/,
      /\d{1,2}\.\d{1,2}\.\d{4}/
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Try to extract from filename
    for (const pattern of datePatterns) {
      const match = filename.match(pattern);
      if (match) {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Default to current date
    return new Date();
  }

  /**
   * Get default prompt for AI analysis
   */
  private static getDefaultPrompt(): string {
    return `You are an expert laboratory technician and medical analyst. Analyze the uploaded laboratory test report and provide a structured JSON response for comparison purposes.

CRITICAL: Your response must be valid JSON format only. Do not include any text before or after the JSON.

Analyze the test report and return the following JSON structure:

{
  "test_identification": {
    "test_name": "Name of the test(s) performed",
    "test_category": "Category (e.g., Hematology, Chemistry, etc.)",
    "report_date": "Date of the test (YYYY-MM-DD format if found)"
  },
  "test_results": [
    {
      "parameter": "Test parameter name",
      "value": "Numerical value with unit",
      "reference_range": "Normal reference range",
      "status": "Normal|High|Low|Abnormal",
      "unit": "Unit of measurement"
    }
  ],
  "abnormal_findings": [
    {
      "parameter": "Parameter name",
      "value": "Current value",
      "reference_range": "Normal range", 
      "status": "High|Low|Abnormal",
      "clinical_significance": "What this abnormal value indicates"
    }
  ],
  "clinical_interpretation": {
    "summary": "Overall interpretation of the results",
    "key_concerns": ["List of main health concerns based on results"],
    "condition_indicators": ["Possible conditions indicated by the results"]
  }
}

IMPORTANT GUIDELINES:
- Extract ALL visible test parameters with their exact values and reference ranges
- For status, use exactly: "Normal", "High", "Low", or "Abnormal"
- If a value is within normal range, mark status as "Normal"
- If image is unclear, include error in JSON: {"error": "Image not clear enough for analysis"}
- Be medically accurate and preserve exact numerical values
- Include units for all numerical values
- Try to extract the actual test date from the report
- Return ONLY the JSON object, no additional text or formatting`;
  }

  /**
   * Get comparison by ID
   */
  public static async getComparisonById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const comparison = await AITestComparison.findOne({
        _id: id,
        clinic_id: req.clinic_id
      }).populate('patient_id', 'first_name last_name').populate('doctor_id', 'first_name last_name');

      if (!comparison) {
        return res.status(404).json({
          success: false,
          message: 'Comparison not found'
        });
      }

      res.status(200).json({
        success: true,
        data: comparison
      });

    } catch (error: any) {
      console.error('Get comparison error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch comparison',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  /**
   * Get all comparisons for clinic
   */
  public static async getAllComparisons(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const query: any = { clinic_id: req.clinic_id };

      // Add filters
      if (req.query.status) {
        query.status = req.query.status;
      }
      if (req.query.patient_id) {
        query.patient_id = req.query.patient_id;
      }
      if (req.query.doctor_id) {
        query.doctor_id = req.query.doctor_id;
      }

      const comparisons = await AITestComparison.find(query)
        .populate('patient_id', 'first_name last_name')
        .populate('doctor_id', 'first_name last_name')
        .sort({ comparison_date: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AITestComparison.countDocuments(query);

      res.status(200).json({
        success: true,
        data: comparisons,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(total / limit),
          total_items: total,
          items_per_page: limit
        }
      });

    } catch (error: any) {
      console.error('Get all comparisons error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch comparisons',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  /**
   * Delete comparison
   */
  public static async deleteComparison(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const comparison = await AITestComparison.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!comparison) {
        return res.status(404).json({
          success: false,
          message: 'Comparison not found'
        });
      }

      // Delete associated files
      comparison.uploaded_files.forEach(file => {
        if (fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
        }
      });

      await AITestComparison.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Comparison deleted successfully'
      });

    } catch (error: any) {
      console.error('Delete comparison error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete comparison',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  /**
   * Get comparison statistics
   */
  public static async getComparisonStats(req: AuthRequest, res: Response) {
    try {
      const stats = await AITestComparison.aggregate([
        { $match: { clinic_id: req.clinic_id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = await AITestComparison.countDocuments({ clinic_id: req.clinic_id });
      const thisMonth = await AITestComparison.countDocuments({
        clinic_id: req.clinic_id,
        comparison_date: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      });

      const statusCounts = stats.reduce((acc: any, stat: any) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        data: {
          total_comparisons: total,
          this_month: thisMonth,
          pending: statusCounts.pending || 0,
          processing: statusCounts.processing || 0,
          completed: statusCounts.completed || 0,
          failed: statusCounts.failed || 0
        }
      });

    } catch (error: any) {
      console.error('Get comparison stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }
}
