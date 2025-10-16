import { Response } from 'express';
import { validationResult } from 'express-validator';
import { TestCategory } from '../models';
import { AuthRequest } from '../types/express';

export class TestCategoryController {
  static async createCategory(req: AuthRequest, res: Response): Promise<void> {
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

      const categoryData = {
        ...req.body,
        clinic_id: req.clinic_id
      };

      const category = new TestCategory(categoryData);
      await category.save();

      res.status(201).json({
        success: true,
        message: 'Test category created successfully',
        data: { category }
      });
    } catch (error: any) {
      console.error('Create test category error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Category name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let filter: any = {
        clinic_id: req.clinic_id // CLINIC FILTER: Only get categories from current clinic
      };

      // Search filter
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { code: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { department: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Department filter
      if (req.query.department && req.query.department !== 'all') {
        filter.department = req.query.department;
      }

      // Status filter
      if (req.query.status && req.query.status !== 'all') {
        filter.isActive = req.query.status === 'active';
      }

      const categories = await TestCategory.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ sortOrder: -1, created_at: -1 });

      const totalCategories = await TestCategory.countDocuments(filter);

      res.json({
        success: true,
        data: {
          categories,
          pagination: {
            page,
            limit,
            total: totalCategories,
            pages: Math.ceil(totalCategories / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all test categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getCategoryById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await TestCategory.findOne({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only get category from current clinic
      });

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Test category not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { category }
      });
    } catch (error) {
      console.error('Get test category by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateCategory(req: AuthRequest, res: Response): Promise<void> {
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
      const category = await TestCategory.findOneAndUpdate(
        {
          _id: id,
          clinic_id: req.clinic_id // CLINIC FILTER: Only update category from current clinic
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Test category not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Test category updated successfully',
        data: { category }
      });
    } catch (error: any) {
      console.error('Update test category error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Category name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await TestCategory.findOneAndDelete({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only delete category from current clinic
      });

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Test category not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Test category deleted successfully'
      });
    } catch (error) {
      console.error('Delete test category error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async toggleStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await TestCategory.findOne({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only toggle category from current clinic
      });

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Test category not found'
        });
        return;
      }

      category.isActive = !category.isActive;
      await category.save();

      res.json({
        success: true,
        message: `Test category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { category }
      });
    } catch (error) {
      console.error('Toggle test category status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getCategoryStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filter = { clinic_id: req.clinic_id }; // CLINIC FILTER: Only get stats from current clinic
      const totalCategories = await TestCategory.countDocuments(filter);
      const activeCategories = await TestCategory.countDocuments({ ...filter, isActive: true });
      const totalTests = await TestCategory.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$testCount' } } }
      ]);
      const departmentsCount = await TestCategory.distinct('department', filter).then(departments => departments.length);

      const departmentStats = await TestCategory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          totalCategories,
          activeCategories,
          inactiveCategories: totalCategories - activeCategories,
          totalTests: totalTests[0]?.total || 0,
          departmentsCount,
          departmentStats
        }
      });
    } catch (error) {
      console.error('Get test category stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 