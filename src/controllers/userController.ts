import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { User, UserClinic, Clinic, Role } from '../models';
import { AuthRequest } from '../types/express';
import { S3Service, s3AvatarUpload } from '../utils/s3';
import { getTenantScopedFilter, addTenantToData } from '../middleware/auth';
import { SubscriptionService } from '../services/subscriptionService';
import { ensureTenantPermissions } from '../utils/tenantPermissionSeeder';

export class UserController {
  // Register a new user
  static async register(req: Request, res: Response) {
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

      const { email, password, first_name, last_name, role, phone, clinic_id } = req.body;

      // Check if clinic exists and is active
      const clinic = await Clinic.findById(clinic_id);
      if (!clinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic not found'
        });
        return;
      }

      if (!clinic.is_active) {
        res.status(400).json({
          success: false,
          message: 'Clinic is not active'
        });
        return;
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
        return;
      }

      // Create new user
      const user = new User({
        tenant_id: clinic.tenant_id,
        clinic_id,
        email,
        password_hash: password, // Will be hashed by pre-save middleware
        first_name,
        last_name,
        role,
        phone
      });

      await user.save();

      // Create UserClinic relationship with the specified role (not for super_admin users)
      if (role !== 'super_admin') {
        try {
          // Ensure tenant has permissions and roles seeded before trying to assign roles
          console.log(`Ensuring permissions and roles exist for tenant: ${clinic.tenant_id}`);
          await ensureTenantPermissions(clinic.tenant_id.toString());
          
          // Find the role document
          const roleDoc = await Role.findOne({ 
            tenant_id: clinic.tenant_id,
            name: role.toLowerCase(), 
            is_system_role: true 
          });
          
          if (roleDoc) {
            // Create UserClinic relationship with tenant_id
            const userClinicData = {
              tenant_id: clinic.tenant_id,
              user_id: user._id,
              clinic_id: clinic_id,
              roles: [{
                role_id: roleDoc._id,
                assigned_at: new Date(),
                assigned_by: user._id,
                is_primary: true
              }],
              permission_overrides: [],
              is_active: true,
              joined_at: new Date()
            };
            
            const userClinic = new UserClinic(userClinicData);
            await userClinic.save();
            
            console.log(`Created UserClinic relationship for user ${user.email} with role ${role}`);
          } else {
            console.error(`Role '${role}' not found for tenant ${clinic.tenant_id} even after seeding. UserClinic relationship not created.`);
            // Return error response instead of just warning
            res.status(500).json({
              success: false,
              message: `Failed to assign role '${role}'. Please contact system administrator.`
            });
            return;
          }
        } catch (permissionError) {
          console.error(`Error setting up tenant permissions for user ${user.email}:`, permissionError);
          res.status(500).json({
            success: false,
            message: 'Failed to setup user permissions. Please contact system administrator.'
          });
          return;
        }
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            phone: user.phone,
            is_active: user.is_active
          }
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Login user
  static async login(req: Request, res: Response) {
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

      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email',
        });
        return;
      }

      // Check if user is active
      if (!user.is_active) {
        res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
        return;
      }

      // Check subscription status for the user's tenant (skip for super_admin)
      if (user.role !== 'super_admin' && user.tenant_id) {
        const subscriptionCheck = await SubscriptionService.canTenantUsersLogin(user.tenant_id);
        
        if (!subscriptionCheck.allowed) {
          res.status(403).json({
            success: false,
            message: subscriptionCheck.reason || 'Access denied due to subscription status',
            code: 'SUBSCRIPTION_REQUIRED',
            subscription_status: subscriptionCheck.subscription?.status || 'none'
          });
          return;
        }
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
        return;
      }

      // Get user's clinics
      const userClinics = await UserClinic.find({
        user_id: user._id,
        is_active: true
      }).populate({
        path: 'clinic_id',
        match: { is_active: true },
        select: 'name code description address.city address.state is_active'
      });

      // Filter out clinics that are null (inactive)
      const activeClinics = userClinics.filter(uc => uc.clinic_id);

      // Generate JWT token (no clinic context yet - will be added after clinic selection)
      const token = jwt.sign(
        { 
          id: user._id, 
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            phone: user.phone
          },
          clinics: activeClinics,
          requiresClinicSelection: activeClinics.length > 1
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get current user profile
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const user = await User.findById(req.user?.id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update user profile
  static async updateProfile(req: AuthRequest, res: Response) {
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

      const allowedUpdates = [
        'first_name', 
        'last_name', 
        'phone', 
        'base_currency',
        'address',
        'bio',
        'date_of_birth',
        'specialization',
        'license_number',
        'department',
        'avatar'
      ];

      const updates: any = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key) && req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user?.id,
        updates,
        { new: true, runValidators: true }
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Change user password
  static async changePassword(req: AuthRequest, res: Response) {
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

      const { current_password, new_password } = req.body;

      // Find the user
      const user = await User.findById(req.user?.id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(current_password);
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // Check if new password is different from current password
      const isSamePassword = await user.comparePassword(new_password);
      if (isSamePassword) {
        res.status(400).json({
          success: false,
          message: 'New password must be different from current password'
        });
        return;
      }

      // Update password
      user.password_hash = new_password; // Will be hashed by pre-save middleware
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get doctors (accessible by medical staff for appointments)
  static async getDoctors(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const filter: any = { 
        role: 'doctor',
        is_active: true
      };

      const doctors = await User.find(filter)
        .select('first_name last_name email phone role is_active')
        .skip(skip)
        .limit(limit)
        .sort({ first_name: -1, last_name: -1 });

      const totalDoctors = await User.countDocuments(filter);

      res.json({
        success: true,
        data: {
          items: doctors,
          pagination: {
            page,
            limit,
            total: totalDoctors,
            pages: Math.ceil(totalDoctors / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get doctors error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getNurses(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const filter: any = { 
        role: 'nurse',
        is_active: true
      };

      const nurses = await User.find(filter)
        .select('first_name last_name email phone role is_active')
        .skip(skip)
        .limit(limit)
        .sort({ first_name: -1, last_name: -1 });

      const totalNurses = await User.countDocuments(filter);

      res.json({
        success: true,
        data: {
          items: nurses,
          pagination: {
            page,
            limit,
            total: totalNurses,
            pages: Math.ceil(totalNurses / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get nurses error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get all users (admin only)
  static async getAllUsers(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // For staff management, we want tenant and clinic-scoped filtering even for super_admin users
      // This ensures each tenant only sees their own staff from their current clinic context
      const filter: any = {};
      
      // Always apply tenant filtering (even for super_admin)
      if (req.tenant_id) {
        filter.tenant_id = req.tenant_id;
      }
      
      // Add clinic filtering if clinic context is available
      if (req.clinic_id) {
        filter.clinic_id = req.clinic_id;
      }
      
      if (req.query.role) {
        filter.role = req.query.role;
      }
      if (req.query.is_active !== undefined) {
        filter.is_active = req.query.is_active === 'true';
      }

      const users = await User.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalUsers = await User.countDocuments(filter);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total: totalUsers,
            pages: Math.ceil(totalUsers / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get all users for admin clinic management (without pagination)
  static async getAllUsersForAdmin(req: AuthRequest, res: Response) {
    try {
      // For admin management, we want tenant and clinic-scoped filtering even for super_admin users
      const filter: any = { is_active: true };
      
      // Always apply tenant filtering (even for super_admin)
      if (req.tenant_id) {
        filter.tenant_id = req.tenant_id;
      }
      
      // Add clinic filtering if clinic context is available
      if (req.clinic_id) {
        filter.clinic_id = req.clinic_id;
      }
      
      const users = await User.find(filter)
        .select('first_name last_name email role phone is_active created_at')
        .sort({ first_name: 1, last_name: 1 });

      res.status(200).json({
        success: true,
        data: {
          users: users
        },
        total: users.length
      });

    } catch (error: any) {
      console.error('Error fetching all users for admin:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error.message
      });
    }
  }

  // Get demo users (public access for login page)
  static async getDemoUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter: any = {};
      if (req.query.role) {
        filter.role = req.query.role;
      }
      if (req.query.is_active !== undefined) {
        filter.is_active = req.query.is_active === 'true';
      }
      
      // Filter by tenant_id if provided (for multi-tenant support)
      if (req.query.tenant_id) {
        filter.tenant_id = req.query.tenant_id;
      }

      // Only return basic fields for security (no password_hash, sensitive data)
      const users = await User.find(filter)
        .select('_id email first_name last_name role phone is_active tenant_id created_at')
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalUsers = await User.countDocuments(filter);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total: totalUsers,
            pages: Math.ceil(totalUsers / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get demo users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user by ID (admin only)
  static async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      
      // For user lookup, we want tenant and clinic-scoped filtering even for super_admin users
      const filter: any = { _id: id };
      
      // Always apply tenant filtering (even for super_admin)
      if (req.tenant_id) {
        filter.tenant_id = req.tenant_id;
      }
      
      // Add clinic filtering if clinic context is available
      if (req.clinic_id) {
        filter.clinic_id = req.clinic_id;
      }
      
      const user = await User.findOne(filter);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update user (admin only)
  static async updateUser(req: Request, res: Response) {
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
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated directly
      delete updates.password_hash;
      delete updates._id;
      delete updates.created_at;

      const user = await User.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User updated successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Deactivate user (admin only)
  static async deactivateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await User.findByIdAndUpdate(
        id,
        { is_active: false },
        { new: true }
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User deactivated successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Activate user (admin only)
  static async activateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await User.findByIdAndUpdate(
        id,
        { is_active: true },
        { new: true }
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User activated successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Activate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Admin change user password (admin only)
  static async adminChangeUserPassword(req: Request, res: Response) {
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
      const { new_password } = req.body;

      // Find the user
      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Update password
      user.password_hash = new_password; // Will be hashed by pre-save middleware
      await user.save();

      res.json({
        success: true,
        message: 'User password updated successfully'
      });
    } catch (error) {
      console.error('Admin change user password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Upload avatar
  static async uploadAvatar(req: AuthRequest, res: Response) {
    try {
      // Validate S3 configuration
      if (!S3Service.validateConfiguration()) {
        res.status(500).json({
          success: false,
          message: 'S3 configuration is incomplete. Please check AWS credentials.'
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No avatar file provided'
        });
        return;
      }

      // Get current user to check for existing avatar
      const currentUser = await User.findById(req.user?.id);
      if (!currentUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Delete old avatar from S3 if it exists
      if (currentUser.avatar && currentUser.avatar.includes('s3.')) {
        try {
          await S3Service.deleteFile(currentUser.avatar);
        } catch (deleteError) {
          console.warn('Failed to delete old avatar from S3:', deleteError);
          // Continue with upload even if old file deletion fails
        }
      }

      // Upload new avatar to S3
      const avatarUrl = await S3Service.uploadFile(req.file, 'avatars');
      
      // Update user's avatar in database
      const user = await User.findByIdAndUpdate(
        req.user?.id,
        { avatar: avatarUrl },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: { 
          avatar: avatarUrl,
          user 
        }
      });
    } catch (error) {
      console.error('Upload avatar error:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // Remove avatar
  static async removeAvatar(req: AuthRequest, res: Response) {
    try {
      const user = await User.findById(req.user?.id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Remove avatar file from S3 if it exists
      if (user.avatar && user.avatar.includes('s3.')) {
        try {
          await S3Service.deleteFile(user.avatar);
        } catch (deleteError) {
          console.warn('Failed to delete avatar from S3:', deleteError);
          // Continue with database update even if S3 deletion fails
        }
      }

      // Update user to remove avatar
      user.avatar = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Avatar removed successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Remove avatar error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update user schedule (admin only or self)
  static async updateUserSchedule(req: AuthRequest, res: Response) {
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
      const { schedule } = req.body;

      // Check authorization - admin can update any user's schedule, users can update their own
      if (req.user?.role !== 'admin' && req.user?.id !== id) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only update your own schedule or need admin privileges.'
        });
        return;
      }

      // Validate schedule structure
      const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      if (!schedule || typeof schedule !== 'object') {
        res.status(400).json({
          success: false,
          message: 'Schedule is required and must be an object'
        });
        return;
      }

      // Validate each day in the schedule
      for (const day of daysOfWeek) {
        if (!schedule[day]) {
          res.status(400).json({
            success: false,
            message: `Schedule for ${day} is required`
          });
          return;
        }

        const daySchedule = schedule[day];
        
        if (typeof daySchedule.isWorking !== 'boolean') {
          res.status(400).json({
            success: false,
            message: `isWorking field for ${day} must be a boolean`
          });
          return;
        }

        // If working day, validate time format
        if (daySchedule.isWorking) {
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
          
          if (!timeRegex.test(daySchedule.start)) {
            res.status(400).json({
              success: false,
              message: `Invalid start time format for ${day}. Use HH:MM format`
            });
            return;
          }

          if (!timeRegex.test(daySchedule.end)) {
            res.status(400).json({
              success: false,
              message: `Invalid end time format for ${day}. Use HH:MM format`
            });
            return;
          }

          // Validate that end time is after start time
          const startMinutes = timeToMinutes(daySchedule.start);
          const endMinutes = timeToMinutes(daySchedule.end);
          
          if (endMinutes <= startMinutes) {
            res.status(400).json({
              success: false,
              message: `End time must be after start time for ${day}`
            });
            return;
          }
        }
      }

      // Apply tenant validation for user update
      const userFilter = getTenantScopedFilter(req, { _id: id });
      
      // Update user's schedule
      const user = await User.findOneAndUpdate(
        userFilter,
        { schedule },
        { new: true, runValidators: true }
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Schedule updated successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Update user schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

// Helper function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
} 