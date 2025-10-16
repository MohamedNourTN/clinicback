import { Response } from 'express';
import { AuthRequest } from '../types/express';
import Role from '../models/Role';

export default class RoleController {
  static async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.tenant_id) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return;
      }

      const roles = await Role.find({ 
        tenant_id: req.user.tenant_id,
        is_active: true 
      }).sort({ priority: -1 });
      
      // Attach effective permissions
      const withPerms = await Promise.all(roles.map(async (r) => ({
        _id: r._id,
        name: r.name,
        display_name: r.display_name,
        is_system_role: r.is_system_role,
        effective_permissions: await r.getEffectivePermissions(),
      })));
      res.json({ success: true, data: { roles: withPerms } });
    } catch (error) {
      console.error('Error listing roles:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch roles' });
    }
  }

  static async updatePermissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.tenant_id) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return;
      }

      const roleId = req.params.id;
      const { permissions } = req.body as { permissions: string[] };
      if (!Array.isArray(permissions)) {
        res.status(400).json({ success: false, message: 'permissions must be an array' });
        return;
      }
      
      const role = await Role.findOne({ 
        _id: roleId,
        tenant_id: req.user.tenant_id 
      });
      if (!role) {
        res.status(404).json({ success: false, message: 'Role not found' });
        return;
      }
      
      // Replace permissions with given names
      role.permissions = permissions.map((p) => ({ permission_name: p, granted: true } as any));
      await role.save();
      res.json({ success: true, message: 'Permissions updated', data: { effective_permissions: await role.getEffectivePermissions() } });
    } catch (error) {
      console.error('Error updating role permissions:', error);
      res.status(500).json({ success: false, message: 'Failed to update role permissions' });
    }
  }
}


