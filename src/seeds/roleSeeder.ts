import Role from '../models/Role';
import Permission from '../models/Permission';

// Define default system roles with their permissions
const defaultRoles = [
  {
    name: 'super_admin',
    display_name: 'Super Administrator',
    description: 'Unrestricted system access - bypasses all permission checks',
    color: '#7c2d12', // Dark Red
    icon: 'shield-check',
    priority: 100,
    can_be_modified: false,
    can_be_deleted: false,
    permissions: [] // Super admin doesn't need explicit permissions - bypasses all checks
  },
  {
    name: 'admin',
    display_name: 'Administrator',
    description: 'Full system access with all permissions',
    color: '#dc2626', // Red
    icon: 'crown',
    priority: 99,
    can_be_modified: false,
    can_be_deleted: false,
    permissions: [
      // Full access to everything
      'users.view', 'users.create', 'users.edit', 'users.delete', 'users.activate_deactivate', 
      'users.assign_roles', 'users.manage_permissions', 'users.export',
      
      'clinics.view', 'clinics.create', 'clinics.edit', 'clinics.delete', 'clinics.settings', 'clinics.switch_clinic',
      
      'patients.view', 'patients.create', 'patients.edit', 'patients.delete', 'patients.export', 'patients.import',
      
      'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.delete', 
      'appointments.reschedule', 'appointments.assign', 'appointments.export',
      
      'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete', 'invoices.send', 'invoices.print',
      'payments.view', 'payments.process', 'payments.refund',
      'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete', 'expenses.approve',
      'payroll.view', 'payroll.create', 'payroll.edit', 'payroll.process',
      
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.stock_update',
      
      'tests.view', 'tests.create', 'tests.edit', 'tests.delete',
      'test_reports.view', 'test_reports.create', 'test_reports.edit', 'test_reports.verify',
      'lab_vendors.view', 'lab_vendors.create', 'lab_vendors.edit', 'lab_vendors.delete',
      
      'departments.view', 'departments.create', 'departments.edit', 'departments.delete',
      'services.view', 'services.create', 'services.edit', 'services.delete',
      
      'prescriptions.view', 'prescriptions.create', 'prescriptions.edit', 'prescriptions.delete', 
      'prescriptions.print', 'prescriptions.dispense',
      
      'leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'leads.convert',
      
      'training.view', 'training.create', 'training.edit', 'training.assign',
      
      'odontogram.view', 'odontogram.create', 'odontogram.edit',
      'xray_analysis.view', 'xray_analysis.create',
      
      'analytics.dashboard', 'analytics.reports', 'analytics.export',
      
      'settings.view', 'settings.general', 'settings.notifications', 'settings.integrations', 'settings.backup',
      
      'permissions.view', 'permissions.create_role', 'permissions.edit_role', 'permissions.delete_role',
      'permissions.assign_permissions', 'permissions.assign_roles', 'permissions.audit_log'
    ]
  },
  {
    name: 'doctor',
    display_name: 'Doctor',
    description: 'Medical practitioner with patient care permissions',
    color: '#2563eb', // Blue
    icon: 'stethoscope',
    priority: 90,
    can_be_modified: true,
    can_be_deleted: false,
    permissions: [
      'patients.view', 'patients.create', 'patients.edit',
      'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.reschedule',
      'prescriptions.view', 'prescriptions.create', 'prescriptions.edit', 'prescriptions.print', 'prescriptions.dispense',
      'test_reports.view', 'test_reports.create', 'test_reports.edit', 'test_reports.verify',
      'tests.view',
      'services.view',
      'departments.view',
      'odontogram.view', 'odontogram.create', 'odontogram.edit',
      'xray_analysis.view', 'xray_analysis.create',
      'analytics.dashboard', 'analytics.reports',
      'training.view'
    ]
  },
  {
    name: 'nurse',
    display_name: 'Nurse',
    description: 'Nursing staff with patient care and administrative permissions',
    color: '#059669', // Green
    icon: 'heart',
    priority: 80,
    can_be_modified: true,
    can_be_deleted: false,
    permissions: [
      // Patient Management - Full access
      'patients.view', 'patients.create', 'patients.edit', 'patients.export',
      
      // Appointment Management - Full access  
      'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.reschedule', 'appointments.assign', 'appointments.export',
      
      // Medical Services
      'prescriptions.view', 'prescriptions.create', 'prescriptions.edit', 'prescriptions.print', 'prescriptions.dispense',
      'test_reports.view', 'test_reports.create', 'test_reports.edit', 'test_reports.verify',
      'tests.view', 'tests.create', 'tests.edit',
      'odontogram.view', 'odontogram.create', 'odontogram.edit',
      'xray_analysis.view', 'xray_analysis.create',
      
      // Inventory & Operations
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.stock_update',
      'services.view', 'services.create', 'services.edit',
      'departments.view',
      'lab_vendors.view',
      
      // Financial (view only)
      'invoices.view', 'payments.view', 'expenses.view', 'payroll.view',
      
      // Lead Management
      'leads.view', 'leads.create', 'leads.edit', 'leads.convert',
      
      // Analytics & Reporting
      'analytics.dashboard', 'analytics.reports', 'analytics.export',
      
      // System Access
      'clinics.view', 'clinics.switch_clinic',
      
      // Training
      'training.view'
    ]
  },
  {
    name: 'receptionist',
    display_name: 'Receptionist',
    description: 'Front desk staff with patient and appointment management',
    color: '#7c3aed', // Purple
    icon: 'phone',
    priority: 70,
    can_be_modified: true,
    can_be_deleted: false,
    permissions: [
      'patients.view', 'patients.create', 'patients.edit',
      'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.reschedule', 'appointments.assign',
      'leads.view', 'leads.create', 'leads.edit', 'leads.convert',
      'invoices.view', 'invoices.create', 'invoices.send', 'invoices.print',
      'payments.view', 'payments.process',
      'services.view',
      'departments.view',
      'training.view'
    ]
  },
  {
    name: 'accountant',
    display_name: 'Accountant',
    description: 'Financial management and reporting specialist',
    color: '#ea580c', // Orange
    icon: 'calculator',
    priority: 75,
    can_be_modified: true,
    can_be_deleted: false,
    permissions: [
      'patients.view', // For billing purposes
      'appointments.view', // For service billing
      'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete', 'invoices.send', 'invoices.print',
      'payments.view', 'payments.process', 'payments.refund',
      'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete', 'expenses.approve',
      'payroll.view', 'payroll.create', 'payroll.edit', 'payroll.process',
      'services.view', // For pricing
      'analytics.dashboard', 'analytics.reports', 'analytics.export',
      'training.view'
    ]
  },
  {
    name: 'staff',
    display_name: 'Staff',
    description: 'General staff member with limited access',
    color: '#6b7280', // Gray
    icon: 'user',
    priority: 60,
    can_be_modified: true,
    can_be_deleted: false,
    permissions: [
      'patients.view',
      'appointments.view',
      'services.view',
      'departments.view',
      'training.view'
    ]
  }
];

export async function seedRoles(tenants: any[]) {
  try {
    console.log('Starting tenant-based role seeding...');
    
    let totalCreatedCount = 0;
    let totalUpdatedCount = 0;
    
    // Create roles for each tenant
    for (const tenant of tenants) {
      console.log(`  Creating roles for tenant: ${tenant.name}`);
      
      let createdCount = 0;
      let updatedCount = 0;
      
      for (const roleData of defaultRoles) {
        const existingRole = await Role.findOne({ 
          tenant_id: tenant._id,
          name: roleData.name, 
          is_system_role: true 
        });
        
        // Prepare permissions array
        const permissions: any[] = [];
        for (const permissionName of roleData.permissions) {
          // Verify permission exists for this tenant
          const permission = await Permission.findOne({ 
            tenant_id: tenant._id,
            name: permissionName 
          });
          if (permission) {
            permissions.push({
              permission_name: permissionName,
              granted: true,
              granted_at: new Date()
            });
          } else {
            console.warn(`Permission '${permissionName}' not found for tenant '${tenant.name}' role '${roleData.name}'`);
          }
        }
        
        const roleDoc = {
          tenant_id: tenant._id,
          name: roleData.name,
          display_name: roleData.display_name,
          description: roleData.description,
          is_system_role: true,
          is_active: true,
          permissions: permissions,
          color: roleData.color,
          icon: roleData.icon,
          priority: roleData.priority,
          can_be_modified: roleData.can_be_modified,
          can_be_deleted: roleData.can_be_deleted
        };
        
        if (existingRole) {
          // Update existing role
          await Role.findOneAndUpdate(
            { tenant_id: tenant._id, name: roleData.name, is_system_role: true },
            roleDoc,
            { upsert: true }
          );
          updatedCount++;
        } else {
          // Create new role
          await Role.create(roleDoc);
          createdCount++;
        }
      }
      
      console.log(`    Created: ${createdCount}, Updated: ${updatedCount} roles`);
      totalCreatedCount += createdCount;
      totalUpdatedCount += updatedCount;
    }
    
    console.log(`Role seeding completed:`);
    console.log(`- Total Created: ${totalCreatedCount} roles`);
    console.log(`- Total Updated: ${totalUpdatedCount} roles`);
    console.log(`- Total Tenants: ${tenants.length}`);
    console.log(`- Roles per tenant: ${defaultRoles.length}`);
    
    return { 
      created: totalCreatedCount, 
      updated: totalUpdatedCount, 
      total: totalCreatedCount + totalUpdatedCount,
      tenants: tenants.length,
      rolesPerTenant: defaultRoles.length
    };
  } catch (error) {
    console.error('Error seeding roles:', error);
    throw error;
  }
}

// Function to get role permissions for reference
export function getRolePermissions(roleName: string): string[] {
  const role = defaultRoles.find(r => r.name === roleName);
  return role ? role.permissions : [];
}

// Function to check if a role has a specific permission
export function roleHasPermission(roleName: string, permissionName: string): boolean {
  // Super admin bypasses all permission checks
  if (roleName === 'super_admin') {
    return true;
  }
  const permissions = getRolePermissions(roleName);
  return permissions.includes(permissionName);
}

export default seedRoles;
