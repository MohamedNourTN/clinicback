import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Lead, Patient } from '../models';
import { AuthRequest } from '../types/express';

export class LeadController {
  static async createLead(req: AuthRequest, res: Response): Promise<void> {
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

      const leadData = {
        ...req.body,
        clinic_id: req.clinic_id, // Add clinic context to lead data
        tenant_id: req.tenant_id  // Add tenant context to lead data
      };
      
      const lead = new Lead(leadData);
      await lead.save();

      res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data: lead
      });
    } catch (error) {
      console.error('Create lead error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllLeads(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let filter: any = {
        clinic_id: req.clinic_id // CLINIC FILTER: Only get leads from current clinic
      };

      // Search filter
      if (req.query.search) {
        filter.$or = [
          { firstName: { $regex: req.query.search, $options: 'i' } },
          { lastName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { phone: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Status filter
      if (req.query.status) {
        filter.status = req.query.status;
      }

      // Source filter
      if (req.query.source) {
        filter.source = req.query.source;
      }

      // Assigned to filter
      if (req.query.assignedTo) {
        filter.assignedTo = req.query.assignedTo;
      }

      // Date range filter
      if (req.query.start_date || req.query.end_date) {
        filter.created_at = {};
        if (req.query.start_date) {
          filter.created_at.$gte = new Date(req.query.start_date as string);
        }
        if (req.query.end_date) {
          filter.created_at.$lte = new Date(req.query.end_date as string);
        }
      }

      // Sort options
      let sortOption: any = { created_at: -1 }; // Default sort by newest first
      if (req.query.sort && req.query.order) {
        const sortField = req.query.sort as string;
        const sortOrder = req.query.order === 'asc' ? 1 : -1;
        sortOption = { [sortField]: sortOrder };
      }

      const leads = await Lead.find(filter)
        .skip(skip)
        .limit(limit)
        .sort(sortOption);

      const totalLeads = await Lead.countDocuments(filter);

      res.json({
        success: true,
        data: {
          items: leads,
          pagination: {
            page,
            limit,
            total: totalLeads,
            pages: Math.ceil(totalLeads / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all leads error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getLeadById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const lead = await Lead.findOne({ 
        _id: id, 
        clinic_id: req.clinic_id 
      });

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
        return;
      }

      res.json({
        success: true,
        data: lead
      });
    } catch (error) {
      console.error('Get lead by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateLead(req: AuthRequest, res: Response): Promise<void> {
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
      const lead = await Lead.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id },
        req.body,
        { new: true, runValidators: true }
      );

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Lead updated successfully',
        data: lead
      });
    } catch (error) {
      console.error('Update lead error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteLead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const lead = await Lead.findOneAndDelete({ 
        _id: id, 
        clinic_id: req.clinic_id 
      });

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Lead deleted successfully'
      });
    } catch (error) {
      console.error('Delete lead error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateLeadStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['new', 'contacted', 'converted', 'lost'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: new, contacted, converted, lost'
        });
        return;
      }

      const lead = await Lead.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id },
        { status },
        { new: true, runValidators: true }
      );

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Lead status updated successfully',
        data: lead
      });
    } catch (error) {
      console.error('Update lead status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async convertLeadToPatient(req: AuthRequest, res: Response): Promise<void> {
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
      const lead = await Lead.findOne({ 
        _id: id, 
        clinic_id: req.clinic_id 
      });

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
        return;
      }

      if (lead.status === 'converted') {
        res.status(400).json({
          success: false,
          message: 'Lead has already been converted to a patient'
        });
        return;
      }

      // Create patient from lead data and request body
      const patientData = {
        ...req.body,
        // Ensure we use lead's contact info if not provided
        first_name: req.body.first_name || lead.firstName,
        last_name: req.body.last_name || lead.lastName,
        email: req.body.email || lead.email,
        phone: req.body.phone || lead.phone,
        clinic_id: req.clinic_id, // Add clinic context to patient data
        tenant_id: req.tenant_id  // Add tenant context to patient data
      };

      const patient = new Patient(patientData);
      await patient.save();

      // Update lead status to converted
      lead.status = 'converted';
      lead.notes = lead.notes 
        ? `${lead.notes}\n\nConverted to patient ID: ${patient._id} on ${new Date().toISOString()}`
        : `Converted to patient ID: ${patient._id} on ${new Date().toISOString()}`;
      await lead.save();

      res.status(201).json({
        success: true,
        message: 'Lead converted to patient successfully',
        data: {
          lead,
          patient
        }
      });
    } catch (error) {
      console.error('Convert lead to patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getLeadStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicFilter = { clinic_id: req.clinic_id };
      
      const totalLeads = await Lead.countDocuments(clinicFilter);
      
      // Status distribution
      const statusStats = await Lead.aggregate([
        { $match: clinicFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Source distribution
      const sourceStats = await Lead.aggregate([
        { $match: clinicFilter },
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 }
          }
        }
      ]);

      // Conversion rate
      const convertedLeads = await Lead.countDocuments({ 
        ...clinicFilter,
        status: 'converted' 
      });
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      // Recent leads (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentLeads = await Lead.countDocuments({
        ...clinicFilter,
        created_at: { $gte: thirtyDaysAgo }
      });

      // Monthly trend (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const monthlyTrend = await Lead.aggregate([
        {
          $match: {
            ...clinicFilter,
            created_at: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' }
            },
            count: { $sum: 1 },
            converted: {
              $sum: {
                $cond: [{ $eq: ['$status', 'converted'] }, 1, 0]
              }
            }
          }
        },
        {
          $sort: { '_id.year': -1, '_id.month': -1 }
        }
      ]);

      res.json({
        success: true,
        data: {
          totalLeads,
          conversionRate: Math.round(conversionRate * 100) / 100,
          recentLeads,
          statusDistribution: statusStats,
          sourceDistribution: sourceStats,
          monthlyTrend
        }
      });
    } catch (error) {
      console.error('Get lead stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getLeadsByAssignee(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { assignee } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter = { 
        assignedTo: assignee, 
        clinic_id: req.clinic_id 
      };

      const leads = await Lead.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalLeads = await Lead.countDocuments(filter);

      res.json({
        success: true,
        data: {
          items: leads,
          pagination: {
            page,
            limit,
            total: totalLeads,
            pages: Math.ceil(totalLeads / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get leads by assignee error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 