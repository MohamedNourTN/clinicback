import mongoose, { Document, Schema, Types } from 'mongoose';

// Permission levels enum
export type PermissionLevel = 'none' | 'view' | 'create' | 'edit' | 'delete' | 'full';

// Module categories
export type ModuleCategory = 
  | 'user_management'
  | 'clinic_management'
  | 'patient_management'
  | 'appointment_management'
  | 'financial_management'
  | 'inventory_management'
  | 'lab_management'
  | 'department_management'
  | 'service_management'
  | 'prescription_management'
  | 'lead_management'
  | 'training_management'
  | 'dental_management'
  | 'analytics_reports'
  | 'settings'
  | 'permissions_management';

export interface IPermission extends Document {
  _id: Types.ObjectId;
  tenant_id: Types.ObjectId; // Tenant-specific permissions
  name: string; // e.g., "patients.view", "appointments.create"
  display_name: string; // User-friendly name
  description: string;
  module: ModuleCategory;
  sub_module?: string; // For nested modules like "invoices" under "financial_management"
  action: string; // view, create, edit, delete, export, etc.
  level: PermissionLevel;
  is_system_permission: boolean; // Cannot be deleted if true
  depends_on?: string[]; // Permissions that must be granted first
  conflicts_with?: string[]; // Permissions that cannot be granted together
  applies_to_clinic?: boolean; // If true, permission is clinic-specific
  created_at: Date;
  updated_at: Date;
}

const PermissionSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required']
  },
  name: {
    type: String,
    required: [true, 'Permission name is required'],
    trim: true,
    lowercase: true,
    maxlength: [100, 'Permission name cannot exceed 100 characters'],
    match: [/^[a-z_]+\.[a-z_]+$/, 'Permission name must follow pattern: module.action']
  },
  display_name: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [200, 'Display name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  module: {
    type: String,
    required: [true, 'Module is required'],
    enum: {
      values: [
        'user_management',
        'clinic_management',
        'patient_management',
        'appointment_management',
        'financial_management',
        'inventory_management',
        'lab_management',
        'department_management',
        'service_management',
        'prescription_management',
        'lead_management',
        'training_management',
        'dental_management',
        'analytics_reports',
        'settings',
        'permissions_management'
      ],
      message: 'Invalid module category'
    }
  },
  sub_module: {
    type: String,
    trim: true,
    maxlength: [100, 'Sub-module name cannot exceed 100 characters']
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
    lowercase: true,
    maxlength: [50, 'Action cannot exceed 50 characters'],
    enum: {
      values: [
        'view', 'create', 'edit', 'delete', 'export', 'import', 
        'approve', 'reject', 'assign', 'unassign', 'activate', 
        'deactivate', 'send', 'print', 'process', 'verify', 
        'deliver', 'dispense', 'convert', 'reschedule', 
        'cancel', 'refund', 'backup', 'restore', 'manage_permissions',
        'manage_roles', 'switch_clinic', 'ai_analysis', 'bulk_operations'
      ],
      message: 'Invalid action'
    }
  },
  level: {
    type: String,
    required: [true, 'Permission level is required'],
    enum: {
      values: ['none', 'view', 'create', 'edit', 'delete', 'full'],
      message: 'Invalid permission level'
    },
    default: 'view'
  },
  is_system_permission: {
    type: Boolean,
    default: true, // Most permissions are system-defined
    required: true
  },
  depends_on: [{
    type: String,
    trim: true,
    validate: {
      validator: function(permission: string) {
        return /^[a-z_]+\.[a-z_]+$/.test(permission);
      },
      message: 'Dependency permission must follow pattern: module.action'
    }
  }],
  conflicts_with: [{
    type: String,
    trim: true,
    validate: {
      validator: function(permission: string) {
        return /^[a-z_]+\.[a-z_]+$/.test(permission);
      },
      message: 'Conflicting permission must follow pattern: module.action'
    }
  }],
  applies_to_clinic: {
    type: Boolean,
    default: true,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance - make name unique per tenant
PermissionSchema.index({ tenant_id: 1, name: 1 }, { unique: true });
PermissionSchema.index({ tenant_id: 1 });
PermissionSchema.index({ tenant_id: 1, module: 1 });
PermissionSchema.index({ tenant_id: 1, module: 1, sub_module: 1 });
PermissionSchema.index({ action: 1 });
PermissionSchema.index({ level: 1 });
PermissionSchema.index({ is_system_permission: 1 });
PermissionSchema.index({ applies_to_clinic: 1 });

// Text search index
PermissionSchema.index({
  name: 'text',
  display_name: 'text',
  description: 'text'
});

// Virtual to get full permission identifier
PermissionSchema.virtual('full_name').get(function(this: IPermission) {
  return this.sub_module ? `${this.module}.${this.sub_module}.${this.action}` : `${this.module}.${this.action}`;
});

// Static method to find permissions by module for a tenant
PermissionSchema.statics.findByModule = function(tenantId: Types.ObjectId, module: ModuleCategory, subModule?: string) {
  const query: any = { tenant_id: tenantId, module };
  if (subModule) {
    query.sub_module = subModule;
  }
  return this.find(query).sort({ module: 1, sub_module: 1, action: 1 });
};

// Static method to find system permissions for a tenant
PermissionSchema.statics.findSystemPermissions = function(tenantId: Types.ObjectId) {
  return this.find({ tenant_id: tenantId, is_system_permission: true }).sort({ module: 1, action: 1 });
};

// Static method to find all permissions for a tenant
PermissionSchema.statics.findByTenant = function(tenantId: Types.ObjectId) {
  return this.find({ tenant_id: tenantId }).sort({ module: 1, sub_module: 1, action: 1 });
};

// Method to check if permission can be granted
PermissionSchema.methods.canBeGranted = function(this: IPermission, grantedPermissions: string[]) {
  // Check dependencies
  if (this.depends_on && this.depends_on.length > 0) {
    const hasAllDependencies = this.depends_on.every(dep => grantedPermissions.includes(dep));
    if (!hasAllDependencies) {
      return {
        canGrant: false,
        reason: `Missing required permissions: ${this.depends_on.filter(dep => !grantedPermissions.includes(dep)).join(', ')}`
      };
    }
  }

  // Check conflicts
  if (this.conflicts_with && this.conflicts_with.length > 0) {
    const hasConflicts = this.conflicts_with.some(conflict => grantedPermissions.includes(conflict));
    if (hasConflicts) {
      return {
        canGrant: false,
        reason: `Conflicts with existing permissions: ${this.conflicts_with.filter(conflict => grantedPermissions.includes(conflict)).join(', ')}`
      };
    }
  }

  return { canGrant: true };
};

// Removed pre-save middleware that was overriding permission names
// Permission names are now explicitly set by the seeder

export default mongoose.model<IPermission>('Permission', PermissionSchema);
