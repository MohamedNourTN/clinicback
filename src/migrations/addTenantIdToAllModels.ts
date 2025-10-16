import mongoose from 'mongoose';
import { Tenant } from '../models';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to add tenant_id to all existing model documents
 * 
 * This migration adds tenant_id to all documents that need it for multi-tenant support.
 * It assigns the first available tenant to existing documents.
 * 
 * Usage: npx ts-node src/migrations/addTenantIdToAllModels.ts
 */

async function addTenantIdToAllModels() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    console.log('✅ Connected to MongoDB');

    // Get the first available tenant to use as default
    const defaultTenant = await Tenant.findOne({ status: 'active' });
    if (!defaultTenant) {
      console.error('❌ No active tenant found. Please create tenants first.');
      console.log('You can run: npm run migrate:tenants');
      return;
    }

    console.log(`🏢 Using default tenant: ${defaultTenant.name} (${defaultTenant._id})`);

    const tenantId = defaultTenant._id;
    let totalUpdated = 0;

    // Array of collection names that need tenant_id
    const collectionsToUpdate = [
      'users', 'clinics', 'userclinics', 'patients', 'appointments', 'medicalrecords',
      'invoices', 'payments', 'payrolls', 'expenses', 'services', 'departments', 
      'inventories', 'leads', 'tests', 'testreports', 'testcategories', 'sampletypes',
      'xrayanalyses', 'aitestanalyses', 'aitestcomparisons', 'prescriptions',
      'trainings', 'trainingprogresses', 'odontograms', 'labvendors',
      'testmethodologies', 'turnaroundtimes'
    ];

    if (!mongoose.connection.db) {
      console.error('❌ Database connection not available');
      return;
    }

    for (const collectionName of collectionsToUpdate) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        
        // Count documents without tenant_id
        const count = await collection.countDocuments({ 
          tenant_id: { $exists: false } 
        });

        if (count === 0) {
          console.log(`✅ ${collectionName}: All documents already have tenant_id or collection empty`);
          continue;
        }

        console.log(`📋 ${collectionName}: Found ${count} documents without tenant_id`);

        // Update documents to add tenant_id
        const result = await collection.updateMany(
          { tenant_id: { $exists: false } },
          { $set: { tenant_id: tenantId } }
        );

        console.log(`✅ ${collectionName}: Updated ${result.modifiedCount} documents`);
        totalUpdated += result.modifiedCount;

      } catch (error: any) {
        console.log(`⚠️ ${collectionName}: Collection might not exist or error occurred:`, error?.message || 'Unknown error');
      }
    }

    // All collections are now handled in the main loop above

    console.log(`🎉 Migration completed successfully!`);
    console.log(`📊 Total documents updated: ${totalUpdated}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

/**
 * Function to assign specific tenant_id to documents based on clinic
 */
export async function assignTenantIdByClinic() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    if (!mongoose.connection.db) {
      console.error('❌ Database connection not available');
      return;
    }

    // Get all clinics with their tenant_id
    const clinics = await mongoose.connection.db.collection('clinics').find({ tenant_id: { $exists: true } }).toArray();
    if (clinics.length === 0) {
      console.log('⚠️ No clinics with tenant_id found. Running basic migration first...');
      await addTenantIdToAllModels();
      return;
    }

    console.log(`🏥 Found ${clinics.length} clinics with tenant assignments`);

    // Collection names that have clinic_id
    const collectionsWithClinicId = [
      'users', 'patients', 'appointments', 'medicalrecords', 'invoices', 'payments',
      'payrolls', 'expenses', 'services', 'departments', 'inventories', 'leads',
      'tests', 'testreports', 'testcategories', 'sampletypes', 'xrayanalyses',
      'aitestanalyses', 'aitestcomparisons', 'prescriptions'
    ];

    let totalUpdated = 0;

    for (const clinic of clinics) {
      console.log(`\n🏥 Processing clinic: ${clinic.name} (${clinic._id})`);
      
      for (const collectionName of collectionsWithClinicId) {
        try {
          const collection = mongoose.connection.db.collection(collectionName);
          const result = await collection.updateMany(
            { 
              clinic_id: clinic._id,
              $or: [
                { tenant_id: { $exists: false } },
                { tenant_id: { $ne: clinic.tenant_id } }
              ]
            },
            { $set: { tenant_id: clinic.tenant_id } }
          );

          if (result.modifiedCount && result.modifiedCount > 0) {
            console.log(`  ✅ ${collectionName}: Updated ${result.modifiedCount} documents`);
            totalUpdated += result.modifiedCount;
          }
        } catch (error: any) {
          console.log(`  ⚠️ ${collectionName}: Collection might not exist or error occurred:`, error?.message || 'Unknown error');
        }
      }
    }

    console.log(`\n🎉 Clinic-based migration completed!`);
    console.log(`📊 Total documents updated: ${totalUpdated}`);

  } catch (error) {
    console.error('❌ Clinic-based migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const useClinicBased = args.includes('--clinic-based') || args.includes('-c');
  
  if (useClinicBased) {
    assignTenantIdByClinic()
      .then(() => {
        console.log('🏁 Clinic-based tenant migration completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Clinic-based tenant migration failed:', error);
        process.exit(1);
      });
  } else {
    addTenantIdToAllModels()
      .then(() => {
        console.log('🏁 Tenant ID migration completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Tenant ID migration failed:', error);
        process.exit(1);
      });
  }
}

export default addTenantIdToAllModels;
