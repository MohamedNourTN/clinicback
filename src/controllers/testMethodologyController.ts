import { Response } from 'express';
import { validationResult } from 'express-validator';
import { TestMethodology } from '../models';
import { AuthRequest } from '../types/express';

export class TestMethodologyController {
  static async createMethodology(req: AuthRequest, res: Response): Promise<void> {
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

      const methodologyData = {
        ...req.body,
        clinic_id: req.clinic_id
      };

      const methodology = new TestMethodology(methodologyData);
      await methodology.save();

      res.status(201).json({
        success: true,
        message: 'Test methodology created successfully',
        data: { methodology }
      });
    } catch (error: any) {
      console.error('Create test methodology error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Methodology name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllMethodologies(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let filter: any = {
        clinic_id: req.clinic_id // CLINIC FILTER: Only get methodologies from current clinic
      };

      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { code: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { category: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      if (req.query.category && req.query.category !== 'all') {
        filter.category = req.query.category;
      }

      if (req.query.status && req.query.status !== 'all') {
        filter.isActive = req.query.status === 'active';
      }

      const methodologies = await TestMethodology.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalMethodologies = await TestMethodology.countDocuments(filter);

      res.json({
        success: true,
        data: {
          methodologies,
          pagination: {
            page,
            limit,
            total: totalMethodologies,
            pages: Math.ceil(totalMethodologies / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all methodologies error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getMethodologyById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const methodology = await TestMethodology.findOne({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only get methodology from current clinic
      });

      if (!methodology) {
        res.status(404).json({
          success: false,
          message: 'Test methodology not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { methodology }
      });
    } catch (error) {
      console.error('Get methodology by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateMethodology(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const methodology = await TestMethodology.findOneAndUpdate(
        {
          _id: id,
          clinic_id: req.clinic_id // CLINIC FILTER: Only update methodology from current clinic
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!methodology) {
        res.status(404).json({
          success: false,
          message: 'Test methodology not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Test methodology updated successfully',
        data: { methodology }
      });
    } catch (error: any) {
      console.error('Update methodology error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Methodology name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteMethodology(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const methodology = await TestMethodology.findOneAndDelete({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only delete methodology from current clinic
      });

      if (!methodology) {
        res.status(404).json({
          success: false,
          message: 'Test methodology not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Test methodology deleted successfully'
      });
    } catch (error) {
      console.error('Delete methodology error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async toggleStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const methodology = await TestMethodology.findOne({
        _id: id,
        clinic_id: req.clinic_id // CLINIC FILTER: Only toggle methodology from current clinic
      });

      if (!methodology) {
        res.status(404).json({
          success: false,
          message: 'Test methodology not found'
        });
        return;
      }

      methodology.isActive = !methodology.isActive;
      await methodology.save();

      res.json({
        success: true,
        message: `Methodology ${methodology.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { methodology }
      });
    } catch (error) {
      console.error('Toggle methodology status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getMethodologyStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filter = { clinic_id: req.clinic_id }; // CLINIC FILTER: Only get stats from current clinic
      const totalMethodologies = await TestMethodology.countDocuments(filter);
      const activeMethodologies = await TestMethodology.countDocuments({ ...filter, isActive: true });
      const categoriesCount = await TestMethodology.distinct('category', filter).then(categories => categories.length);

      const categoryStats = await TestMethodology.aggregate([
        { $match: filter },
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
          totalMethodologies,
          activeMethodologies,
          inactiveMethodologies: totalMethodologies - activeMethodologies,
          categoriesCount,
          categoryStats
        }
      });
    } catch (error) {
      console.error('Get methodology stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 