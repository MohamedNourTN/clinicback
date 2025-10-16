import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Test } from '../models';
import { AuthRequest } from '../types/express';

export class TestController {
  static async createTest(req: AuthRequest, res: Response): Promise<void> {
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

      const testData = {
        ...req.body,
        clinic_id: req.clinic_id
      };

      const test = new Test(testData);
      await test.save();

      res.status(201).json({
        success: true,
        message: 'Test created successfully',
        data: { test }
      });
    } catch (error: any) {
      console.error('Create test error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Test name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllTests(req: AuthRequest, res: Response): Promise<void> {
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
          { description: { $regex: req.query.search, $options: 'i' } },
          { category: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      // Category filter
      if (req.query.category && req.query.category !== 'all') {
        filter.category = req.query.category;
      }

      // Status filter
      if (req.query.status && req.query.status !== 'all') {
        filter.isActive = req.query.status === 'active';
      }

      const tests = await Test.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalTests = await Test.countDocuments(filter);

      res.json({
        success: true,
        data: {
          tests,
          pagination: {
            page,
            limit,
            total: totalTests,
            pages: Math.ceil(totalTests / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all tests error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getTestById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const test = await Test.findById(id);

      if (!test) {
        res.status(404).json({
          success: false,
          message: 'Test not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { test }
      });
    } catch (error) {
      console.error('Get test by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateTest(req: AuthRequest, res: Response): Promise<void> {
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
      const test = await Test.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!test) {
        res.status(404).json({
          success: false,
          message: 'Test not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Test updated successfully',
        data: { test }
      });
    } catch (error: any) {
      console.error('Update test error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Test name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteTest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const test = await Test.findByIdAndDelete(id);

      if (!test) {
        res.status(404).json({
          success: false,
          message: 'Test not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Test deleted successfully'
      });
    } catch (error) {
      console.error('Delete test error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async toggleStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const test = await Test.findById(id);

      if (!test) {
        res.status(404).json({
          success: false,
          message: 'Test not found'
        });
        return;
      }

      test.isActive = !test.isActive;
      await test.save();

      res.json({
        success: true,
        message: `Test ${test.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { test }
      });
    } catch (error) {
      console.error('Toggle test status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getTestStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const totalTests = await Test.countDocuments();
      const activeTests = await Test.countDocuments({ isActive: true });
      const categoriesCount = await Test.distinct('category').then(categories => categories.length);

      const categoryStats = await Test.aggregate([
        {
          $group: {
            _id: '$category',
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
          totalTests,
          activeTests,
          inactiveTests: totalTests - activeTests,
          categoriesCount,
          categoryStats
        }
      });
    } catch (error) {
      console.error('Get test stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 