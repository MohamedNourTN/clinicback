import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRolePermission {
  permission_name: string; // Reference to Permission.name
  granted: boolean;
  granted_at?: Date;
  granted_by?: Types.ObjectId; // User who granted this permission
}

export interface IRole extends Document {
  _id: Types.ObjectId;
  tenant_id: Types.ObjectId; // Tenant-specific roles
  name: string;
  display_name: string;
  description: string;
  clinic_id?: Types.ObjectId; // If null, it's a system role
  is_system_role: boolean;
  is_active: boolean;
  inherits_from?: Types.ObjectId; // Parent role for inheritance
  permissions: IRolePermission[];
  user_count: number; // Number of users with this role
  color: string; // UI color for the role
  icon?: string; // UI icon for the role
  priority: number; // Higher number = higher priority
  can_be_modified: boolean;
  can_be_deleted: boolean;
  created_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
  
  // Virtual properties
  effective_permissions?: string[]; // Computed permissions including inherited ones
  
  // Methods
  addPermission(permissionName: string, grantedBy?: Types.ObjectId): Promise<IRole>;
  removePermission(permissionName: string): Promise<IRole>;
  hasPermission(permissionName: string): boolean;
  getEffectivePermissions(): Promise<string[]>;
  copyFromRole(sourceRoleId: Types.ObjectId, grantedBy?: Types.ObjectId): Promise<IRole>;
}

const RolePermissionSchema: Schema = new Schema({
  permission_name: {
    type: String,
    required: [true, 'Permission name is required'],
    trim: true,
    lowercase: true
  },
  granted: {
    type: Boolean,
    default: true,
    required: true
  },
  granted_at: {
    type: Date,
    default: Date.now
  },
  granted_by: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

const RoleSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required']
  },
  name: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true,
    lowercase: true,
    maxlength: [50, 'Role name cannot exceed 50 characters'],
    match: [/^[a-z_]+$/, 'Role name can only contain lowercase letters and underscores']
  },
  display_name: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic'
  },
  is_system_role: {
    type: Boolean,
    default: false,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true,
    required: true
  },
  inherits_from: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    validate: {
      validator: function(this: IRole, value: Types.ObjectId) {
        // Cannot inherit from itself
        return !value || !this._id.equals(value);
      },
      message: 'Role cannot inherit from itself'
    }
  },
  permissions: [RolePermissionSchema],
  user_count: {
    type: Number,
    default: 0,
    min: [0, 'User count cannot be negative']
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color']
  },
  icon: {
    type: String,
    trim: true,
    maxlength: [50, 'Icon name cannot exceed 50 characters']
  },
  priority: {
    type: Number,
    required: [true, 'Priority is required'],
    min: [1, 'Priority must be at least 1'],
    max: [100, 'Priority cannot exceed 100'],
    default: 50
  },
  can_be_modified: {
    type: Boolean,
    default: true,
    required: true
  },
  can_be_deleted: {
    type: Boolean,
    default: true,
    required: true
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance - make name unique per tenant
RoleSchema.index({ tenant_id: 1, name: 1, clinic_id: 1 }, { unique: true }); // Unique role name per tenant/clinic
RoleSchema.index({ tenant_id: 1 });
RoleSchema.index({ tenant_id: 1, clinic_id: 1, is_active: 1 });
RoleSchema.index({ tenant_id: 1, is_system_role: 1 });
RoleSchema.index({ priority: -1 });
RoleSchema.index({ created_by: 1 });

// Text search index
RoleSchema.index({
  name: 'text',
  display_name: 'text',
  description: 'text'
});

// Virtual to get effective permissions including inherited ones
RoleSchema.virtual('effective_permissions').get(function(this: IRole) {
  // This will be computed dynamically through the method
  return null;
});

// Static method to find system roles for a tenant
RoleSchema.statics.findSystemRoles = function(tenantId: Types.ObjectId) {
  return this.find({ tenant_id: tenantId, is_system_role: true, is_active: true }).sort({ priority: -1 });
};

// Static method to find clinic roles for a tenant
RoleSchema.statics.findClinicRoles = function(tenantId: Types.ObjectId, clinicId: Types.ObjectId) {
  return this.find({ 
    tenant_id: tenantId,
    $or: [
      { clinic_id: clinicId },
      { is_system_role: true }
    ],
    is_active: true 
  }).sort({ priority: -1 });
};

// Static method to find all roles for a tenant
RoleSchema.statics.findByTenant = function(tenantId: Types.ObjectId) {
  return this.find({ tenant_id: tenantId, is_active: true }).sort({ priority: -1 });
};

// Method to add a permission to the role
RoleSchema.methods.addPermission = function(this: IRole, permissionName: string, grantedBy?: Types.ObjectId) {
  // Check if permission already exists
  const existingPermission = this.permissions.find(p => p.permission_name === permissionName);
  
  if (existingPermission) {
    existingPermission.granted = true;
    existingPermission.granted_at = new Date();
    if (grantedBy) {
      existingPermission.granted_by = grantedBy;
    }
  } else {
    this.permissions.push({
      permission_name: permissionName,
      granted: true,
      granted_at: new Date(),
      granted_by: grantedBy
    });
  }
  
  return this.save();
};

// Method to remove a permission from the role
RoleSchema.methods.removePermission = function(this: IRole, permissionName: string) {
  this.permissions = this.permissions.filter(p => p.permission_name !== permissionName);
  return this.save();
};

// Method to check if role has a specific permission
RoleSchema.methods.hasPermission = function(this: IRole, permissionName: string) {
  const permission = this.permissions.find(p => p.permission_name === permissionName);
  return permission ? permission.granted : false;
};

// Method to get effective permissions including inherited ones
RoleSchema.methods.getEffectivePermissions = async function(this: IRole): Promise<string[]> {
  const effectivePermissions = new Set<string>();
  
  // Add own permissions
  this.permissions.forEach(permission => {
    if (permission.granted) {
      effectivePermissions.add(permission.permission_name);
    }
  });
  
  // Add inherited permissions
  if (this.inherits_from) {
    const parentRole = await mongoose.model('Role').findById(this.inherits_from);
    if (parentRole) {
      const parentPermissions = await parentRole.getEffectivePermissions();
      parentPermissions.forEach(permission => {
        effectivePermissions.add(permission);
      });
    }
  }
  
  return Array.from(effectivePermissions);
};

// Method to copy permissions from another role
RoleSchema.methods.copyFromRole = async function(this: IRole, sourceRoleId: Types.ObjectId, grantedBy?: Types.ObjectId) {
  const sourceRole = await mongoose.model('Role').findById(sourceRoleId);
  if (!sourceRole) {
    throw new Error('Source role not found');
  }
  
  // Get effective permissions from source role
  const sourcePermissions = await sourceRole.getEffectivePermissions();
  
  // Clear existing permissions
  this.permissions = [];
  
  // Add permissions from source role
  sourcePermissions.forEach(permissionName => {
    this.permissions.push({
      permission_name: permissionName,
      granted: true,
      granted_at: new Date(),
      granted_by: grantedBy
    });
  });
  
  return this.save();
};

// Pre-save middleware
RoleSchema.pre('save', function(next) {
  // System roles cannot be deleted or have clinic_id
  if (this.is_system_role) {
    this.clinic_id = undefined;
    this.can_be_deleted = false;
  }
  
  // Custom roles must have clinic_id
  if (!this.is_system_role && !this.clinic_id) {
    return next(new Error('Custom roles must be associated with a clinic'));
  }
  
  next();
});

// Pre-remove middleware to check if role can be deleted
RoleSchema.pre('deleteOne', function(this: IRole, next) {
  if (!this.can_be_deleted) {
    return next(new Error('This role cannot be deleted'));
  }
  
  if (this.user_count > 0) {
    return next(new Error('Cannot delete role that is assigned to users'));
  }
  
  next();
});

export default mongoose.model<IRole>('Role', RoleSchema);
