import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Tenant } from '../../models';
import { AuthRequest } from '../../types/express';

export class TenantController {
  // Get all tenants with pagination and filtering
  static async getAllTenants(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      const search = req.query.search as string || '';
      const status = req.query.status as string;
      const sortBy = req.query.sortBy as string || 'created_at';
      const sortOrder = req.query.sortOrder as string || 'desc';

      // Build filter object
      const filter: any = { deleted_at: { $exists: false } };

      // Add search filter
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
          { subdomain: { $regex: search, $options: 'i' } }
        ];
      }

      // Add status filter
      if (status && status !== 'all') {
        filter.status = status;
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const tenants = await Tenant.find(filter)
        .populate('created_by', 'first_name last_name email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      const totalTenants = await Tenant.countDocuments(filter);

      // Get statistics
      const stats = {
        total: await Tenant.countDocuments({ deleted_at: { $exists: false } }),
        active: await Tenant.countDocuments({ status: 'active', deleted_at: { $exists: false } }),
        pending: await Tenant.countDocuments({ status: 'pending', deleted_at: { $exists: false } }),
        suspended: await Tenant.countDocuments({ status: 'suspended', deleted_at: { $exists: false } }),
        inactive: await Tenant.countDocuments({ status: 'inactive', deleted_at: { $exists: false } })
      };

      res.json({
        success: true,
        data: {
          tenants,
          pagination: {
            page,
            limit,
            total: totalTenants,
            pages: Math.ceil(totalTenants / limit)
          },
          stats
        }
      });
    } catch (error) {
      console.error('Get all tenants error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get tenant by ID
  static async getTenantById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const tenant = await Tenant.findOne({
        _id: id,
        deleted_at: { $exists: false }
      }).populate('created_by', 'first_name last_name email');

      if (!tenant) {
        res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { tenant }
      });
    } catch (error) {
      console.error('Get tenant by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Create new tenant
  static async createTenant(req: AuthRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { name, slug, email, phone, subdomain, logo_url, status } = req.body;

      // Check if slug already exists
      const existingSlug = await Tenant.findOne({
        slug: slug.toLowerCase(),
        deleted_at: { $exists: false }
      });

      if (existingSlug) {
        res.status(409).json({
          success: false,
          message: 'A tenant with this slug already exists'
        });
        return;
      }

      // Check if subdomain already exists (if provided)
      if (subdomain) {
        const existingSubdomain = await Tenant.findOne({
          subdomain: subdomain.toLowerCase(),
          deleted_at: { $exists: false }
        });

        if (existingSubdomain) {
          res.status(409).json({
            success: false,
            message: 'A tenant with this subdomain already exists'
          });
          return;
        }
      }

      // Create new tenant
      const tenant = new Tenant({
        name: name.trim(),
        slug: slug.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim(),
        subdomain: subdomain?.toLowerCase().trim(),
        logo_url: logo_url?.trim(),
        status: status || 'pending',
        created_by: req.user?.id
      });

      await tenant.save();

      // Populate created_by field for response
      await tenant.populate('created_by', 'first_name last_name email');

      res.status(201).json({
        success: true,
        message: 'Tenant created successfully',
        data: { tenant }
      });
    } catch (error) {
      console.error('Create tenant error:', error);
      
      // Handle mongoose validation errors
      if (error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: Object.values(error.errors).map((err: any) => ({
            field: err.path,
            message: err.message
          }))
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Update tenant
  static async updateTenant(req: AuthRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const { name, slug, email, phone, subdomain, logo_url, status } = req.body;

      // Find existing tenant
      const existingTenant = await Tenant.findOne({
        _id: id,
        deleted_at: { $exists: false }
      });

      if (!existingTenant) {
        res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
        return;
      }

      // Check if slug already exists (excluding current tenant)
      if (slug && slug !== existingTenant.slug) {
        const existingSlug = await Tenant.findOne({
          slug: slug.toLowerCase(),
          _id: { $ne: id },
          deleted_at: { $exists: false }
        });

        if (existingSlug) {
          res.status(409).json({
            success: false,
            message: 'A tenant with this slug already exists'
          });
          return;
        }
      }

      // Check if subdomain already exists (excluding current tenant)
      if (subdomain && subdomain !== existingTenant.subdomain) {
        const existingSubdomain = await Tenant.findOne({
          subdomain: subdomain.toLowerCase(),
          _id: { $ne: id },
          deleted_at: { $exists: false }
        });

        if (existingSubdomain) {
          res.status(409).json({
            success: false,
            message: 'A tenant with this subdomain already exists'
          });
          return;
        }
      }

      // Update tenant
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (slug !== undefined) updates.slug = slug.toLowerCase().trim();
      if (email !== undefined) updates.email = email.toLowerCase().trim();
      if (phone !== undefined) updates.phone = phone?.trim();
      if (subdomain !== undefined) updates.subdomain = subdomain?.toLowerCase().trim();
      if (logo_url !== undefined) updates.logo_url = logo_url?.trim();
      if (status !== undefined) updates.status = status;

      const tenant = await Tenant.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      ).populate('created_by', 'first_name last_name email');

      res.json({
        success: true,
        message: 'Tenant updated successfully',
        data: { tenant }
      });
    } catch (error) {
      console.error('Update tenant error:', error);
      
      // Handle mongoose validation errors
      if (error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: Object.values(error.errors).map((err: any) => ({
            field: err.path,
            message: err.message
          }))
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Soft delete tenant
  static async deleteTenant(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const tenant = await Tenant.findOneAndUpdate(
        {
          _id: id,
          deleted_at: { $exists: false }
        },
        { deleted_at: new Date() },
        { new: true }
      ).populate('created_by', 'first_name last_name email');

      if (!tenant) {
        res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Tenant deleted successfully',
        data: { tenant }
      });
    } catch (error) {
      console.error('Delete tenant error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Restore soft deleted tenant
  static async restoreTenant(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const tenant = await Tenant.findOneAndUpdate(
        {
          _id: id,
          deleted_at: { $exists: true }
        },
        { $unset: { deleted_at: 1 } },
        { new: true }
      ).populate('created_by', 'first_name last_name email');

      if (!tenant) {
        res.status(404).json({
          success: false,
          message: 'Deleted tenant not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Tenant restored successfully',
        data: { tenant }
      });
    } catch (error) {
      console.error('Restore tenant error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get tenant statistics
  static async getTenantStats(req: Request, res: Response) {
    try {
      const stats = {
        total: await Tenant.countDocuments({ deleted_at: { $exists: false } }),
        active: await Tenant.countDocuments({ status: 'active', deleted_at: { $exists: false } }),
        pending: await Tenant.countDocuments({ status: 'pending', deleted_at: { $exists: false } }),
        suspended: await Tenant.countDocuments({ status: 'suspended', deleted_at: { $exists: false } }),
        inactive: await Tenant.countDocuments({ status: 'inactive', deleted_at: { $exists: false } }),
        deleted: await Tenant.countDocuments({ deleted_at: { $exists: true } })
      };

      // Get recent tenants
      const recentTenants = await Tenant.find({ deleted_at: { $exists: false } })
        .sort({ created_at: -1 })
        .limit(5)
        .select('name slug status created_at')
        .lean();

      res.json({
        success: true,
        data: {
          stats,
          recentTenants
        }
      });
    } catch (error) {
      console.error('Get tenant stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Check if slug is available
  static async checkSlugAvailability(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const { excludeId } = req.query;

      const filter: any = {
        slug: slug.toLowerCase(),
        deleted_at: { $exists: false }
      };

      if (excludeId) {
        filter._id = { $ne: excludeId };
      }

      const existingTenant = await Tenant.findOne(filter);

      res.json({
        success: true,
        data: {
          available: !existingTenant,
          slug: slug.toLowerCase()
        }
      });
    } catch (error) {
      console.error('Check slug availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Check if subdomain is available
  static async checkSubdomainAvailability(req: Request, res: Response) {
    try {
      const { subdomain } = req.params;
      const { excludeId } = req.query;

      const filter: any = {
        subdomain: subdomain.toLowerCase(),
        deleted_at: { $exists: false }
      };

      if (excludeId) {
        filter._id = { $ne: excludeId };
      }

      const existingTenant = await Tenant.findOne(filter);

      res.json({
        success: true,
        data: {
          available: !existingTenant,
          subdomain: subdomain.toLowerCase(),
          full_url: `${subdomain.toLowerCase()}.clinicpro.com`
        }
      });
    } catch (error) {
      console.error('Check subdomain availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
