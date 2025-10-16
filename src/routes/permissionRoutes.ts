import { Router } from 'express';
import PermissionController from '../controllers/permissionController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// List all permissions (admin only)
router.get('/', ...requireAdmin, PermissionController.list);

export default router;


