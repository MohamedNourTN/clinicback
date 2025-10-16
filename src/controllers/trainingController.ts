import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Training, TrainingProgress, User } from '../models';
import { AuthRequest } from '../types/express';

export class TrainingController {
  // Get all trainings or training by role
  static async getTrainings(req: Request, res: Response) {
    try {
      const { role } = req.query;
      const filter: any = { is_active: true };
      
      if (role) {
        filter.role = role;
      }

      const trainings = await Training.find(filter).sort({ role: 1 });
      
      res.json({
        success: true,
        message: 'Trainings retrieved successfully',
        data: { trainings }
      });
    } catch (error) {
      console.error('Get trainings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get training by role (now returns all trainings if role-specific not found)
  static async getTrainingByRole(req: Request, res: Response) {
    try {
      const { role } = req.params;
      
      // Return all active trainings for users to choose from
      const allTrainings = await Training.find({ is_active: true }).sort({ role: 1 });
      
      if (allTrainings.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No training programs available'
        });
        return;
      }

      // Find the role-specific training if it exists, otherwise return the first one
      const roleSpecificTraining = allTrainings.find(t => t.role === role);
      const training = roleSpecificTraining || allTrainings[0];

      res.json({
        success: true,
        message: 'Training retrieved successfully',
        data: { 
          training,
          allTrainings, // Include all trainings so frontend can show options
          roleSpecific: !!roleSpecificTraining
        }
      });
    } catch (error) {
      console.error('Get training by role error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user's training progress
  static async getUserProgress(req: AuthRequest, res: Response) {
    try {
      const { role } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const filter: any = { user_id: userId };
      if (role) {
        filter.role = role;
      }

      const progress = await TrainingProgress.find(filter)
        .populate('training_id', 'name role overview')
        .populate('user_id', 'first_name last_name email role')
        .sort({ last_accessed: -1 });

      res.json({
        success: true,
        message: 'Training progress retrieved successfully',
        data: { progress }
      });
    } catch (error) {
      console.error('Get user progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Start training for a user
  static async startTraining(req: AuthRequest, res: Response) {
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

      const { trainingId, role } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Check if training exists
      const training = await Training.findById(trainingId);
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found'
        });
        return;
      }

      // Check if user already has progress for this training
      const existingProgress = await TrainingProgress.findOne({
        user_id: userId,
        training_id: trainingId
      });

      if (existingProgress) {
        res.status(409).json({
          success: false,
          message: 'Training already started',
          data: { progress: existingProgress }
        });
        return;
      }

      // Initialize module progress
      const modulesProgress = training.modules.map((module, index) => ({
        module_id: module._id?.toString() || index.toString(),
        module_title: module.title,
        completed: false,
        lessons_completed: [],
        progress_percentage: 0
      }));

      // Create new progress record
      const progress = new TrainingProgress({
        user_id: userId,
        training_id: trainingId,
        role: role || training.role,
        modules_progress: modulesProgress
      });

      await progress.save();

      res.status(201).json({
        success: true,
        message: 'Training started successfully',
        data: { progress }
      });
    } catch (error) {
      console.error('Start training error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update module progress
  static async updateModuleProgress(req: AuthRequest, res: Response) {
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

      const { progressId } = req.params;
      const { moduleId, completed, lessonsCompleted, progressPercentage } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const progress = await TrainingProgress.findOne({
        _id: progressId,
        user_id: userId
      });

      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Training progress not found'
        });
        return;
      }

      // Find and update the specific module
      const moduleIndex = progress.modules_progress.findIndex(
        m => m.module_id === moduleId
      );

      if (moduleIndex === -1) {
        res.status(404).json({
          success: false,
          message: 'Module not found'
        });
        return;
      }

      // Update module progress
      progress.modules_progress[moduleIndex].completed = completed;
      progress.modules_progress[moduleIndex].lessons_completed = lessonsCompleted || [];
      progress.modules_progress[moduleIndex].progress_percentage = progressPercentage || 0;

      if (completed && !progress.modules_progress[moduleIndex].completed_at) {
        progress.modules_progress[moduleIndex].completed_at = new Date();
      }

      await progress.save();

      res.json({
        success: true,
        message: 'Module progress updated successfully',
        data: { progress }
      });
    } catch (error) {
      console.error('Update module progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Complete training
  static async completeTraining(req: AuthRequest, res: Response) {
    try {
      const { progressId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const progress = await TrainingProgress.findOne({
        _id: progressId,
        user_id: userId
      });

      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Training progress not found'
        });
        return;
      }

      // Check if all modules are completed
      const allModulesCompleted = progress.modules_progress.every(m => m.completed);
      
      if (!allModulesCompleted) {
        res.status(400).json({
          success: false,
          message: 'Cannot complete training. All modules must be completed first.'
        });
        return;
      }

      progress.is_completed = true;
      progress.completed_at = new Date();
      progress.overall_progress = 100;

      await progress.save();

      res.json({
        success: true,
        message: 'Training completed successfully',
        data: { progress }
      });
    } catch (error) {
      console.error('Complete training error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Issue certificate
  static async issueCertificate(req: AuthRequest, res: Response) {
    try {
      const { progressId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const progress = await TrainingProgress.findOne({
        _id: progressId,
        user_id: userId
      }).populate('training_id', 'name role')
        .populate('user_id', 'first_name last_name email');

      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Training progress not found'
        });
        return;
      }

      if (!progress.is_completed) {
        res.status(400).json({
          success: false,
          message: 'Cannot issue certificate. Training must be completed first.'
        });
        return;
      }

      progress.certificate_issued = true;
      await progress.save();

      res.json({
        success: true,
        message: 'Certificate issued successfully',
        data: { 
          progress,
          certificate: {
            id: progress._id,
            issued_date: new Date(),
            training_name: (progress.training_id as any)?.name,
            user_name: `${(progress.user_id as any)?.first_name} ${(progress.user_id as any)?.last_name}`,
            completion_date: progress.completed_at
          }
        }
      });
    } catch (error) {
      console.error('Issue certificate error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Admin: Issue certificate for any user
  static async adminIssueCertificate(req: AuthRequest, res: Response) {
    try {
      const { progressId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Check if user is admin
      const user = await User.findById(userId);
      if (!user || user.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
        return;
      }

      // Find progress record (no user restriction for admin)
      const progress = await TrainingProgress.findById(progressId)
        .populate('training_id', 'name role')
        .populate('user_id', 'firstName lastName email');

      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Training progress not found'
        });
        return;
      }

      if (!progress.is_completed) {
        res.status(400).json({
          success: false,
          message: 'Cannot issue certificate. Training must be completed first.'
        });
        return;
      }

      progress.certificate_issued = true;
      await progress.save();

      res.json({
        success: true,
        message: 'Certificate issued successfully',
        data: { 
          progress,
          certificate: {
            id: progress._id,
            issued_date: new Date(),
            training_name: (progress.training_id as any)?.name,
            user_name: `${(progress.user_id as any)?.firstName} ${(progress.user_id as any)?.lastName}`,
            completion_date: progress.completed_at
          }
        }
      });
    } catch (error) {
      console.error('Admin issue certificate error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Admin: Create or update training content
  static async createOrUpdateTraining(req: Request, res: Response) {
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

      const { role, name, description, overview, modules } = req.body;

      // Check if training already exists for this role
      let training = await Training.findOne({ role });
      
      if (training) {
        // Update existing training
        training.name = name;
        training.description = description;
        training.overview = overview;
        training.modules = modules;
        await training.save();

        res.json({
          success: true,
          message: 'Training updated successfully',
          data: { training }
        });
      } else {
        // Create new training
        training = new Training({
          role,
          name,
          description,
          overview,
          modules
        });

        await training.save();

        res.status(201).json({
          success: true,
          message: 'Training created successfully',
          data: { training }
        });
      }
    } catch (error) {
      console.error('Create/Update training error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Admin: Get all users' training progress
  static async getAllTrainingProgress(req: Request, res: Response) {
    try {
      const { role, status, page = 1, limit = 50 } = req.query;
      
      // Build filter
      const filter: any = {};
      if (role) filter.role = role;
      if (status === 'completed') filter.is_completed = true;
      if (status === 'in-progress') {
        filter.started_at = { $exists: true };
        filter.is_completed = false;
      }
      if (status === 'not-started') filter.started_at = { $exists: false };

      const progress = await TrainingProgress.find(filter)
        .populate('training_id', 'name role overview')
        .populate('user_id', 'firstName lastName email role')
        .sort({ last_accessed: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await TrainingProgress.countDocuments(filter);

      // Calculate overall analytics
      const totalUsers = await TrainingProgress.countDocuments();
      const completedTrainings = await TrainingProgress.countDocuments({ is_completed: true });
      const inProgress = await TrainingProgress.countDocuments({ 
        started_at: { $exists: true }, 
        is_completed: false 
      });
      const certificatesIssued = await TrainingProgress.countDocuments({ certificate_issued: true });

      const analytics = {
        total_users: totalUsers,
        total_trainings_started: totalUsers,
        completed_trainings: completedTrainings,
        in_progress: inProgress,
        certificates_issued: certificatesIssued,
        completion_rate: totalUsers > 0 ? Math.round((completedTrainings / totalUsers) * 100) : 0,
        avg_progress: 0 // Will be calculated separately if needed
      };

      // Calculate average progress
      const avgProgressResult = await TrainingProgress.aggregate([
        { $group: { _id: null, avgProgress: { $avg: '$overall_progress' } } }
      ]);
      analytics.avg_progress = avgProgressResult[0]?.avgProgress || 0;

      res.json({
        success: true,
        message: 'Training progress retrieved successfully',
        data: { 
          progress,
          analytics,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get all training progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Admin: Get all training analytics
  static async getTrainingAnalytics(req: Request, res: Response) {
    try {
      const { role, startDate, endDate } = req.query;
      
      // Build filter
      const filter: any = {};
      if (role) filter.role = role;
      if (startDate || endDate) {
        filter.created_at = {};
        if (startDate) filter.created_at.$gte = new Date(startDate as string);
        if (endDate) filter.created_at.$lte = new Date(endDate as string);
      }

      const analytics = await TrainingProgress.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$role',
            total_users: { $sum: 1 },
            completed_trainings: { $sum: { $cond: ['$is_completed', 1, 0] } },
            in_progress: { $sum: { $cond: [{ $and: ['$started_at', { $not: '$is_completed' }] }, 1, 0] } },
            certificates_issued: { $sum: { $cond: ['$certificate_issued', 1, 0] } },
            avg_completion_time: {
              $avg: {
                $cond: [
                  '$completed_at',
                  { $subtract: ['$completed_at', '$started_at'] },
                  null
                ]
              }
            },
            avg_progress: { $avg: '$overall_progress' }
          }
        },
        {
          $project: {
            role: '$_id',
            total_users: 1,
            completed_trainings: 1,
            in_progress: 1,
            certificates_issued: 1,
            completion_rate: {
              $multiply: [
                { $divide: ['$completed_trainings', '$total_users'] },
                100
              ]
            },
            avg_completion_days: {
              $divide: ['$avg_completion_time', 1000 * 60 * 60 * 24]
            },
            avg_progress: { $round: ['$avg_progress', 2] }
          }
        }
      ]);

      res.json({
        success: true,
        message: 'Training analytics retrieved successfully',
        data: { analytics }
      });
    } catch (error) {
      console.error('Get training analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 