import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fromPath } from 'pdf2pic';
import pdf from 'pdf-parse';
import AITestAnalysis from '../models/AITestAnalysis';
import { AuthRequest } from '../types/express';

// NOTE: Add GEMINI_API_KEY to your .env file
// GEMINI_API_KEY=your-gemini-api-key-here

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/ai-test-reports';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `test-report-${uniqueSuffix}${path.extname(file.originalname)}`);
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

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit for test reports
  }
});



export class AITestAnalysisController {
  
  /**
   * Upload and analyze test report using AI
   */
  static async analyzeTestReport(req: AuthRequest, res: Response): Promise<void> {
    console.log('=== AI Test Report Analysis Request Started ===');
    console.log('User:', req.user?._id, 'Role:', req.user?.role);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('File present:', !!req.file);
    
    try {
      const { patient_id, custom_prompt } = req.body;
      const file = req.file;

      if (!file) {
        console.log('Error: No file uploaded');
        res.status(400).json({
          success: false,
          message: 'Test report file is required'
        });
        return;
      }

      if (!patient_id) {
        console.log('Error: No patient_id provided');
        res.status(400).json({
          success: false,
          message: 'Patient ID is required'
        });
        return;
      }

      console.log('Patient ID:', patient_id);
      console.log('Custom prompt length:', custom_prompt?.length || 0);

      // Default prompt for test report analysis - requesting JSON format
      const defaultPrompt = `You are an expert laboratory technician and medical analyst. Analyze the uploaded laboratory test report image and provide a structured JSON response.

CRITICAL: Your response must be valid JSON format only. Do not include any text before or after the JSON.

Analyze the test report and return the following JSON structure:

{
  "test_identification": {
    "test_name": "Name of the test(s) performed",
    "test_category": "Category (e.g., Hematology, Chemistry, etc.)"
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
  },
  "recommendations": [
    {
      "category": "immediate|follow_up|lifestyle|dietary|medication",
      "action": "Specific recommendation",
      "priority": "high|medium|low",
      "timeline": "When to act (e.g., immediately, within 1 week, etc.)"
    }
  ],
  "patient_summary": {
    "overall_status": "Brief overall health status",
    "main_findings": "Patient-friendly summary of key findings",
    "next_steps": "What the patient should do next"
  }
}

IMPORTANT GUIDELINES:
- Extract ALL visible test parameters with their values and reference ranges
- For status, use exactly: "Normal", "High", "Low", or "Abnormal"
- If a value is within normal range, mark status as "Normal"
- If image is unclear, include error in JSON: {"error": "Image not clear enough for analysis"}
- Be medically accurate and precise
- Include units for all numerical values
- Return ONLY the JSON object, no additional text or formatting`;

      // Always merge custom prompt with default prompt
      const analysisPrompt = custom_prompt && custom_prompt.trim() 
        ? `${defaultPrompt}\n\n--- Additional Custom Instructions ---\n${custom_prompt}`
        : defaultPrompt;

      // Initialize Gemini AI client
      const apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      const genAI = new GoogleGenAI({ apiKey: apiKey as string });

      // Process the uploaded file (image or PDF)
      let imageParts: any[] = [];
      let extractedText = '';

      if (file.mimetype === 'application/pdf') {
        console.log('Processing PDF file...');
        
        try {
          // Extract text from PDF
          const pdfBuffer = fs.readFileSync(file.path);
          const pdfData = await pdf(pdfBuffer);
          extractedText = pdfData.text;
          const numPages = pdfData.numpages || 1;
          
          console.log('Extracted text length:', extractedText.length);
          console.log(`PDF has ${numPages} page(s), converting...`);

          // Convert PDF to images using pdf2pic
          const outputDir = path.dirname(file.path);
          
          const pdf2picOptions = {
            density: 150,           // Higher resolution for better quality
            saveFilename: "page",   // Output filename format  
            savePath: outputDir,    // Output directory
            format: "png",          // Output format
            width: 800,            // Smaller width for Gemini compatibility
            height: 800            // Smaller height for Gemini compatibility
          };

          console.log('Converting PDF to images...');
          const convert = fromPath(file.path, pdf2picOptions);
          
          // Limit pages for Gemini API compatibility (max 5 pages)
          const maxPages = Math.min(numPages, 5);
          console.log(`Processing first ${maxPages} pages for AI analysis...`);
          
          // Convert pages (limited to avoid Gemini API limits)
          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            try {
              const result = await convert(pageNum, { responseType: "buffer" });
              
              if (result.buffer) {
                // Validate image size (max 4MB per image for Gemini)
                const imageSizeKB = result.buffer.length / 1024;
                console.log(`Page ${pageNum} image size: ${imageSizeKB.toFixed(2)}KB`);
                
                if (imageSizeKB > 4000) { // 4MB limit
                  console.log(`Page ${pageNum} too large (${imageSizeKB.toFixed(2)}KB), skipping...`);
                  continue;
                }
                
                const imageBase64 = result.buffer.toString('base64');
                
                imageParts.push({
                  inlineData: {
                    data: imageBase64,
                    mimeType: 'image/png'
                  }
                });
                
                console.log(`Converted page ${pageNum}/${maxPages}`);
              }
            } catch (pageError: any) {
              console.error(`Error converting page ${pageNum}:`, pageError.message);
              // Continue with other pages even if one fails
            }
          }

          console.log(`Successfully converted ${imageParts.length} page(s) to images`);
          
          // If no images could be processed, continue with text-only analysis
          if (imageParts.length === 0) {
            console.log('No images could be processed, continuing with text-only analysis...');
          }

        } catch (pdfError: any) {
          console.error('PDF processing error:', pdfError);
          throw new Error(`Failed to process PDF: ${pdfError.message}`);
        }

      } else {
        // Handle regular image files
        console.log('Processing image file...');
        const imageBuffer = fs.readFileSync(file.path);
        const imageBase64 = imageBuffer.toString('base64');

        imageParts.push({
          inlineData: {
            data: imageBase64,
            mimeType: file.mimetype
          }
        });
      }

      // Generate analysis using Gemini with proper error handling, timeout, and retry logic
      console.log('Starting Gemini AI analysis...');
      console.log('Number of images to analyze:', imageParts.length);
      console.log('Extracted text length:', extractedText.length);
      
      // Enhance the prompt based on available data
      let enhancedPrompt = analysisPrompt;
      if (extractedText && extractedText.trim()) {
        if (imageParts.length > 0) {
          enhancedPrompt += `\n\n--- Extracted Text from PDF ---\n${extractedText}\n\nPlease analyze both the visual content from the images and the text data above to provide a comprehensive analysis.`;
        } else {
          enhancedPrompt += `\n\n--- Extracted Text from PDF ---\n${extractedText}\n\nNote: Only text data is available for analysis (images could not be processed). Please provide a comprehensive analysis based on the text content above.`;
        }
      } else if (imageParts.length === 0) {
        throw new Error('No analyzable content found - neither text nor images could be extracted from the PDF');
      }
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API request timed out after 5 minutes')), 5 * 60 * 1000)
      );
      
      // Retry logic for Gemini API call
      let result;
      let lastError;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Gemini API attempt ${attempt}/${maxRetries}...`);
          
          // Build content parts - text only or text + images
          const contentParts = [
            { text: enhancedPrompt }
          ];
          
          // Add images only if available
          if (imageParts.length > 0) {
            contentParts.push(...imageParts);
            console.log(`Sending ${imageParts.length} images to Gemini for analysis`);
          } else {
            console.log('Sending text-only analysis to Gemini');
          }
          
          const analysisPromise = genAI.models.generateContent({
            model: 'gemini-2.5-pro-preview-05-06',
            contents: [
              {
                parts: contentParts
              }
            ]
          });
          
          result = await Promise.race([analysisPromise, timeoutPromise]) as any;
          console.log(`Gemini API attempt ${attempt} succeeded`);
          break;
          
        } catch (error: any) {
          console.error(`Gemini API attempt ${attempt} failed:`, error.message);
          lastError = error;
          
          // If this is an image processing error and we have text, try text-only on final attempt
          if (attempt === maxRetries && imageParts.length > 0 && extractedText && extractedText.trim() && 
              (error.message.includes('Unable to process input image') || error.message.includes('INVALID_ARGUMENT'))) {
            console.log('Image processing failed, attempting text-only analysis as fallback...');
            
            try {
              // Retry with text-only analysis
              const textOnlyPrompt = analysisPrompt + `\n\n--- Extracted Text from PDF ---\n${extractedText}\n\nNote: Analysis based on text content only (image processing failed). Please provide a comprehensive analysis based on the text content above.`;
              
              const textOnlyAnalysis = await genAI.models.generateContent({
                model: 'gemini-2.5-pro-preview-05-06',
                contents: [
                  {
                    parts: [{ text: textOnlyPrompt }]
                  }
                ]
              });
              
              result = textOnlyAnalysis;
              console.log('Text-only analysis succeeded as fallback');
              break;
              
            } catch (textOnlyError: any) {
              console.error('Text-only fallback also failed:', textOnlyError.message);
              throw error; // Throw original error
            }
          }
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Wait before retry (exponential backoff)
          const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      console.log('Gemini API analysis completed successfully');
      
      // Extract text from response with proper error handling
      let analysisText = '';
      
      try {
        // Try different ways to extract the text from the response
        if (result && result.text) {
          analysisText = result.text;
        } else if (result && result.candidates && result.candidates.length > 0) {
          const candidate = result.candidates[0];
          if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            const part = candidate.content.parts[0];
            if (part && part.text) {
              analysisText = part.text;
            }
          }
        }
      } catch (textError: any) {
        console.error('Error extracting text from result:', textError);
        throw new Error('Failed to extract text from Gemini response: ' + (textError?.message || String(textError)));
      }
      
      if (!analysisText || analysisText.trim() === '') {
        console.error('Failed to extract analysis text. Full response:', JSON.stringify(result, null, 2));
        throw new Error('Gemini returned empty or invalid analysis result. Please check the API key and model availability.');
      }

      // Parse structured data from the analysis
      const structuredData = AITestAnalysisController.parseStructuredData(analysisText);

      // Save analysis to database
      const aiTestAnalysis = new AITestAnalysis({
        clinic_id: req.clinic_id,
        patient_id,
        doctor_id: req.user?._id,
        file_url: `/uploads/ai-test-reports/${file.filename}`,
        file_name: file.filename,
        file_type: file.mimetype,
        custom_prompt: custom_prompt || '',
        analysis_result: analysisText,
        structured_data: structuredData,
        status: 'completed',
        analysis_date: new Date()
      });

      await aiTestAnalysis.save();

      res.status(200).json({
        success: true,
        message: 'Test report analysis completed successfully',
        data: {
          id: aiTestAnalysis._id,
          analysis_result: analysisText,
          structured_data: structuredData,
          file_url: aiTestAnalysis.file_url,
          analysis_date: aiTestAnalysis.analysis_date
        }
      });

    } catch (error: any) {
      console.error('Test report analysis error:', error);
      console.error('Error stack:', error.stack);
      
      // Clean up uploaded file if analysis fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Provide more detailed error information
      let errorMessage = 'Failed to analyze test report';
      let statusCode = 500;
      
      if (error.message) {
        if (error.message.includes('GEMINI_API_KEY')) {
          errorMessage = 'Gemini API key is not configured properly';
          statusCode = 500;
        } else if (error.message.includes('timed out')) {
          errorMessage = 'Analysis timed out. The file may be too large or the service is busy. Please try again with a smaller file.';
          statusCode = 408;
        } else if (error.message.includes('Gemini returned empty')) {
          errorMessage = 'Gemini AI service returned empty result. Please try again or check the image quality.';
          statusCode = 422;
        } else if (error.message.includes('Failed to extract text')) {
          errorMessage = 'Unable to process Gemini AI response. The service may be temporarily unavailable.';
          statusCode = 503;
        } else if (error.message.includes('network') || error.message.includes('ECONNRESET') || error.message.includes('ENOTFOUND')) {
          errorMessage = 'Network error occurred while connecting to Gemini AI service. Please check your internet connection and try again.';
          statusCode = 503;
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
          errorMessage = 'Gemini AI service quota exceeded or rate limited. Please try again later.';
          statusCode = 429;
        } else {
          errorMessage = error.message;
        }
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          fullError: error
        } : error.message
      });
    }
  }

  /**
   * Get AI analysis by ID
   */
  static async getAnalysisById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const analysis = await AITestAnalysis.findOne({
        _id: id,
        clinic_id: req.clinic_id
      })
        .populate('patient_id', 'first_name last_name date_of_birth')
        .populate('doctor_id', 'first_name last_name specialization');

      if (!analysis) {
        res.status(404).json({
          success: false,
          message: 'AI test analysis not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: analysis
      });

    } catch (error: any) {
      console.error('Get analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analysis',
        error: error.message
      });
    }
  }

  /**
   * Get all AI analyses for the clinic
   */
  static async getAllAnalyses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      const { status, date_from, date_to, search } = req.query;

      // Build filter query
      const filter: any = { clinic_id: req.clinic_id };
      
      if (status) filter.status = status;
      
      if (search) {
        const searchTerm = search as string;
        filter.$or = [
          { 'structured_data.test_name': { $regex: searchTerm, $options: 'i' } },
          { analysis_result: { $regex: searchTerm, $options: 'i' } }
        ];
      }
      
      if (date_from || date_to) {
        filter.analysis_date = {};
        if (date_from) filter.analysis_date.$gte = new Date(date_from as string);
        if (date_to) filter.analysis_date.$lte = new Date(date_to as string);
      }

      const analyses = await AITestAnalysis.find(filter)
        .populate('patient_id', 'first_name last_name date_of_birth')
        .populate('doctor_id', 'first_name last_name specialization')
        .sort({ analysis_date: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AITestAnalysis.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: analyses,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(total / limit),
          total_items: total,
          items_per_page: limit
        }
      });

    } catch (error: any) {
      console.error('Get all analyses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analyses',
        error: error.message
      });
    }
  }

  /**
   * Delete AI analysis
   */
  static async deleteAnalysis(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const analysis = await AITestAnalysis.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });
      
      if (!analysis) {
        res.status(404).json({
          success: false,
          message: 'AI test analysis not found'
        });
        return;
      }

      // Delete the file
      const filePath = path.join('./uploads/ai-test-reports', analysis.file_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete the analysis record
      await AITestAnalysis.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'AI test analysis deleted successfully'
      });

    } catch (error: any) {
      console.error('Delete analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete analysis',
        error: error.message
      });
    }
  }

  /**
   * Get AI analysis statistics
   */
  static async getAnalysisStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filter = { clinic_id: req.clinic_id };
      
      const totalAnalyses = await AITestAnalysis.countDocuments(filter);
      const completedAnalyses = await AITestAnalysis.countDocuments({ ...filter, status: 'completed' });
      const processingAnalyses = await AITestAnalysis.countDocuments({ ...filter, status: 'processing' });
      const failedAnalyses = await AITestAnalysis.countDocuments({ ...filter, status: 'failed' });

      // Get analyses from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentAnalyses = await AITestAnalysis.countDocuments({
        ...filter,
        analysis_date: { $gte: thirtyDaysAgo }
      });

      // Get most common test types
      const topTestTypes = await AITestAnalysis.aggregate([
        { $match: filter },
        { $match: { 'structured_data.test_name': { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: '$structured_data.test_name',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $project: {
            testName: '$_id',
            count: 1,
            _id: 0
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          total_analyses: totalAnalyses,
          completed_analyses: completedAnalyses,
          processing_analyses: processingAnalyses,
          failed_analyses: failedAnalyses,
          recent_analyses: recentAnalyses,
          top_test_types: topTestTypes
        }
      });

    } catch (error: any) {
      console.error('Get analysis stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analysis statistics',
        error: error.message
      });
    }
  }

  /**
   * Parse structured JSON data from Gemini analysis response
   */
  private static parseStructuredData(analysisText: string): any {
    try {
      console.log('Parsing JSON analysis response...');
      console.log('Raw response length:', analysisText.length);
      
      // Clean the response text - remove any markdown code blocks or extra formatting
      let cleanedText = analysisText.trim();
      
      // Remove markdown code blocks if present
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Remove any leading/trailing whitespace
      cleanedText = cleanedText.trim();
      
      console.log('Cleaned response for parsing:', cleanedText.substring(0, 200) + '...');
      
      // Parse the JSON response
      const jsonResponse = JSON.parse(cleanedText);
      
      console.log('Successfully parsed JSON response');
      console.log('Test name:', jsonResponse.test_identification?.test_name);
      console.log('Number of test results:', jsonResponse.test_results?.length || 0);
      
      // Transform the JSON structure to match our database schema
      const structuredData = {
        test_name: jsonResponse.test_identification?.test_name || '',
        test_category: jsonResponse.test_identification?.test_category || '',
        test_results: jsonResponse.test_results || [],
        abnormal_findings: jsonResponse.abnormal_findings || [],
        clinical_interpretation: jsonResponse.clinical_interpretation || {},
        recommendations: jsonResponse.recommendations || [],
        patient_summary: jsonResponse.patient_summary || {},
        // Legacy fields for backward compatibility
        test_values: jsonResponse.test_results?.map(result => 
          `${result.parameter}: ${result.value} (Ref: ${result.reference_range})`
        ) || [],
        reference_ranges: jsonResponse.test_results?.map(result => result.reference_range) || [],
        interpretation: jsonResponse.clinical_interpretation?.summary || ''
      };
      
      console.log('Structured data created successfully');
      return structuredData;
      
    } catch (error: any) {
      console.error('Error parsing JSON structured data:', error.message);
      console.log('Attempting fallback text parsing...');
      
      // Fallback to text parsing if JSON parsing fails
      try {
        const text = analysisText;
        
        // Extract test type
        const testTypeMatch = text.match(/\*\*Test Type\*\*:\s*(.+?)(?:\n|\*\*|$)/i);
        const testName = testTypeMatch ? testTypeMatch[1].trim() : '';

        // Extract key values
        const keyValuesMatch = text.match(/\*\*Key Values\*\*:\s*(.*?)(?:\n\*\*|\n-|$)/is);
        const keyValues = keyValuesMatch ? keyValuesMatch[1].split('\n').filter(v => v.trim()) : [];

        // Extract abnormal findings
        const abnormalMatch = text.match(/\*\*Abnormal Findings\*\*:\s*(.*?)(?:\n\*\*|\n-|$)/is);
        const abnormalFindings = abnormalMatch ? abnormalMatch[1].split('\n').filter(f => f.trim()) : [];

        // Extract recommendations
        const recommendationsMatch = text.match(/\*\*Recommendations\*\*:\s*(.*?)(?:\n\*\*|\n-|$)/is);
        const recommendations = recommendationsMatch ? recommendationsMatch[1].split('\n').filter(r => r.trim()) : [];

        // Extract interpretation
        const interpretationMatch = text.match(/\*\*Clinical Interpretation\*\*:\s*(.*?)(?:\n\*\*|\n-|$)/is);
        const interpretation = interpretationMatch ? interpretationMatch[1].trim() : '';

        console.log('Fallback text parsing completed');
        return {
          test_name: testName,
          test_values: keyValues,
          reference_ranges: [],
          abnormal_findings: abnormalFindings,
          recommendations: recommendations,
          interpretation: interpretation,
          // Initialize new fields as empty
          test_category: '',
          test_results: [],
          clinical_interpretation: { summary: interpretation },
          patient_summary: {}
        };
      } catch (fallbackError: any) {
        console.error('Both JSON and text parsing failed:', fallbackError.message);
        return {
          test_name: '',
          test_category: '',
          test_results: [],
          test_values: [],
          reference_ranges: [],
          abnormal_findings: [],
          recommendations: [],
          interpretation: '',
          clinical_interpretation: {},
          patient_summary: {}
        };
      }
    }
  }
}
