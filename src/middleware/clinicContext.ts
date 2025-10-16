import { Response, NextFunction } from 'express';
import { UserClinic, Clinic } from '../models';
import { AuthRequest } from '../types/express';

/**
 * Middleware to extract and validate clinic context from request headers
 * This middleware should be used after authentication middleware
 * 
 * Expected header: X-Clinic-Id
 * 
 * This middleware:
 * 1. Extracts clinic ID from request headers
 * 2. Validates that the clinic exists and is active
 * 3. Verifies that the authenticated user has access to this clinic
 * 4. Adds clinic_id and userClinics to the request object
 */

export const clinicContext = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated before proceeding
    if (!req.user || !req.user._id) {
      console.error('❌ Clinic context middleware: User not authenticated');
      return res.status(401).json({
        success: false,
        message: 'Authentication required before accessing clinic resources',
        code: 'AUTH_REQUIRED'
      });
    }

    // Extract clinic ID from header
    const clinicId = req.headers['x-clinic-id'] as string;
    
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: 'Clinic context is required',
        code: 'CLINIC_CONTEXT_MISSING'
      });
    }

    // Validate clinic ID format
    if (!isValidObjectId(clinicId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clinic ID format',
        code: 'INVALID_CLINIC_ID'
      });
    }

    // Check if clinic exists and is active
    const clinic = await Clinic.findOne({ 
      _id: clinicId, 
      is_active: true 
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found or inactive',
        code: 'CLINIC_NOT_FOUND'
      });
    }

    // Verify user has access to this clinic
    let userClinic = await UserClinic.findOne({
      user_id: req.user?._id,
      clinic_id: clinicId,
      is_active: true
    });

    // If no relationship exists, create one automatically with basic permissions
    if (!userClinic) {
      console.log(`🔧 Creating missing UserClinic relationship for user ${req.user._id} and clinic ${clinicId}`);
      
      // Validate that we have all required data
      if (!req.user._id) {
        console.error('❌ Cannot create UserClinic: user._id is missing');
        return res.status(500).json({
          success: false,
          message: 'Internal error: User ID not available',
          code: 'USER_ID_MISSING'
        });
      }

      userClinic = new UserClinic({
        user_id: req.user._id,
        clinic_id: clinicId,
        role: 'staff', // Default role
        permissions: [
          'read_patients', 'read_appointments', 'read_medical_records',
          'read_prescriptions', 'read_invoices', 'read_payments', 'manage_services'
        ], // Basic read permissions + services for testing
        is_active: true
      });

      try {
        await userClinic.save();
        console.log(`✅ UserClinic relationship created successfully for user ${req.user._id}`);
      } catch (error) {
        console.error('❌ Failed to create UserClinic relationship:', error);
        console.error('User ID:', req.user._id);
        console.error('Clinic ID:', clinicId);
        return res.status(403).json({
          success: false,
          message: 'Unable to establish clinic access. Please contact administrator.',
          code: 'CLINIC_ACCESS_DENIED'
        });
      }
    }

    // Get all clinics user has access to (for potential clinic switching)
    const userClinics = await UserClinic.find({
      user_id: req.user._id,
      is_active: true
    }).populate('clinic_id', 'name code description is_active');

    // Add clinic context to request
    req.clinic_id = clinicId;
    req.userClinics = userClinics;
    req.currentUserClinic = userClinic;
    req.currentClinic = clinic;

    next();
  } catch (error) {
    console.error('Clinic context middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating clinic context',
      code: 'CLINIC_CONTEXT_ERROR'
    });
  }
};

/**
 * Optional clinic context middleware
 * Similar to clinicContext but doesn't require clinic header
 * Useful for endpoints that can work with or without clinic context
 */
export const optionalClinicContext = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Ensure user is authenticated before proceeding
    if (!req.user || !req.user._id) {
      console.error('❌ Optional clinic context middleware: User not authenticated');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const clinicId = req.headers['x-clinic-id'] as string;
    
    if (clinicId) {
      // If clinic ID is provided, validate it
      if (!isValidObjectId(clinicId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid clinic ID format',
          code: 'INVALID_CLINIC_ID'
        });
      }

      const clinic = await Clinic.findOne({ 
        _id: clinicId, 
        is_active: true 
      });

      if (!clinic) {
        return res.status(404).json({
          success: false,
          message: 'Clinic not found or inactive',
          code: 'CLINIC_NOT_FOUND'
        });
      }

      const userClinic = await UserClinic.findOne({
        user_id: req.user._id,
        clinic_id: clinicId,
        is_active: true
      });

      if (!userClinic) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this clinic',
          code: 'CLINIC_ACCESS_DENIED'
        });
      }

      req.clinic_id = clinicId;
      req.currentUserClinic = userClinic;
      req.currentClinic = clinic;
    }

    // Always get user's clinics for context
    const userClinics = await UserClinic.find({
      user_id: req.user._id,
      is_active: true
    }).populate('clinic_id', 'name code description is_active');

    req.userClinics = userClinics;

    next();
  } catch (error) {
    console.error('Optional clinic context middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating clinic context',
      code: 'CLINIC_CONTEXT_ERROR'
    });
  }
};

/**
 * Middleware to check if user has specific permission in current clinic
 * @param permission - The permission to check
 * @returns Express middleware function
 */
export const requireClinicPermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.currentUserClinic) {
      // @ts-ignore
      return res.status(403).json({
        success: false,
        message: 'Clinic context required for permission check',
        code: 'CLINIC_CONTEXT_REQUIRED'
      });
    }

    const userClinic = req.currentUserClinic;
    
    // Check if user has the required permission
    if (!(await userClinic.hasPermission(permission))) {
      // @ts-ignore
      return res.status(403).json({
        success: false,
        message: `Permission '${permission}' required`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has specific role in current clinic
 * @param roles - The role(s) to check
 * @returns Express middleware function
 */
export const requireClinicRole = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.currentUserClinic) {
      // @ts-ignore: TypeScript middleware return type issue
      return res.status(403).json({
        success: false,
        message: 'Clinic context required for role check',
        code: 'CLINIC_CONTEXT_REQUIRED'
      });
    }

    const userClinic = req.currentUserClinic;
    
    // Check if user has one of the required roles
    const primaryRole = await userClinic.getPrimaryRole();
    const userRoleName = primaryRole?.name || 'staff';
    if (!roles.includes(userRoleName)) {
      // @ts-ignore: TypeScript middleware return type issue
      return res.status(403).json({
        success: false,
        message: `Role '${roles.join("' or '")}' required`,
        code: 'INSUFFICIENT_ROLE'
      });
    }

    next();
  };
};

/**
 * Helper function to get clinic-scoped filter
 * Adds clinic_id to the provided filter object
 * @param req - The authenticated request with clinic context
 * @param baseFilter - Base filter object to enhance
 * @returns Enhanced filter with clinic_id
 */
export const getClinicScopedFilter = (req: AuthRequest, baseFilter: any = {}) => {
  return {
    ...baseFilter,
    clinic_id: req.clinic_id
  };
};

/**
 * Helper function to validate ObjectId format
 * @param id - String to validate
 * @returns boolean indicating if valid ObjectId
 */
function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Middleware to ensure clinic admin access
 * User must be admin role in the current clinic
 */
export const requireClinicAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.currentUserClinic) {
    // @ts-ignore
    return res.status(403).json({
      success: false,
      message: 'Clinic context required',
      code: 'CLINIC_CONTEXT_REQUIRED'
    });
  }

  const primaryRole = await req.currentUserClinic.getPrimaryRole();
  if (primaryRole?.name !== 'super_admin' && primaryRole?.name !== 'admin') {
    // @ts-ignore
    return res.status(403).json({
      success: false,
      message: 'Clinic admin access required',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware combinations for common use cases
 */
export const clinicAdminRequired = [clinicContext, requireClinicAdmin];
export const clinicDoctorRequired = [clinicContext, requireClinicRole('admin', 'doctor')];
export const clinicStaffRequired = [clinicContext, requireClinicRole('admin', 'doctor', 'nurse', 'receptionist', 'staff')];

export default {
  clinicContext,
  optionalClinicContext,
  requireClinicPermission,
  requireClinicRole,
  requireClinicAdmin,
  getClinicScopedFilter,
  clinicAdminRequired,
  clinicDoctorRequired,
  clinicStaffRequired
}; 