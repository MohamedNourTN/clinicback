import { Request, Response } from 'express';
import { Tenant } from '../../models';

/**
 * Public Tenant Controller
 * Handles public tenant operations (no auth required)
 */
export class PublicTenantController {
  /**
   * Get all active tenants for tenant selection
   * GET /api/public/tenants
   */
  static async getActiveTenants(req: Request, res: Response): Promise<void> {
    try {
      const tenants = await Tenant.find(
        { 
          status: 'active',
          deleted_at: null 
        },
        {
          id: 1,
          name: 1,
          slug: 1,
          subdomain: 1,
          logo_url: 1,
          status: 1,
          created_at: 1
        }
      ).sort({ name: 1 }).limit(50);

      const transformedTenants = tenants.map(tenant => ({
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        logo_url: tenant.logo_url,
        status: tenant.status
      }));

      res.json({
        success: true,
        data: {
          tenants: transformedTenants,
          total: transformedTenants.length
        }
      });
      
    } catch (error: any) {
      console.error('Error fetching active tenants:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organizations',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get tenant by subdomain
   * GET /api/public/tenants/subdomain/:subdomain
   */
  static async getTenantBySubdomain(req: Request, res: Response): Promise<void> {
    try {
      const { subdomain } = req.params;

      if (!subdomain) {
        res.status(400).json({
          success: false,
          message: 'Subdomain parameter is required'
        });
        return;
      }

      const tenant = await Tenant.findOne(
        { 
          $or: [
            { subdomain: subdomain },
            { slug: subdomain }  // Also check slug for flexibility
          ],
          deleted_at: null 
        },
        {
          id: 1,
          name: 1,
          slug: 1,
          subdomain: 1,
          logo_url: 1,
          status: 1,
          email: 1,
          created_at: 1
        }
      );

      if (!tenant) {
        res.status(404).json({
          success: false,
          message: 'Organization not found',
          error: 'TENANT_NOT_FOUND'
        });
        return;
      }

      if (tenant.status !== 'active') {
        res.status(403).json({
          success: false,
          message: 'Organization is not active',
          error: 'TENANT_INACTIVE'
        });
        return;
      }

      const transformedTenant = {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
          subdomain: tenant.subdomain,
          logo_url: tenant.logo_url,
          status: tenant.status,
          email: tenant.email
      };

      res.json({
        success: true,
        data: {
          tenant: transformedTenant
        }
      });
      
    } catch (error: any) {
      console.error('Error fetching tenant by subdomain:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organization',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Validate tenant subdomain
   * GET /api/public/tenants/validate/:subdomain
   */
  static async validateTenantSubdomain(req: Request, res: Response): Promise<void> {
    try {
      const { subdomain } = req.params;

      if (!subdomain) {
        res.status(400).json({
          success: false,
          message: 'Subdomain parameter is required'
        });
        return;
      }

      const tenant = await Tenant.findOne(
        { 
          $or: [
            { subdomain: subdomain },
            { slug: subdomain }
          ],
          status: 'active',
          deleted_at: null 
        },
        { _id: 1, status: 1, name: 1 }
      );

      const isValid = !!tenant;

      res.json({
        success: true,
        data: {
          valid: isValid,
          tenant: isValid ? {
            id: tenant!._id.toString(),
            name: tenant!.name,
            status: tenant!.status
          } : null
        }
      });
      
    } catch (error: any) {
      console.error('Error validating tenant subdomain:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate organization',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

export default PublicTenantController;
