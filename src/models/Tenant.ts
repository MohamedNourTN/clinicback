import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITenant extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  subdomain?: string;
  logo_url?: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  created_by: Types.ObjectId; // Reference to SuperAdmin who created this tenant
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date; // Soft delete field
}

// Interface for Tenant model with static methods
export interface ITenantModel extends mongoose.Model<ITenant> {
  findActiveBySlug(slug: string): Promise<ITenant | null>;
  findActiveBySubdomain(subdomain: string): Promise<ITenant | null>;
}

const TenantSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    maxlength: [100, 'Organization name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
    maxlength: [50, 'Slug cannot exceed 50 characters'],
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    maxlength: [255, 'Email cannot exceed 255 characters']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  subdomain: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true, // Allows multiple null values
    match: [/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'],
    maxlength: [50, 'Subdomain cannot exceed 50 characters'],
    index: true
  },
  logo_url: {
    type: String,
    trim: true,
    maxlength: [500, 'Logo URL cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    required: [true, 'Status is required'],
    default: 'pending',
    index: true
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    required: [true, 'Created by is required']
  },
  deleted_at: {
    type: Date,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for better query performance
TenantSchema.index({ slug: 1, deleted_at: 1 });
TenantSchema.index({ subdomain: 1, deleted_at: 1 });
TenantSchema.index({ status: 1, deleted_at: 1 });
TenantSchema.index({ created_by: 1, deleted_at: 1 });
TenantSchema.index({ created_at: -1 });

// Static method to find active tenant by slug
TenantSchema.statics.findActiveBySlug = function(slug: string) {
  return this.findOne({ 
    slug: slug.toLowerCase(), 
    deleted_at: { $exists: false } 
  });
};

// Static method to find active tenant by subdomain
TenantSchema.statics.findActiveBySubdomain = function(subdomain: string) {
  return this.findOne({ 
    subdomain: subdomain.toLowerCase(), 
    deleted_at: { $exists: false } 
  });
};

// Validate subdomain uniqueness only if provided
TenantSchema.pre('save', async function(next) {
  if (this.subdomain && this.isModified('subdomain')) {
    const existingTenant = await mongoose.model('Tenant').findOne({
      subdomain: this.subdomain,
      _id: { $ne: this._id },
      deleted_at: { $exists: false }
    });
    
    if (existingTenant) {
      const error = new Error('Subdomain already exists');
      return next(error);
    }
  }
  
  next();
});

// Validate slug uniqueness
TenantSchema.pre('save', async function(next) {
  if (this.isModified('slug')) {
    const existingTenant = await mongoose.model('Tenant').findOne({
      slug: this.slug,
      _id: { $ne: this._id },
      deleted_at: { $exists: false }
    });
    
    if (existingTenant) {
      const error = new Error('Slug already exists');
      return next(error);
    }
  }
  
  next();
});

// Remove sensitive fields from JSON output
TenantSchema.methods.toJSON = function() {
  const tenantObject = this.toObject();
  // Keep all fields for admin use
  return tenantObject;
};

// Virtual for full subdomain URL
TenantSchema.virtual('subdomain_url').get(function() {
  return this.subdomain ? `${this.subdomain}.clinicpro.com` : null;
});

export default mongoose.model<ITenant, ITenantModel>('Tenant', TenantSchema);
