import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { AuthRequest } from '../types/express';
import { SubscriptionService } from '../services/subscriptionService';

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  tenant_id?: string; // Tenant ID for multi-tenancy
  clinic_id?: string; // Optional, added after clinic selection
  clinic_role?: string; // User's role in the selected clinic
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JWTPayload;
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
      return;
    }

    // Add user to request
    req.user = user as any;

    // Add tenant context from JWT or user record
    // Priority: JWT tenant_id > User tenant_id
    req.tenant_id = decoded.tenant_id || user.tenant_id?.toString();
    
    // Add clinic context from JWT if present
    if (decoded.clinic_id) {
      req.clinic_id = decoded.clinic_id;
      // Note: Full clinic context validation will be done by clinicContext middleware if needed
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

export const authorize = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
      return;
    }

    // Super Admin has unrestricted access - bypass all role checks
    if (req.user.role === 'super_admin') {
      next();
      return;
    }

    // For tenant-based system, check clinic-specific roles
    const clinicId = (req.headers['x-clinic-id'] as string) || req.clinic_id;
    
    if (clinicId) {
      try {
        // Check tenant-based roles through UserClinic
        const { UserClinic } = require('../models');
        const userClinic = await UserClinic.findOne({
          user_id: req.user.id,
          clinic_id: clinicId,
          is_active: true
        }).populate('roles.role_id', 'name display_name');
        
        if (userClinic) {
          // Get user's clinic-specific roles
          const userRoles = userClinic.roles.map((role: any) => role.role_id.name);
          console.log('🔍 User clinic roles:', userRoles, 'Required roles:', roles);
          
          // Check if user has any of the required roles in this clinic
          const hasRequiredRole = roles.some(role => userRoles.includes(role));
          
          if (hasRequiredRole) {
            next();
            return;
          }
        }
      } catch (error) {
        console.error('Error checking tenant-based roles:', error);
        // Fall back to global role check
      }
    }
    
    // Fallback: Check global role (for backwards compatibility)
    if (!roles.includes(req.user.role)) {
      console.log('❌ Authorization failed. User role:', req.user.role, 'Required roles:', roles);
      res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
      return;
    }

    next();
  };
};

/**
 * Role-based data filtering implementation
 * 
 * This function applies appropriate filters based on user roles:
 * - Admin: Can see all data (no additional filters)
 * - Doctor: Can only see data assigned to them (appointments/prescriptions they created)
 * - Other roles: Can see all data (configurable based on requirements)
 * 
 * @param req AuthRequest containing user information
 * @param filter Existing filter object to be enhanced
 * @returns Enhanced filter object with role-based restrictions
 */
export const applyRoleBasedFilter = (req: AuthRequest, filter: any = {}) => {
  if (!req.user) {
    return filter;
  }

  // Super Admin and Admin can see all data
  if (req.user.role === 'super_admin' || req.user.role === 'admin') {
    return filter;
  }

  // Doctors can only see their assigned data
  if (req.user.role === 'doctor') {
    filter.doctor_id = req.user._id;
    return filter;
  }

  // Other roles (nurse, receptionist, etc.) can see all data for now
  // You can modify this based on your specific requirements
  return filter;
};

/**
 * Helper function to get role-based query filter
 * 
 * This function generates appropriate filters for different entity types:
 * - For appointments/prescriptions: Doctors can only see their own, Nurses can only see their assigned
 * - For patients: Doctors can only see patients they have appointments/prescriptions with, Nurses can only see patients they're assigned to
 * 
 * @param user User object containing role and ID
 * @param entityType Type of entity being queried
 * @returns Filter object with role-based restrictions
 */
export const getRoleBasedFilter = (user: any, entityType: 'appointment' | 'prescription' | 'patient' | 'odontogram' = 'appointment') => {
  const filter: any = {};

  // Super Admin, Admin, receptionist, and staff can see all data
  if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'receptionist' || user.role === 'staff') {
    return filter;
  }

  // Doctors can only see their assigned data
  if (user.role === 'doctor') {
    if (entityType === 'appointment' || entityType === 'prescription' || entityType === 'odontogram') {
      filter.doctor_id = user._id;
    } else if (entityType === 'patient') {
      // For patients, doctors can only see patients they have appointments/prescriptions with
      // This will be handled in the controller with a more complex query
      filter._requiresDoctorPatientFilter = true;
      filter._doctorId = user._id;
    }
    return filter;
  }

  // Nurses can only see their assigned data
  if (user.role === 'nurse') {
    if (entityType === 'appointment') {
      filter.nurse_id = user._id;
    } else if (entityType === 'patient') {
      // For patients, nurses can only see patients they have appointments with (as assigned nurse)
      // This will be handled in the controller with a more complex query
      filter._requiresNursePatientFilter = true;
      filter._nurseId = user._id;
    } else if (entityType === 'prescription') {
      // Nurses can see prescriptions for patients they're assigned to
      filter._requiresNursePrescriptionFilter = true;
      filter._nurseId = user._id;
    }
    return filter;
  }

  // Other roles can see all data for now
  // You can customize this based on your requirements
  return filter;
};

/**
 * Tenant validation helper functions for multi-tenancy
 */

/**
 * Get tenant-scoped filter for database queries
 * @param req AuthRequest containing tenant context
 * @param additionalFilter Optional additional filters
 * @returns Filter object with tenant_id validation
 */
export const getTenantScopedFilter = (req: AuthRequest, additionalFilter: any = {}) => {
  // Super Admin can access all tenants - no tenant filtering
  if (req.user?.role === 'super_admin') {
    return additionalFilter;
  }

  // For all other users, enforce tenant_id filtering
  if (!req.tenant_id) {
    throw new Error('Tenant context is required for this operation');
  }

  return {
    ...additionalFilter,
    tenant_id: req.tenant_id
  };
};

/**
 * Validate that user can access data from a specific tenant
 * @param req AuthRequest containing user and tenant context
 * @param targetTenantId The tenant_id of the data being accessed
 * @returns boolean indicating if access is allowed
 */
export const canAccessTenant = (req: AuthRequest, targetTenantId: string): boolean => {
  // Super Admin can access any tenant
  if (req.user?.role === 'super_admin') {
    return true;
  }

  // Check if user's tenant matches target tenant
  return req.tenant_id === targetTenantId;
};

/**
 * Middleware to validate tenant access for specific resource
 * @param getResourceTenantId Function to extract tenant_id from resource
 */
export const validateTenantAccess = (getResourceTenantId: (req: AuthRequest) => Promise<string>) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Super Admin bypass
      if (req.user?.role === 'super_admin') {
        next();
        return;
      }

      const resourceTenantId = await getResourceTenantId(req);
      
      if (!canAccessTenant(req, resourceTenantId)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only access data from your organization.'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error validating tenant access'
      });
    }
  };
};

/**
 * Add tenant_id to data for creation operations
 * @param req AuthRequest containing tenant context
 * @param data Data object to enhance with tenant_id
 * @returns Enhanced data object with tenant_id
 */
export const addTenantToData = (req: AuthRequest, data: any) => {
  // Super Admin operations might not have tenant context
  if (req.user?.role === 'super_admin' && !req.tenant_id) {
    return data;
  }

  if (!req.tenant_id) {
    throw new Error('Tenant context is required for this operation');
  }

  return {
    ...data,
    tenant_id: req.tenant_id
  };
};

// Combined middleware functions that include authentication
export const requireAdmin = [authenticate, authorize('super_admin', 'admin')];
export const requireDoctor = [authenticate, authorize('super_admin', 'admin', 'doctor')];
export const requireMedicalStaffOnly = [authenticate, authorize('super_admin', 'admin', 'doctor', 'nurse')]; // Medical staff only - no receptionist
export const requireMedicalStaff = [authenticate, authorize('super_admin', 'admin', 'doctor', 'nurse', 'receptionist')]; // Medical staff + receptionist for appointments/scheduling
export const requireStaff = [authenticate, authorize('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'staff')];
export const requireAnalyticsAccess = [authenticate, authorize('super_admin', 'admin', 'accountant')];
export const requireAllRoles = [authenticate, authorize('super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'staff')]; 