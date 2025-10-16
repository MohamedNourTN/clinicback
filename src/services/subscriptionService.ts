import TenantSubscription from '../models/TenantSubscription';
import { Types } from 'mongoose';

export class SubscriptionService {
  /**
   * Check if a tenant has an active subscription
   * @param tenantId - The tenant ID to check
   * @returns Promise<boolean> - True if tenant has active subscription
   */
  static async hasActiveSubscription(tenantId: string | Types.ObjectId): Promise<boolean> {
    try {
      const subscription = await TenantSubscription.findOne({
        tenant_id: tenantId,
        status: { $in: ['active', 'trialing'] }, // Allow both active and trial subscriptions
        $or: [
          { ended_at: { $exists: false } }, // No end date
          { ended_at: null }, // Null end date
          { ended_at: { $gt: new Date() } } // End date in the future
        ]
      }).populate('plan_id', 'name');

      return !!subscription;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get tenant's current subscription status
   * @param tenantId - The tenant ID to check
   * @returns Promise with subscription details or null
   */
  static async getTenantSubscription(tenantId: string | Types.ObjectId) {
    try {
      const subscription = await TenantSubscription.findOne({
        tenant_id: tenantId
      })
      .populate('plan_id', 'name features')
      .sort({ created_at: -1 }); // Get the most recent subscription

      return subscription;
    } catch (error) {
      console.error('Error fetching tenant subscription:', error);
      return null;
    }
  }

  /**
   * Check if a tenant's subscription allows login
   * @param tenantId - The tenant ID to check
   * @returns Promise<{allowed: boolean, reason?: string, subscription?: any}>
   */
  static async canTenantUsersLogin(tenantId: string | Types.ObjectId): Promise<{
    allowed: boolean;
    reason?: string;
    subscription?: any;
  }> {
    try {
      const subscription = await this.getTenantSubscription(tenantId);

      // No subscription found
      if (!subscription) {
        return {
          allowed: false,
          reason: 'No subscription found for this organization. Please contact your administrator to set up a subscription plan.',
          subscription: null
        };
      }

      // Check subscription status
      switch (subscription.status) {
        case 'active':
          return {
            allowed: true,
            subscription
          };

        case 'trialing':
          // Check if trial has expired
          if (subscription.trial_end && new Date() > new Date(subscription.trial_end)) {
            return {
              allowed: false,
              reason: 'Your trial period has expired. Please contact your administrator to activate a subscription plan.',
              subscription
            };
          }
          return {
            allowed: true,
            subscription
          };

        case 'past_due':
          return {
            allowed: false,
            reason: 'Your subscription payment is overdue. Please contact your administrator to resolve payment issues.',
            subscription
          };

        case 'incomplete':
          return {
            allowed: false,
            reason: 'Your subscription setup is incomplete. Please contact your administrator to complete the subscription setup.',
            subscription
          };

        case 'incomplete_expired':
          return {
            allowed: false,
            reason: 'Your subscription setup has expired. Please contact your administrator to set up a new subscription.',
            subscription
          };

        case 'canceled':
          return {
            allowed: false,
            reason: 'Your subscription has been canceled. Please contact your administrator to reactivate your subscription.',
            subscription
          };

        case 'unpaid':
          return {
            allowed: false,
            reason: 'Your subscription has unpaid invoices. Please contact your administrator to resolve payment issues.',
            subscription
          };

        default:
          return {
            allowed: false,
            reason: 'Your subscription status is unknown. Please contact your administrator.',
            subscription
          };
      }
    } catch (error) {
      console.error('Error checking tenant login permissions:', error);
      return {
        allowed: false,
        reason: 'Unable to verify subscription status. Please try again later.',
        subscription: null
      };
    }
  }

  /**
   * Get user-friendly subscription status message
   * @param status - Subscription status
   * @returns Human-readable status message
   */
  static getStatusMessage(status: string): string {
    const statusMessages = {
      'active': 'Active subscription',
      'trialing': 'Trial period active',
      'past_due': 'Payment overdue',
      'incomplete': 'Setup incomplete',
      'incomplete_expired': 'Setup expired',
      'canceled': 'Subscription canceled',
      'unpaid': 'Payment required'
    };

    return statusMessages[status as keyof typeof statusMessages] || 'Unknown status';
  }
}

