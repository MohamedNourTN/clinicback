import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import UserClinic from '../models/UserClinic';
import Role from '../models/Role';
import Permission from '../models/Permission';
import User from '../models/User';

// Use existing AuthRequest interface
import { AuthRequest } from '../types/express';

// Permission check options
export interface PermissionOptions {
  permissions?: string[]; // Required permissions
  roles?: string[]; // Required roles
  operator?: 'AND' | 'OR'; // How to combine permissions/roles
  requireClinicAccess?: boolean; // Whether clinic access is required
  adminBypass?: boolean; // Whether admin can bypass permission checks
  customCheck?: (req: AuthRequest) => Promise<boolean>; // Custom permission logic
}

// Default options
const defaultOptions: PermissionOptions = {
  permissions: [],
  roles: [],
  operator: 'OR',
  requireClinicAccess: true,
  adminBypass: true,
  customCheck: undefined
};

/**
 * Middleware to check if user has required permissions
 */
export const requirePermission = (options: PermissionOptions = {}) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const opts = { ...defaultOptions, ...options };
      
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error_code: 'AUTH_REQUIRED'
        });
      }

      // Check clinic access if required
      if (opts.requireClinicAccess) {
        const clinicId = req.headers['x-clinic-id'] || req.user.clinic_id;
        
        if (!clinicId) {
          return res.status(400).json({
            success: false,
            message: 'Clinic context required',
            error_code: 'CLINIC_REQUIRED'
          });
        }

        // Super admin bypass at clinic scope
        if (opts.adminBypass && (req.user.role === 'super_admin' || req.user.role === 'admin' || req.user.is_admin)) {
          return next();
        }

        // Get user-clinic relationship
        const userClinic = await UserClinic.findOne({
          user_id: req.user.id,
          clinic_id: clinicId.toString(),
          is_active: true
        })
        .populate('clinic_id user_id')
        .populate('roles.role_id', 'name display_name permissions');
        
        if (!userClinic || !userClinic.is_active) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this clinic',
            error_code: 'CLINIC_ACCESS_DENIED'
          });
        }

        // Attach user clinic info to request
        req.user.user_clinic = userClinic;
        req.clinic_id = clinicId.toString();
        
        // Get user's effective permissions
        const effectivePermissions = await userClinic.getEffectivePermissions();
        req.user.permissions = effectivePermissions;
        
        // Get user's roles
        await userClinic.populate('roles.role_id', 'name display_name');
        req.user.roles = userClinic.roles.map((role: any) => role.role_id.name);
        
        // Check if user is admin or super admin
        req.user.is_admin = req.user.roles.includes('admin') || req.user.roles.includes('super_admin');
      }

      // Admin bypass check
      if (opts.adminBypass && req.user.is_admin) {
        return next();
      }

      // Custom permission check
      if (opts.customCheck) {
        const customResult = await opts.customCheck(req);
        if (!customResult) {
          return res.status(403).json({
            success: false,
            message: 'Custom permission check failed',
            error_code: 'CUSTOM_PERMISSION_DENIED'
          });
        }
      }

      // Check permissions
      if (opts.permissions && opts.permissions.length > 0) {
        const hasPermissions = checkPermissions(req.user.permissions || [], opts.permissions, opts.operator || 'AND');
        
        if (!hasPermissions) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions',
            error_code: 'PERMISSION_DENIED',
            required_permissions: opts.permissions,
            user_permissions: req.user.permissions
          });
        }
      }

      // Check roles
      if (opts.roles && opts.roles.length > 0) {
        const hasRoles = checkRoles(req.user.roles || [], opts.roles, opts.operator || 'AND');
        
        if (!hasRoles) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient role privileges',
            error_code: 'ROLE_DENIED',
            required_roles: opts.roles,
            user_roles: req.user.roles
          });
        }
      }

      // Log successful permission check
      logPermissionCheck(req, true, opts);
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during permission check',
        error_code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware specifically for admin-only routes (includes Super Admin)
 */
export const requireAdmin = () => {
  return requirePermission({
    roles: ['super_admin', 'admin'],
    adminBypass: false // Don't bypass since we're checking for admin specifically
  });
};

/**
 * Middleware to require specific role
 */
export const requireRole = (roleName: string) => {
  return requirePermission({
    roles: [roleName]
  });
};

/**
 * Middleware to require any of the specified roles
 */
export const requireAnyRole = (roleNames: string[]) => {
  return requirePermission({
    roles: roleNames,
    operator: 'OR'
  });
};

/**
 * Middleware to require all specified roles
 */
export const requireAllRoles = (roleNames: string[]) => {
  return requirePermission({
    roles: roleNames,
    operator: 'AND'
  });
};

/**
 * Middleware to require specific permission
 */
export const requirePermissions = (...permissionNames: string[]) => {
  return requirePermission({
    permissions: permissionNames,
    operator: 'OR'
  });
};

/**
 * Middleware to require all specified permissions
 */
export const requireAllPermissions = (...permissionNames: string[]) => {
  return requirePermission({
    permissions: permissionNames,
    operator: 'AND'
  });
};

/**
 * Middleware for routes that don't require clinic context
 */
export const withoutClinicContext = (options: Omit<PermissionOptions, 'requireClinicAccess'> = {}) => {
  return requirePermission({
    ...options,
    requireClinicAccess: false
  });
};

/**
 * Check if user has required permissions
 */
function checkPermissions(userPermissions: string[], requiredPermissions: string[], operator: 'AND' | 'OR'): boolean {
  if (requiredPermissions.length === 0) return true;
  
  if (operator === 'AND') {
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  } else {
    return requiredPermissions.some(permission => userPermissions.includes(permission));
  }
}

/**
 * Check if user has required roles
 */
function checkRoles(userRoles: string[], requiredRoles: string[], operator: 'AND' | 'OR'): boolean {
  if (requiredRoles.length === 0) return true;
  
  if (operator === 'AND') {
    return requiredRoles.every(role => userRoles.includes(role));
  } else {
    return requiredRoles.some(role => userRoles.includes(role));
  }
}

/**
 * Log permission check for audit purposes
 */
function logPermissionCheck(req: AuthRequest, success: boolean, options: PermissionOptions) {
  const logData = {
    user_id: req.user?.id,
    clinic_id: req.user?.clinic_id,
    endpoint: `${req.method} ${req.originalUrl}`,
    ip_address: req.ip || req.socket.remoteAddress,
    user_agent: req.get('User-Agent'),
    required_permissions: options.permissions,
    required_roles: options.roles,
    user_permissions: req.user?.permissions,
    user_roles: req.user?.roles,
    success,
    timestamp: new Date(),
    operator: options.operator
  };

  // In a production environment, you might want to store this in a dedicated audit log
  console.log('Permission Check:', JSON.stringify(logData, null, 2));
}

/**
 * Utility function to check if user has specific permission
 */
export const hasPermission = async (userId: string, clinicId: string, permissionName: string): Promise<boolean> => {
  try {
    // First check if user is Super Admin - they have unrestricted access
    const user = await User.findById(userId);
    if (user && user.role === 'super_admin') {
      return true;
    }

    const userClinic = await UserClinic.findOne({
      user_id: userId,
      clinic_id: clinicId,
      is_active: true
    })
    .populate('clinic_id user_id')
    .populate('roles.role_id', 'name display_name permissions');
    if (!userClinic || !userClinic.is_active) {
      return false;
    }

    return await userClinic.hasPermission(permissionName);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

/**
 * Utility function to check if user has specific role
 */
export const hasRole = async (userId: string, clinicId: string, roleName: string): Promise<boolean> => {
  try {
    // First check if user is Super Admin - they have unrestricted access to all roles
    const user = await User.findById(userId);
    if (user && user.role === 'super_admin') {
      return true;
    }

    const userClinic = await UserClinic.findOne({
      user_id: userId,
      clinic_id: clinicId,
      is_active: true
    })
    .populate('clinic_id user_id')
    .populate('roles.role_id', 'name display_name permissions');
    if (!userClinic || !userClinic.is_active) {
      return false;
    }

    await userClinic.populate('roles.role_id', 'name');
    const userRoles = userClinic.roles.map((role: any) => role.role_id.name);
    return userRoles.includes(roleName);
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
};

/**
 * Utility function to get user's effective permissions
 */
export const getUserPermissions = async (userId: string, clinicId: string): Promise<string[]> => {
  try {
    // First check if user is Super Admin - they have all permissions
    const user = await User.findById(userId);
    if (user && user.role === 'super_admin') {
      // Return all possible permissions for Super Admin
      const allPermissions = await Permission.find({}, 'name');
      return allPermissions.map((p: any) => p.name);
    }

    const userClinic = await UserClinic.findOne({
      user_id: userId,
      clinic_id: clinicId,
      is_active: true
    })
    .populate('clinic_id user_id')
    .populate('roles.role_id', 'name display_name permissions');
    if (!userClinic || !userClinic.is_active) {
      return [];
    }

    return await userClinic.getEffectivePermissions();
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
};

/**
 * Common permission combinations for easy use
 */
export const commonPermissions = {
  // Patient management
  viewPatients: () => requirePermissions('patients.view'),
  managePatients: () => requirePermissions('patients.create', 'patients.edit'),
  fullPatientAccess: () => requireAllPermissions('patients.view', 'patients.create', 'patients.edit', 'patients.delete'),

  // Appointment management
  viewAppointments: () => requirePermissions('appointments.view'),
  manageAppointments: () => requirePermissions('appointments.create', 'appointments.edit'),
  fullAppointmentAccess: () => requireAllPermissions('appointments.view', 'appointments.create', 'appointments.edit', 'appointments.delete'),

  // Financial management
  viewFinancials: () => requirePermissions('invoices.view', 'payments.view'),
  manageFinancials: () => requirePermissions('invoices.create', 'invoices.edit', 'payments.process'),
  fullFinancialAccess: () => requireRole('super_admin') || requireRole('admin') || requireRole('accountant'),

  // Admin only
  systemSettings: () => requireAdmin(),
  userManagement: () => requirePermissions('users.create', 'users.edit'),
  permissionManagement: () => requirePermissions('permissions.manage_permissions'),

  // Role-based shortcuts
  doctorAccess: () => requireRole('doctor'),
  nurseAccess: () => requireRole('nurse'),
  receptionistAccess: () => requireRole('receptionist'),
  accountantAccess: () => requireRole('accountant'),

  // Multi-role access
  medicalStaff: () => requireAnyRole(['doctor', 'nurse']),
  adminStaff: () => requireAnyRole(['super_admin', 'admin', 'accountant']),
  frontDesk: () => requireAnyRole(['super_admin', 'admin', 'receptionist'])
};

export default requirePermission;
