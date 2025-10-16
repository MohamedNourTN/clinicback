import { Response } from 'express';
import { validationResult } from 'express-validator';
import { LabVendor } from '../models';
import { AuthRequest } from '../types/express';

export class LabVendorController {
  static async createLabVendor(req: AuthRequest, res: Response): Promise<void> {
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

      // Check if lab vendor code already exists in this clinic
      const existingVendor = await LabVendor.findOne({ 
        code: req.body.code.toUpperCase(),
        clinic_id: req.clinic_id
      });
      if (existingVendor) {
        res.status(400).json({
          success: false,
          message: 'Lab vendor code already exists'
        });
        return;
      }

      const labVendorData = {
        ...req.body,
        clinic_id: req.clinic_id
      };

      const labVendor = new LabVendor(labVendorData);
      await labVendor.save();

      res.status(201).json({
        success: true,
        message: 'Lab vendor created successfully',
        data: { labVendor }
      });
    } catch (error) {
      console.error('Create lab vendor error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllLabVendors(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let filter: any = {
        clinic_id: req.clinic_id
      };

      // Search filter
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { code: { $regex: req.query.search, $options: 'i' } },
          { contactPerson: { $regex: req.query.search, $options: 'i' } },
          { specialties: { $in: [new RegExp(req.query.search as string, 'i')] } },
          { city: { $regex: req.query.search, $options: 'i' } },
          { state: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Type filter
      if (req.query.type && req.query.type !== 'all') {
        filter.type = req.query.type;
      }

      // Status filter
      if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status;
      }

      // Specialty filter
      if (req.query.specialty && req.query.specialty !== 'all') {
        filter.specialties = { $in: [req.query.specialty] };
      }

      // Pricing filter
      if (req.query.pricing) {
        filter.pricing = req.query.pricing;
      }

      // Rating filter
      if (req.query.minRating) {
        filter.rating = { $gte: parseFloat(req.query.minRating as string) };
      }

      const labVendors = await LabVendor.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalVendors = await LabVendor.countDocuments(filter);

      res.json({
        success: true,
        data: {
          labVendors,
          pagination: {
            page,
            limit,
            total: totalVendors,
            pages: Math.ceil(totalVendors / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all lab vendors error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getLabVendorById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const labVendor = await LabVendor.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!labVendor) {
        res.status(404).json({
          success: false,
          message: 'Lab vendor not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { labVendor }
      });
    } catch (error) {
      console.error('Get lab vendor by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateLabVendor(req: AuthRequest, res: Response): Promise<void> {
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

      // Check if lab vendor code already exists (excluding current vendor)
      if (req.body.code) {
        const existingVendor = await LabVendor.findOne({ 
          code: req.body.code.toUpperCase(),
          _id: { $ne: id },
          clinic_id: req.clinic_id
        });
        if (existingVendor) {
          res.status(400).json({
            success: false,
            message: 'Lab vendor code already exists'
          });
          return;
        }
      }

      const labVendor = await LabVendor.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id },
        req.body,
        { new: true, runValidators: true }
      );

      if (!labVendor) {
        res.status(404).json({
          success: false,
          message: 'Lab vendor not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Lab vendor updated successfully',
        data: { labVendor }
      });
    } catch (error) {
      console.error('Update lab vendor error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteLabVendor(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const labVendor = await LabVendor.findOneAndDelete({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!labVendor) {
        res.status(404).json({
          success: false,
          message: 'Lab vendor not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Lab vendor deleted successfully'
      });
    } catch (error) {
      console.error('Delete lab vendor error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getLabVendorStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const totalVendors = await LabVendor.countDocuments({ clinic_id: req.clinic_id });
      const activeVendors = await LabVendor.countDocuments({ status: 'active', clinic_id: req.clinic_id });
      const pendingVendors = await LabVendor.countDocuments({ status: 'pending', clinic_id: req.clinic_id });
      const suspendedVendors = await LabVendor.countDocuments({ status: 'suspended', clinic_id: req.clinic_id });

      // Type distribution
      const typeStats = await LabVendor.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      // Pricing distribution
      const pricingStats = await LabVendor.aggregate([
        {
          $group: {
            _id: '$pricing',
            count: { $sum: 1 }
          }
        }
      ]);

      // Specialty distribution (top 10)
      const specialtyStats = await LabVendor.aggregate([
        { $unwind: '$specialties' },
        {
          $group: {
            _id: '$specialties',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Total tests processed
      const totalTestsResult = await LabVendor.aggregate([
        {
          $group: {
            _id: null,
            totalTests: { $sum: '$totalTests' }
          }
        }
      ]);

      const totalTests = totalTestsResult.length > 0 ? totalTestsResult[0].totalTests : 0;

      // Average rating
      const avgRatingResult = await LabVendor.aggregate([
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' }
          }
        }
      ]);

      const averageRating = avgRatingResult.length > 0 ? avgRatingResult[0].averageRating : 0;

      // Contract expiry in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringContracts = await LabVendor.countDocuments({
        contractEnd: { $lte: thirtyDaysFromNow },
        status: 'active',
        clinic_id: req.clinic_id
      });

      res.json({
        success: true,
        data: {
          totalVendors,
          activeVendors,
          pendingVendors,
          suspendedVendors,
          totalTests,
          averageRating: Math.round(averageRating * 10) / 10,
          expiringContracts,
          typeStats,
          pricingStats,
          specialtyStats
        }
      });
    } catch (error) {
      console.error('Get lab vendor stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateLabVendorStatus(req: AuthRequest, res: Response): Promise<void> {
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
      const { status } = req.body;

      const labVendor = await LabVendor.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id },
        { status },
        { new: true, runValidators: true }
      );

      if (!labVendor) {
        res.status(404).json({
          success: false,
          message: 'Lab vendor not found'
        });
        return;
      }

      res.json({
        success: true,
        message: `Lab vendor status updated to ${status}`,
        data: { labVendor }
      });
    } catch (error) {
      console.error('Update lab vendor status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateTestCount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { increment = 1 } = req.body;

      const labVendor = await LabVendor.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id },
        { 
          $inc: { totalTests: increment },
          lastTestDate: new Date()
        },
        { new: true }
      );

      if (!labVendor) {
        res.status(404).json({
          success: false,
          message: 'Lab vendor not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Test count updated successfully',
        data: { labVendor }
      });
    } catch (error) {
      console.error('Update test count error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getContractExpiringVendors(req: AuthRequest, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);

      const expiringVendors = await LabVendor.find({
        contractEnd: { $lte: targetDate },
        status: 'active',
        clinic_id: req.clinic_id
              }).sort({ contractEnd: -1 });

      res.json({
        success: true,
        data: { expiringVendors }
      });
    } catch (error) {
      console.error('Get contract expiring vendors error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getTestHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;

      // Verify vendor exists
      const vendor = await LabVendor.findById(id);
      if (!vendor) {
        res.status(404).json({
          success: false,
          message: 'Lab vendor not found'
        });
        return;
      }

      // Mock test data for now - in a real implementation, 
      // this would query a separate TestRecord collection
      const mockTests = [
        {
          id: "T-001",
          testId: "LAB001",
          patientId: "P-12345",
          patientName: "John Doe",
          testType: "Complete Blood Count",
          orderDate: new Date("2024-01-20"),
          completionDate: new Date("2024-01-21"),
          status: "completed",
          cost: 45.00,
          results: "Normal values within range",
          notes: "Fasting sample collected",
        },
        {
          id: "T-002",
          testId: "LAB002",
          patientId: "P-12346",
          patientName: "Jane Smith",
          testType: "Lipid Panel",
          orderDate: new Date("2024-01-19"),
          completionDate: new Date("2024-01-20"),
          status: "completed",
          cost: 78.50,
          results: "Elevated cholesterol levels",
          notes: "12-hour fasting required",
        },
        {
          id: "T-003",
          testId: "LAB003",
          patientId: "P-12347",
          patientName: "Mike Johnson",
          testType: "Thyroid Function",
          orderDate: new Date("2024-01-18"),
          status: "in_progress",
          cost: 120.00,
          notes: "Follow-up test",
        },
        {
          id: "T-004",
          testId: "LAB004",
          patientId: "P-12348",
          patientName: "Sarah Wilson",
          testType: "HbA1c",
          orderDate: new Date("2024-01-17"),
          status: "pending",
          cost: 65.00,
          notes: "Diabetes monitoring",
        },
        {
          id: "T-005",
          testId: "LAB005",
          patientId: "P-12349",
          patientName: "Robert Brown",
          testType: "Liver Function Panel",
          orderDate: new Date("2024-01-16"),
          completionDate: new Date("2024-01-17"),
          status: "completed",
          cost: 95.75,
          results: "Slightly elevated ALT",
          notes: "Recheck in 3 months",
        },
      ];

      // Apply date filters if provided
      let filteredTests = mockTests;
      if (dateFrom || dateTo) {
        filteredTests = mockTests.filter(test => {
          const testDate = test.orderDate;
          if (dateFrom && testDate < new Date(dateFrom)) return false;
          if (dateTo && testDate > new Date(dateTo)) return false;
          return true;
        });
      }

      // Pagination
      const totalTests = filteredTests.length;
      const totalPages = Math.ceil(totalTests / limit);
      const startIndex = (page - 1) * limit;
      const paginatedTests = filteredTests.slice(startIndex, startIndex + limit);

      res.json({
        success: true,
        data: {
          tests: paginatedTests,
          pagination: {
            page,
            limit,
            total: totalTests,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Get test history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getContractDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Get vendor details
      const vendor = await LabVendor.findById(id);
      if (!vendor) {
        res.status(404).json({
          success: false,
          message: 'Lab vendor not found'
        });
        return;
      }

      // Mock contract data - in a real implementation, 
      // this would query a separate Contract collection
      const mockContract = {
        id: "CON-001",
        vendorId: id,
        contractNumber: `LAB-CON-2024-${vendor.code}`,
        startDate: vendor.contractStart,
        endDate: vendor.contractEnd,
        renewalDate: new Date(vendor.contractEnd.getTime() - (60 * 24 * 60 * 60 * 1000)), // 60 days before end
        status: vendor.status === 'active' ? 'active' : 'expired',
        terms: "Standard laboratory services contract with guaranteed turnaround times and quality metrics. Vendor agrees to maintain CLIA and CAP accreditations throughout the contract period.",
        paymentTerms: "Net 30 days from invoice date. Early payment discount of 2% available for payments within 10 days.",
        serviceLevels: {
          turnaroundTime: vendor.averageTurnaround,
          accuracyGuarantee: 99.5,
          availabilityHours: "24/7 emergency services, business hours for routine",
        },
        pricing: {
          baseRate: vendor.pricing === 'premium' ? 150.00 : vendor.pricing === 'moderate' ? 100.00 : 75.00,
          discountPercentage: 15,
          minimumVolume: 50,
          penalties: "Late delivery penalty: $50 per day for tests exceeding turnaround time",
        },
        autoRenewal: true,
        notificationDays: 60,
                 createdAt: vendor.created_at,
         updatedAt: vendor.updated_at,
      };

      res.json({
        success: true,
        data: { contract: mockContract }
      });
    } catch (error) {
      console.error('Get contract details error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getBillingPayments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);

      // Verify vendor exists
      const vendor = await LabVendor.findById(id);
      if (!vendor) {
        res.status(404).json({
          success: false,
          message: 'Lab vendor not found'
        });
        return;
      }

      // Mock payment data - in a real implementation, 
      // this would query a separate Payment collection
      const mockPayments = [
        {
          id: "PAY-001",
          vendorId: id,
          amount: 1250.75,
          paymentDate: new Date("2024-01-15"),
          paymentMethod: "bank_transfer",
          reference: "INV-2024-001",
          status: "completed",
          notes: "Monthly lab services payment",
          createdAt: new Date("2024-01-15"),
        },
        {
          id: "PAY-002",
          vendorId: id,
          amount: 890.50,
          paymentDate: new Date("2024-01-02"),
          paymentMethod: "ach",
          reference: "INV-2023-128",
          status: "completed",
          notes: "December services payment",
          createdAt: new Date("2024-01-02"),
        },
        {
          id: "PAY-003",
          vendorId: id,
          amount: 2150.00,
          paymentDate: new Date("2024-01-25"),
          paymentMethod: "check",
          reference: "INV-2024-002",
          status: "pending",
          notes: "Quarterly contract payment",
          createdAt: new Date("2024-01-20"),
        },
        {
          id: "PAY-004",
          vendorId: id,
          amount: 675.25,
          paymentDate: new Date("2023-12-28"),
          paymentMethod: "credit_card",
          reference: "INV-2023-127",
          status: "completed",
          notes: "Emergency testing services",
          createdAt: new Date("2023-12-28"),
        },
        {
          id: "PAY-005",
          vendorId: id,
          amount: 1425.80,
          paymentDate: new Date("2023-12-15"),
          paymentMethod: "wire",
          reference: "INV-2023-126",
          status: "failed",
          notes: "Failed wire transfer - retry needed",
          createdAt: new Date("2023-12-15"),
        },
      ];

      // Apply date filters if provided
      let filteredPayments = mockPayments;
      if (year || month) {
        filteredPayments = mockPayments.filter(payment => {
          const paymentDate = payment.paymentDate;
          if (year && paymentDate.getFullYear() !== year) return false;
          if (month && paymentDate.getMonth() + 1 !== month) return false;
          return true;
        });
      }

      // Pagination
      const totalPayments = filteredPayments.length;
      const totalPages = Math.ceil(totalPayments / limit);
      const startIndex = (page - 1) * limit;
      const paginatedPayments = filteredPayments.slice(startIndex, startIndex + limit);

      // Mock billing summary
      const mockSummary = {
        totalAmount: 15432.75,
        paidAmount: 12856.50,
        pendingAmount: 2150.00,
        overdueAmount: 426.25,
        lastPaymentDate: new Date("2024-01-15"),
        nextPaymentDue: new Date("2024-02-15"),
        averageMonthlySpend: 1287.73,
      };

      res.json({
        success: true,
        data: {
          payments: paginatedPayments,
          summary: mockSummary,
          pagination: {
            page,
            limit,
            total: totalPayments,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Get billing payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 