import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserClinic, Clinic, Role } from '../models';
import { AuthRequest } from '../types/express';
import { getTenantScopedFilter, canAccessTenant } from '../middleware/auth';
import { ensureTenantPermissions } from '../utils/tenantPermissionSeeder';

export class UserClinicController {
  
  /**
   * Get current user's clinics (only clinics with access)
   * GET /api/user/clinics
   */
  static async getUserClinics(req: AuthRequest, res: Response): Promise<void> {
    try {
      // If user is not authenticated, return empty array
      if (!req.user?._id) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          data: [],
          total: 0
        });
        return;
      }

      // Check if user is super_admin and explicitly wants global access
      const isSuperAdmin = req.user?.role === 'super_admin';
      const wantsGlobalAccess = req.query.global === 'true' && isSuperAdmin;
      
      // Get user's existing clinic relationships first
      const userClinicFilter: any = { user_id: req.user._id, is_active: true };
      if (!wantsGlobalAccess && req.tenant_id) {
        // Add tenant filter for all users (unless super admin wants global access)
        userClinicFilter.tenant_id = req.tenant_id;
      }
      
      const userClinics = await UserClinic.find(userClinicFilter)
        .populate({
          path: 'clinic_id',
          match: { is_active: true }, // Only populate active clinics
          select: 'name code description address contact settings is_active tenant_id created_at'
        })
        .sort({ joined_at: 1 });

      // Filter out entries where clinic_id is null (inactive clinics)
      const validUserClinics = userClinics.filter(uc => uc.clinic_id !== null);

      // If super admin wants global access, get additional clinics they don't have relationships with
      if (wantsGlobalAccess) {
        const existingClinicIds = validUserClinics.map(uc => uc.clinic_id._id.toString());
        
        // Find additional active clinics not in user's relationships
        const additionalClinics = await Clinic.find({
          _id: { $nin: existingClinicIds },
          is_active: true
        })
          .select('name code description address contact settings is_active tenant_id created_at')
          .sort({ name: 1 });

        // Add these as super admin relationships
        additionalClinics.forEach(clinic => {
          validUserClinics.push({
            _id: null,
            user_id: req.user!._id,
            clinic_id: clinic,
            synthetic_role: 'super_admin', // Use different property name
            synthetic_permissions: [],
            is_active: true,
            joined_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
            hasRelationship: true,
            tenant_info: {
              tenant_id: clinic.tenant_id,
              user_tenant_id: req.tenant_id
            }
          } as any);
        });
      }

      // Build response data from actual relationships only
      const clinicsData = await Promise.all(
        validUserClinics.map(async (userClinic) => {
          // Get primary role and effective permissions for proper UserClinic documents
          let role = 'staff';
          let permissions: string[] = [];
          
          if ((userClinic as any).synthetic_role) {
            // This is a synthetic super admin entry
            role = (userClinic as any).synthetic_role;
            permissions = (userClinic as any).synthetic_permissions || [];
          } else if (userClinic.getPrimaryRole && userClinic.getEffectivePermissions) {
            // This is a proper UserClinic document
            const primaryRole = await userClinic.getPrimaryRole();
            role = primaryRole?.name || 'staff';
            permissions = await userClinic.getEffectivePermissions();
          }
          
          return {
            _id: userClinic._id,
            user_id: userClinic.user_id,
            clinic_id: userClinic.clinic_id,
            role: role,
            permissions: permissions,
            is_active: userClinic.is_active,
            joined_at: userClinic.joined_at,
            created_at: userClinic.created_at,
            updated_at: userClinic.updated_at,
            hasRelationship: true, // All returned clinics have relationships
            // Include tenant info for debugging (super admin with global access only)
            tenant_info: wantsGlobalAccess ? {
              tenant_id: (userClinic.clinic_id as any).tenant_id,
              user_tenant_id: req.tenant_id
            } : undefined
          };
        })
      );

      res.json({
        success: true,
        data: clinicsData,
        total: clinicsData.length,
        message: wantsGlobalAccess 
          ? `Retrieved ${clinicsData.length} accessible clinics across all tenants (Super Admin global access)`
          : `Retrieved ${clinicsData.length} accessible clinics from your organization`
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
   * DEVELOPMENT ONLY: Assign current user to all clinics (within their tenant)
   * POST /api/user/assign-to-all-clinics
   */
  static async assignUserToAllClinics(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check if user is super_admin - they can access ALL clinics
      const isSuperAdmin = req.user?.role === 'super_admin';
      let clinics;
      
      if (isSuperAdmin) {
        // Super admins can be assigned to all clinics across all tenants
        clinics = await Clinic.find({ is_active: true });
      } else {
        // Regular users can only be assigned to clinics from their own tenant
        const clinicFilter = getTenantScopedFilter(req, { is_active: true });
        clinics = await Clinic.find(clinicFilter);
      }
      
      if (clinics.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No active clinics found'
        });
        return;
      }

      const userClinicRecords: any[] = [];
      
      for (const clinic of clinics) {
        // Check if user-clinic relationship already exists
        const existingRelation = await UserClinic.findOne({
          user_id: req.user?._id,
          clinic_id: clinic._id
        });

        if (!existingRelation) {
          // Get admin role from new role system
          const adminRole = await Role.findOne({ name: 'admin', is_system_role: true });
          if (!adminRole) {
            console.error('Admin role not found in role system');
            continue; // Skip this clinic if role system is not set up
          }

          // Create new user-clinic relationship with proper tenant_id
          const userClinic = new UserClinic({
            tenant_id: clinic.tenant_id, // Include tenant_id from clinic
            user_id: req.user?._id,
            clinic_id: clinic._id,
            roles: [{
              role_id: adminRole._id,
              assigned_at: new Date(),
              assigned_by: req.user!._id, // Self-assigned for development
              is_primary: true
            }],
            permission_overrides: [], // No overrides for development assignment
            is_active: true
          });

          await userClinic.save();
          userClinicRecords.push(userClinic);
        } else {
          // Reactivate if it exists but is inactive
          if (!existingRelation.is_active) {
            existingRelation.is_active = true;
            await existingRelation.save();
            userClinicRecords.push(existingRelation);
          }
        }
      }

      res.json({
        success: true,
        message: `User assigned to ${userClinicRecords.length} clinics`,
        data: {
          assignedClinics: userClinicRecords.length,
          totalClinics: clinics.length
        }
      });
    } catch (error) {
      console.error('Error assigning user to clinics:', error);
      res.status(500).json({
        success: false,
        message: 'Error assigning user to clinics'
      });
    }
  }

  /**
   * Select a clinic and update the session
   */
  static async selectClinic(req: AuthRequest, res: Response): Promise<void> {
    try {
      // setLoading(true);
      // clearError();

      const { clinic_id } = req.body;

      if (!clinic_id) {
        res.status(400).json({
          success: false,
          message: 'Clinic ID is required'
        });
        return;
      }

      // Verify clinic exists and is active (with tenant validation)
      const isSuperAdmin = req.user?.role === 'super_admin';
      let clinicFilter: any = { _id: clinic_id, is_active: true };
      
      if (!isSuperAdmin) {
        // Regular users can only select clinics from their own tenant
        clinicFilter = getTenantScopedFilter(req, clinicFilter);
      }
      
      const clinic = await Clinic.findOne(clinicFilter);

      if (!clinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic not found or inactive'
        });
        return;
      }

      // Check if user has existing relationship with this clinic
      let userClinic = await UserClinic.findOne({
        user_id: req.user?._id,
        clinic_id: clinic_id,
        is_active: true
      }).populate('clinic_id', 'name code description is_active');

      // If no relationship exists, create one automatically with new role system
      if (!userClinic) {
        try {
          // Ensure tenant has permissions and roles seeded
          if (!req.tenant_id) {
            throw new Error('Tenant ID is required');
          }
          console.log(`Ensuring permissions and roles exist for tenant: ${req.tenant_id}`);
          await ensureTenantPermissions(req.tenant_id.toString());

          // Determine role to assign (admin bypass)
          const desiredRoleName = (req.user?.role === 'super_admin' || req.user?.role === 'admin') ? 'admin' : (req.user?.role || 'staff');
          const roleDoc = await Role.findOne({ 
            tenant_id: req.tenant_id,
            name: desiredRoleName.toLowerCase(), 
            is_system_role: true 
          });
          
          userClinic = new UserClinic({
            tenant_id: req.tenant_id,
            user_id: req.user?._id,
            clinic_id: clinic_id,
            roles: roleDoc ? [{
              role_id: roleDoc._id,
              assigned_at: new Date(),
              assigned_by: req.user!._id,
              is_primary: true
            }] : [],
            permission_overrides: [],
            is_active: true
          } as any);

          // If for some reason roleDoc is missing, we still need to satisfy validation
          if (!roleDoc) {
            const fallbackRole = await Role.findOne({ 
              tenant_id: req.tenant_id,
              name: 'staff', 
              is_system_role: true 
            });
            if (fallbackRole) {
              (userClinic as any).roles = [{
                role_id: fallbackRole._id,
                assigned_at: new Date(),
                assigned_by: req.user!._id,
                is_primary: true
              }];
            }
          }

          await userClinic.save();
          await userClinic.populate('clinic_id', 'name code description is_active');
        } catch (permissionError) {
          console.error(`Error setting up tenant permissions for user clinic selection:`, permissionError);
          res.status(500).json({
            success: false,
            message: 'Failed to setup clinic access permissions. Please contact system administrator.'
          });
          return;
        }
      } else {
        // Relationship exists. Ensure it conforms to new role system and has a primary role
        try {
          const hasRoles = Array.isArray((userClinic as any).roles) && (userClinic as any).roles.length > 0;
          if (!hasRoles) {
            const desiredRoleName = (req.user?.role === 'super_admin' || req.user?.role === 'admin') ? 'admin' : (req.user?.role || 'staff');
            const roleDoc = await Role.findOne({ 
              tenant_id: req.tenant_id,
              name: desiredRoleName.toLowerCase(), 
              is_system_role: true 
            });
            if (roleDoc && (userClinic as any).assignRole) {
              await (userClinic as any).assignRole(roleDoc._id, req.user!._id, true);
            } else if (roleDoc) {
              (userClinic as any).roles = [{
                role_id: roleDoc._id,
                assigned_at: new Date(),
                assigned_by: req.user!._id,
                is_primary: true
              }];
              await userClinic.save();
            } else {
              const fallbackRole = await Role.findOne({ name: 'staff', is_system_role: true });
              if (fallbackRole) {
                (userClinic as any).roles = [{
                  role_id: fallbackRole._id,
                  assigned_at: new Date(),
                  assigned_by: req.user!._id,
                  is_primary: true
                }];
                await userClinic.save();
              }
            }
          }
        } catch {}
      }

      // Get primary role name for JWT
      const primaryRole = await userClinic.getPrimaryRole();
      
      // Generate new JWT token with clinic and tenant context
      const tokenPayload = {
        id: req.user?._id,
        email: req.user?.email,
        role: req.user?.role,
        tenant_id: clinic.tenant_id?.toString(), // Add tenant_id from selected clinic
        clinic_id: clinic_id,
        clinic_role: primaryRole?.name || 'staff'
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Get effective permissions
      const effectivePermissions = await userClinic.getEffectivePermissions();
      
      res.json({
        success: true,
        message: 'Clinic selected successfully',
        data: {
          token,
          clinic: userClinic.clinic_id,
          role: primaryRole?.name || 'staff',
          permissions: effectivePermissions
        }
      });
    } catch (error) {
      console.error('Error selecting clinic:', error);
      res.status(500).json({
        success: false,
        message: 'Error selecting clinic'
      });
    }
  };

  /**
   * Get current selected clinic
   * GET /api/user/current-clinic
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

      const userClinic = await UserClinic.findOne({
        user_id: req.user?._id,
        clinic_id: req.clinic_id,
        is_active: true
      }).populate('clinic_id', 'name code description address contact settings');

      if (!userClinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic access not found'
        });
        return;
      }

      // Get primary role and effective permissions
      const primaryRole = await userClinic.getPrimaryRole();
      const effectivePermissions = await userClinic.getEffectivePermissions();
      
      res.json({
        success: true,
        data: {
          clinic: userClinic.clinic_id,
          role: primaryRole?.name || 'staff',
          permissions: effectivePermissions,
          joined_at: userClinic.joined_at
        }
      });
    } catch (error) {
      console.error('Error fetching current clinic:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching current clinic'
      });
    }
  }

  /**
   * Switch clinic (same as select but with different semantics)
   * POST /api/user/switch-clinic
   */
  static async switchClinic(req: AuthRequest, res: Response): Promise<void> {
    // Use the same logic as selectClinic
    await UserClinicController.selectClinic(req, res);
  }

  /**
   * Clear clinic selection (return to clinic selection state)
   * POST /api/user/clear-clinic
   */
  static async clearClinicSelection(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Generate new JWT token without clinic context (but keep tenant context)
      const tokenPayload = {
        id: req.user?._id,
        email: req.user?.email,
        role: req.user?.role,
        tenant_id: req.tenant_id // Keep tenant_id for continued tenant validation
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Clinic selection cleared',
        data: {
          token
        }
      });
    } catch (error) {
      console.error('Error clearing clinic selection:', error);
      res.status(500).json({
        success: false,
        message: 'Error clearing clinic selection'
      });
    }
  }

  /**
   * Get user's role and permissions in current clinic
   * GET /api/user/clinic-permissions
   */
  static async getClinicPermissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.clinic_id) {
        res.status(400).json({
          success: false,
          message: 'No clinic selected'
        });
        return;
      }

      const userClinic = await UserClinic.findOne({
        user_id: req.user?._id,
        clinic_id: req.clinic_id,
        is_active: true
      }).select('role permissions joined_at');

      if (!userClinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic access not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          clinic_id: req.clinic_id,
          role: (await userClinic.getPrimaryRole())?.name || 'staff',
          permissions: await userClinic.getEffectivePermissions(),
          joined_at: userClinic.joined_at
        }
      });
    } catch (error) {
      console.error('Error fetching clinic permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching clinic permissions'
      });
    }
  }

  /**
   * Update user's own profile within current clinic context
   * PUT /api/user/clinic-profile
   */
  static async updateClinicProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.clinic_id) {
        res.status(400).json({
          success: false,
          message: 'No clinic selected'
        });
        return;
      }

      const { bio, specialization, department } = req.body;

      // Only allow updating specific clinic-related fields
      const allowedUpdates: any = {};
      if (bio !== undefined) allowedUpdates.bio = bio;
      if (specialization !== undefined) allowedUpdates.specialization = specialization;
      if (department !== undefined) allowedUpdates.department = department;

      const updatedUser = await req.user?.updateOne(allowedUpdates, { new: true });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          bio: req.user?.bio,
          specialization: req.user?.specialization,
          department: req.user?.department
        }
      });
    } catch (error) {
      console.error('Error updating clinic profile:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating profile'
      });
    }
  }

  /**
   * Get user's clinic activity/stats
   * GET /api/user/clinic-activity
   */
  static async getClinicActivity(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.clinic_id) {
        res.status(400).json({
          success: false,
          message: 'No clinic selected'
        });
        return;
      }

      const userClinic = await UserClinic.findOne({
        user_id: req.user?._id,
        clinic_id: req.clinic_id,
        is_active: true
      }).select('role permissions joined_at');

      if (!userClinic) {
        res.status(404).json({
          success: false,
          message: 'Clinic access not found'
        });
        return;
      }

      // Calculate days since joining
      const daysSinceJoining = Math.floor(
        (new Date().getTime() - new Date(userClinic.joined_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      // You can expand this with more activity metrics
      const effectivePermissions = await userClinic.getEffectivePermissions();
      const primaryRole = await userClinic.getPrimaryRole();
      
      const activity = {
        joined_at: userClinic.joined_at,
        days_since_joining: daysSinceJoining,
        role: primaryRole?.name || 'staff',
        permissions_count: effectivePermissions.length,
        clinic_id: req.clinic_id
      };

      res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      console.error('Error fetching clinic activity:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching clinic activity'
      });
    }
  }
} 