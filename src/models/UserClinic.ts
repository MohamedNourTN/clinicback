import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPermissionOverride {
  permission_name: string;
  granted: boolean;
  granted_at: Date;
  granted_by: Types.ObjectId;
  reason?: string;
}

export interface IUserRole {
  role_id: Types.ObjectId;
  assigned_at: Date;
  assigned_by: Types.ObjectId;
  is_primary: boolean; // One role must be primary
}

export interface IPermissionAudit {
  action: 'granted' | 'revoked' | 'role_assigned' | 'role_removed';
  permission_name?: string;
  role_id?: Types.ObjectId;
  performed_by: Types.ObjectId;
  performed_at: Date;
  reason?: string;
  old_value?: any;
  new_value?: any;
}

export interface IUserClinic extends Document {
  _id: Types.ObjectId;
  tenant_id: Types.ObjectId;
  user_id: Types.ObjectId;
  clinic_id: Types.ObjectId;
  roles: IUserRole[]; // Multiple roles per user per clinic
  permission_overrides: IPermissionOverride[]; // Individual permission overrides
  is_active: boolean;
  joined_at: Date;
  last_login?: Date;
  permission_audit: IPermissionAudit[]; // Audit trail
  created_at: Date;
  updated_at: Date;
  
  // Virtual properties
  primary_role?: Types.ObjectId;
  effective_permissions?: string[];
  
  // Methods
  assignRole(roleId: Types.ObjectId, assignedBy: Types.ObjectId, isPrimary?: boolean): Promise<IUserClinic>;
  removeRole(roleId: Types.ObjectId, removedBy: Types.ObjectId, reason?: string): Promise<IUserClinic>;
  grantPermission(permissionName: string, grantedBy: Types.ObjectId, reason?: string): Promise<IUserClinic>;
  revokePermission(permissionName: string, revokedBy: Types.ObjectId, reason?: string): Promise<IUserClinic>;
  hasPermission(permissionName: string): Promise<boolean>;
  getEffectivePermissions(): Promise<string[]>;
  hasRole(roleId: Types.ObjectId): boolean;
  getPrimaryRole(): Promise<any>;
  auditPermissionChange(action: string, performedBy: Types.ObjectId, details?: any): void;
}

const PermissionOverrideSchema: Schema = new Schema({
  permission_name: {
    type: String,
    required: [true, 'Permission name is required'],
    trim: true,
    lowercase: true
  },
  granted: {
    type: Boolean,
    required: [true, 'Granted status is required']
  },
  granted_at: {
    type: Date,
    default: Date.now
  },
  granted_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Granted by user is required']
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  }
}, { _id: false });

const UserRoleSchema: Schema = new Schema({
  role_id: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role ID is required']
  },
  assigned_at: {
    type: Date,
    default: Date.now
  },
  assigned_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned by user is required']
  },
  is_primary: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const PermissionAuditSchema: Schema = new Schema({
  action: {
    type: String,
    enum: ['granted', 'revoked', 'role_assigned', 'role_removed'],
    required: [true, 'Action is required']
  },
  permission_name: {
    type: String,
    trim: true,
    lowercase: true
  },
  role_id: {
    type: Schema.Types.ObjectId,
    ref: 'Role'
  },
  performed_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Performed by user is required']
  },
  performed_at: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  old_value: {
    type: Schema.Types.Mixed
  },
  new_value: {
    type: Schema.Types.Mixed
  }
}, { _id: false });

const UserClinicSchema: Schema = new Schema({
  tenant_id: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  clinic_id: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  roles: {
    type: [UserRoleSchema],
    default: [],
    validate: {
      validator: function(roles: IUserRole[]) {
        // Ensure at least one role is assigned
        if (roles.length === 0) return false;
        
        // Ensure only one primary role
        const primaryRoles = roles.filter(role => role.is_primary);
        return primaryRoles.length === 1;
      },
      message: 'User must have exactly one primary role'
    }
  },
  permission_overrides: {
    type: [PermissionOverrideSchema],
    default: []
  },
  is_active: {
    type: Boolean,
    default: true
  },
  joined_at: {
    type: Date,
    default: Date.now
  },
  last_login: {
    type: Date
  },
  permission_audit: {
    type: [PermissionAuditSchema],
    default: []
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for better performance with tenant awareness
UserClinicSchema.index({ tenant_id: 1 });
UserClinicSchema.index({ tenant_id: 1, user_id: 1, clinic_id: 1 }, { unique: true });
UserClinicSchema.index({ tenant_id: 1, user_id: 1, is_active: 1 });
UserClinicSchema.index({ tenant_id: 1, clinic_id: 1, is_active: 1 });
UserClinicSchema.index({ tenant_id: 1, 'roles.role_id': 1 });
UserClinicSchema.index({ tenant_id: 1, 'roles.is_primary': 1 });
UserClinicSchema.index({ tenant_id: 1, 'permission_overrides.permission_name': 1 });
UserClinicSchema.index({ tenant_id: 1, 'permission_audit.performed_at': -1 });

// Text search index for audit trail
UserClinicSchema.index({
  'permission_audit.action': 'text',
  'permission_audit.permission_name': 'text',
  'permission_audit.reason': 'text'
});

// Virtual to get primary role
UserClinicSchema.virtual('primary_role').get(function(this: IUserClinic) {
  const primaryRole = this.roles.find(role => role.is_primary);
  return primaryRole ? primaryRole.role_id : null;
});

// Static methods
UserClinicSchema.statics.findUserClinics = function(userId: string) {
  return this.find({ user_id: userId, is_active: true })
    .populate('clinic_id', 'name code description is_active')
    .populate('roles.role_id', 'name display_name color icon priority')
    .sort({ joined_at: 1 });
};

UserClinicSchema.statics.findClinicUsers = function(clinicId: string) {
  return this.find({ clinic_id: clinicId, is_active: true })
    .populate('user_id', 'first_name last_name email phone is_active')
    .populate('roles.role_id', 'name display_name color icon priority')
    .sort({ joined_at: 1 });
};

UserClinicSchema.statics.findUserClinicRelation = function(userId: string, clinicId: string) {
  return this.findOne({ 
    user_id: userId, 
    clinic_id: clinicId, 
    is_active: true 
  })
  .populate('clinic_id user_id')
  .populate('roles.role_id', 'name display_name permissions');
};

UserClinicSchema.statics.getUserPermissions = function(userId: string, clinicId: string) {
  return this.findOne({ 
    user_id: userId, 
    clinic_id: clinicId, 
    is_active: true 
  })
  .populate('roles.role_id', 'permissions')
  .select('roles permission_overrides');
};

UserClinicSchema.statics.getClinicAdmins = function(clinicId: string) {
  return this.find({ 
    clinic_id: clinicId,
    is_active: true,
    'roles.role_id': { $exists: true }
  })
  .populate({
    path: 'roles.role_id',
    match: { name: 'admin' }
  })
  .populate('user_id', 'first_name last_name email phone');
};

UserClinicSchema.statics.findUsersByRole = function(clinicId: string, roleName: string) {
  return this.find({ 
    clinic_id: clinicId,
    is_active: true
  })
  .populate({
    path: 'roles.role_id',
    match: { name: roleName, is_active: true }
  })
  .populate('user_id', 'first_name last_name email phone');
};

UserClinicSchema.statics.getUsersWithPermission = function(clinicId: string, permissionName: string) {
  return this.find({ 
    clinic_id: clinicId,
    is_active: true,
    $or: [
      { 'permission_overrides.permission_name': permissionName, 'permission_overrides.granted': true },
      { 'roles.role_id': { $exists: true } } // Will need to check role permissions separately
    ]
  })
  .populate('roles.role_id', 'permissions')
  .populate('user_id', 'first_name last_name email');
};

// Instance methods
UserClinicSchema.methods.activate = function() {
  this.is_active = true;
  this.auditPermissionChange('account_activated', this.user_id);
  return this.save();
};

UserClinicSchema.methods.deactivate = function() {
  this.is_active = false;
  this.auditPermissionChange('account_deactivated', this.user_id);
  return this.save();
};

// Method to assign a role to the user
UserClinicSchema.methods.assignRole = function(this: IUserClinic, roleId: Types.ObjectId, assignedBy: Types.ObjectId, isPrimary: boolean = false) {
  // Check if role already exists
  const existingRole = this.roles.find(role => role.role_id.equals(roleId));
  
  if (existingRole) {
    existingRole.is_primary = isPrimary;
    existingRole.assigned_at = new Date();
    existingRole.assigned_by = assignedBy;
  } else {
    // If this is the first role or setting as primary, make sure only one primary exists
    if (isPrimary || this.roles.length === 0) {
      this.roles.forEach(role => role.is_primary = false);
      isPrimary = true;
    }
    
    this.roles.push({
      role_id: roleId,
      assigned_at: new Date(),
      assigned_by: assignedBy,
      is_primary: isPrimary
    });
  }
  
  this.auditPermissionChange('role_assigned', assignedBy, { role_id: roleId, is_primary: isPrimary });
  return this.save();
};

// Method to remove a role from the user
UserClinicSchema.methods.removeRole = function(this: IUserClinic, roleId: Types.ObjectId, removedBy: Types.ObjectId, reason?: string) {
  const roleIndex = this.roles.findIndex(role => role.role_id.equals(roleId));
  
  if (roleIndex === -1) {
    throw new Error('Role not found');
  }
  
  const removedRole = this.roles[roleIndex];
  
  // Cannot remove the last role
  if (this.roles.length === 1) {
    throw new Error('Cannot remove the last role. User must have at least one role.');
  }
  
  // If removing primary role, make another role primary
  if (removedRole.is_primary && this.roles.length > 1) {
    const nextRole = this.roles.find((role, index) => index !== roleIndex);
    if (nextRole) {
      nextRole.is_primary = true;
    }
  }
  
  this.roles.splice(roleIndex, 1);
  this.auditPermissionChange('role_removed', removedBy, { role_id: roleId, reason });
  return this.save();
};

// Method to grant individual permission
UserClinicSchema.methods.grantPermission = function(this: IUserClinic, permissionName: string, grantedBy: Types.ObjectId, reason?: string) {
  // Check if permission override already exists
  const existingOverride = this.permission_overrides.find(override => override.permission_name === permissionName);
  
  if (existingOverride) {
    existingOverride.granted = true;
    existingOverride.granted_at = new Date();
    existingOverride.granted_by = grantedBy;
    if (reason) existingOverride.reason = reason;
  } else {
    this.permission_overrides.push({
      permission_name: permissionName,
      granted: true,
      granted_at: new Date(),
      granted_by: grantedBy,
      reason
    });
  }
  
  this.auditPermissionChange('granted', grantedBy, { permission_name: permissionName, reason });
  return this.save();
};

// Method to revoke individual permission
UserClinicSchema.methods.revokePermission = function(this: IUserClinic, permissionName: string, revokedBy: Types.ObjectId, reason?: string) {
  // Add or update permission override to deny
  const existingOverride = this.permission_overrides.find(override => override.permission_name === permissionName);
  
  if (existingOverride) {
    existingOverride.granted = false;
    existingOverride.granted_at = new Date();
    existingOverride.granted_by = revokedBy;
    if (reason) existingOverride.reason = reason;
  } else {
    this.permission_overrides.push({
      permission_name: permissionName,
      granted: false,
      granted_at: new Date(),
      granted_by: revokedBy,
      reason
    });
  }
  
  this.auditPermissionChange('revoked', revokedBy, { permission_name: permissionName, reason });
  return this.save();
};

// Method to check if user has specific permission
UserClinicSchema.methods.hasPermission = async function(this: IUserClinic, permissionName: string): Promise<boolean> {
  // First check permission overrides
  const override = this.permission_overrides.find(override => override.permission_name === permissionName);
  if (override) {
    return override.granted;
  }
  
  // Then check role permissions
  await this.populate('roles.role_id');
  
  for (const userRole of this.roles) {
    const role = userRole.role_id as any; // populated role
    if (role && role.permissions) {
      const rolePermission = role.permissions.find((perm: any) => perm.permission_name === permissionName);
      if (rolePermission && rolePermission.granted) {
        return true;
      }
    }
  }
  
  return false;
};

// Method to get all effective permissions
UserClinicSchema.methods.getEffectivePermissions = async function(this: IUserClinic): Promise<string[]> {
  const effectivePermissions = new Set<string>();
  
  // Get permissions from all roles
  await this.populate('roles.role_id');
  
  for (const userRole of this.roles) {
    const role = userRole.role_id as any; // populated role
    if (role && role.getEffectivePermissions) {
      const rolePermissions = await role.getEffectivePermissions();
      rolePermissions.forEach((permission: string) => effectivePermissions.add(permission));
    }
  }
  
  // Apply permission overrides
  this.permission_overrides.forEach(override => {
    if (override.granted) {
      effectivePermissions.add(override.permission_name);
    } else {
      effectivePermissions.delete(override.permission_name);
    }
  });
  
  return Array.from(effectivePermissions);
};

// Method to check if user has specific role
UserClinicSchema.methods.hasRole = function(this: IUserClinic, roleId: Types.ObjectId): boolean {
  return this.roles.some(role => role.role_id.equals(roleId));
};

// Method to get primary role
UserClinicSchema.methods.getPrimaryRole = async function(this: IUserClinic) {
  const primaryRole = this.roles.find(role => role.is_primary);
  if (primaryRole) {
    await this.populate('roles.role_id');
    return primaryRole.role_id;
  }
  return null;
};

// Method to audit permission changes
UserClinicSchema.methods.auditPermissionChange = function(this: IUserClinic, action: string, performedBy: Types.ObjectId, details?: any) {
  this.permission_audit.push({
    action: action as any,
    permission_name: details?.permission_name,
    role_id: details?.role_id,
    performed_by: performedBy,
    performed_at: new Date(),
    reason: details?.reason,
    old_value: details?.old_value,
    new_value: details?.new_value
  });
  
  // Keep only last 100 audit entries per user
  if (this.permission_audit.length > 100) {
    this.permission_audit = this.permission_audit.slice(-100);
  }
};

// Pre-save middleware
UserClinicSchema.pre<IUserClinic>('save', function(next) {
  if (!this.isNew) {
    this.updated_at = new Date();
  }
  
  // Ensure at least one role is assigned for new users
  if (this.isNew && this.roles.length === 0) {
    return next(new Error('User must be assigned at least one role'));
  }
  
  // Ensure exactly one primary role
  const primaryRoles = this.roles.filter(role => role.is_primary);
  if (primaryRoles.length === 0 && this.roles.length > 0) {
    // Set first role as primary if none specified
    this.roles[0].is_primary = true;
  } else if (primaryRoles.length > 1) {
    // Keep only the first primary role
    let foundPrimary = false;
    this.roles.forEach(role => {
      if (role.is_primary && !foundPrimary) {
        foundPrimary = true;
      } else if (role.is_primary && foundPrimary) {
        role.is_primary = false;
      }
    });
  }
  
  next();
});

// Pre-save validation to ensure user-clinic combination is unique
UserClinicSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existing = await mongoose.model('UserClinic').findOne({
      user_id: this.user_id,
      clinic_id: this.clinic_id
    });
    
    if (existing) {
      const error = new Error('User is already associated with this clinic');
      return next(error);
    }
  }
  next();
});

// Pre-remove middleware to audit deletion
UserClinicSchema.pre('deleteOne', function(this: IUserClinic, next) {
  this.auditPermissionChange('user_clinic_deleted', this.user_id);
  next();
});

// Virtual to include virtuals in JSON output
UserClinicSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.id; // Remove the virtual id field that mongoose adds
    return ret;
  }
});

UserClinicSchema.set('toObject', { virtuals: true });

export const UserClinic = mongoose.model<IUserClinic>('UserClinic', UserClinicSchema);
export default UserClinic; 