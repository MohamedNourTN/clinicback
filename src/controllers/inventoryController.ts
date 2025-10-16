import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Inventory } from '../models';
import { AuthRequest } from '../types/express';
import { getTenantScopedFilter, addTenantToData } from '../middleware/auth';

export class InventoryController {
  static async createInventoryItem(req: AuthRequest, res: Response): Promise<void> {
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

      // Add tenant_id to inventory data with validation
      const inventoryData = addTenantToData(req, {
        ...req.body,
        clinic_id: req.clinic_id
      });

      const inventoryItem = new Inventory(inventoryData);
      await inventoryItem.save();

      res.status(201).json({
        success: true,
        message: 'Inventory item created successfully',
        data: { inventoryItem }
      });
    } catch (error: any) {
      console.error('Create inventory item error:', error);
      if (error.code === 11000) {
        res.status(409).json({
          success: false,
          message: 'SKU already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getAllInventoryItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Apply tenant-scoped filtering
      let filter: any = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id
      });

      if (req.query.category) {
        filter.category = req.query.category;
      }

      if (req.query.low_stock === 'true') {
        filter.$expr = { $lte: ['$current_stock', '$minimum_stock'] };
      }

      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { sku: { $regex: req.query.search, $options: 'i' } },
          { supplier: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const inventoryItems = await Inventory.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ created_at: -1 });

      const totalItems = await Inventory.countDocuments(filter);

      res.json({
        success: true,
        data: {
          inventoryItems,
          pagination: {
            page,
            limit,
            total: totalItems,
            pages: Math.ceil(totalItems / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all inventory items error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getInventoryItemById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Apply tenant-scoped filtering for inventory item query
      const itemFilter = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      const inventoryItem = await Inventory.findOne(itemFilter);

      if (!inventoryItem) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { inventoryItem }
      });
    } catch (error) {
      console.error('Get inventory item by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateInventoryItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Apply tenant-scoped filtering for inventory update
      const updateFilter = getTenantScopedFilter(req, {
        _id: id,
        clinic_id: req.clinic_id
      });
      
      const inventoryItem = await Inventory.findOneAndUpdate(
        updateFilter,
        req.body,
        { new: true, runValidators: true }
      );

      if (!inventoryItem) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Inventory item updated successfully',
        data: { inventoryItem }
      });
    } catch (error) {
      console.error('Update inventory item error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deleteInventoryItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const inventoryItem = await Inventory.findOneAndDelete({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!inventoryItem) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Inventory item deleted successfully'
      });
    } catch (error) {
      console.error('Delete inventory item error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async updateStock(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { quantity, operation } = req.body;

      const inventoryItem = await Inventory.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });
      if (!inventoryItem) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
        return;
      }

      await inventoryItem.updateStock(quantity, operation);

      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: { inventoryItem }
      });
    } catch (error) {
      console.error('Update stock error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getLowStockItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Apply tenant-scoped filtering for low stock items
      const lowStockFilter = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id,
        $expr: { $lte: ['$current_stock', '$minimum_stock'] }
      });
      
      const inventoryItems = await Inventory.find(lowStockFilter)
        .sort({ current_stock: -1 });

      res.json({
        success: true,
        data: { inventoryItems }
      });
    } catch (error) {
      console.error('Get low stock items error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getExpiredItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const inventoryItems = await Inventory.find({
        clinic_id: req.clinic_id,
        expiry_date: { $lte: new Date() }
      }).sort({ expiry_date: -1 });

      res.json({
        success: true,
        data: { inventoryItems }
      });
    } catch (error) {
      console.error('Get expired items error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getExpiringItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const futureDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
      
      const inventoryItems = await Inventory.find({
        clinic_id: req.clinic_id,
        expiry_date: { 
          $gte: new Date(),
          $lte: futureDate 
        }
      }).sort({ expiry_date: -1 });

      res.json({
        success: true,
        data: { inventoryItems }
      });
    } catch (error) {
      console.error('Get expiring items error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getInventoryStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Apply tenant-scoped filtering for inventory stats
      const clinicFilter = getTenantScopedFilter(req, {
        clinic_id: req.clinic_id
      });
      const totalItems = await Inventory.countDocuments(clinicFilter);
      const lowStockItems = await Inventory.countDocuments({
        ...clinicFilter,
        $expr: { $lte: ['$current_stock', '$minimum_stock'] }
      });
      const outOfStockItems = await Inventory.countDocuments({ 
        ...clinicFilter,
        current_stock: 0 
      });
      const expiredItems = await Inventory.countDocuments({
        ...clinicFilter,
        expiry_date: { $lte: new Date() }
      });

      const totalValue = await Inventory.aggregate([
        { $match: clinicFilter },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$current_stock', '$unit_price'] } }
          }
        }
      ]);

      const categoryStats = await Inventory.aggregate([
        { $match: clinicFilter },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalValue: { $sum: { $multiply: ['$current_stock', '$unit_price'] } }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        data: {
          totalItems,
          lowStockItems,
          outOfStockItems,
          expiredItems,
          totalValue: totalValue[0]?.total || 0,
          categoryStats
        }
      });
    } catch (error) {
      console.error('Get inventory stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 