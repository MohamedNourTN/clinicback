import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { SuperAdmin, ISuperAdminModel } from '../../models';
import { AuthRequest } from '../../types/express';

export interface SuperAdminJWTPayload {
  id: string;
  email: string;
  role: 'super_admin';
  type: 'super_admin'; // Distinguish from regular user tokens
}

export class SuperAdminAuthController {
  // Super Admin Login
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

      // Find super admin by email
      const superAdmin = await SuperAdmin.findActiveByEmail(email);
      if (!superAdmin) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
        return;
      }

      // Check if account is locked
      if (superAdmin.isLocked()) {
        const lockTime = superAdmin.locked_until ? new Date(superAdmin.locked_until) : null;
        res.status(423).json({
          success: false,
          message: 'Account is temporarily locked due to multiple failed login attempts',
          locked_until: lockTime
        });
        return;
      }

      // Verify password
      const isPasswordValid = await superAdmin.comparePassword(password);
      if (!isPasswordValid) {
        // Increment login attempts on failed password
        await superAdmin.incrementLoginAttempts();
        
        res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
        return;
      }

      // Reset login attempts on successful login
      await superAdmin.resetLoginAttempts();

      // Generate JWT token for super admin
      const tokenPayload: SuperAdminJWTPayload = {
        id: superAdmin._id.toString(),
        email: superAdmin.email,
        role: 'super_admin',
        type: 'super_admin'
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '8h' } // Shorter expiry for super admin tokens
      );

      res.json({
        success: true,
        message: 'Super Admin login successful',
        data: {
          token,
          super_admin: {
            id: superAdmin._id,
            email: superAdmin.email,
            first_name: superAdmin.first_name,
            last_name: superAdmin.last_name,
            avatar: superAdmin.avatar,
            last_login: superAdmin.last_login,
            two_factor_enabled: superAdmin.two_factor_enabled
          }
        }
      });
    } catch (error) {
      console.error('Super Admin login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get current super admin profile
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const superAdmin = await SuperAdmin.findById(req.user?.id);
      if (!superAdmin) {
        res.status(404).json({
          success: false,
          message: 'Super admin not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { super_admin: superAdmin }
      });
    } catch (error) {
      console.error('Get super admin profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update super admin profile
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
        'avatar'
      ];

      const updates: any = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key) && req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      });

      const superAdmin = await SuperAdmin.findByIdAndUpdate(
        req.user?.id,
        updates,
        { new: true, runValidators: true }
      );

      if (!superAdmin) {
        res.status(404).json({
          success: false,
          message: 'Super admin not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { super_admin: superAdmin }
      });
    } catch (error) {
      console.error('Update super admin profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Change super admin password
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

      // Find the super admin
      const superAdmin = await SuperAdmin.findById(req.user?.id);
      if (!superAdmin) {
        res.status(404).json({
          success: false,
          message: 'Super admin not found'
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await superAdmin.comparePassword(current_password);
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // Check if new password is different from current password
      const isSamePassword = await superAdmin.comparePassword(new_password);
      if (isSamePassword) {
        res.status(400).json({
          success: false,
          message: 'New password must be different from current password'
        });
        return;
      }

      // Update password
      superAdmin.password_hash = new_password; // Will be hashed by pre-save middleware
      await superAdmin.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change super admin password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get all super admins (for super admin management)
  static async getAllSuperAdmins(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter: any = {};
      if (req.query.is_active !== undefined) {
        filter.is_active = req.query.is_active === 'true';
      }

      const superAdmins = await SuperAdmin.find(filter)
        .select('-password_hash -two_factor_secret')
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalSuperAdmins = await SuperAdmin.countDocuments(filter);

      res.json({
        success: true,
        data: {
          super_admins: superAdmins,
          pagination: {
            page,
            limit,
            total: totalSuperAdmins,
            pages: Math.ceil(totalSuperAdmins / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all super admins error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Create new super admin (for super admin management)
  static async createSuperAdmin(req: Request, res: Response) {
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

      const { email, password, first_name, last_name, phone } = req.body;

      // Check if super admin already exists
      const existingSuperAdmin = await SuperAdmin.findOne({ email });
      if (existingSuperAdmin) {
        res.status(409).json({
          success: false,
          message: 'Super admin with this email already exists'
        });
        return;
      }

      // Create new super admin
      const superAdmin = new SuperAdmin({
        email,
        password_hash: password, // Will be hashed by pre-save middleware
        first_name,
        last_name,
        phone,
        is_active: true,
        two_factor_enabled: false
      });

      await superAdmin.save();

      res.status(201).json({
        success: true,
        message: 'Super admin created successfully',
        data: {
          super_admin: {
            id: superAdmin._id,
            email: superAdmin.email,
            first_name: superAdmin.first_name,
            last_name: superAdmin.last_name,
            phone: superAdmin.phone,
            is_active: superAdmin.is_active
          }
        }
      });
    } catch (error) {
      console.error('Create super admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Deactivate super admin
  static async deactivateSuperAdmin(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const superAdmin = await SuperAdmin.findByIdAndUpdate(
        id,
        { is_active: false },
        { new: true }
      );

      if (!superAdmin) {
        res.status(404).json({
          success: false,
          message: 'Super admin not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Super admin deactivated successfully',
        data: { super_admin: superAdmin }
      });
    } catch (error) {
      console.error('Deactivate super admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Activate super admin
  static async activateSuperAdmin(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const superAdmin = await SuperAdmin.findByIdAndUpdate(
        id,
        { is_active: true },
        { new: true }
      );

      if (!superAdmin) {
        res.status(404).json({
          success: false,
          message: 'Super admin not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Super admin activated successfully',
        data: { super_admin: superAdmin }
      });
    } catch (error) {
      console.error('Activate super admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Unlock super admin account
  static async unlockSuperAdmin(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const superAdmin = await SuperAdmin.findByIdAndUpdate(
        id,
        { 
          login_attempts: 0,
          $unset: { locked_until: 1 }
        },
        { new: true }
      );

      if (!superAdmin) {
        res.status(404).json({
          success: false,
          message: 'Super admin not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Super admin account unlocked successfully',
        data: { super_admin: superAdmin }
      });
    } catch (error) {
      console.error('Unlock super admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
