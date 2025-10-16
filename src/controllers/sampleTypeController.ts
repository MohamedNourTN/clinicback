import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { SampleType } from '../models';

export class SampleTypeController {
  static async createSampleType(req: Request, res: Response): Promise<void> {
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

      const sampleType = new SampleType(req.body);
      await sampleType.save();

      res.status(201).json({
        success: true,
        message: 'Sample type created successfully',
        data: { sampleType }
      });
    } catch (error: any) {
      console.error('Create sample type error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Sample type name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllSampleTypes(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let filter: any = {};

      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { code: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      if (req.query.category && req.query.category !== 'all') {
        filter.category = req.query.category;
      }

      if (req.query.status && req.query.status !== 'all') {
        filter.isActive = req.query.status === 'active';
      }

      const sampleTypes = await SampleType.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalSampleTypes = await SampleType.countDocuments(filter);

      res.json({
        success: true,
        data: {
          sampleTypes,
          pagination: {
            page,
            limit,
            total: totalSampleTypes,
            pages: Math.ceil(totalSampleTypes / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all sample types error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getSampleTypeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sampleType = await SampleType.findById(id);

      if (!sampleType) {
        res.status(404).json({
          success: false,
          message: 'Sample type not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { sampleType }
      });
    } catch (error) {
      console.error('Get sample type by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateSampleType(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sampleType = await SampleType.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!sampleType) {
        res.status(404).json({
          success: false,
          message: 'Sample type not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Sample type updated successfully',
        data: { sampleType }
      });
    } catch (error: any) {
      console.error('Update sample type error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Sample type name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteSampleType(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sampleType = await SampleType.findByIdAndDelete(id);

      if (!sampleType) {
        res.status(404).json({
          success: false,
          message: 'Sample type not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Sample type deleted successfully'
      });
    } catch (error) {
      console.error('Delete sample type error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sampleType = await SampleType.findById(id);

      if (!sampleType) {
        res.status(404).json({
          success: false,
          message: 'Sample type not found'
        });
        return;
      }

      sampleType.isActive = !sampleType.isActive;
      await sampleType.save();

      res.json({
        success: true,
        message: `Sample type ${sampleType.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { sampleType }
      });
    } catch (error) {
      console.error('Toggle sample type status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getSampleTypeStats(req: Request, res: Response): Promise<void> {
    try {
      const totalSampleTypes = await SampleType.countDocuments();
      const activeSampleTypes = await SampleType.countDocuments({ isActive: true });
      const bloodSamples = await SampleType.countDocuments({ category: 'blood' });
      const categoriesCount = await SampleType.distinct('category').then(categories => categories.length);

      const categoryStats = await SampleType.aggregate([
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
          totalSampleTypes,
          activeSampleTypes,
          inactiveSampleTypes: totalSampleTypes - activeSampleTypes,
          bloodSamples,
          categoriesCount,
          categoryStats
        }
      });
    } catch (error) {
      console.error('Get sample type stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 