import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import XrayAnalysis from '../models/XrayAnalysis';
import { AuthRequest } from '../types/express';
import { addTenantToData } from '../middleware/auth';

// NOTE: Add GEMINI_API_KEY to your .env file
// GEMINI_API_KEY=your-gemini-api-key-here

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/xrays';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `xray-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, and PNG files are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export class XrayAnalysisController {
  
  /**
   * Upload and analyze X-ray image
   */
  static async analyzeXray(req: AuthRequest, res: Response): Promise<void> {
    console.log('=== X-ray Analysis Request Started ===');
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
          message: 'X-ray image is required'
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

      // Default prompt if none provided
             const defaultPrompt = `You are an expert dental radiologist. Analyze the uploaded dental X-ray image. Based on the visual details, provide the following:
 
 1. A short summary of the condition of the teeth shown in the X-ray (e.g., decay, infection, root condition, bone loss, fillings, etc.)
 2. Identify any problematic areas (e.g., tooth number and the issue).
 3. Mention whether there's a need for further diagnosis (e.g., CBCT, clinical exam).
 4. Suggest suitable medications if needed (e.g., antibiotics, painkillers) with dosage and purpose.
 5. Avoid overly technical jargon. Keep it understandable for both dentist and patient.
 6. Do **not** generate any fake data if the image is unclear. Instead, mention "Image not clear enough for diagnosis".
 7. Do **not** include phrases like "Detailed Analysis:", "Of course. As a dental radiologist, here is my analysis of the provided dental X-ray." or similar introductory statements. Start directly with the analysis content.
 
 Respond in this format:
 - **Condition Summary**:
 - **Identified Issues**:
 - **Suggested Medications**:
 - **Additional Notes**:
 `;

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

      // Read the uploaded file
      const imageBuffer = fs.readFileSync(file.path);
      const imageBase64 = imageBuffer.toString('base64');

      // Prepare the image for Gemini
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: file.mimetype
        }
      };

      // Generate analysis using Gemini with proper error handling, timeout, and retry logic
      console.log('Starting Gemini AI analysis...');
      console.log('Image size:', imageBuffer.length, 'bytes');
      console.log('Image type:', file.mimetype);
      
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
          
          const analysisPromise = genAI.models.generateContent({
            model: 'gemini-2.5-pro-preview-05-06',
            contents: [
              {
                parts: [
                  { text: analysisPrompt },
                  imagePart
                ]
              }
            ]
          });
          
          result = await Promise.race([analysisPromise, timeoutPromise]) as any;
          console.log(`Gemini API attempt ${attempt} succeeded`);
          break;
          
        } catch (error: any) {
          console.error(`Gemini API attempt ${attempt} failed:`, error.message);
          lastError = error;
          
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
      console.log('Gemini API Response:', JSON.stringify(result, null, 2));
      
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

      // Parse findings from the analysis (basic implementation)
      const findings = XrayAnalysisController.parseFindings(analysisText);

      // Save analysis to database
      const xrayAnalysisData = addTenantToData(req, {
        clinic_id: req.clinic_id,
        patient_id,
        doctor_id: req.user?._id,
        image_url: `/uploads/xrays/${file.filename}`,
        image_filename: file.filename,
        custom_prompt: custom_prompt || '',
        analysis_result: analysisText,
        status: 'completed',
        findings,
        analysis_date: new Date()
      });

      const xrayAnalysis = new XrayAnalysis(xrayAnalysisData);

      await xrayAnalysis.save();

      res.status(200).json({
        success: true,
        message: 'X-ray analysis completed successfully',
        data: {
          id: xrayAnalysis._id,
          analysis_result: analysisText,
          findings,
          image_url: xrayAnalysis.image_url,
          analysis_date: xrayAnalysis.analysis_date
        }
      });

    } catch (error: any) {
      console.error('X-ray analysis error:', error);
      console.error('Error stack:', error.stack);
      
      // Clean up uploaded file if analysis fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Provide more detailed error information
      let errorMessage = 'Failed to analyze X-ray';
      let statusCode = 500;
      
      if (error.message) {
        if (error.message.includes('GEMINI_API_KEY')) {
          errorMessage = 'Gemini API key is not configured properly';
          statusCode = 500;
        } else if (error.message.includes('timed out')) {
          errorMessage = 'X-ray analysis timed out. The image may be too large or the service is busy. Please try again with a smaller image.';
          statusCode = 408; // Request Timeout
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
          statusCode = 429; // Too Many Requests
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
   * Get X-ray analysis by ID
   */
  static async getAnalysisById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const analysis = await XrayAnalysis.findById(id)
        .populate('patient_id', 'first_name last_name date_of_birth')
        .populate('doctor_id', 'first_name last_name specialization');

      if (!analysis) {
        res.status(404).json({
          success: false,
          message: 'X-ray analysis not found'
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
   * Get all X-ray analyses for a patient
   */
  static async getPatientAnalyses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { patient_id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const analyses = await XrayAnalysis.find({ patient_id })
        .populate('doctor_id', 'first_name last_name specialization')
        .sort({ analysis_date: -1 })
        .skip(skip)
        .limit(limit);

      const total = await XrayAnalysis.countDocuments({ patient_id });

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
      console.error('Get patient analyses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patient analyses',
        error: error.message
      });
    }
  }

  /**
   * Get all X-ray analyses (with pagination and filters)
   */
  static async getAllAnalyses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      const { status, date_from, date_to } = req.query;

      // Build filter query
      const filter: any = {};
      if (status) filter.status = status;
      if (date_from || date_to) {
        filter.analysis_date = {};
        if (date_from) filter.analysis_date.$gte = new Date(date_from as string);
        if (date_to) filter.analysis_date.$lte = new Date(date_to as string);
      }

      const analyses = await XrayAnalysis.find(filter)
        .populate('patient_id', 'first_name last_name date_of_birth')
        .populate('doctor_id', 'first_name last_name specialization')
        .sort({ analysis_date: -1 })
        .skip(skip)
        .limit(limit);

      const total = await XrayAnalysis.countDocuments(filter);

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
   * Delete X-ray analysis
   */
  static async deleteAnalysis(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const analysis = await XrayAnalysis.findById(id);
      if (!analysis) {
        res.status(404).json({
          success: false,
          message: 'X-ray analysis not found'
        });
        return;
      }

      // Delete the image file
      const imagePath = path.join('./uploads/xrays', analysis.image_filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      // Delete the analysis record
      await XrayAnalysis.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'X-ray analysis deleted successfully'
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
   * Get X-ray analysis statistics
   */
  static async getAnalysisStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const totalAnalyses = await XrayAnalysis.countDocuments();
      const completedAnalyses = await XrayAnalysis.countDocuments({ status: 'completed' });
      const pendingAnalyses = await XrayAnalysis.countDocuments({ status: 'pending' });
      const failedAnalyses = await XrayAnalysis.countDocuments({ status: 'failed' });

      // Get analyses from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentAnalyses = await XrayAnalysis.countDocuments({
        analysis_date: { $gte: thirtyDaysAgo }
      });

      // Get most common findings
      const findingsStats = await XrayAnalysis.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalCavities: { $sum: { $cond: ['$findings.cavities', 1, 0] } },
            totalInfections: { $sum: { $cond: ['$findings.infections', 1, 0] } },
            totalAbnormalities: { $sum: { $size: { $ifNull: ['$findings.abnormalities', []] } } }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          total_analyses: totalAnalyses,
          completed_analyses: completedAnalyses,
          pending_analyses: pendingAnalyses,
          failed_analyses: failedAnalyses,
          recent_analyses: recentAnalyses,
          findings_stats: findingsStats[0] || {
            totalCavities: 0,
            totalInfections: 0,
            totalAbnormalities: 0
          }
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
   * Parse findings from Gemini analysis text
   * This is a basic implementation that can be enhanced with more sophisticated NLP
   */
  private static parseFindings(analysisText: string): any {
    const text = analysisText.toLowerCase();
    
    return {
      cavities: text.includes('cavity') || text.includes('cavities') || text.includes('decay'),
      wisdom_teeth: text.includes('wisdom') ? 'Present in analysis' : '',
      bone_density: text.includes('bone') ? 'Mentioned in analysis' : '',
      infections: text.includes('infection') || text.includes('inflammation'),
      abnormalities: text.includes('abnormal') ? ['Abnormalities noted'] : []
    };
  }
} 