import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { SubscriptionService } from '../services/subscriptionService';

/**
 * Middleware to check if user's tenant has an active subscription
 * This should be used after authentication middleware
 */
export const requireActiveSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Skip subscription check if user is not authenticated (public routes)
    if (!req.user) {
      next();
      return;
    }

    // Skip subscription check for super_admin
    if (req.user?.role === 'super_admin') {
      next();
      return;
    }

    // Check if user has tenant_id
    if (!req.tenant_id && !req.user?.tenant_id) {
      res.status(403).json({
        success: false,
        message: 'No organization context found. Please contact your administrator.',
        code: 'NO_TENANT_CONTEXT'
      });
      return;
    }

    const tenantId = req.tenant_id || req.user?.tenant_id;
    const subscriptionCheck = await SubscriptionService.canTenantUsersLogin(tenantId!);

    if (!subscriptionCheck.allowed) {
      res.status(403).json({
        success: false,
        message: subscriptionCheck.reason || 'Access denied due to subscription status',
        code: 'SUBSCRIPTION_REQUIRED',
        subscription_status: subscriptionCheck.subscription?.status || 'none',
        details: {
          tenant_id: tenantId,
          current_status: subscriptionCheck.subscription?.status,
          plan_name: subscriptionCheck.subscription?.plan_id?.name
        }
      });
      return;
    }

    // Add subscription info to request for use in controllers
    req.subscription = subscriptionCheck.subscription || undefined;
    next();
  } catch (error) {
    console.error('Subscription middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to verify subscription status. Please try again later.',
      code: 'SUBSCRIPTION_CHECK_ERROR'
    });
  }
};

/**
 * Optional subscription middleware that adds subscription info to request but doesn't block
 * Useful for routes that need subscription info but don't require active subscription
 */
export const addSubscriptionInfo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Skip for super_admin
    if (req.user?.role === 'super_admin') {
      next();
      return;
    }

    const tenantId = req.tenant_id || req.user?.tenant_id;
    if (tenantId) {
      const subscription = await SubscriptionService.getTenantSubscription(tenantId);
      req.subscription = subscription || undefined;
    }

    next();
  } catch (error) {
    console.error('Add subscription info middleware error:', error);
    // Don't block the request if subscription info can't be retrieved
    next();
  }
};

/**
 * Middleware to check specific subscription features
 * @param requiredFeatures Array of features that the subscription must include
 */
export const requireSubscriptionFeatures = (requiredFeatures: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Skip for super_admin
      if (req.user?.role === 'super_admin') {
        next();
        return;
      }

      // First ensure there's an active subscription
      const tenantId = req.tenant_id || req.user?.tenant_id;
      if (!tenantId) {
        res.status(403).json({
          success: false,
          message: 'No organization context found',
          code: 'NO_TENANT_CONTEXT'
        });
        return;
      }

      const subscriptionCheck = await SubscriptionService.canTenantUsersLogin(tenantId);
      if (!subscriptionCheck.allowed) {
        res.status(403).json({
          success: false,
          message: subscriptionCheck.reason || 'Access denied due to subscription status',
          code: 'SUBSCRIPTION_REQUIRED'
        });
        return;
      }

      // Check if subscription plan includes required features
      const subscription = subscriptionCheck.subscription;
      const planFeatures = subscription?.plan_id?.features || [];
      
      const missingFeatures = requiredFeatures.filter(feature => !planFeatures.includes(feature));
      
      if (missingFeatures.length > 0) {
        res.status(403).json({
          success: false,
          message: `Your current subscription plan does not include the required features: ${missingFeatures.join(', ')}. Please upgrade your plan.`,
          code: 'FEATURE_NOT_AVAILABLE',
          missing_features: missingFeatures,
          current_plan: subscription?.plan_id?.name
        });
        return;
      }

      req.subscription = subscription || undefined;
      next();
    } catch (error) {
      console.error('Subscription features middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Unable to verify subscription features',
        code: 'FEATURE_CHECK_ERROR'
      });
    }
  };
};
