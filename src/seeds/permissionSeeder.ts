import Permission, { ModuleCategory, PermissionLevel } from '../models/Permission';

// Define all permissions based on our module analysis
const defaultPermissions = [
  // USER MANAGEMENT MODULE
  { name: 'users.view', display_name: 'View Users', description: 'View user list and profiles', module: 'user_management', action: 'view', level: 'view' },
  { name: 'users.create', display_name: 'Create Users', description: 'Create new user accounts', module: 'user_management', action: 'create', level: 'create' },
  { name: 'users.edit', display_name: 'Edit Users', description: 'Edit user information and profiles', module: 'user_management', action: 'edit', level: 'edit' },
  { name: 'users.delete', display_name: 'Delete Users', description: 'Delete user accounts', module: 'user_management', action: 'delete', level: 'delete' },
  { name: 'users.activate_deactivate', display_name: 'Activate/Deactivate Users', description: 'Activate or deactivate user accounts', module: 'user_management', action: 'activate', level: 'edit' },
  { name: 'users.assign_roles', display_name: 'Assign Roles', description: 'Assign roles to users', module: 'user_management', action: 'assign', level: 'edit' },
  { name: 'users.manage_permissions', display_name: 'Manage User Permissions', description: 'Grant or revoke individual permissions', module: 'user_management', action: 'manage_permissions', level: 'full' },
  { name: 'users.export', display_name: 'Export User Data', description: 'Export user information', module: 'user_management', action: 'export', level: 'view' },

  // CLINIC MANAGEMENT MODULE
  { name: 'clinics.view', display_name: 'View Clinic Details', description: 'View clinic information', module: 'clinic_management', action: 'view', level: 'view' },
  { name: 'clinics.create', display_name: 'Create Clinics', description: 'Create new clinics', module: 'clinic_management', action: 'create', level: 'create' },
  { name: 'clinics.edit', display_name: 'Edit Clinic Info', description: 'Edit clinic information', module: 'clinic_management', action: 'edit', level: 'edit' },
  { name: 'clinics.delete', display_name: 'Delete Clinics', description: 'Delete clinic records', module: 'clinic_management', action: 'delete', level: 'delete' },
  { name: 'clinics.settings', display_name: 'Manage Clinic Settings', description: 'Configure clinic settings', module: 'clinic_management', action: 'manage_permissions', level: 'full' },
  { name: 'clinics.switch_clinic', display_name: 'Switch Between Clinics', description: 'Switch between different clinics', module: 'clinic_management', action: 'switch_clinic', level: 'view' },

  // PATIENT MANAGEMENT MODULE
  { name: 'patients.view', display_name: 'View Patients', description: 'View patient list and information', module: 'patient_management', action: 'view', level: 'view' },
  { name: 'patients.create', display_name: 'Register Patients', description: 'Register new patients', module: 'patient_management', action: 'create', level: 'create' },
  { name: 'patients.edit', display_name: 'Edit Patient Info', description: 'Edit patient information', module: 'patient_management', action: 'edit', level: 'edit' },
  { name: 'patients.delete', display_name: 'Delete Patients', description: 'Delete patient records', module: 'patient_management', action: 'delete', level: 'delete' },
  { name: 'patients.export', display_name: 'Export Patient Data', description: 'Export patient information', module: 'patient_management', action: 'export', level: 'view' },
  { name: 'patients.import', display_name: 'Import Patient Data', description: 'Import patient information', module: 'patient_management', action: 'import', level: 'create' },

  // APPOINTMENT MANAGEMENT MODULE
  { name: 'appointments.view', display_name: 'View Appointments', description: 'View appointment schedules', module: 'appointment_management', action: 'view', level: 'view' },
  { name: 'appointments.create', display_name: 'Schedule Appointments', description: 'Create new appointments', module: 'appointment_management', action: 'create', level: 'create' },
  { name: 'appointments.edit', display_name: 'Modify Appointments', description: 'Edit existing appointments', module: 'appointment_management', action: 'edit', level: 'edit' },
  { name: 'appointments.delete', display_name: 'Cancel Appointments', description: 'Cancel or delete appointments', module: 'appointment_management', action: 'delete', level: 'delete' },
  { name: 'appointments.reschedule', display_name: 'Reschedule Appointments', description: 'Reschedule existing appointments', module: 'appointment_management', action: 'reschedule', level: 'edit' },
  { name: 'appointments.assign', display_name: 'Assign Staff', description: 'Assign doctors/nurses to appointments', module: 'appointment_management', action: 'assign', level: 'edit' },
  { name: 'appointments.export', display_name: 'Export Appointments', description: 'Export appointment data', module: 'appointment_management', action: 'export', level: 'view' },

  // FINANCIAL MANAGEMENT MODULE - Invoices
  { name: 'invoices.view', display_name: 'View Invoices', description: 'View invoice records', module: 'financial_management', sub_module: 'invoices', action: 'view', level: 'view' },
  { name: 'invoices.create', display_name: 'Create Invoices', description: 'Create new invoices', module: 'financial_management', sub_module: 'invoices', action: 'create', level: 'create' },
  { name: 'invoices.edit', display_name: 'Edit Invoices', description: 'Edit existing invoices', module: 'financial_management', sub_module: 'invoices', action: 'edit', level: 'edit' },
  { name: 'invoices.delete', display_name: 'Delete Invoices', description: 'Delete invoice records', module: 'financial_management', sub_module: 'invoices', action: 'delete', level: 'delete' },
  { name: 'invoices.send', display_name: 'Send Invoices', description: 'Send invoices to patients', module: 'financial_management', sub_module: 'invoices', action: 'send', level: 'edit' },
  { name: 'invoices.print', display_name: 'Print Invoices', description: 'Print invoice documents', module: 'financial_management', sub_module: 'invoices', action: 'print', level: 'view' },

  // FINANCIAL MANAGEMENT MODULE - Payments
  { name: 'payments.view', display_name: 'View Payments', description: 'View payment records', module: 'financial_management', sub_module: 'payments', action: 'view', level: 'view' },
  { name: 'payments.process', display_name: 'Process Payments', description: 'Process patient payments', module: 'financial_management', sub_module: 'payments', action: 'process', level: 'create' },
  { name: 'payments.refund', display_name: 'Process Refunds', description: 'Process payment refunds', module: 'financial_management', sub_module: 'payments', action: 'refund', level: 'edit' },

  // FINANCIAL MANAGEMENT MODULE - Expenses
  { name: 'expenses.view', display_name: 'View Expenses', description: 'View expense records', module: 'financial_management', sub_module: 'expenses', action: 'view', level: 'view' },
  { name: 'expenses.create', display_name: 'Add Expenses', description: 'Add new expense records', module: 'financial_management', sub_module: 'expenses', action: 'create', level: 'create' },
  { name: 'expenses.edit', display_name: 'Edit Expenses', description: 'Edit expense records', module: 'financial_management', sub_module: 'expenses', action: 'edit', level: 'edit' },
  { name: 'expenses.delete', display_name: 'Delete Expenses', description: 'Delete expense records', module: 'financial_management', sub_module: 'expenses', action: 'delete', level: 'delete' },
  { name: 'expenses.approve', display_name: 'Approve Expenses', description: 'Approve expense claims', module: 'financial_management', sub_module: 'expenses', action: 'approve', level: 'edit' },

  // FINANCIAL MANAGEMENT MODULE - Payroll
  { name: 'payroll.view', display_name: 'View Payroll', description: 'View payroll records', module: 'financial_management', sub_module: 'payroll', action: 'view', level: 'view' },
  { name: 'payroll.create', display_name: 'Create Payroll', description: 'Create payroll entries', module: 'financial_management', sub_module: 'payroll', action: 'create', level: 'create' },
  { name: 'payroll.edit', display_name: 'Edit Payroll', description: 'Edit payroll records', module: 'financial_management', sub_module: 'payroll', action: 'edit', level: 'edit' },
  { name: 'payroll.process', display_name: 'Process Payroll', description: 'Process employee payroll', module: 'financial_management', sub_module: 'payroll', action: 'process', level: 'edit' },

  // INVENTORY MANAGEMENT MODULE
  { name: 'inventory.view', display_name: 'View Inventory', description: 'View inventory items', module: 'inventory_management', action: 'view', level: 'view' },
  { name: 'inventory.create', display_name: 'Add Inventory Items', description: 'Add new inventory items', module: 'inventory_management', action: 'create', level: 'create' },
  { name: 'inventory.edit', display_name: 'Edit Inventory', description: 'Edit inventory items', module: 'inventory_management', action: 'edit', level: 'edit' },
  { name: 'inventory.delete', display_name: 'Delete Inventory Items', description: 'Delete inventory items', module: 'inventory_management', action: 'delete', level: 'delete' },
  { name: 'inventory.stock_update', display_name: 'Update Stock', description: 'Update stock levels', module: 'inventory_management', action: 'edit', level: 'edit' },

  // LAB MANAGEMENT MODULE
  { name: 'tests.view', display_name: 'View Tests', description: 'View test catalog', module: 'lab_management', sub_module: 'tests', action: 'view', level: 'view' },
  { name: 'tests.create', display_name: 'Create Tests', description: 'Create new test definitions', module: 'lab_management', sub_module: 'tests', action: 'create', level: 'create' },
  { name: 'tests.edit', display_name: 'Edit Tests', description: 'Edit test definitions', module: 'lab_management', sub_module: 'tests', action: 'edit', level: 'edit' },
  { name: 'tests.delete', display_name: 'Delete Tests', description: 'Delete test definitions', module: 'lab_management', sub_module: 'tests', action: 'delete', level: 'delete' },

  { name: 'test_reports.view', display_name: 'View Test Reports', description: 'View test results and reports', module: 'lab_management', sub_module: 'test_reports', action: 'view', level: 'view' },
  { name: 'test_reports.create', display_name: 'Create Test Reports', description: 'Create new test reports', module: 'lab_management', sub_module: 'test_reports', action: 'create', level: 'create' },
  { name: 'test_reports.edit', display_name: 'Edit Test Reports', description: 'Edit test reports', module: 'lab_management', sub_module: 'test_reports', action: 'edit', level: 'edit' },
  { name: 'test_reports.verify', display_name: 'Verify Test Reports', description: 'Verify and approve test reports', module: 'lab_management', sub_module: 'test_reports', action: 'verify', level: 'edit' },

  { name: 'lab_vendors.view', display_name: 'View Lab Vendors', description: 'View lab vendor information', module: 'lab_management', sub_module: 'lab_vendors', action: 'view', level: 'view' },
  { name: 'lab_vendors.create', display_name: 'Add Lab Vendors', description: 'Add new lab vendors', module: 'lab_management', sub_module: 'lab_vendors', action: 'create', level: 'create' },
  { name: 'lab_vendors.edit', display_name: 'Edit Lab Vendors', description: 'Edit lab vendor details', module: 'lab_management', sub_module: 'lab_vendors', action: 'edit', level: 'edit' },
  { name: 'lab_vendors.delete', display_name: 'Delete Lab Vendors', description: 'Delete lab vendor records', module: 'lab_management', sub_module: 'lab_vendors', action: 'delete', level: 'delete' },

  // DEPARTMENT MANAGEMENT MODULE
  { name: 'departments.view', display_name: 'View Departments', description: 'View department information', module: 'department_management', action: 'view', level: 'view' },
  { name: 'departments.create', display_name: 'Create Departments', description: 'Create new departments', module: 'department_management', action: 'create', level: 'create' },
  { name: 'departments.edit', display_name: 'Edit Departments', description: 'Edit department details', module: 'department_management', action: 'edit', level: 'edit' },
  { name: 'departments.delete', display_name: 'Delete Departments', description: 'Delete department records', module: 'department_management', action: 'delete', level: 'delete' },

  // SERVICE MANAGEMENT MODULE
  { name: 'services.view', display_name: 'View Services', description: 'View service catalog', module: 'service_management', action: 'view', level: 'view' },
  { name: 'services.create', display_name: 'Create Services', description: 'Create new services', module: 'service_management', action: 'create', level: 'create' },
  { name: 'services.edit', display_name: 'Edit Services', description: 'Edit service details', module: 'service_management', action: 'edit', level: 'edit' },
  { name: 'services.delete', display_name: 'Delete Services', description: 'Delete service records', module: 'service_management', action: 'delete', level: 'delete' },

  // PRESCRIPTION MANAGEMENT MODULE
  { name: 'prescriptions.view', display_name: 'View Prescriptions', description: 'View prescription records', module: 'prescription_management', action: 'view', level: 'view' },
  { name: 'prescriptions.create', display_name: 'Create Prescriptions', description: 'Create new prescriptions', module: 'prescription_management', action: 'create', level: 'create' },
  { name: 'prescriptions.edit', display_name: 'Edit Prescriptions', description: 'Edit prescription details', module: 'prescription_management', action: 'edit', level: 'edit' },
  { name: 'prescriptions.delete', display_name: 'Delete Prescriptions', description: 'Delete prescription records', module: 'prescription_management', action: 'delete', level: 'delete' },
  { name: 'prescriptions.print', display_name: 'Print Prescriptions', description: 'Print prescription documents', module: 'prescription_management', action: 'print', level: 'view' },
  { name: 'prescriptions.dispense', display_name: 'Mark as Dispensed', description: 'Mark prescriptions as dispensed', module: 'prescription_management', action: 'dispense', level: 'edit' },

  // LEAD MANAGEMENT MODULE
  { name: 'leads.view', display_name: 'View Leads', description: 'View lead information', module: 'lead_management', action: 'view', level: 'view' },
  { name: 'leads.create', display_name: 'Create Leads', description: 'Create new leads', module: 'lead_management', action: 'create', level: 'create' },
  { name: 'leads.edit', display_name: 'Edit Leads', description: 'Edit lead details', module: 'lead_management', action: 'edit', level: 'edit' },
  { name: 'leads.delete', display_name: 'Delete Leads', description: 'Delete lead records', module: 'lead_management', action: 'delete', level: 'delete' },
  { name: 'leads.convert', display_name: 'Convert Leads', description: 'Convert leads to patients', module: 'lead_management', action: 'convert', level: 'create' },

  // TRAINING MANAGEMENT MODULE
  { name: 'training.view', display_name: 'View Training', description: 'View training modules', module: 'training_management', action: 'view', level: 'view' },
  { name: 'training.create', display_name: 'Create Training', description: 'Create training content', module: 'training_management', action: 'create', level: 'create' },
  { name: 'training.edit', display_name: 'Edit Training', description: 'Edit training modules', module: 'training_management', action: 'edit', level: 'edit' },
  { name: 'training.assign', display_name: 'Assign Training', description: 'Assign training to users', module: 'training_management', action: 'assign', level: 'edit' },

  // DENTAL MANAGEMENT MODULE
  { name: 'odontogram.view', display_name: 'View Dental Charts', description: 'View dental charts and odontograms', module: 'dental_management', action: 'view', level: 'view' },
  { name: 'odontogram.create', display_name: 'Create Dental Charts', description: 'Create new dental charts', module: 'dental_management', action: 'create', level: 'create' },
  { name: 'odontogram.edit', display_name: 'Edit Dental Charts', description: 'Edit dental charts and treatments', module: 'dental_management', action: 'edit', level: 'edit' },
  { name: 'xray_analysis.view', display_name: 'View X-ray Analysis', description: 'View X-ray analysis results', module: 'dental_management', sub_module: 'xray_analysis', action: 'view', level: 'view' },
  { name: 'xray_analysis.create', display_name: 'Perform X-ray Analysis', description: 'Perform AI-powered X-ray analysis', module: 'dental_management', sub_module: 'xray_analysis', action: 'ai_analysis', level: 'create' },

  // ANALYTICS & REPORTS MODULE
  { name: 'analytics.dashboard', display_name: 'View Dashboard', description: 'View analytics dashboard', module: 'analytics_reports', action: 'view', level: 'view' },
  { name: 'analytics.reports', display_name: 'Generate Reports', description: 'Generate and view reports', module: 'analytics_reports', action: 'view', level: 'view' },
  { name: 'analytics.export', display_name: 'Export Analytics', description: 'Export analytics data', module: 'analytics_reports', action: 'export', level: 'view' },

  // SETTINGS MODULE
  { name: 'settings.view', display_name: 'View Settings', description: 'View system settings', module: 'settings', action: 'view', level: 'view' },
  { name: 'settings.general', display_name: 'Manage General Settings', description: 'Configure general system settings', module: 'settings', action: 'edit', level: 'edit' },
  { name: 'settings.notifications', display_name: 'Manage Notifications', description: 'Configure notification settings', module: 'settings', action: 'edit', level: 'edit' },
  { name: 'settings.integrations', display_name: 'Manage Integrations', description: 'Configure third-party integrations', module: 'settings', action: 'edit', level: 'edit' },
  { name: 'settings.backup', display_name: 'Backup Management', description: 'Manage system backups', module: 'settings', action: 'backup', level: 'full' },

  // PERMISSIONS MANAGEMENT MODULE (Admin only)
  { name: 'permissions.view', display_name: 'View Permissions', description: 'View all permissions and roles', module: 'permissions_management', action: 'view', level: 'view' },
  { name: 'permissions.create_role', display_name: 'Create Roles', description: 'Create custom roles', module: 'permissions_management', action: 'create', level: 'create' },
  { name: 'permissions.edit_role', display_name: 'Edit Roles', description: 'Edit role permissions', module: 'permissions_management', action: 'edit', level: 'edit' },
  { name: 'permissions.delete_role', display_name: 'Delete Roles', description: 'Delete custom roles', module: 'permissions_management', action: 'delete', level: 'delete' },
  { name: 'permissions.assign_permissions', display_name: 'Assign Permissions', description: 'Assign permissions to roles', module: 'permissions_management', action: 'assign', level: 'edit' },
  { name: 'permissions.assign_roles', display_name: 'Assign Roles to Users', description: 'Assign roles to users', module: 'permissions_management', action: 'assign', level: 'edit' },
  { name: 'permissions.audit_log', display_name: 'View Permission Audit Log', description: 'View permission change history', module: 'permissions_management', action: 'view', level: 'view' }
];

export async function seedPermissions(tenants: any[]) {
  try {
    console.log('Starting tenant-based permission seeding...');
    
    // Clear existing permissions (optional - remove in production)
    // await Permission.deleteMany({});
    
    let totalCreatedCount = 0;
    let totalUpdatedCount = 0;
    
    // Create permissions for each tenant
    for (const tenant of tenants) {
      console.log(`  Creating permissions for tenant: ${tenant.name}`);
      
      let createdCount = 0;
      let updatedCount = 0;
      
      for (const permissionData of defaultPermissions) {
        const existingPermission = await Permission.findOne({ 
          tenant_id: tenant._id,
          name: permissionData.name 
        });
        
        if (existingPermission) {
          // Update existing permission
          await Permission.findOneAndUpdate(
            { tenant_id: tenant._id, name: permissionData.name },
            {
              ...permissionData,
              tenant_id: tenant._id,
              is_system_permission: true,
              applies_to_clinic: true
            },
            { upsert: true }
          );
          updatedCount++;
        } else {
          // Create new permission
          try {
            await Permission.create({
              ...permissionData,
              tenant_id: tenant._id,
              is_system_permission: true,
              applies_to_clinic: true
            });
            createdCount++;
          } catch (error: any) {
            console.error(`Error creating permission ${permissionData.name} for tenant ${tenant.name}:`, error.message);
            if (error.errors) {
              Object.keys(error.errors).forEach(field => {
                console.error(`  - ${field}: ${error.errors[field].message}`);
              });
            }
          }
        }
      }
      
      console.log(`    Created: ${createdCount}, Updated: ${updatedCount} permissions`);
      totalCreatedCount += createdCount;
      totalUpdatedCount += updatedCount;
    }
    
    console.log(`Permission seeding completed:`);
    console.log(`- Total Created: ${totalCreatedCount} permissions`);
    console.log(`- Total Updated: ${totalUpdatedCount} permissions`);
    console.log(`- Total Tenants: ${tenants.length}`);
    console.log(`- Permissions per tenant: ${defaultPermissions.length}`);
    
    return { 
      created: totalCreatedCount, 
      updated: totalUpdatedCount, 
      total: totalCreatedCount + totalUpdatedCount,
      tenants: tenants.length,
      permissionsPerTenant: defaultPermissions.length
    };
  } catch (error) {
    console.error('Error seeding permissions:', error);
    throw error;
  }
}

export default seedPermissions;
