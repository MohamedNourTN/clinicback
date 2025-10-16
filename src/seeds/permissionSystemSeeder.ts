import mongoose from 'mongoose';
import { seedPermissions } from './permissionSeeder';
import { seedRoles } from './roleSeeder';
import UserClinic from '../models/UserClinic';
import Role from '../models/Role';

/**
 * Master seeder for the permission system
 * Runs all permission-related seeders in the correct order with tenant support
 */
export async function seedPermissionSystem(tenants: any[]) {
  try {
    console.log('🚀 Starting Tenant-Based Permission System Setup...\n');
    
    if (!tenants || tenants.length === 0) {
      throw new Error('No tenants provided for permission system setup');
    }
    
    console.log(`Setting up permissions for ${tenants.length} tenants:`)
    tenants.forEach(tenant => console.log(`  - ${tenant.name} (${tenant._id})`));
    console.log();
    
    // Step 0: Handle index migration for tenant-based permissions
    console.log('🔧 Step 0: Migrating Database Indexes');
    await migrateIndexes();
    console.log('✅ Index migration completed\n');
    
    // Step 1: Seed Permissions for all tenants
    console.log('📋 Step 1: Seeding Tenant-Based Permissions');
    const permissionResult = await seedPermissions(tenants);
    console.log(`✅ Permissions: ${permissionResult.created} created, ${permissionResult.updated} updated across ${permissionResult.tenants} tenants\n`);
    
    // Step 2: Seed Roles for all tenants
    console.log('👥 Step 2: Seeding Tenant-Based Roles');
    const roleResult = await seedRoles(tenants);
    console.log(`✅ Roles: ${roleResult.created} created, ${roleResult.updated} updated across ${roleResult.tenants} tenants\n`);
    
    // Step 3: Migrate existing users (if any)
    console.log('🔄 Step 3: Migrating Existing Users');
    const migrationResult = await migrateExistingUsers(tenants);
    console.log(`✅ Migration: ${migrationResult.migrated} users migrated, ${migrationResult.skipped} skipped\n`);
    
    console.log('🎉 Tenant-Based Permission System Setup Complete!');
    console.log('═'.repeat(60));
    console.log('Summary:');
    console.log(`- Tenants: ${tenants.length}`);
    console.log(`- Permissions per tenant: ${permissionResult.permissionsPerTenant}`);
    console.log(`- Total permissions: ${permissionResult.total}`);
    console.log(`- Roles per tenant: ${roleResult.rolesPerTenant}`);
    console.log(`- Total roles: ${roleResult.total}`);
    console.log(`- Users migrated: ${migrationResult.migrated}`);
    console.log('═'.repeat(60));
    
    return {
      permissions: permissionResult,
      roles: roleResult,
      migration: migrationResult
    };
  } catch (error) {
    console.error('❌ Error setting up tenant-based permission system:', error);
    throw error;
  }
}

/**
 * Migrate database indexes for tenant-based permissions
 */
async function migrateIndexes() {
  try {
    const db = mongoose.connection.db;
    
    if (!db) {
      console.log('  ⚠️  Database connection not available, skipping index migration');
      return;
    }
    
    // Handle Permission collection indexes
    console.log('  🔍 Migrating Permission collection indexes...');
    const permissionCollection = db.collection('permissions');
    
    try {
      // Try to drop the old unique index on 'name'
      await permissionCollection.dropIndex('name_1');
      console.log('    ✅ Dropped old permission name_1 index');
    } catch (error: any) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('    ℹ️  Old permission name_1 index not found (already dropped)');
      } else {
        console.log('    ⚠️  Could not drop old permission index:', error.message);
      }
    }
    
    // Handle Role collection indexes 
    console.log('  🔍 Migrating Role collection indexes...');
    const roleCollection = db.collection('roles');
    
    try {
      // Try to drop any conflicting indexes
      await roleCollection.dropIndex('name_1_clinic_id_1');
      console.log('    ✅ Dropped old role name_1_clinic_id_1 index');
    } catch (error: any) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('    ℹ️  Old role name_1_clinic_id_1 index not found (already dropped)');
      } else {
        console.log('    ⚠️  Could not drop old role index:', error.message);
      }
    }
    
    // The new tenant-based indexes will be created automatically by Mongoose
    console.log('  ✅ Index migration completed - new tenant-based indexes will be created automatically');
    
  } catch (error) {
    console.error('  ❌ Error during index migration:', error);
    // Don't throw - continue with seeding even if index migration partially fails
  }
}

/**
 * Migrate existing users from old role system to new permission system
 */
async function migrateExistingUsers(tenants: any[]) {
  try {
    console.log('Checking for existing users to migrate...');
    
    // Find all UserClinic records that might need migration
    // These would be records that have the old 'role' field but no roles array
    const usersToMigrate = await UserClinic.find({
      $or: [
        { roles: { $exists: false } },
        { roles: { $size: 0 } }
      ]
    }).populate('user_id clinic_id');
    
    console.log(`Found ${usersToMigrate.length} users that need migration`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const userClinic of usersToMigrate) {
      try {
        // Get the old role (this assumes the old model had a 'role' field)
        const oldRole = (userClinic as any).role;
        
        if (!oldRole) {
          console.log(`Skipping user ${userClinic.user_id} - no old role found`);
          skippedCount++;
          continue;
        }
        
        // Find the user's tenant_id from the clinic
        const clinic = await mongoose.model('Clinic').findById(userClinic.clinic_id);
        if (!clinic) {
          console.log(`Skipping user ${userClinic.user_id} - clinic not found`);
          skippedCount++;
          continue;
        }
        
        // Find the corresponding role in the new system for this tenant
        const newRole = await Role.findOne({ 
          tenant_id: clinic.tenant_id,
          name: oldRole, 
          is_system_role: true 
        });
        
        if (!newRole) {
          console.log(`Warning: Role '${oldRole}' not found for tenant '${clinic.tenant_id}' user ${userClinic.user_id}`);
          // Assign default 'staff' role
          const staffRole = await Role.findOne({ 
            tenant_id: clinic.tenant_id,
            name: 'staff', 
            is_system_role: true 
          });
          
          if (staffRole) {
            userClinic.roles = [{
              role_id: staffRole._id,
              assigned_at: new Date(),
              assigned_by: userClinic.user_id, // Self-assigned during migration
              is_primary: true
            }];
          }
        } else {
          // Assign the found role
          userClinic.roles = [{
            role_id: newRole._id,
            assigned_at: new Date(),
            assigned_by: userClinic.user_id, // Self-assigned during migration
            is_primary: true
          }];
        }
        
        // Clear old permissions array if it exists
        if ((userClinic as any).permissions) {
          delete (userClinic as any).permissions;
        }
        
        // Add migration audit entry
        userClinic.auditPermissionChange('role_migrated', userClinic.user_id, {
          old_role: oldRole,
          new_role_id: userClinic.roles[0].role_id,
          migration_date: new Date(),
          tenant_id: clinic.tenant_id
        });
        
        await userClinic.save();
        migratedCount++;
        
        console.log(`✓ Migrated user ${userClinic.user_id} from '${oldRole}' to new tenant-based role system`);
      } catch (error) {
        console.error(`Error migrating user ${userClinic.user_id}:`, error);
        skippedCount++;
      }
    }
    
    return { migrated: migratedCount, skipped: skippedCount };
  } catch (error) {
    console.error('Error during user migration:', error);
    return { migrated: 0, skipped: 0 };
  }
}

/**
 * Rollback function to undo permission system setup (use with caution)
 */
export async function rollbackPermissionSystem() {
  try {
    console.log('⚠️  Starting Permission System Rollback...\n');
    
    // This is a destructive operation - only use in development
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Rollback is not allowed in production environment');
    }
    
    console.log('🗑️  Removing all permissions...');
    const deletedPermissions = await mongoose.model('Permission').deleteMany({});
    console.log(`Deleted ${deletedPermissions.deletedCount} permissions`);
    
    console.log('🗑️  Removing all custom roles...');
    const deletedRoles = await mongoose.model('Role').deleteMany({ is_system_role: true });
    console.log(`Deleted ${deletedRoles.deletedCount} roles`);
    
    console.log('🔄 Resetting user-clinic relationships...');
    // Since roles are required, it's cleaner to delete UserClinic documents during rollback
    // rather than trying to create invalid documents with empty roles
    const deletedUserClinics = await UserClinic.deleteMany({});
    console.log(`Reset ${deletedUserClinics.deletedCount} user-clinic relationships`);
    console.log('✅ Rollback completed');
    
    return {
      deletedPermissions: deletedPermissions.deletedCount,
      deletedRoles: deletedRoles.deletedCount,
      resetUsers: deletedUserClinics.deletedCount
    };
  } catch (error) {
    console.error('❌ Error during rollback:', error);
    throw error;
  }
}

/**
 * Utility function to create a custom role for a specific clinic
 */
export async function createCustomRole(
  tenantId: string,
  clinicId: string, 
  roleName: string, 
  displayName: string, 
  description: string, 
  permissions: string[], 
  createdBy: string
) {
  try {
    // Verify all permissions exist for this tenant
    for (const permissionName of permissions) {
      const permission = await mongoose.model('Permission').findOne({ 
        tenant_id: tenantId,
        name: permissionName 
      });
      if (!permission) {
        throw new Error(`Permission '${permissionName}' does not exist for tenant ${tenantId}`);
      }
    }
    
    // Create role permissions array
    const rolePermissions = permissions.map(permissionName => ({
      permission_name: permissionName,
      granted: true,
      granted_at: new Date(),
      granted_by: new mongoose.Types.ObjectId(createdBy)
    }));
    
    // Create the custom role
    const customRole = new Role({
      tenant_id: new mongoose.Types.ObjectId(tenantId),
      name: roleName.toLowerCase().replace(/\s+/g, '_'),
      display_name: displayName,
      description: description,
      clinic_id: new mongoose.Types.ObjectId(clinicId),
      is_system_role: false,
      is_active: true,
      permissions: rolePermissions,
      color: '#6366f1', // Default color
      icon: 'user-group',
      priority: 50, // Default priority
      can_be_modified: true,
      can_be_deleted: true,
      created_by: new mongoose.Types.ObjectId(createdBy)
    });
    
    await customRole.save();
    console.log(`Created custom role '${displayName}' for tenant ${tenantId} clinic ${clinicId}`);
    
    return customRole;
  } catch (error) {
    console.error('Error creating custom role:', error);
    throw error;
  }
}

/**
 * Run the seeder from command line
 */
if (require.main === module) {
  // Connect to MongoDB (you'll need to configure this based on your setup)
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinicpro')
    .then(async () => {
      console.log('Connected to MongoDB');
      
      // First create some basic tenants for standalone execution
      const { seedTenants } = await import('./tenantSeeder');
      const tenantIds = await seedTenants();
      
      // Get tenant objects
      const { Tenant } = await import('../models');
      const tenants = await Tenant.find({ _id: { $in: tenantIds } });
      
      return seedPermissionSystem(tenants);
    })
    .then((result) => {
      console.log('Seeding completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export default seedPermissionSystem;
