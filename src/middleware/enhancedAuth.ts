import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { AuthRequest } from '../types/express';
import { SubscriptionService } from '../services/subscriptionService';

/**
 * Enhanced authentication middleware that includes subscription validation
 * Use this for routes that require both authentication and active subscription
 */
export const authenticateWithSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
      id: string;
      email: string;
      role: string;
      tenant_id?: string;
      clinic_id?: string;
    };

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Check if user is active
    if (!user.is_active) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated.',
        code: 'ACCOUNT_DEACTIVATED'
      });
      return;
    }

    // Add user to request
    req.user = user as any;
    req.tenant_id = decoded.tenant_id || user.tenant_id?.toString();
    
    if (decoded.clinic_id) {
      req.clinic_id = decoded.clinic_id;
    }

    // Skip subscription check for super_admin
    if (user.role === 'super_admin') {
      next();
      return;
    }

    // Check subscription status for regular users
    if (req.tenant_id) {
      const subscriptionCheck = await SubscriptionService.canTenantUsersLogin(req.tenant_id);
      
      if (!subscriptionCheck.allowed) {
        res.status(403).json({
          success: false,
          message: subscriptionCheck.reason || 'Access denied due to subscription status',
          code: 'SUBSCRIPTION_REQUIRED',
          subscription_status: subscriptionCheck.subscription?.status || 'none',
          details: {
            tenant_id: req.tenant_id,
            current_status: subscriptionCheck.subscription?.status,
            plan_name: subscriptionCheck.subscription?.plan_id?.name
          }
        });
        return;
      }

      // Add subscription info to request
      req.subscription = subscriptionCheck.subscription;
    } else {
      res.status(403).json({
        success: false,
        message: 'No organization context found. Please contact your administrator.',
        code: 'NO_TENANT_CONTEXT'
      });
      return;
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    } else {
      console.error('Authentication with subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication failed. Please try again.',
        code: 'AUTH_ERROR'
      });
    }
  }
};

/**
 * Middleware to validate session and check subscription status for existing sessions
 * This can be used for routes that need to verify ongoing subscription validity
 */
export const validateActiveSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Skip for super_admin
    if (req.user?.role === 'super_admin') {
      next();
      return;
    }

    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (!tenantId) {
      res.status(403).json({
        success: false,
        message: 'Session expired. Please login again.',
        code: 'SESSION_EXPIRED'
      });
      return;
    }

    const subscriptionCheck = await SubscriptionService.canTenantUsersLogin(tenantId);
    
    if (!subscriptionCheck.allowed) {
      res.status(403).json({
        success: false,
        message: subscriptionCheck.reason || 'Your subscription status has changed. Please contact your administrator.',
        code: 'SUBSCRIPTION_CHANGED',
        subscription_status: subscriptionCheck.subscription?.status || 'none',
        details: {
          tenant_id: tenantId,
          current_status: subscriptionCheck.subscription?.status,
          plan_name: subscriptionCheck.subscription?.plan_id?.name
        }
      });
      return;
    }

    req.subscription = subscriptionCheck.subscription;
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to validate session. Please try again.',
      code: 'SESSION_VALIDATION_ERROR'
    });
  }
};

