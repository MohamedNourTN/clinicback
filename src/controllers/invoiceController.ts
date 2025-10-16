import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Invoice } from '../models';
import { AuthRequest } from '../types/express';
import { getTenantScopedFilter, addTenantToData } from '../middleware/auth';

export class InvoiceController {
  static async createInvoice(req: AuthRequest, res: Response): Promise<void> {
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

      // Add tenant_id to invoice data with validation
      const invoiceData = addTenantToData(req, {
        ...req.body,
        clinic_id: req.clinic_id
      });

      const invoice = new Invoice(invoiceData);
      await invoice.save();

      await invoice.populate('patient_id', 'first_name last_name email phone');

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: { invoice }
      });
    } catch (error: any) {
      console.error('Create invoice error:', error);
      
      if (error.message === 'Tenant context is required for this operation') {
        res.status(400).json({
          success: false,
          message: 'Tenant information is required'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllInvoices(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Apply tenant-scoped filtering
      let filter: any = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id
      });

      if (req.query.status) {
        filter.status = req.query.status;
      }

      if (req.query.patient_id) {
        filter.patient_id = req.query.patient_id;
      }

      if (req.query.start_date && req.query.end_date) {
        filter.created_at = {
          $gte: new Date(req.query.start_date as string),
          $lte: new Date(req.query.end_date as string)
        };
      }

      const invoices = await Invoice.find(filter)
        .populate('patient_id', 'first_name last_name email phone')
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalInvoices = await Invoice.countDocuments(filter);

      res.json({
        success: true,
        data: {
          invoices,
          pagination: {
            page,
            limit,
            total: totalInvoices,
            pages: Math.ceil(totalInvoices / limit)
          }
        }
      });
    } catch (error: any) {
      console.error('Get all invoices error:', error);
      
      if (error.message === 'Tenant context is required for this operation') {
        res.status(400).json({
          success: false,
          message: 'Tenant information is required'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getInvoiceById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Apply tenant-scoped filtering for invoice query
      const invoiceFilter = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      const invoice = await Invoice.findOne(invoiceFilter)
        .populate('patient_id', 'first_name last_name email phone address');

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { invoice }
      });
    } catch (error) {
      console.error('Get invoice by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateInvoice(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Apply tenant-scoped filtering for invoice update
      const updateFilter = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      const invoice = await Invoice.findOneAndUpdate(
        updateFilter,
        req.body,
        { new: true, runValidators: true }
      )
      .populate('patient_id', 'first_name last_name email phone');

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: { invoice }
      });
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async markAsPaid(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const invoice = await Invoice.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id },
        { 
          status: 'paid',
          payment_date: new Date()
        },
        { new: true }
      );

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Invoice marked as paid successfully',
        data: { invoice }
      });
    } catch (error) {
      console.error('Mark invoice as paid error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getOverdueInvoices(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Apply tenant-scoped filtering for overdue invoices
      const overdueFilter = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id,
        status: { $in: ['pending'] },
        due_date: { $lt: new Date() }
      });
      
      const invoices = await Invoice.find(overdueFilter)
      .populate('patient_id', 'first_name last_name email phone')
              .sort({ due_date: -1 });

      res.json({
        success: true,
        data: { invoices }
      });
    } catch (error) {
      console.error('Get overdue invoices error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getInvoiceStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Apply tenant-scoped filtering for invoice stats
      const clinicFilter = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id
      });

      const totalInvoices = await Invoice.countDocuments(clinicFilter);
      const paidInvoices = await Invoice.countDocuments({ ...clinicFilter, status: 'paid' });
      const pendingInvoices = await Invoice.countDocuments({ ...clinicFilter, status: 'pending' });
      const overdueInvoices = await Invoice.countDocuments({
        ...clinicFilter,
        status: 'pending',
        due_date: { $lt: new Date() }
      });

      // Get current month dates for monthly revenue calculation
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [revenueData, monthlyRevenueData] = await Promise.all([
        // Total revenue calculation
        Invoice.aggregate([
          { $match: { ...clinicFilter, status: 'paid', paid_at: { $exists: true } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$total_amount' },
              averageInvoice: { $avg: '$total_amount' }
            }
          }
        ]),
        // Current month revenue calculation  
        Invoice.aggregate([
          { 
            $match: { 
              ...clinicFilter,
              status: 'paid', 
              paid_at: { 
                $gte: startOfMonth,
                $lt: startOfNextMonth,
                $exists: true 
              } 
            } 
          },
          {
            $group: {
              _id: null,
              monthlyRevenue: { $sum: '$total_amount' },
              monthlyInvoicesCount: { $sum: 1 }
            }
          }
        ])
      ]);

      const monthlyRevenue = await Invoice.aggregate([
        { $match: { ...clinicFilter, status: 'paid', paid_at: { $exists: true } } },
        {
          $group: {
            _id: {
              year: { $year: '$paid_at' },
              month: { $month: '$paid_at' }
            },
            revenue: { $sum: '$total_amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]);

      res.json({
        success: true,
        data: {
          totalInvoices,
          paidInvoices,
          pendingInvoices,
          overdueInvoices,
          totalRevenue: revenueData[0]?.totalRevenue || 0,
          averageInvoice: revenueData[0]?.averageInvoice || 0,
          monthlyRevenue: monthlyRevenueData[0]?.monthlyRevenue || 0,
          monthlyInvoicesCount: monthlyRevenueData[0]?.monthlyInvoicesCount || 0,
          historicalMonthlyRevenue: monthlyRevenue
        }
      });
    } catch (error) {
      console.error('Get invoice stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteInvoice(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const invoice = await Invoice.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      // Optional: Add business logic to prevent deletion of paid invoices
      // if (invoice.status === 'paid') {
      //   res.status(400).json({
      //     success: false,
      //     message: 'Cannot delete paid invoices. Consider cancelling instead.'
      //   });
      //   return;
      // }

      await Invoice.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Invoice deleted successfully'
      });
    } catch (error) {
      console.error('Delete invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 