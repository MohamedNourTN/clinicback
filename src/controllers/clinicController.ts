import { Response } from 'express';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Clinic, UserClinic, User, Role } from '../models';
import { AuthRequest } from '../types/express';
import { getClinicScopedFilter } from '../middleware/clinicContext';
import { getTenantScopedFilter, addTenantToData, canAccessTenant } from '../middleware/auth';
import { ensureTenantPermissions } from '../utils/tenantPermissionSeeder';

export class ClinicController {
  
  /**
   * Get all clinics for admin management (with tenant validation)
   * GET /api/clinics/all
   */
  static async getAllClinics(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check if user is super_admin - they can see ALL clinics
      const isSuperAdmin = req.user?.role === 'super_admin';
      
      let clinics;
      
      if (isSuperAdmin) {
        // Super admins can see all clinics across all tenants
        clinics = await Clinic.find({})
          .select('name code description address contact is_active tenant_id created_at updated_at')
          .sort({ name: 1 });
      } else {
        // Regular admins can only see clinics from their own tenant
        const clinicFilter = getTenantScopedFilter(req, {});
        clinics = await Clinic.find(clinicFilter)
          .select('name code description address contact is_active tenant_id created_at updated_at')
          .sort({ name: 1 });
      }

      res.json({
        success: true,
        data: {
          clinics: clinics
        },
        total: clinics.length,
        message: isSuperAdmin 
          ? `Retrieved ${clinics.length} clinics across all tenants (Super Admin access)`
          : `Retrieved ${clinics.length} clinics from your organization`
      });
    } catch (error: any) {
      console.error('Error fetching all clinics:', error);
      
      // Handle tenant validation errors
      if (error.message === 'Tenant context is required for this operation') {
        res.status(400).json({
          success: false,
          message: 'Tenant information is required',
          data: { clinics: [] },
          total: 0
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error fetching clinics',
        data: { clinics: [] },
        total: 0
      });
    }
  }

  /**
   * Get all clinics that the current user has access to
   * GET /api/clinics
   */
  static async getUserClinics(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check if user is super_admin - only they get access to ALL clinics
      const isSuperAdmin = req.user?.role === 'super_admin';
      
      if (isSuperAdmin) {
        // Return all active clinics for super_admin users
        const allClinics = await Clinic.find({ is_active: true })
          .select('name code description address contact settings is_active tenant_id created_at')
          .sort({ name: 1 });

        // Format to match UserClinic structure expected by frontend
        const formattedClinics = allClinics.map(clinic => ({
          clinic_id: clinic,
          role: 'super_admin',
          hasRelationship: true,
          joined_at: clinic.created_at,
          is_active: true
        }));

        res.json({
          success: true,
          data: formattedClinics,
          total: formattedClinics.length,
          message: `Retrieved ${formattedClinics.length} clinics across all tenants (Super Admin access)`
        });
        return;
      }

      // Regular users - only return clinics they have explicit relationships with (tenant-scoped)
      const userClinicFilter = getTenantScopedFilter(req, {
        user_id: req.user?._id,
        is_active: true
      });
      
      const userClinics = await UserClinic.find(userClinicFilter).populate({
        path: 'clinic_id',
        match: { is_active: true },
        select: 'name code description address contact settings is_active tenant_id created_at'
      }).sort({ joined_at: 1 });

      // Filter out clinics that are null (inactive)
      const activeClinics = userClinics.filter(uc => uc.clinic_id);

      res.json({
        success: true,
        data: activeClinics,
        total: activeClinics.length,
        message: `Retrieved ${activeClinics.length} clinics from your organization`
      });
    } catch (error: any) {
      console.error('Error fetching user clinics:', error);
      
      // Handle tenant validation errors
      if (error.message === 'Tenant context is required for this operation') {
        res.status(400).json({
          success: false,
          message: 'Tenant information is required',
          data: [],
          total: 0
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Error fetching clinics',
        data: [],
        total: 0
      });
    }
  }

  /**
   * Get current clinic details
   * GET /api/clinics/current
   */
  static async getCurrentClinic(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.clinic_id) {
        res.status(400).json({
          success: false,
          message: 'No clinic selected'
        });
        return;
      }

      const clinic = await Clinic.findById(req.clinic_id);
      if (!clinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic not found'
        });
        return;
      }

      res.json({
        success: true,
        data: clinic
      });
    } catch (error) {
      console.error('Error fetching current clinic:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching clinic details'
      });
    }
  }

  /**
   * Create a new clinic (any authenticated user)
   * POST /api/clinics
   */
  static async createClinic(req: AuthRequest, res: Response): Promise<void> {
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

      // Allow any authenticated user to create clinics
      // Ensure user is authenticated (should be handled by authenticate middleware)
      if (!req.user?._id) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Add tenant_id to clinic data from authenticated user
      const clinicData = addTenantToData(req, req.body);
      const clinic = new Clinic(clinicData);
      await clinic.save();

      try {
        // Ensure tenant has permissions and roles seeded
        console.log(`Ensuring permissions and roles exist for tenant: ${req.user?.tenant_id}`);
        await ensureTenantPermissions(req.user?.tenant_id.toString());

        // Automatically add the creator as admin of the new clinic
        const adminRole = await Role.findOne({ 
          tenant_id: req.user?.tenant_id,
          name: 'admin', 
          is_system_role: true 
        });
        
        if (adminRole) {
          // Create UserClinic relationship with tenant_id
          const userClinicData = addTenantToData(req, {
            user_id: req.user._id,
            clinic_id: clinic._id,
            roles: [{
              role_id: adminRole._id,
              assigned_at: new Date(),
              assigned_by: req.user._id,
              is_primary: true
            }],
            permission_overrides: [],
            is_active: true
          });
          
          const userClinic = new UserClinic(userClinicData);
          await userClinic.save();
          
          console.log(`Created UserClinic relationship for user ${req.user.email} as admin of clinic ${clinic.name}`);
        } else {
          console.error(`Admin role not found for tenant ${req.user?.tenant_id}. UserClinic relationship not created.`);
        }
      } catch (permissionError) {
        console.error(`Error setting up tenant permissions for clinic ${clinic.name}:`, permissionError);
        // Continue with clinic creation but log the issue
      }

      res.status(201).json({
        success: true,
        message: 'Clinic created successfully',
        data: clinic
      });
    } catch (error: any) {
      console.error('Error creating clinic:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Clinic code already exists'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error creating clinic'
        });
      }
    }
  }

  /**
   * Get clinic by ID
   * GET /api/clinics/:id
   */
  static async getClinicById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Verify user has access to this clinic
      const userClinic = await UserClinic.findOne({
        user_id: req.user?._id,
        clinic_id: id,
        is_active: true
      });

      if (!userClinic) {
        res.status(403).json({
          success: false,
          message: 'Access denied to this clinic'
        });
        return;
      }

      const clinic = await Clinic.findById(id);
      if (!clinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic not found'
        });
        return;
      }

      res.json({
        success: true,
        data: clinic
      });
    } catch (error) {
      console.error('Error fetching clinic:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching clinic'
      });
    }
  }

  /**
   * Update clinic
   * PUT /api/clinics/:id
   */
  static async updateClinic(req: AuthRequest, res: Response): Promise<void> {
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

      // Super Admin has unrestricted access - bypass clinic-specific checks
      if (req.user?.role === 'super_admin') {
        // Super Admin can update any clinic
      } else {
        // Verify user is admin of this clinic
        const userClinic = await UserClinic.findOne({
          user_id: req.user?._id,
          clinic_id: id,
          is_active: true
        }).populate('roles.role_id', 'name');

        let hasAdminAccess = false;
        if (userClinic) {
          const userRoles = userClinic.roles.map((role: any) => role.role_id?.name);
          hasAdminAccess = userRoles.includes('admin') || userRoles.includes('super_admin');
        }

        if (!hasAdminAccess) {
          res.status(403).json({
            success: false,
            message: 'Admin access required for this clinic'
          });
          return;
        }
      }

      const clinic = await Clinic.findByIdAndUpdate(
        id,
        { ...req.body, updated_at: new Date() },
        { new: true, runValidators: true }
      );

      if (!clinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Clinic updated successfully',
        data: clinic
      });
    } catch (error: any) {
      console.error('Error updating clinic:', error);
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Clinic code already exists'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error updating clinic'
        });
      }
    }
  }

  /**
   * Deactivate clinic (soft delete)
   * DELETE /api/clinics/:id
   */
  static async deactivateClinic(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Only super admin can deactivate clinics
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Only super administrators can deactivate clinics'
        });
        return;
      }

      const clinic = await Clinic.findByIdAndUpdate(
        id,
        { is_active: false, updated_at: new Date() },
        { new: true }
      );

      if (!clinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic not found'
        });
        return;
      }

      // Deactivate all user-clinic relationships
      await UserClinic.updateMany(
        { clinic_id: id },
        { is_active: false, updated_at: new Date() }
      );

      res.json({
        success: true,
        message: 'Clinic deactivated successfully'
      });
    } catch (error) {
      console.error('Error deactivating clinic:', error);
      res.status(500).json({
        success: false,
        message: 'Error deactivating clinic'
      });
    }
  }

  /**
   * Get clinic statistics
   * GET /api/clinics/:id/stats
   */
  static async getClinicStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Verify user has access to this clinic
      const userClinic = await UserClinic.findOne({
        user_id: req.user?._id,
        clinic_id: id,
        is_active: true
      });

      if (!userClinic) {
        res.status(403).json({
          success: false,
          message: 'Access denied to this clinic'
        });
        return;
      }

      // Get clinic users count
      const usersCount = await UserClinic.countDocuments({
        clinic_id: id,
        is_active: true
      });

      // Get users by role
      const usersByRole = await UserClinic.aggregate([
        { $match: { clinic_id: id, is_active: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);

      const clinic = await Clinic.findById(id);

      res.json({
        success: true,
        data: {
          clinic_info: {
            name: clinic?.name,
            code: clinic?.code,
            created_at: clinic?.created_at
          },
          users: {
            total: usersCount,
            by_role: usersByRole.reduce((acc, curr) => {
              acc[curr._id] = curr.count;
              return acc;
            }, {})
          }
        }
      });
    } catch (error) {
      console.error('Error fetching clinic stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching clinic statistics'
      });
    }
  }

  /**
   * Get clinic users
   * GET /api/clinics/:id/users
   */
  static async getClinicUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, role } = req.query;

      // Verify current user is either global admin or admin of this clinic
      const isGlobalAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      
      let hasPermission = isGlobalAdmin;
      
      if (!hasPermission) {
        const currentUserClinic = await UserClinic.findOne({
          user_id: req.user?._id,
          clinic_id: id,
          is_active: true
        }).populate('roles.role_id', 'name');
        
        if (currentUserClinic) {
          const userRoles = currentUserClinic.roles.map((role: any) => role.role_id?.name);
          hasPermission = userRoles.includes('admin') || userRoles.includes('super_admin');
        }
      }

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const filter: any = { clinic_id: id, is_active: true };
      if (role) {
        filter.role = role;
      }

      const users = await UserClinic.find(filter)
        .populate('user_id', 'first_name last_name email phone is_active created_at')
        .sort({ joined_at: 1 })
        .limit(Number(limit) * 1)
        .skip((Number(page) - 1) * Number(limit));

      const total = await UserClinic.countDocuments(filter);

      res.json({
        success: true,
        data: {
          users: users
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching clinic users:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching clinic users'
      });
    }
  }

  /**
   * Get user's clinic access for admin management
   * GET /api/clinics/user/:userId/access
   */
  static async getUserClinicAccess(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const userClinics = await UserClinic.find({
        user_id: userId,
        is_active: true
      }).populate({
        path: 'clinic_id',
        select: 'name code is_active'
      }).sort({ joined_at: 1 });

      const clinicsWithAccess = userClinics
        .filter(uc => uc.clinic_id)
        .map(uc => uc.clinic_id);

      res.json({
        success: true,
        data: {
          clinics: clinicsWithAccess
        },
        total: clinicsWithAccess.length
      });
    } catch (error) {
      console.error('Error fetching user clinic access:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user clinic access'
      });
    }
  }

  /**
   * Add user to clinic
   * POST /api/clinics/:id/users
   */
  static async addUserToClinic(req: AuthRequest, res: Response): Promise<void> {
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
      const { user_id, role, permissions } = req.body;

      // Verify current user is either global admin or admin of this clinic
      const isGlobalAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      
      let hasPermission = isGlobalAdmin;
      
      if (!hasPermission) {
        const currentUserClinic = await UserClinic.findOne({
          user_id: req.user?._id,
          clinic_id: id,
          is_active: true
        }).populate('roles.role_id', 'name');
        
        if (currentUserClinic) {
          const userRoles = currentUserClinic.roles.map((role: any) => role.role_id?.name);
          hasPermission = userRoles.includes('admin') || userRoles.includes('super_admin');
        }
      }

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      // Check if user exists
      const user = await User.findById(user_id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Check if user is already associated with this clinic
      const existingRelation = await UserClinic.findOne({
        user_id,
        clinic_id: id
      });

      if (existingRelation) {
        if (existingRelation.is_active) {
          res.status(400).json({
            success: false,
            message: 'User is already associated with this clinic'
          });
          return;
        } else {
          // Reactivate existing relationship with new role system and ensure tenant_id
          // Get the role object by name
          const roleObj = await Role.findOne({ name: role.toLowerCase() });
          if (roleObj && req.user) {
            await existingRelation.assignRole(roleObj._id, req.user._id, true);
          }
          
          // Ensure tenant_id is set if missing
          if (!existingRelation.tenant_id && req.tenant_id) {
            existingRelation.tenant_id = new mongoose.Types.ObjectId(req.tenant_id);
          }
          
          existingRelation.is_active = true;
          await existingRelation.save();

          res.json({
            success: true,
            message: 'User association reactivated',
            data: existingRelation
          });
          return;
        }
      }

      // Find the role by name
      const roleDoc = await Role.findOne({ name: role.toLowerCase(), is_system_role: true });
      
      if (!roleDoc) {
        res.status(400).json({
          success: false,
          message: `Role '${role}' not found`
        });
        return;
      }

      // Create new user-clinic relationship with proper role structure and tenant context
      const userClinicData = addTenantToData(req, {
        user_id,
        clinic_id: id,
        roles: [{
          role_id: roleDoc._id,
          assigned_at: new Date(),
          assigned_by: req.user!._id,
          is_primary: true
        }],
        permission_overrides: permissions ? permissions.map((perm: any) => ({
          permission_name: perm,
          granted: true,
          granted_at: new Date(),
          granted_by: req.user!._id
        })) : [],
        is_active: true
      });

      const userClinic = new UserClinic(userClinicData);

      await userClinic.save();

      res.status(201).json({
        success: true,
        message: 'User added to clinic successfully',
        data: userClinic
      });
    } catch (error: any) {
      console.error('Error adding user to clinic:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding user to clinic',
        error: error.message
      });
    }
  }

  /**
   * Update user role/permissions in clinic
   * PUT /api/clinics/:id/users/:userId
   */
  static async updateUserInClinic(req: AuthRequest, res: Response): Promise<void> {
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

      const { id, userId } = req.params;
      const { role, permissions } = req.body;

      // Verify current user is either global admin or admin of this clinic
      const isGlobalAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      
      let hasPermission = isGlobalAdmin;
      
      if (!hasPermission) {
        const currentUserClinic = await UserClinic.findOne({
          user_id: req.user?._id,
          clinic_id: id,
          is_active: true
        }).populate('roles.role_id', 'name');
        
        if (currentUserClinic) {
          const userRoles = currentUserClinic.roles.map((role: any) => role.role_id?.name);
          hasPermission = userRoles.includes('admin') || userRoles.includes('super_admin');
        }
      }

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const userClinic = await UserClinic.findOneAndUpdate(
        { user_id: userId, clinic_id: id, is_active: true },
        { role, permissions: permissions || [], updated_at: new Date() },
        { new: true }
      ).populate('user_id', 'first_name last_name email');

      if (!userClinic) {
        res.status(404).json({
          success: false,
          message: 'User not found in this clinic'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User updated successfully',
        data: userClinic
      });
    } catch (error) {
      console.error('Error updating user in clinic:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user'
      });
    }
  }

  /**
   * Remove user from clinic
   * DELETE /api/clinics/:id/users/:userId
   */
  static async removeUserFromClinic(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, userId } = req.params;

      // Verify current user is either global admin or admin of this clinic
      const isGlobalAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
      
      let hasPermission = isGlobalAdmin;
      
      if (!hasPermission) {
        const currentUserClinic = await UserClinic.findOne({
          user_id: req.user?._id,
          clinic_id: id,
          is_active: true
        }).populate('roles.role_id', 'name');
        
        if (currentUserClinic) {
          const userRoles = currentUserClinic.roles.map((role: any) => role.role_id?.name);
          hasPermission = userRoles.includes('admin') || userRoles.includes('super_admin');
        }
      }

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      // Prevent removing yourself as admin if you're the only admin
      if (userId === req.user?._id.toString()) {
        // Count admin users in this clinic using role system
        const adminUserClinics = await UserClinic.find({
          clinic_id: id,
          is_active: true
        }).populate('roles.role_id', 'name');

        let adminCount = 0;
        for (const uc of adminUserClinics) {
          const userRoles = uc.roles.map((role: any) => role.role_id?.name);
          if (userRoles.includes('admin') || userRoles.includes('super_admin')) {
            adminCount++;
          }
        }

        if (adminCount <= 1) {
          res.status(400).json({
            success: false,
            message: 'Cannot remove yourself as the only admin'
          });
          return;
        }
      }

      const userClinic = await UserClinic.findOneAndUpdate(
        { user_id: userId, clinic_id: id },
        { is_active: false, updated_at: new Date() },
        { new: true }
      );

      if (!userClinic) {
        res.status(404).json({
          success: false,
          message: 'User not found in this clinic'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User removed from clinic successfully'
      });
    } catch (error) {
      console.error('Error removing user from clinic:', error);
      res.status(500).json({
        success: false,
        message: 'Error removing user from clinic'
      });
    }
  }
} 