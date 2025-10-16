import { Router } from 'express';
import RoleController from '../controllers/roleController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// List roles (admin only)
router.get('/', ...requireAdmin, RoleController.list);

// Update role permissions
router.put('/:id/permissions', ...requireAdmin, RoleController.updatePermissions);

export default router;


