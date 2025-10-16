import { Request, Response } from 'express';
import Stripe from 'stripe';
import SubscriptionPlan from '../models/SubscriptionPlan';
import TenantSubscription from '../models/TenantSubscription';
import StripeTransaction from '../models/StripeTransaction';
import Tenant from '../models/Tenant';
import { StripeService } from '../utils/stripe';
import { Types } from 'mongoose';

// Define AuthRequest interface for authenticated requests
interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
  typescript: true,
});

export class StripeController {
  
  // ============ SUBSCRIPTION PLANS ============
  
  /**
   * Get all subscription plans
   */
  static async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const { active_only = 'true' } = req.query;
      
      const query: any = {};
      if (active_only === 'true') {
        query.is_active = true;
      }
      
      const plans = await SubscriptionPlan.find(query)
        .populate('created_by', 'first_name last_name email')
        .sort({ price: 1 });
      
      res.status(200).json({
        success: true,
        data: plans,
        message: 'Plans retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch plans'
      });
    }
  }
  
  /**
   * Create a new subscription plan
   */
  static async createPlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        price,
        currency = 'USD',
        interval = 'month',
        interval_count = 1,
        trial_period_days = 0,
        features = [],
        max_clinics = 1,
        max_users = 5,
        max_patients = 100,
        is_default = false
      } = req.body;
      
      const superAdminId = req.user?.id;
      if (!superAdminId) {
        res.status(401).json({
          success: false,
          message: 'Super admin authentication required'
        });
        return;
      }
      
      // Create Stripe product first
      const stripeProduct = await stripe.products.create({
        name,
        description,
        metadata: {
          max_clinics: max_clinics.toString(),
          max_users: max_users.toString(),
          max_patients: max_patients.toString(),
        }
      });
      
      // Create Stripe price
      const stripePrice = await stripe.prices.create({
        unit_amount: Math.round(price * 100), // Convert to cents
        currency: currency.toLowerCase(),
        recurring: {
          interval,
          interval_count,
          trial_period_days: trial_period_days > 0 ? trial_period_days : undefined
        },
        product: stripeProduct.id,
        metadata: {
          plan_name: name,
          max_clinics: max_clinics.toString(),
          max_users: max_users.toString(),
          max_patients: max_patients.toString(),
        }
      });
      
      // Create plan in database
      const plan = new SubscriptionPlan({
        stripe_price_id: stripePrice.id,
        stripe_product_id: stripeProduct.id,
        name,
        description,
        price: Math.round(price * 100), // Store in cents
        currency: currency.toUpperCase(),
        interval,
        interval_count,
        trial_period_days,
        features,
        max_clinics,
        max_users,
        max_patients,
        is_default,
        created_by: new Types.ObjectId(superAdminId)
      });
      
      await plan.save();
      
      res.status(201).json({
        success: true,
        data: plan,
        message: 'Plan created successfully'
      });
    } catch (error: any) {
      console.error('Error creating plan:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create plan'
      });
    }
  }
  
  /**
   * Update a subscription plan
   */
  static async updatePlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const plan = await SubscriptionPlan.findById(id);
      if (!plan) {
        res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
        return;
      }
      
      // Update Stripe product if description changed
      if (updates.description && updates.description !== plan.description) {
        await stripe.products.update(plan.stripe_product_id, {
          description: updates.description
        });
      }
      
      // Update plan in database
      Object.assign(plan, updates);
      await plan.save();
      
      res.status(200).json({
        success: true,
        data: plan,
        message: 'Plan updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating plan:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update plan'
      });
    }
  }
  
  /**
   * Delete a subscription plan
   */
  static async deletePlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const plan = await SubscriptionPlan.findById(id);
      if (!plan) {
        res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
        return;
      }
      
      // Check if plan has active subscriptions
      const activeSubscriptions = await TenantSubscription.countDocuments({
        plan_id: id,
        status: { $in: ['active', 'trialing', 'past_due'] }
      });
      
      if (activeSubscriptions > 0) {
        res.status(400).json({
          success: false,
          message: `Cannot delete plan with ${activeSubscriptions} active subscriptions`
        });
        return;
      }
      
      // Archive Stripe product instead of deleting
      await stripe.products.update(plan.stripe_product_id, {
        active: false
      });
      
      // Archive price
      await stripe.prices.update(plan.stripe_price_id, {
        active: false
      });
      
      // Mark plan as inactive instead of deleting
      plan.is_active = false;
      await plan.save();
      
      res.status(200).json({
        success: true,
        message: 'Plan archived successfully'
      });
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete plan'
      });
    }
  }

  /**
   * Sync plans from Stripe to local database
   */
  static async syncPlansFromStripe(req: Request, res: Response): Promise<void> {
    try {
      // Fetch all products from Stripe
      const stripeProducts = await stripe.products.list({
        active: true,
        limit: 100
      });

      // Fetch all prices from Stripe  
      const stripePrices = await stripe.prices.list({
        active: true,
        limit: 100
      });

      let syncedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const product of stripeProducts.data) {
        try {
          // Find associated prices for this product
          const productPrices = stripePrices.data.filter(
            price => price.product === product.id && price.recurring
          );

          for (const price of productPrices) {
            // Check if we already have this plan
            const existingPlan = await SubscriptionPlan.findOne({
              $or: [
                { stripe_product_id: product.id },
                { stripe_price_id: price.id }
              ]
            });

            if (!existingPlan) {
              // Create new plan from Stripe data
              const validInterval = (price.recurring?.interval === 'month' || price.recurring?.interval === 'year') 
                ? price.recurring.interval 
                : 'month';
                
              const newPlan = new SubscriptionPlan({
                name: product.name,
                description: product.description || '',
                price: price.unit_amount || 0,
                currency: (price.currency || 'usd').toUpperCase(),
                interval: validInterval,
                interval_count: price.recurring?.interval_count || 1,
                trial_period_days: price.recurring?.trial_period_days || 0,
                features: [], // Will need to be set manually
                max_clinics: parseInt(product.metadata?.max_clinics || '1'),
                max_users: parseInt(product.metadata?.max_users || '5'), 
                max_patients: parseInt(product.metadata?.max_patients || '100'),
                is_active: product.active && price.active,
                is_default: false,
                stripe_product_id: product.id,
                stripe_price_id: price.id
              });

              await newPlan.save();
              syncedCount++;
            } else {
              // Update existing plan with Stripe data
              const validInterval = (price.recurring?.interval === 'month' || price.recurring?.interval === 'year') 
                ? price.recurring.interval 
                : 'month';
                
              existingPlan.name = product.name;
              existingPlan.description = product.description || '';
              existingPlan.price = price.unit_amount || 0;
              existingPlan.currency = (price.currency || 'usd').toUpperCase();
              existingPlan.interval = validInterval;
              existingPlan.interval_count = price.recurring?.interval_count || 1;
              existingPlan.trial_period_days = price.recurring?.trial_period_days || 0;
              existingPlan.is_active = product.active && price.active;
              existingPlan.stripe_product_id = product.id;
              existingPlan.stripe_price_id = price.id;

              await existingPlan.save();
              syncedCount++;
            }
          }
        } catch (productError: any) {
          console.error(`Error syncing product ${product.id}:`, productError);
          errors.push(`Product ${product.name}: ${productError.message}`);
          errorCount++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Successfully synced ${syncedCount} plans from Stripe`,
        data: {
          synced_count: syncedCount,
          error_count: errorCount,
          errors: errors
        }
      });

    } catch (error: any) {
      console.error('Error syncing plans from Stripe:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to sync plans from Stripe'
      });
    }
  }
  
  // ============ SUBSCRIPTIONS ============
  
  /**
   * Get all subscriptions
   */
  static async getSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status,
        tenant_id,
        plan_id
      } = req.query;
      
      const query: any = {};
      if (status) query.status = status;
      if (tenant_id) query.tenant_id = tenant_id;
      if (plan_id) query.plan_id = plan_id;
      
      const skip = (Number(page) - 1) * Number(limit);
      
      const [subscriptions, total] = await Promise.all([
        TenantSubscription.find(query)
          .populate('tenant_id', 'name email slug subdomain status')
          .populate('plan_id', 'name price currency interval features')
          .populate('created_by', 'first_name last_name email')
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(Number(limit)),
        TenantSubscription.countDocuments(query)
      ]);
      
      res.status(200).json({
        success: true,
        data: {
          subscriptions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        },
        message: 'Subscriptions retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch subscriptions'
      });
    }
  }
  
  /**
   * Create subscription for tenant
   */
  static async createSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tenant_id, plan_id, customer_email, trial_days, admin_payment_method_id } = req.body;
      const superAdminId = req.user?.id;
      
      if (!superAdminId) {
        res.status(401).json({
          success: false,
          message: 'Super admin authentication required'
        });
        return;
      }
      
      // Validate tenant and plan
      const [tenant, plan] = await Promise.all([
        Tenant.findById(tenant_id),
        SubscriptionPlan.findById(plan_id)
      ]);
      
      if (!tenant) {
        res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
        return;
      }
      
      if (!plan) {
        res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
        return;
      }
      
      // Check for existing active subscription
      const existingSubscription = await TenantSubscription.findOne({
        tenant_id,
        status: { $in: ['active', 'trialing', 'past_due'] }
      });
      
      if (existingSubscription) {
        res.status(400).json({
          success: false,
          message: 'Tenant already has an active subscription'
        });
        return;
      }
      
      // Create or retrieve Stripe customer
      let stripeCustomer;
      try {
        const customers = await stripe.customers.list({
          email: customer_email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          stripeCustomer = customers.data[0];
        } else {
          stripeCustomer = await stripe.customers.create({
            email: customer_email,
            name: tenant.name,
            metadata: {
              tenant_id: tenant_id,
              tenant_name: tenant.name
            }
          });
        }
      } catch (stripeError: any) {
        console.error('Stripe customer error:', stripeError);
        res.status(500).json({
          success: false,
          message: 'Failed to create Stripe customer'
        });
        return;
      }
      
      // Create subscription with different payment strategies
      let stripeSubscription;
      let paymentIntent = null;
      
      if (admin_payment_method_id) {
        // Admin pays on behalf - use admin customer for payment
        try {
          const adminCustomerId = await StripeController.getOrCreateAdminCustomer(superAdminId);
          
          // Verify the payment method belongs to the admin customer
          const paymentMethod = await stripe.paymentMethods.retrieve(admin_payment_method_id);
          if (paymentMethod.customer !== adminCustomerId) {
            res.status(400).json({
              success: false,
              message: 'Payment method does not belong to admin customer'
            });
            return;
          }

          // Create subscription normally first (with default payment behavior)
          stripeSubscription = await stripe.subscriptions.create({
            customer: stripeCustomer.id,
            items: [{
              price: plan.stripe_price_id,
            }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
              tenant_id: tenant_id,
              tenant_name: tenant.name,
              plan_id: plan_id,
              plan_name: plan.name,
              paid_by_admin: 'true',
              admin_id: superAdminId
            }
          });

          // Get the invoice from the subscription
          const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
          
          if (invoice && invoice.status !== 'paid') {
            // Create Payment Intent using admin customer and payment method
            const paymentIntent = await stripe.paymentIntents.create({
              amount: invoice.amount_due,
              currency: invoice.currency,
              customer: adminCustomerId,
              payment_method: admin_payment_method_id,
              confirm: true,
              automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never' // Disable redirect-based payment methods for admin payments
              },
              description: `Admin payment on behalf for subscription ${stripeSubscription.id}`,
              metadata: {
                subscription_id: stripeSubscription.id,
                invoice_id: invoice.id,
                tenant_id: tenant_id,
                paid_by_admin: 'true',
                admin_id: superAdminId
              }
            });

            if (paymentIntent.status === 'succeeded') {
              // Mark the invoice as paid
              await stripe.invoices.pay(invoice.id, {
                paid_out_of_band: true
              });

              // Create transaction record in our database
              const transaction = new StripeTransaction({
                stripe_payment_intent_id: paymentIntent.id,
                stripe_invoice_id: invoice.id,
                stripe_subscription_id: stripeSubscription.id,
                stripe_customer_id: stripeSubscription.customer as string,
                tenant_id: tenant_id,
                customer_email: customer_email,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: 'succeeded',
                type: 'subscription',
                description: `Admin payment on behalf for new subscription ${stripeSubscription.id}`,
                card_last4: undefined, 
                card_brand: undefined, 
                created_at: new Date(),
                metadata: {
                  subscription_id: stripeSubscription.id,
                  tenant_id: tenant_id,
                  paid_by_admin: 'true',
                  admin_id: superAdminId
                }
              });
              await transaction.save();
              console.log(`Transaction record created during subscription creation: ${transaction._id}`);
              
              // Refresh subscription status
              stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscription.id);
            } else {
              throw new Error(`Payment failed with status: ${paymentIntent.status}`);
            }
          }

        } catch (paymentError: any) {
          console.error('Admin payment error:', paymentError);
          res.status(400).json({
            success: false,
            message: `Payment failed: ${paymentError.message}`
          });
          return;
        }
      } else {
        // Standard subscription creation requiring customer payment
        stripeSubscription = await stripe.subscriptions.create({
          customer: stripeCustomer.id,
          items: [{
            price: plan.stripe_price_id,
          }],
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            tenant_id: tenant_id,
            tenant_name: tenant.name,
            plan_id: plan_id,
            plan_name: plan.name,
            paid_by_admin: 'false'
          }
        });
      }
      
      // Create subscription record in database
      const subscription = new TenantSubscription({
        tenant_id: new Types.ObjectId(tenant_id),
        plan_id: new Types.ObjectId(plan_id),
        stripe_subscription_id: stripeSubscription.id,
        stripe_customer_id: stripeCustomer.id,
        status: stripeSubscription.status,
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        price_amount: plan.price,
        currency: plan.currency,
        created_by: new Types.ObjectId(superAdminId)
      });
      
      await subscription.save();
      
      // Return appropriate response based on payment method
      const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      const responseData: any = {
        subscription,
        stripe_subscription_id: stripeSubscription.id,
        payment_status: stripeSubscription.status
      };

      if (admin_payment_method_id) {
        responseData.message = 'Subscription created and paid by admin successfully';
        responseData.paid_by_admin = true;
      } else {
        const paymentIntentFromInvoice = invoice.payment_intent as Stripe.PaymentIntent;
        responseData.client_secret = paymentIntentFromInvoice?.client_secret;
        responseData.message = 'Subscription created - customer payment required';
        responseData.paid_by_admin = false;
      }
      
      res.status(201).json({
        success: true,
        data: responseData,
        message: responseData.message
      });
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create subscription'
      });
    }
  }
  
  /**
   * Cancel subscription
   */
  static async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { immediately = false } = req.body;
      
      const subscription = await TenantSubscription.findById(id);
      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
        return;
      }
      
      // Cancel in Stripe
      if (immediately) {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        subscription.status = 'canceled';
        subscription.canceled_at = new Date();
        subscription.ended_at = new Date();
      } else {
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true
        });
        subscription.cancel_at_period_end = true;
      }
      
      await subscription.save();
      
      res.status(200).json({
        success: true,
        data: subscription,
        message: immediately ? 'Subscription canceled immediately' : 'Subscription will cancel at period end'
      });
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel subscription'
      });
    }
  }

  // ============ ADMIN PAYMENT METHODS ============

  /**
   * Get or create admin customer ID for the authenticated super admin
   */
  static async getOrCreateAdminCustomer(superAdminId: string): Promise<string> {
    // First try to use environment variable
    let adminCustomerId = process.env.STRIPE_ADMIN_CUSTOMER_ID;
    
    if (adminCustomerId) {
      return adminCustomerId;
    }

    // Search for existing admin customer by metadata
    const existingCustomers = await stripe.customers.list({
      email: `admin+${superAdminId}@${process.env.DOMAIN || 'clinicpro.com'}`,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      adminCustomerId = existingCustomers.data[0].id;
      console.log(`Found existing admin customer: ${adminCustomerId}`);
      return adminCustomerId;
    }

    // Create new admin customer
    const adminCustomer = await stripe.customers.create({
      email: `admin+${superAdminId}@${process.env.DOMAIN || 'clinicpro.com'}`,
      name: 'ClinicPro Admin',
      description: 'Admin customer for paying subscription on behalf of tenants',
      metadata: {
        admin_id: superAdminId,
        is_admin_customer: 'true'
      }
    });
    
    adminCustomerId = adminCustomer.id;
    console.log(`Created admin customer: ${adminCustomerId}. Add STRIPE_ADMIN_CUSTOMER_ID=${adminCustomerId} to your environment variables.`);
    
    return adminCustomerId;
  }

  /**
   * Get admin payment methods for paying on behalf of customers
   */
  static async getAdminPaymentMethods(req: AuthRequest, res: Response): Promise<void> {
    try {
      const superAdminId = req.user?.id;
      
      if (!superAdminId) {
        res.status(401).json({
          success: false,
          message: 'Super admin authentication required'
        });
        return;
      }

      const adminCustomerId = await StripeController.getOrCreateAdminCustomer(superAdminId);

      // Get payment methods for admin customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: adminCustomerId,
        type: 'card',
      });

      res.status(200).json({
        success: true,
        data: {
          payment_methods: paymentMethods.data.map(pm => ({
            id: pm.id,
            card: pm.card ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              exp_month: pm.card.exp_month,
              exp_year: pm.card.exp_year
            } : null,
            created: pm.created
          })),
          admin_customer_id: adminCustomerId
        },
        message: 'Admin payment methods retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error getting admin payment methods:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get admin payment methods'
      });
    }
  }

  /**
   * Create setup intent for admin to add new payment method
   */
  static async createAdminSetupIntent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const superAdminId = req.user?.id;
      
      if (!superAdminId) {
        res.status(401).json({
          success: false,
          message: 'Super admin authentication required'
        });
        return;
      }

      const adminCustomerId = await StripeController.getOrCreateAdminCustomer(superAdminId);

      // Create setup intent for admin to add payment method
      const setupIntent = await stripe.setupIntents.create({
        customer: adminCustomerId,
        usage: 'off_session', // For future payments
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never' // Only allow direct payment methods like cards
        },
        metadata: {
          admin_id: superAdminId,
          purpose: 'admin_payment_method'
        }
      });

      res.status(200).json({
        success: true,
        data: {
          client_secret: setupIntent.client_secret,
          setup_intent_id: setupIntent.id,
          admin_customer_id: adminCustomerId
        },
        message: 'Setup intent created successfully'
      });

    } catch (error: any) {
      console.error('Error creating admin setup intent:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create setup intent'
      });
    }
  }

  /**
   * Pay for existing subscription on behalf of customer
   */
  static async paySubscriptionOnBehalf(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { subscription_id } = req.params;
      const { admin_payment_method_id } = req.body;
      const superAdminId = req.user?.id;
      
      if (!superAdminId) {
        res.status(401).json({
          success: false,
          message: 'Super admin authentication required'
        });
        return;
      }

      if (!admin_payment_method_id) {
        res.status(400).json({
          success: false,
          message: 'Admin payment method ID is required'
        });
        return;
      }

      // Find subscription in database
      const subscription = await TenantSubscription.findById(subscription_id);
      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
        return;
      }

      // Get the Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
        expand: ['latest_invoice', 'customer']
      });

      if (stripeSubscription.status === 'active') {
        res.status(400).json({
          success: false,
          message: 'Subscription is already active and paid'
        });
        return;
      }

      // Get the latest invoice
      const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      
      if (!invoice || invoice.status === 'paid') {
        res.status(400).json({
          success: false,
          message: 'No unpaid invoice found for this subscription'
        });
        return;
      }

      // Get admin customer ID and verify payment method belongs to admin
      const adminCustomerId = await StripeController.getOrCreateAdminCustomer(superAdminId);
      
      // Verify the payment method belongs to the admin customer
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(admin_payment_method_id);
        if (paymentMethod.customer !== adminCustomerId) {
          res.status(400).json({
            success: false,
            message: 'Payment method does not belong to admin customer'
          });
          return;
        }
      } catch (error: any) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment method ID'
        });
        return;
      }

      // Create a Payment Intent for the invoice amount using admin payment method
      try {
        console.log(`Creating PaymentIntent for subscription ${stripeSubscription.id}, amount: ${invoice.amount_due}, currency: ${invoice.currency}`);
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: invoice.amount_due,
          currency: invoice.currency,
          customer: adminCustomerId,
          payment_method: admin_payment_method_id,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never' // Disable redirect-based payment methods for admin payments
          },
          description: `Admin payment on behalf for subscription ${stripeSubscription.id}`,
          metadata: {
            subscription_id: stripeSubscription.id,
            invoice_id: invoice.id,
            tenant_id: subscription.tenant_id.toString(),
            paid_by_admin: 'true',
            admin_id: superAdminId
          }
        });

        console.log(`PaymentIntent created: ${paymentIntent.id}, status: ${paymentIntent.status}`);

        if (paymentIntent.status === 'succeeded') {
          // Mark the invoice as paid by applying the payment
          await stripe.invoices.pay(invoice.id, {
            paid_out_of_band: true
          });

          console.log(`Invoice ${invoice.id} marked as paid out-of-band`);

          // Update subscription status in our database
          subscription.status = 'active';
          await subscription.save();

          // Create transaction record in our database
          const customer = stripeSubscription.customer as Stripe.Customer;
          const transaction = new StripeTransaction({
            stripe_payment_intent_id: paymentIntent.id,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: stripeSubscription.id,
            stripe_customer_id: typeof stripeSubscription.customer === 'string' ? 
              stripeSubscription.customer : stripeSubscription.customer.id,
            tenant_id: subscription.tenant_id,
            customer_email: customer?.email || '',
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: 'succeeded',
            type: 'subscription',
            description: `Admin payment on behalf for subscription ${stripeSubscription.id}`,
            card_last4: undefined, 
            card_brand: undefined, 
            created_at: new Date(),
            metadata: {
              subscription_id: stripeSubscription.id,
              tenant_id: subscription.tenant_id.toString(),
              paid_by_admin: 'true',
              admin_id: superAdminId
            }
          });
          await transaction.save();
          console.log(`Transaction record created: ${transaction._id}`);

          res.status(200).json({
            success: true,
            data: {
              subscription,
              payment_intent_id: paymentIntent.id,
              invoice_id: invoice.id,
              amount_paid: paymentIntent.amount,
              status: paymentIntent.status
            },
            message: 'Subscription paid successfully by admin'
          });
        } else {
          console.error(`PaymentIntent failed with status: ${paymentIntent.status}`);
          res.status(400).json({
            success: false,
            message: `Payment failed with status: ${paymentIntent.status}`
          });
        }

      } catch (paymentError: any) {
        console.error('Payment error details:', {
          error: paymentError.message,
          type: paymentError.type,
          code: paymentError.code,
          admin_customer_id: adminCustomerId,
          payment_method_id: admin_payment_method_id,
          invoice_id: invoice.id,
          amount: invoice.amount_due
        });
        res.status(400).json({
          success: false,
          message: `Payment failed: ${paymentError.message}`
        });
        return;
      }

    } catch (error: any) {
      console.error('Error paying subscription on behalf:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to pay subscription on behalf'
      });
    }
  }

  /**
   * Delete admin payment method
   */
  static async deleteAdminPaymentMethod(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { payment_method_id } = req.params;
      const superAdminId = req.user?.id;
      
      if (!superAdminId) {
        res.status(401).json({
          success: false,
          message: 'Super admin authentication required'
        });
        return;
      }

      if (!payment_method_id) {
        res.status(400).json({
          success: false,
          message: 'Payment method ID is required'
        });
        return;
      }

      // Detach payment method from Stripe customer
      await stripe.paymentMethods.detach(payment_method_id);

      res.status(200).json({
        success: true,
        message: 'Payment method removed successfully'
      });

    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove payment method'
      });
    }
  }

  /**
   * Debug endpoint to check Stripe payment method status
   */
  static async debugAdminPaymentMethods(req: AuthRequest, res: Response): Promise<void> {
    try {
      const superAdminId = req.user?.id;
      
      if (!superAdminId) {
        res.status(401).json({
          success: false,
          message: 'Super admin authentication required'
        });
        return;
      }

      const adminCustomerId = await StripeController.getOrCreateAdminCustomer(superAdminId);

      // Get all payment methods for this customer from Stripe directly
      const stripePaymentMethods = await stripe.paymentMethods.list({
        customer: adminCustomerId,
        type: 'card',
      });

      // Also get the customer details
      const customer = await stripe.customers.retrieve(adminCustomerId);

      res.status(200).json({
        success: true,
        debug_data: {
          admin_customer_id: adminCustomerId,
          customer_details: customer,
          payment_methods_count: stripePaymentMethods.data.length,
          payment_methods: stripePaymentMethods.data,
          super_admin_id: superAdminId
        },
        message: 'Debug information retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error getting debug info:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get debug information'
      });
    }
  }
  
  // ============ TRANSACTIONS ============
  
  /**
   * Sync transactions from Stripe to local database
   */
  static async syncTransactionsFromStripe(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('Starting transaction sync from Stripe...');
      
      // Get all payment intents from Stripe (last 100)
      const paymentIntents = await stripe.paymentIntents.list({
        limit: 100,
        expand: ['data.charges']
      });

      let syncedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const paymentIntent of paymentIntents.data) {
        try {
          // Check if transaction already exists
          const existingTransaction = await StripeTransaction.findOne({
            stripe_payment_intent_id: paymentIntent.id
          });

          if (existingTransaction) {
            console.log(`Transaction ${paymentIntent.id} already exists, skipping...`);
            continue;
          }

          // Get charge details for card info
          let cardLast4 = '';
          let cardBrand = '';
          const paymentIntentWithCharges = paymentIntent as Stripe.PaymentIntent & { charges?: Stripe.ApiList<Stripe.Charge>; };
          if (paymentIntentWithCharges.charges && paymentIntentWithCharges.charges.data.length > 0) {
            const charge = paymentIntentWithCharges.charges.data[0];
            if (charge.payment_method_details?.card) {
              cardLast4 = charge.payment_method_details.card.last4 || '';
              cardBrand = charge.payment_method_details.card.brand || '';
            }
          }

          // Determine transaction type based on description
          let type = 'one_time'; // Default to one_time instead of payment
          if (paymentIntent.description?.includes('subscription')) {
            type = 'subscription';
          }

          // Try to extract tenant info from metadata
          let tenantId: string | null = null;
          let customerEmail = '';
          
          if (paymentIntent.metadata?.tenant_id) {
            tenantId = paymentIntent.metadata.tenant_id;
          }
          
          if (paymentIntent.receipt_email) {
            customerEmail = paymentIntent.receipt_email;
          }

          // Create transaction record
          const transaction = new StripeTransaction({
            stripe_payment_intent_id: paymentIntent.id,
            stripe_invoice_id: paymentIntent.invoice as string || '',
            stripe_subscription_id: paymentIntent.metadata?.subscription_id || '',
            stripe_customer_id: paymentIntent.customer as string || 'unknown',
            tenant_id: tenantId ? new Types.ObjectId(tenantId) : undefined,
            customer_email: customerEmail,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status === 'succeeded' ? 'succeeded' : 
                   paymentIntent.status === 'requires_payment_method' ? 'failed' : 
                   paymentIntent.status,
            type: type,
            description: paymentIntent.description || `Payment ${paymentIntent.id}`,
            card_last4: cardLast4 || undefined,
            card_brand: cardBrand ? cardBrand.toLowerCase() : undefined,
            created_at: new Date(paymentIntent.created * 1000),
            metadata: paymentIntent.metadata || {}
          });

          await transaction.save();
          syncedCount++;
          console.log(`Synced transaction: ${paymentIntent.id}`);

        } catch (error: any) {
          errorCount++;
          const errorMsg = `Failed to sync transaction ${paymentIntent.id}: ${error.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      res.status(200).json({
        success: true,
        data: {
          synced_count: syncedCount,
          error_count: errorCount,
          errors: errors,
          total_processed: paymentIntents.data.length
        },
        message: `Successfully synced ${syncedCount} transactions from Stripe`
      });

    } catch (error: any) {
      console.error('Error syncing transactions from Stripe:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to sync transactions from Stripe'
      });
    }
  }

  /**
   * Get all Stripe transactions
   */
  static async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status,
        type,
        tenant_id,
        customer_email,
        start_date,
        end_date
      } = req.query;
      
      const query: any = {};
      if (status) query.status = status;
      if (type) query.type = type;
      if (tenant_id) query.tenant_id = tenant_id;
      if (customer_email) query.customer_email = customer_email;
      if (start_date || end_date) {
        query.created_at = {};
        if (start_date) query.created_at.$gte = new Date(start_date as string);
        if (end_date) query.created_at.$lte = new Date(end_date as string);
      }
      
      const skip = (Number(page) - 1) * Number(limit);
      
      const [transactions, total] = await Promise.all([
        StripeTransaction.find(query)
          .populate('tenant_id', 'name email slug subdomain')
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(Number(limit)),
        StripeTransaction.countDocuments(query)
      ]);
      
      res.status(200).json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        },
        message: 'Transactions retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch transactions'
      });
    }
  }
  
  /**
   * Get subscription analytics
   */
  static async getSubscriptionAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { start_date, end_date } = req.query;
      
      const dateFilter: any = {};
      if (start_date) dateFilter.$gte = new Date(start_date as string);
      if (end_date) dateFilter.$lte = new Date(end_date as string);
      
      const matchStage = Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {};
      
      // Aggregate subscription statistics
      const [subscriptionStats, revenueByPlan, transactionStats] = await Promise.all([
        TenantSubscription.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              total_revenue: { $sum: '$price_amount' }
            }
          }
        ]),
        TenantSubscription.aggregate([
          { $match: { status: { $in: ['active', 'trialing'] } } },
          {
            $lookup: {
              from: 'subscriptionplans',
              localField: 'plan_id',
              foreignField: '_id',
              as: 'plan'
            }
          },
          { $unwind: '$plan' },
          {
            $group: {
              _id: '$plan.name',
              count: { $sum: 1 },
              revenue: { $sum: '$price_amount' },
              plan_price: { $first: '$plan.price' }
            }
          }
        ]),
        StripeTransaction.aggregate([
          { $match: { ...matchStage, status: 'succeeded' } },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              total_amount: { $sum: '$amount' },
              total_fees: { $sum: '$fee_amount' }
            }
          }
        ])
      ]);
      
      res.status(200).json({
        success: true,
        data: {
          subscription_stats: subscriptionStats,
          revenue_by_plan: revenueByPlan,
          transaction_stats: transactionStats
        },
        message: 'Analytics retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch analytics'
      });
    }
  }
  
  /**
   * Handle Stripe webhooks for subscription updates
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const sig = req.headers['stripe-signature'] as string;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
      
      let event: Stripe.Event;
      
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        res.status(400).json({ error: 'Webhook signature verification failed' });
        return;
      }
      
      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await StripeController.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
          await StripeController.handlePaymentUpdate(event.data.object as Stripe.Invoice);
          break;
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed':
          await StripeController.handlePaymentIntentUpdate(event.data.object as Stripe.PaymentIntent);
          break;
      }
      
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
  
  // ============ PRIVATE HELPER METHODS ============
  
  private static async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    try {
      const dbSubscription = await TenantSubscription.findOne({
        stripe_subscription_id: subscription.id
      });
      
      if (dbSubscription) {
        dbSubscription.status = subscription.status as any;
        dbSubscription.current_period_start = new Date(subscription.current_period_start * 1000);
        dbSubscription.current_period_end = new Date(subscription.current_period_end * 1000);
        dbSubscription.cancel_at_period_end = subscription.cancel_at_period_end;
        
        if (subscription.canceled_at) {
          dbSubscription.canceled_at = new Date(subscription.canceled_at * 1000);
        }
        
        if (subscription.ended_at) {
          dbSubscription.ended_at = new Date(subscription.ended_at * 1000);
        }
        
        await dbSubscription.save();
      }
    } catch (error) {
      console.error('Error updating subscription from webhook:', error);
    }
  }
  
  private static async handlePaymentUpdate(invoice: Stripe.Invoice): Promise<void> {
    try {
      const transaction = new StripeTransaction({
        stripe_invoice_id: invoice.id,
        stripe_subscription_id: invoice.subscription as string,
        stripe_customer_id: invoice.customer as string,
        amount: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        status: invoice.paid ? 'succeeded' : 'failed',
        type: 'subscription',
        description: `Subscription payment - ${invoice.description || 'No description'}`,
        customer_email: invoice.customer_email,
        processed_at: new Date()
      });
      
      await transaction.save();
    } catch (error) {
      console.error('Error creating transaction from webhook:', error);
    }
  }
  
  private static async handlePaymentIntentUpdate(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      // Update existing transaction or create new one
      let transaction = await StripeTransaction.findOne({
        stripe_payment_intent_id: paymentIntent.id
      });
      
      if (!transaction) {
        transaction = new StripeTransaction({
          stripe_payment_intent_id: paymentIntent.id,
          stripe_customer_id: paymentIntent.customer as string,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency.toUpperCase(),
          status: paymentIntent.status as any,
          type: 'one_time',
          description: paymentIntent.description || 'One-time payment'
        });
      } else {
        transaction.status = paymentIntent.status as any;
      }
      
      // Cast paymentIntent to include charges for expanded object
      const expandedPaymentIntent = paymentIntent as Stripe.PaymentIntent & {
        charges?: Stripe.ApiList<Stripe.Charge>;
      };
      
      if (expandedPaymentIntent.charges && expandedPaymentIntent.charges.data && expandedPaymentIntent.charges.data.length > 0) {
        const charge = expandedPaymentIntent.charges.data[0];
        if (charge.payment_method_details?.card) {
          transaction.card_last4 = charge.payment_method_details.card.last4 || undefined;
          transaction.card_brand = charge.payment_method_details.card.brand || undefined;
        }
        transaction.fee_amount = charge.application_fee_amount || 0;
        transaction.net_amount = paymentIntent.amount - (charge.application_fee_amount || 0);
      }
      
      if (paymentIntent.last_payment_error) {
        transaction.failure_code = paymentIntent.last_payment_error.code || '';
        transaction.failure_message = paymentIntent.last_payment_error.message || '';
      }
      
      transaction.processed_at = new Date();
      await transaction.save();
    } catch (error) {
      console.error('Error updating payment intent from webhook:', error);
    }
  }
}
