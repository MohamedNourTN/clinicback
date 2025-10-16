import { Router } from 'express';
import { body } from 'express-validator';
import { InventoryController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Apply authentication middleware first, then clinic context to all routes
router.use(authenticate);
router.use(clinicContext);

// Validation middleware
const inventoryValidation = [
  body('name').notEmpty().withMessage('Item name is required'),
  body('category').isIn(['medications', 'medical-devices', 'consumables', 'equipment', 'laboratory', 'office-supplies', 'other']).withMessage('Invalid category'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('current_stock').isInt({ min: 0 }).withMessage('Current stock must be a non-negative integer'),
  body('minimum_stock').isInt({ min: 0 }).withMessage('Minimum stock must be a non-negative integer'),
  body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('supplier').notEmpty().withMessage('Supplier information is required'),
  body('expiry_date').optional().isISO8601().withMessage('Please provide a valid expiry date')
];

const stockUpdateValidation = [
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('operation').isIn(['add', 'subtract']).withMessage('Operation must be either add or subtract')
];

// Routes
router.post('/', inventoryValidation, InventoryController.createInventoryItem);
router.get('/', InventoryController.getAllInventoryItems);
router.get('/low-stock', InventoryController.getLowStockItems);
router.get('/expired', InventoryController.getExpiredItems);
router.get('/expiring', InventoryController.getExpiringItems);
router.get('/stats', InventoryController.getInventoryStats);
router.get('/:id', InventoryController.getInventoryItemById);
router.put('/:id', inventoryValidation, InventoryController.updateInventoryItem);
router.patch('/:id/stock', stockUpdateValidation, InventoryController.updateStock);
router.delete('/:id', InventoryController.deleteInventoryItem);

export default router; 