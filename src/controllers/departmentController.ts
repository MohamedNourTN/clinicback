import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Department } from '../models';
import { AuthRequest } from '../types/express';

export class DepartmentController {
  static async createDepartment(req: AuthRequest, res: Response): Promise<void> {
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

      // Check if department code already exists in this clinic
      const existingDept = await Department.findOne({ 
        code: req.body.code.toUpperCase(),
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      });
      if (existingDept) {
        res.status(400).json({
          success: false,
          message: 'Department code already exists'
        });
        return;
      }

      const departmentData = {
        ...req.body,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      };

      const department = new Department(departmentData);
      await department.save();

      res.status(201).json({
        success: true,
        message: 'Department created successfully',
        data: { department }
      });
    } catch (error) {
      console.error('Create department error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllDepartments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let filter: any = {
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      };

      // Search filter
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { code: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { head: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Status filter
      if (req.query.status) {
        filter.status = req.query.status;
      }

      const departments = await Department.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalDepartments = await Department.countDocuments(filter);

      res.json({
        success: true,
        data: {
          departments,
          pagination: {
            page,
            limit,
            total: totalDepartments,
            pages: Math.ceil(totalDepartments / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all departments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getDepartmentById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const department = await Department.findOne({
        _id: id,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      });

      if (!department) {
        res.status(404).json({
          success: false,
          message: 'Department not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { department }
      });
    } catch (error) {
      console.error('Get department by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateDepartment(req: AuthRequest, res: Response): Promise<void> {
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

      // Check if department code already exists (excluding current department) in this clinic
      if (req.body.code) {
        const existingDept = await Department.findOne({ 
          code: req.body.code.toUpperCase(),
          _id: { $ne: id },
          tenant_id: req.tenant_id,
          clinic_id: req.clinic_id
        });
        if (existingDept) {
          res.status(400).json({
            success: false,
            message: 'Department code already exists'
          });
          return;
        }
      }

      const department = await Department.findOneAndUpdate(
        { _id: id, tenant_id: req.tenant_id, clinic_id: req.clinic_id },
        req.body,
        { new: true, runValidators: true }
      );

      if (!department) {
        res.status(404).json({
          success: false,
          message: 'Department not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Department updated successfully',
        data: { department }
      });
    } catch (error) {
      console.error('Update department error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteDepartment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const department = await Department.findOneAndDelete({
        _id: id,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      });

      if (!department) {
        res.status(404).json({
          success: false,
          message: 'Department not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Department deleted successfully'
      });
    } catch (error) {
      console.error('Delete department error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getDepartmentStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicFilter = { tenant_id: req.tenant_id, clinic_id: req.clinic_id };
      
      const totalDepartments = await Department.countDocuments(clinicFilter);
      const activeDepartments = await Department.countDocuments({ ...clinicFilter, status: 'active' });
      const inactiveDepartments = await Department.countDocuments({ ...clinicFilter, status: 'inactive' });

      // Staff statistics
      const staffStats = await Department.aggregate([
        { $match: clinicFilter },
        {
          $group: {
            _id: null,
            totalStaff: { $sum: '$staffCount' },
            avgStaffPerDept: { $avg: '$staffCount' },
            maxStaff: { $max: '$staffCount' },
            minStaff: { $min: '$staffCount' }
          }
        }
      ]);

      // Budget statistics
      const budgetStats = await Department.aggregate([
        { $match: clinicFilter },
        {
          $group: {
            _id: null,
            totalBudget: { $sum: '$budget' },
            avgBudget: { $avg: '$budget' },
            maxBudget: { $max: '$budget' },
            minBudget: { $min: '$budget' }
          }
        }
      ]);

      // Status distribution
      const statusStats = await Department.aggregate([
        { $match: clinicFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Top departments by staff count
      const topDepartmentsByStaff = await Department.find(clinicFilter)
        .select('name code staffCount')
        .sort({ staffCount: -1 })
        .limit(5);

      // Top departments by budget
      const topDepartmentsByBudget = await Department.find(clinicFilter)
        .select('name code budget')
        .sort({ budget: -1 })
        .limit(5);

      res.json({
        success: true,
        data: {
          overview: {
            totalDepartments,
            activeDepartments,
            inactiveDepartments
          },
          staff: staffStats[0] || {
            totalStaff: 0,
            avgStaffPerDept: 0,
            maxStaff: 0,
            minStaff: 0
          },
          budget: budgetStats[0] || {
            totalBudget: 0,
            avgBudget: 0,
            maxBudget: 0,
            minBudget: 0
          },
          statusDistribution: statusStats,
          topByStaff: topDepartmentsByStaff,
          topByBudget: topDepartmentsByBudget
        }
      });
    } catch (error) {
      console.error('Get department stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateDepartmentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be either "active" or "inactive"'
        });
        return;
      }

      const department = await Department.findOneAndUpdate(
        { _id: id, tenant_id: req.tenant_id, clinic_id: req.clinic_id },
        { status },
        { new: true, runValidators: true }
      );

      if (!department) {
        res.status(404).json({
          success: false,
          message: 'Department not found'
        });
        return;
      }

      res.json({
        success: true,
        message: `Department ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
        data: { department }
      });
    } catch (error) {
      console.error('Update department status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 