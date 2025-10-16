import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { TurnaroundTime } from '../models';

export class TurnaroundTimeController {
  static async createTurnaroundTime(req: Request, res: Response): Promise<void> {
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

      const turnaroundTime = new TurnaroundTime(req.body);
      await turnaroundTime.save();

      res.status(201).json({
        success: true,
        message: 'Turnaround time created successfully',
        data: { turnaroundTime }
      });
    } catch (error: any) {
      console.error('Create turnaround time error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Turnaround time name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllTurnaroundTimes(req: Request, res: Response): Promise<void> {
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

      if (req.query.priority && req.query.priority !== 'all') {
        filter.priority = req.query.priority;
      }

      if (req.query.status && req.query.status !== 'all') {
        filter.isActive = req.query.status === 'active';
      }

      const turnaroundTimes = await TurnaroundTime.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ durationMinutes: -1 });

      const totalTurnaroundTimes = await TurnaroundTime.countDocuments(filter);

      res.json({
        success: true,
        data: {
          turnaroundTimes,
          pagination: {
            page,
            limit,
            total: totalTurnaroundTimes,
            pages: Math.ceil(totalTurnaroundTimes / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all turnaround times error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getTurnaroundTimeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const turnaroundTime = await TurnaroundTime.findById(id);

      if (!turnaroundTime) {
        res.status(404).json({
          success: false,
          message: 'Turnaround time not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { turnaroundTime }
      });
    } catch (error) {
      console.error('Get turnaround time by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateTurnaroundTime(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const turnaroundTime = await TurnaroundTime.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!turnaroundTime) {
        res.status(404).json({
          success: false,
          message: 'Turnaround time not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Turnaround time updated successfully',
        data: { turnaroundTime }
      });
    } catch (error: any) {
      console.error('Update turnaround time error:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Turnaround time name or code already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteTurnaroundTime(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const turnaroundTime = await TurnaroundTime.findByIdAndDelete(id);

      if (!turnaroundTime) {
        res.status(404).json({
          success: false,
          message: 'Turnaround time not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Turnaround time deleted successfully'
      });
    } catch (error) {
      console.error('Delete turnaround time error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const turnaroundTime = await TurnaroundTime.findById(id);

      if (!turnaroundTime) {
        res.status(404).json({
          success: false,
          message: 'Turnaround time not found'
        });
        return;
      }

      turnaroundTime.isActive = !turnaroundTime.isActive;
      await turnaroundTime.save();

      res.json({
        success: true,
        message: `Turnaround time ${turnaroundTime.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { turnaroundTime }
      });
    } catch (error) {
      console.error('Toggle turnaround time status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getTurnaroundTimeStats(req: Request, res: Response): Promise<void> {
    try {
      const totalTimes = await TurnaroundTime.countDocuments();
      const activeTimes = await TurnaroundTime.countDocuments({ isActive: true });
      const statTimes = await TurnaroundTime.countDocuments({ priority: 'stat' });
      
      const averageMinutes = await TurnaroundTime.aggregate([
        { $group: { _id: null, avg: { $avg: '$durationMinutes' } } }
      ]);

      const priorityStats = await TurnaroundTime.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            avgDuration: { $avg: '$durationMinutes' }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          totalTimes,
          activeTimes,
          inactiveTimes: totalTimes - activeTimes,
          statTimes,
          averageMinutes: Math.round(averageMinutes[0]?.avg || 0),
          priorityStats
        }
      });
    } catch (error) {
      console.error('Get turnaround time stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 