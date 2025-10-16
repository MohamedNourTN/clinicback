import { Response } from 'express';
import { validationResult } from 'express-validator';
import { User, Tenant, UserClinic, Role } from '../../models';
import { AuthRequest } from '../../types/express';
import mongoose from 'mongoose';
import { ensureTenantPermissions } from '../../utils/tenantPermissionSeeder';

const DEFAULT_PASSWORD = 'password123'; // From userSeeder.ts

export class SuperAdminUserController {
  
  /**
   * Get all super admin users
   * GET /api/super-admin/users
   */
  static async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Find all users with super_admin or admin roles
      const users = await User.find({ 
        role: { $in: ['super_admin', 'admin'] } 
      })
        .populate('tenant_id', 'name subdomain status')
        .select('-password_hash')
        .sort({ created_at: -1 });

      // Get user counts by role
      const stats = {
        total: users.length,
        active: users.filter(u => u.is_active).length,
        inactive: users.filter(u => !u.is_active).length,
        super_admin: users.filter(u => u.role === 'super_admin').length,
        admin: users.filter(u => u.role === 'admin').length
      };

      res.json({
        success: true,
        data: {
          users: users,
          stats: stats
        },
        total: users.length,
        message: `Retrieved ${users.length} admin users`
      });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error.message
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/super-admin/users/:id
   */
  static async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await User.findById(id)
        .populate('tenant_id', 'name subdomain status')
        .select('-password_hash');

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user,
        message: 'User retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user',
        error: error.message
      });
    }
  }

  /**
   * Create a new super admin user
   * POST /api/super-admin/users
   */
  static async createUser(req: AuthRequest, res: Response): Promise<void> {
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

      const {
        first_name,
        last_name,
        email,
        phone,
        tenant_id,
        role = 'super_admin',
        is_active = true
      } = req.body;

      // Check if user with email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
        return;
      }

      // Verify tenant exists and is active
      const tenant = await Tenant.findOne({ _id: tenant_id, status: 'active' });
      if (!tenant) {
        res.status(400).json({
          success: false,
          message: 'Invalid or inactive tenant'
        });
        return;
      }

      // Create user data (let the User model's pre-save hook handle password hashing)
      const userData = {
        tenant_id: new mongoose.Types.ObjectId(tenant_id),
        clinic_id: new mongoose.Types.ObjectId(tenant_id), // Use tenant_id as default clinic_id for now
        first_name,
        last_name,
        email: email.toLowerCase(),
        phone,
        role,
        password_hash: DEFAULT_PASSWORD, // Plain password - will be hashed by User model pre-save hook
        is_active,
        base_currency: 'USD',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(first_name + ' ' + last_name)}&background=6366f1&color=ffffff`,
      };

      // Create the user
      const newUser = await User.create(userData);

      // Create UserClinic relationship if role is not super_admin
      if (role !== 'super_admin') {
        try {
          // Ensure tenant has permissions and roles seeded before trying to assign roles
          console.log(`Ensuring permissions and roles exist for tenant: ${tenant_id}`);
          await ensureTenantPermissions(tenant_id.toString());
          
          // Find the role document
          const roleDoc = await Role.findOne({ 
            tenant_id: tenant_id,
            name: role.toLowerCase(), 
            is_system_role: true 
          });
          
          if (roleDoc) {
            // Get one clinic from the tenant for admin users
            const clinic = await mongoose.model('Clinic').findOne({ tenant_id: tenant_id, is_active: true });
            if (clinic) {
              await UserClinic.create({
                tenant_id: new mongoose.Types.ObjectId(tenant_id),
                user_id: newUser._id,
                clinic_id: clinic._id,
                roles: [{
                  role_id: roleDoc._id,
                  assigned_at: new Date(),
                  assigned_by: req.user!._id,
                  is_primary: true
                }],
                permission_overrides: [],
                is_active: true,
                joined_at: new Date()
              });
              console.log(`Created UserClinic relationship for user ${newUser.email} with role ${role}`);
            }
          } else {
            console.error(`Role '${role}' not found for tenant ${tenant_id} even after seeding.`);
          }
        } catch (permissionError) {
          console.error(`Error setting up tenant permissions for user ${newUser.email}:`, permissionError);
          // Continue with user creation but log the issue
        }
      }

      // Return user without password hash
      const createdUser = await User.findById(newUser._id)
        .populate('tenant_id', 'name subdomain status')
        .select('-password_hash');

      res.status(201).json({
        success: true,
        data: createdUser,
        message: 'User created successfully',
        meta: {
          default_password: DEFAULT_PASSWORD,
          note: 'User should change password after first login'
        }
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      if (error.code === 11000) {
        // Duplicate key error
        res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating user',
        error: error.message
      });
    }
  }

  /**
   * Update user
   * PUT /api/super-admin/users/:id
   */
  static async updateUser(req: AuthRequest, res: Response): Promise<void> {
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
      const {
        first_name,
        last_name,
        email,
        phone,
        tenant_id,
        role,
        is_active
      } = req.body;

      // Check if user exists
      const existingUser = await User.findById(id);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Check if email is taken by another user
      if (email && email !== existingUser.email) {
        const emailExists = await User.findOne({ email, _id: { $ne: id } });
        if (emailExists) {
          res.status(400).json({
            success: false,
            message: 'Email is already taken by another user'
          });
          return;
        }
      }

      // Verify tenant if changed
      if (tenant_id && tenant_id !== existingUser.tenant_id.toString()) {
        const tenant = await Tenant.findOne({ _id: tenant_id, status: 'active' });
        if (!tenant) {
          res.status(400).json({
            success: false,
            message: 'Invalid or inactive tenant'
          });
          return;
        }
      }

      // Update user
      const updatedUser = await User.findByIdAndUpdate(
        id,
        {
          first_name,
          last_name,
          email: email?.toLowerCase(),
          phone,
          tenant_id: tenant_id ? new mongoose.Types.ObjectId(tenant_id) : existingUser.tenant_id,
          role,
          is_active,
          updated_at: new Date()
        },
        { new: true }
      )
        .populate('tenant_id', 'name subdomain status')
        .select('-password_hash');

      res.json({
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating user:', error);
      
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating user',
        error: error.message
      });
    }
  }

  /**
   * Delete user
   * DELETE /api/super-admin/users/:id
   */
  static async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Prevent self-deletion
      if (req.isSuperAdmin && req.superAdminId === id) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
        return;
      }

      // Delete associated UserClinic relationships
      await UserClinic.deleteMany({ user_id: id });

      // Delete the user
      await User.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'User deleted successfully',
        data: {
          deleted_user_id: id,
          deleted_user_email: user.email
        }
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting user',
        error: error.message
      });
    }
  }

  /**
   * Toggle user status (activate/deactivate)
   * PATCH /api/super-admin/users/:id/toggle-status
   */
  static async toggleUserStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Prevent self-deactivation
      if (req.isSuperAdmin && req.superAdminId === id && user.is_active) {
        res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
        return;
      }

      // Toggle status
      const updatedUser = await User.findByIdAndUpdate(
        id,
        { 
          is_active: !user.is_active,
          updated_at: new Date()
        },
        { new: true }
      )
        .populate('tenant_id', 'name subdomain status')
        .select('-password_hash');

      res.json({
        success: true,
        data: updatedUser,
        message: `User ${updatedUser!.is_active ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user status',
        error: error.message
      });
    }
  }

  /**
   * Reset user password to default
   * PATCH /api/super-admin/users/:id/reset-password
   */
  static async resetUserPassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Update password (plain password will be hashed by pre-save hook when saved)
      const userToUpdate = await User.findById(id);
      if (userToUpdate) {
        userToUpdate.password_hash = DEFAULT_PASSWORD; // Set plain password
        userToUpdate.updated_at = new Date();
        await userToUpdate.save(); // This will trigger the pre-save hook to hash the password
      }

      res.json({
        success: true,
        message: 'Password reset successfully',
        data: {
          user_email: user.email,
          new_password: DEFAULT_PASSWORD,
          note: 'User should change password after next login'
        }
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      res.status(500).json({
        success: false,
        message: 'Error resetting password',
        error: error.message
      });
    }
  }

  /**
   * Get user statistics
   * GET /api/super-admin/users/stats
   */
  static async getUserStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const totalUsers = await User.countDocuments({ 
        role: { $in: ['super_admin', 'admin'] } 
      });
      
      const activeUsers = await User.countDocuments({ 
        role: { $in: ['super_admin', 'admin'] }, 
        is_active: true 
      });
      
      const superAdminUsers = await User.countDocuments({ role: 'super_admin' });
      const adminUsers = await User.countDocuments({ role: 'admin' });

      // Recent users (created in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentUsers = await User.countDocuments({
        role: { $in: ['super_admin', 'admin'] },
        created_at: { $gte: thirtyDaysAgo }
      });

      const stats = {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        super_admin: superAdminUsers,
        admin: adminUsers,
        recent: recentUsers
      };

      res.json({
        success: true,
        data: stats,
        message: 'User statistics retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching statistics',
        error: error.message
      });
    }
  }
}
