import { Response } from 'express';
import { validationResult } from 'express-validator';
import { TestReport, Patient, Test } from '../models';
import { AuthRequest } from '../types/express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/test-reports');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png) and documents (pdf, doc, docx) are allowed'));
    }
  }
});

export class TestReportController {
  static async createReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      // Validate patient exists in the current clinic
      const patient = await Patient.findOne({
        _id: req.body.patientId,
        clinic_id: req.clinic_id
      });
      if (!patient) {
        res.status(400).json({
          success: false,
          message: 'Patient not found'
        });
        return;
      }

      // Validate test exists in the current clinic
      const test = await Test.findOne({
        _id: req.body.testId,
        clinic_id: req.clinic_id
      });
      if (!test) {
        res.status(400).json({
          success: false,
          message: 'Test not found'
        });
        return;
      }

      // Auto-populate patient and test details with clinic context
      const reportData = {
        ...req.body,
        clinic_id: req.clinic_id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        patientAge: patient.age,
        patientGender: patient.gender,
        testName: test.name,
        testCode: test.code,
        category: test.category
      };

      const report = new TestReport(reportData);
      await report.save();

      // Populate related fields for response
      await report.populate([
        { path: 'patientId', select: 'first_name last_name email phone' },
        { path: 'testId', select: 'name code category normalRange units' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Test report created successfully',
        data: { report }
      });
    } catch (error: any) {
      console.error('Create test report error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Report number already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllReports(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let filter: any = {
        clinic_id: req.clinic_id // CLINIC FILTER: Only get reports from current clinic
      };

      // Search filter
      if (req.query.search) {
        filter.$or = [
          { patientName: { $regex: req.query.search, $options: 'i' } },
          { reportNumber: { $regex: req.query.search, $options: 'i' } },
          { testName: { $regex: req.query.search, $options: 'i' } },
          { externalVendor: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Status filter
      if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status;
      }

      // Category filter
      if (req.query.category && req.query.category !== 'all') {
        filter.category = req.query.category;
      }

      // Vendor filter
      if (req.query.vendor && req.query.vendor !== 'all') {
        filter.externalVendor = req.query.vendor;
      }

      // Date range filter
      if (req.query.startDate || req.query.endDate) {
        filter.testDate = {};
        if (req.query.startDate) {
          filter.testDate.$gte = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          filter.testDate.$lte = new Date(req.query.endDate as string);
        }
      }

      const reports = await TestReport.find(filter)
        .populate('patientId', 'first_name last_name email phone')
        .populate('testId', 'name code category normalRange units')
        .skip(skip)
        .limit(limit)
        .sort({ testDate: -1, created_at: -1 });

      const totalReports = await TestReport.countDocuments(filter);

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            page,
            limit,
            total: totalReports,
            pages: Math.ceil(totalReports / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all test reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getReportById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await TestReport.findOne({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only get report from current clinic
      })
        .populate('patientId', 'first_name last_name email phone address')
        .populate('testId', 'name code category description normalRange units methodology');

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Test report not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { report }
      });
    } catch (error) {
      console.error('Get test report by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const report = await TestReport.findOneAndUpdate(
        {
          _id: id,
          clinic_id: req.clinic_id // CLINIC FILTER: Only update report from current clinic
        },
        req.body,
        { new: true, runValidators: true }
      ).populate([
        { path: 'patientId', select: 'first_name last_name email phone' },
        { path: 'testId', select: 'name code category normalRange units' }
      ]);

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Test report not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Test report updated successfully',
        data: { report }
      });
    } catch (error: any) {
      console.error('Update test report error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Report number already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await TestReport.findOneAndDelete({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only delete report from current clinic
      });

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Test report not found'
        });
        return;
      }

      // Delete associated files
      if (report.attachments && report.attachments.length > 0) {
        report.attachments.forEach(attachment => {
          const filePath = path.join(__dirname, '../../', attachment.url);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }

      res.json({
        success: true,
        message: 'Test report deleted successfully'
      });
    } catch (error) {
      console.error('Delete test report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, verifiedBy } = req.body;

      const report = await TestReport.findOne({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only update status for reports from current clinic
      });
      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Test report not found'
        });
        return;
      }

      try {
        await report.updateStatus(status, verifiedBy);
        await report.populate([
          { path: 'patientId', select: 'first_name last_name email phone' },
          { path: 'testId', select: 'name code category normalRange units' }
        ]);

        res.json({
          success: true,
          message: `Test report status updated to ${status}`,
          data: { report }
        });
      } catch (statusError: any) {
        res.status(400).json({
          success: false,
          message: statusError.message
        });
      }
    } catch (error) {
      console.error('Update test report status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async addAttachment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await TestReport.findOne({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only add attachment to reports from current clinic
      });

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Test report not found'
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const attachment = {
        id: Date.now().toString(),
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/test-reports/${req.file.filename}`
      };

      report.attachments = report.attachments || [];
      report.attachments.push(attachment);
      await report.save();

      res.json({
        success: true,
        message: 'Attachment added successfully',
        data: { attachment }
      });
    } catch (error) {
      console.error('Add attachment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async removeAttachment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, attachmentId } = req.params;
      const report = await TestReport.findOne({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only remove attachment from reports in current clinic
      });

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Test report not found'
        });
        return;
      }

      const attachmentIndex = report.attachments?.findIndex(att => att.id === attachmentId);
      if (attachmentIndex === -1) {
        res.status(404).json({
          success: false,
          message: 'Attachment not found'
        });
        return;
      }

      // Delete file from filesystem
      const attachment = report.attachments![attachmentIndex!];
      const filePath = path.join(__dirname, '../../', attachment.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove from database
      report.attachments!.splice(attachmentIndex!, 1);
      await report.save();

      res.json({
        success: true,
        message: 'Attachment removed successfully'
      });
    } catch (error) {
      console.error('Remove attachment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getReportStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filter = { clinic_id: req.clinic_id }; // CLINIC FILTER: Only get stats from current clinic
      const totalReports = await TestReport.countDocuments(filter);
      const pendingReports = await TestReport.countDocuments({ ...filter, status: 'pending' });
      const recordedReports = await TestReport.countDocuments({ ...filter, status: 'recorded' });
      const verifiedReports = await TestReport.countDocuments({ ...filter, status: 'verified' });
      const deliveredReports = await TestReport.countDocuments({ ...filter, status: 'delivered' });

      const categoryStats = await TestReport.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const vendorStats = await TestReport.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$externalVendor',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const monthlyStats = await TestReport.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              year: { $year: '$testDate' },
              month: { $month: '$testDate' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]);

      res.json({
        success: true,
        data: {
          totalReports,
          pendingReports,
          recordedReports,
          verifiedReports,
          deliveredReports,
          categoryStats,
          vendorStats,
          monthlyStats
        }
      });
    } catch (error) {
      console.error('Get test report stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getPatientReports(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter = { 
        patientId, 
        clinic_id: req.clinic_id // CLINIC FILTER: Only get reports from current clinic
      };

      const reports = await TestReport.find(filter)
        .populate('testId', 'name code category normalRange units')
        .skip(skip)
        .limit(limit)
        .sort({ testDate: -1 });

      const totalReports = await TestReport.countDocuments(filter);

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            page,
            limit,
            total: totalReports,
            pages: Math.ceil(totalReports / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get patient reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 