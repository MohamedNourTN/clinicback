import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SuperAdmin, ISuperAdminModel } from '../models';
import { AuthRequest } from '../types/express';
import { SuperAdminJWTPayload } from '../controllers/auth/SuperAdminAuthController';

export const authenticateSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
      return;
    }

    // Verify and decode JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as SuperAdminJWTPayload;
    
    // Ensure this is a super admin token
    if (decoded.type !== 'super_admin' || decoded.role !== 'super_admin') {
      res.status(401).json({
        success: false,
        message: 'Invalid token. Super admin access required.'
      });
      return;
    }

    // Find super admin in database
    const superAdmin = await SuperAdmin.findById(decoded.id);
    if (!superAdmin) {
      res.status(401).json({
        success: false,
        message: 'Invalid token. Super admin not found.'
      });
      return;
    }

    // Check if super admin account is active
    if (!superAdmin.is_active) {
      res.status(401).json({
        success: false,
        message: 'Super admin account is deactivated.'
      });
      return;
    }

    // Check if account is locked
    if (superAdmin.isLocked()) {
      const lockTime = superAdmin.locked_until ? new Date(superAdmin.locked_until) : null;
      res.status(423).json({
        success: false,
        message: 'Super admin account is temporarily locked.',
        locked_until: lockTime
      });
      return;
    }

    // Add super admin to request object
    req.user = {
      id: superAdmin._id.toString(),
      email: superAdmin.email,
      role: 'super_admin',
      first_name: superAdmin.first_name,
      last_name: superAdmin.last_name,
      is_active: superAdmin.is_active,
      _id: superAdmin._id
    } as any;

    // Add super admin specific flag
    req.isSuperAdmin = true;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format.'
      });
      return;
    }

    console.error('Super admin authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication service error.'
    });
  }
};

/**
 * Middleware to ensure only super admins can access certain routes
 * This is an additional security layer on top of authenticateSuperAdmin
 */
export const requireSuperAdmin = [authenticateSuperAdmin];

/**
 * Middleware to check if the current user is a super admin (for mixed access routes)
 * This doesn't block access but adds super admin info to request
 */
export const checkSuperAdminStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      req.isSuperAdmin = false;
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as SuperAdminJWTPayload;
      
      // Check if this is a super admin token
      if (decoded.type === 'super_admin' && decoded.role === 'super_admin') {
        const superAdmin = await SuperAdmin.findById(decoded.id);
        
        if (superAdmin && superAdmin.is_active && !superAdmin.isLocked()) {
          req.isSuperAdmin = true;
          req.superAdminId = superAdmin._id.toString();
        } else {
          req.isSuperAdmin = false;
        }
      } else {
        req.isSuperAdmin = false;
      }
    } catch (jwtError) {
      req.isSuperAdmin = false;
    }

    next();
  } catch (error) {
    console.error('Check super admin status error:', error);
    req.isSuperAdmin = false;
    next();
  }
};

/**
 * Rate limiting middleware specifically for super admin login attempts
 */
export const superAdminLoginRateLimit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      next();
      return;
    }

    // Find super admin to check current login attempts
    const superAdmin = await SuperAdmin.findOne({ email: email.toLowerCase() });
    
    if (superAdmin && superAdmin.isLocked()) {
      const lockTime = superAdmin.locked_until ? new Date(superAdmin.locked_until) : null;
      const remainingTime = lockTime ? Math.ceil((lockTime.getTime() - Date.now()) / 1000 / 60) : 0;
      
      res.status(429).json({
        success: false,
        message: `Account is locked due to multiple failed login attempts. Please try again in ${remainingTime} minutes.`,
        locked_until: lockTime
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Super admin rate limit error:', error);
    next(); // Continue on error to avoid blocking legitimate requests
  }
};

/**
 * Audit log middleware for super admin actions
 * This logs all super admin actions for security auditing
 */
export const auditSuperAdminAction = (action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalSend = res.json;
    
    res.json = function(data: any) {
      // Log the action after successful response
      if (data.success !== false && req.user) {
        const logData = {
          timestamp: new Date(),
          super_admin_id: req.user.id,
          super_admin_email: req.user.email,
          action: action,
          ip_address: req.ip || req.connection.remoteAddress,
          user_agent: req.get('User-Agent'),
          request_data: {
            method: req.method,
            url: req.originalUrl,
            params: req.params,
            query: req.query
          }
        };
        
        console.log('🔐 SUPER ADMIN ACTION:', JSON.stringify(logData, null, 2));
        
        // TODO: Store in dedicated audit log collection
        // await AuditLog.create(logData);
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
};
