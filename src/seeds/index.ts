import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

// Import centralized database connection
import connectDB, { gracefulShutdown } from '../config/database';

// Import seeder functions
import { seedClinics } from './clinicSeeder';
import { seedUsers } from './userSeeder';
import { seedAllData } from './dataSeeder';
import { seedPermissionSystem } from './permissionSystemSeeder';
import { seedTenants } from './tenantSeeder';
import { seedSuperAdmins } from './superAdminSeeder';

dotenv.config();

/**
 * Clear all collections in the database
 */
async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  
  console.log(`Clearing ${Object.keys(collections).length} collections...`);
  
  for (const key in collections) {
    const collection = collections[key];
    const count = await collection.countDocuments({});
    if (count > 0) {
      await collection.deleteMany({});
      console.log(`  Cleared ${key}: ${count} documents`);
    }
  }
  
  console.log('Database cleared successfully\n');
}

/**
 * Run comprehensive seeding for multi-clinic setup
 */
async function runComprehensiveSeeding(): Promise<void> {
  try {
    console.log('Starting comprehensive multi-clinic database seeding...\n');
    console.log('='.repeat(60));

    // 1. Clear database first (if requested)
    const shouldClear = process.argv.includes('--clear') || process.argv.includes('-c');
    if (shouldClear) {
      await clearDatabase();
    }

    // 1. Create super admins first (required for tenant creation)
    console.log('PHASE 1: Creating Super Admins');
    console.log('-'.repeat(35));
    const superAdminIds = await seedSuperAdmins();
    
    // 2. Setup Tenant-Based Permission System 
    console.log('\nPHASE 2: Setting up Tenant-Based Permission System');
    console.log('-'.repeat(50));
    
    // Create tenants (requires super admins to exist)
    const tenantIds = await seedTenants();
    
    // Get full tenant objects for permission system
    const { Tenant } = await import('../models');
    const tenants = await Tenant.find({ _id: { $in: tenantIds } });
    
    // Setup permission system with tenants
    const permissionResult = await seedPermissionSystem(tenants);
    
    // 3. Create multiple clinics per tenant (2-3 per tenant)
    console.log('\nPHASE 3: Creating Clinics (Multiple per Tenant)');
    console.log('-'.repeat(45));
    const clinicIds = await seedClinics(tenants);
    
    // 4. Create users and user-clinic relationships  
    console.log('\nPHASE 4: Creating Users & Relationships');
    console.log('-'.repeat(40));
    await seedUsers(clinicIds, tenants);
    
    // 5. Create comprehensive data for all models (10 rows per clinic)
    console.log('\nPHASE 5: Creating Comprehensive Data');
    console.log('-'.repeat(40));
    await seedAllData(clinicIds, tenants);

    // 6. Display summary
    console.log('\n' + '='.repeat(60));
    console.log('SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\nSEEDING SUMMARY:');
    console.log(`   Super Admins: ${superAdminIds.length} created/verified`);
    console.log(`   Tenants: ${tenants.length} created`);
    console.log(`   Permissions per tenant: ${permissionResult.permissions.permissionsPerTenant}`);
    console.log(`   Total permissions: ${permissionResult.permissions.total}`);
    console.log(`   Roles per tenant: ${permissionResult.roles.rolesPerTenant}`);
    console.log(`   Total roles: ${permissionResult.roles.total}`);
    console.log(`   Clinics: ${clinicIds.length} created (2-3 per tenant)`);
    console.log(`   Average Clinics per Tenant: ${(clinicIds.length / tenants.length).toFixed(1)}`);
    console.log(`   Users: ~${clinicIds.length * 10 + superAdminIds.length} created (including super admins)`);
    console.log(`   User-Clinic Relations: ~${clinicIds.length * 10 + clinicIds.length * 2} created`);
    console.log(`   Data Records: ~${clinicIds.length * 200} created across all models`);
    console.log(`   Migrated Users: ${permissionResult.migration.migrated} migrated to new permission system`);
    
    console.log('\nMULTI-TENANT FEATURES:');
    console.log('   ✅ Advanced Permission System');
    console.log('   ✅ Role-based Access Control');
    console.log('   ✅ Multi-tenant architecture with data isolation');
    console.log('   ✅ Super admins with cross-tenant access');
    console.log('   ✅ 5 tenant organizations');
    console.log('   ✅ Each tenant has multiple unique clinics (2-3 per tenant)');
    console.log('   ✅ Proper tenant → clinic → data hierarchy');
    console.log('   ✅ Tenant-specific data isolation');
    console.log('   ✅ Realistic faker-generated data');
    console.log('   ✅ Proper relationships and foreign keys');
    console.log('   ✅ 10 records per model per clinic');
    
    console.log('\nPERMISSION SYSTEM:');
    console.log('   📋 Granular permissions for all modules');
    console.log('   👥 System roles: Admin, Doctor, Nurse, Receptionist, Accountant, Staff');
    console.log('   🔐 Individual permission overrides');
    console.log('   📊 Permission audit trail');
    console.log('   🏥 Clinic-specific custom roles');
    
    console.log('\nTEST CREDENTIALS:');
    console.log('   Super Admin:');
    console.log('     Email: superadmin@clinicpro.com');
    console.log('     Password: SuperAdmin123!');
    console.log('   Regular Users:');
    console.log('     Email: Any user email from the generated data');
    console.log('     Password: password123');
    
    console.log('\nNEXT STEPS:');
    console.log('   1. Start the backend server: npm run dev');
    console.log('   2. Test super admin login and tenant management');
    console.log('   3. Test permission system functionality');
    console.log('   4. Test multi-tenant functionality');
    console.log('   5. Verify data isolation between tenants');
    console.log('   6. Test user permissions and clinic access');
    
  } catch (error) {
    console.error('\nError in comprehensive seeding:', error);
    throw error;
  }
}



/**
 * Main seeder execution function
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Check command line arguments
    const args = process.argv.slice(2);
    const showHelp = args.includes('--help') || args.includes('-h');
    
    if (showHelp) {
      console.log('ClinicPro Database Seeding Commands');
      console.log('====================================');
      console.log('');
      console.log('Usage: npm run seed [options]');
      console.log('');
      console.log('Options:');
      console.log('  --help, -h    Show this help message');
      console.log('  --clear, -c   Clear database before seeding');
      console.log('');
      console.log('Examples:');
      console.log('  npm run seed          # Full multi-tenant seeding');
      console.log('  npm run seed --clear  # Clear database and full seed');
      console.log('');
      return;
    }
    
    console.log('ClinicPro Multi-Tenant Database Seeding');
    console.log('=========================================');
    console.log('Creating realistic data with Faker.js');
    console.log('Multi-tenant setup with data isolation');
    console.log('Advanced Permission System included');
    console.log('=========================================\n');
    
    // Connect to database
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully\n');
    
    // Execute seeding
    await runComprehensiveSeeding();
    
    // Calculate execution time
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('SEEDING PROCESS COMPLETED!');
    console.log(`Total execution time: ${executionTime}s`);
    console.log('Disconnecting from database...');
    
    // Graceful shutdown
    await gracefulShutdown();
    console.log('Database connection closed gracefully');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('FATAL ERROR DURING SEEDING');
    console.error('='.repeat(60));
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    
    console.error('\nAttempting graceful shutdown...');
    await gracefulShutdown();
    
    process.exit(1);
  }
}

// Export for use in other files
export { 
  seedClinics, 
  seedUsers, 
  seedAllData, 
  clearDatabase, 
  seedPermissionSystem,
  seedTenants,
  seedSuperAdmins 
};

// Execute main function if this file is run directly
if (require.main === module) {
  main();
}
