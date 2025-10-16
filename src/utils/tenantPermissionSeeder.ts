import { seedPermissions } from '../seeds/permissionSeeder';
import { seedRoles } from '../seeds/roleSeeder';
import { Tenant } from '../models';

/**
 * Utility to ensure permissions and roles exist for a tenant
 * This is called when creating new users to ensure tenant has proper permission setup
 */
export async function ensureTenantPermissions(tenantId: string) {
  try {
    console.log(`Ensuring permissions and roles exist for tenant: ${tenantId}`);
    
    // Get tenant object
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Seed permissions for this tenant if they don't exist
    console.log(`Seeding permissions for tenant: ${tenant.name}`);
    const permissionResult = await seedPermissions([tenant]);
    console.log(`Permissions - Created: ${permissionResult.created}, Updated: ${permissionResult.updated}`);

    // Seed roles for this tenant if they don't exist  
    console.log(`Seeding roles for tenant: ${tenant.name}`);
    const roleResult = await seedRoles([tenant]);
    console.log(`Roles - Created: ${roleResult.created}, Updated: ${roleResult.updated}`);

    return {
      permissionsCreated: permissionResult.created,
      permissionsUpdated: permissionResult.updated,
      rolesCreated: roleResult.created,
      rolesUpdated: roleResult.updated
    };
  } catch (error) {
    console.error(`Error ensuring tenant permissions for ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Utility to seed permissions and roles for multiple tenants
 */
export async function ensureMultipleTenantPermissions(tenantIds: string[]) {
  try {
    console.log(`Ensuring permissions and roles exist for ${tenantIds.length} tenants`);
    
    // Get tenant objects
    const tenants = await Tenant.find({ _id: { $in: tenantIds } });
    if (tenants.length !== tenantIds.length) {
      const foundIds = tenants.map(t => t._id.toString());
      const missingIds = tenantIds.filter(id => !foundIds.includes(id));
      throw new Error(`Some tenants not found: ${missingIds.join(', ')}`);
    }

    // Seed permissions for all tenants
    console.log(`Seeding permissions for ${tenants.length} tenants`);
    const permissionResult = await seedPermissions(tenants);
    console.log(`Total Permissions - Created: ${permissionResult.created}, Updated: ${permissionResult.updated}`);

    // Seed roles for all tenants
    console.log(`Seeding roles for ${tenants.length} tenants`);
    const roleResult = await seedRoles(tenants);
    console.log(`Total Roles - Created: ${roleResult.created}, Updated: ${roleResult.updated}`);

    return {
      permissionsCreated: permissionResult.created,
      permissionsUpdated: permissionResult.updated,
      rolesCreated: roleResult.created,
      rolesUpdated: roleResult.updated
    };
  } catch (error) {
    console.error(`Error ensuring multiple tenant permissions:`, error);
    throw error;
  }
}
