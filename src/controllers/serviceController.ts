import { Response } from 'express';
import Service, { IService } from '../models/Service';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../types/express';

// Get all services with optional filtering
export const getServices = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter object with clinic context
    const filter: any = {
      tenant_id: req.tenant_id,
      clinic_id: req.clinic_id
    };
    
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }
    
    if (req.query.department && req.query.department !== 'all') {
      filter.department = req.query.department;
    }
    
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { department: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice as string);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice as string);
    }

    if (req.query.minDuration || req.query.maxDuration) {
      filter.duration = {};
      if (req.query.minDuration) filter.duration.$gte = parseInt(req.query.minDuration as string);
      if (req.query.maxDuration) filter.duration.$lte = parseInt(req.query.maxDuration as string);
    }

    const services = await Service.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Service.countDocuments(filter);

    return res.json({
      success: true,
      data: services,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get service by ID
export const getServiceById = async (req: AuthRequest, res: Response) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      tenant_id: req.tenant_id,
      clinic_id: req.clinic_id
    });
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    return res.json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create new service
export const createService = async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const serviceData = {
      ...req.body,
      tenant_id: req.tenant_id,
      clinic_id: req.clinic_id
    };

    const service = new Service(serviceData);
    await service.save();

    return res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update service
export const updateService = async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, tenant_id: req.tenant_id, clinic_id: req.clinic_id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    return res.json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete service
export const deleteService = async (req: AuthRequest, res: Response) => {
  try {
    const service = await Service.findOneAndDelete({
      _id: req.params.id,
      tenant_id: req.tenant_id,
      clinic_id: req.clinic_id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    return res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get service statistics
export const getServiceStats = async (req: AuthRequest, res: Response) => {
  try {
    const clinicFilter = { tenant_id: req.tenant_id, clinic_id: req.clinic_id };

    const totalServices = await Service.countDocuments(clinicFilter);
    const activeServices = await Service.countDocuments({ ...clinicFilter, isActive: true });
    const inactiveServices = await Service.countDocuments({ ...clinicFilter, isActive: false });

    // Category breakdown
    const categoryStats = await Service.aggregate([
      { $match: clinicFilter },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalRevenue: { $sum: '$price' },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Department breakdown
    const departmentStats = await Service.aggregate([
      { $match: clinicFilter },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalRevenue: { $sum: '$price' },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Price range distribution
    const priceRanges = await Service.aggregate([
      { $match: clinicFilter },
      {
        $bucket: {
          groupBy: '$price',
          boundaries: [0, 50, 100, 200, 500, 1000, Number.MAX_VALUE],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            avgDuration: { $avg: '$duration' }
          }
        }
      }
    ]);

    return res.json({
      success: true,
      data: {
        totalServices,
        activeServices,
        inactiveServices,
        categoryStats,
        departmentStats,
        priceRanges
      }
    });
  } catch (error) {
    console.error('Error fetching service stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Toggle service status
export const toggleServiceStatus = async (req: AuthRequest, res: Response) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      tenant_id: req.tenant_id,
      clinic_id: req.clinic_id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    service.isActive = !service.isActive;
    await service.save();

    return res.json({
      success: true,
      message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`,
      data: service
    });
  } catch (error) {
    console.error('Error toggling service status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 