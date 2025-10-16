import mongoose from 'mongoose';
import { Tenant, SuperAdmin } from '../models';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to create the Tenants collection and seed with sample data
 * 
 * This script should be run once to set up the Tenants system.
 * It will create the collection with proper indexes and add sample tenant data.
 * 
 * Usage: npx ts-node src/migrations/createTenantsTable.ts
 */

async function createTenantsTable() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    console.log('✅ Connected to MongoDB');

    // Check if Tenants collection already has data
    const existingTenants = await Tenant.countDocuments();
    console.log(`📊 Found ${existingTenants} existing tenant(s)`);

    // Ensure indexes are created
    console.log('📂 Ensuring Tenant collection exists with proper indexes...');
    await Tenant.init();
    console.log('✅ Tenant collection and indexes ready');

    // Create sample tenants if none exist
    if (existingTenants === 0) {
      console.log('🏢 Creating sample tenants...');
      
      // Get the first super admin to use as created_by
      const superAdmin = await SuperAdmin.findOne({ is_active: true });
      if (!superAdmin) {
        console.warn('⚠️ No super admin found. Please create a super admin first.');
        console.log('You can run: npm run migrate:superadmin');
        return;
      }

      const sampleTenants = [
        {
          name: 'Acme Medical Center',
          slug: 'acme-medical',
          email: 'admin@acmemedical.com',
          phone: '+1 (555) 123-4567',
          subdomain: 'acme-medical',
          logo_url: 'https://picsum.photos/50/50',
          status: 'active',
          created_by: superAdmin._id
        },
        {
          name: 'Downtown Dental Clinic',
          slug: 'downtown-dental',
          email: 'contact@downtowndental.com',
          phone: '+1 (555) 987-6543',
          subdomain: 'downtown-dental',
          status: 'active',
          created_by: superAdmin._id
        },
        {
          name: 'Metro Health Group',
          slug: 'metro-health',
          email: 'admin@metrohealth.org',
          phone: '+1 (555) 456-7890',
          subdomain: 'metro-health',
          logo_url: 'https://picsum.photos/50/50',
          status: 'pending',
          created_by: superAdmin._id
        },
        {
          name: 'Sunset Family Practice',
          slug: 'sunset-family',
          email: 'info@sunsetfamily.com',
          phone: '+1 (555) 321-0987',
          subdomain: 'sunset-family',
          status: 'suspended',
          created_by: superAdmin._id
        },
        {
          name: 'Riverside Wellness Center',
          slug: 'riverside-wellness',
          email: 'hello@riversidewellness.com',
          phone: '+1 (555) 654-3210',
          subdomain: 'riverside-wellness',
          status: 'inactive',
          created_by: superAdmin._id
        }
      ];

      for (const tenantData of sampleTenants) {
        const tenant = new Tenant(tenantData);
        await tenant.save();
        console.log(`✅ Created tenant: ${tenant.name}`);
      }
      
      console.log(`✅ ${sampleTenants.length} sample tenants created successfully`);
    } else {
      console.log('ℹ️  Tenants collection already has data. Skipping sample data creation.');
    }

    console.log('🎉 Tenants table setup completed successfully!');

    // Show summary
    const totalTenants = await Tenant.countDocuments({ deleted_at: { $exists: false } });
    const activeTenants = await Tenant.countDocuments({ status: 'active', deleted_at: { $exists: false } });
    const pendingTenants = await Tenant.countDocuments({ status: 'pending', deleted_at: { $exists: false } });
    
    console.log('📈 Summary:');
    console.log(`   Total Tenants: ${totalTenants}`);
    console.log(`   Active: ${activeTenants}`);
    console.log(`   Pending: ${pendingTenants}`);

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
 * Function to create a new tenant
 * Usage: createTenant(name, slug, email, phone, subdomain, status, superAdminId)
 */
export async function createTenant(
  name: string,
  slug: string,
  email: string,
  phone: string | undefined,
  subdomain: string | undefined,
  status: 'active' | 'inactive' | 'suspended' | 'pending',
  superAdminId: string
) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    // Validate super admin exists
    const superAdmin = await SuperAdmin.findById(superAdminId);
    if (!superAdmin) {
      throw new Error(`Super admin with ID ${superAdminId} not found`);
    }

    // Create new tenant
    const tenant = new Tenant({
      name,
      slug: slug.toLowerCase(),
      email: email.toLowerCase(),
      phone,
      subdomain: subdomain?.toLowerCase(),
      status,
      created_by: superAdminId
    });

    await tenant.save();
    console.log(`✅ Tenant created successfully: ${name} (${slug})`);
    return tenant;

  } catch (error) {
    console.error('❌ Tenant creation failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Function to soft delete a tenant
 * Usage: deleteTenant('tenant-id')
 */
export async function deleteTenant(tenantId: string) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    // Find and soft delete tenant
    const tenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { deleted_at: new Date() },
      { new: true }
    );

    if (!tenant) {
      throw new Error(`Tenant with ID ${tenantId} not found`);
    }

    console.log(`✅ Tenant soft deleted: ${tenant.name} (${tenant.slug})`);
    return tenant;

  } catch (error) {
    console.error('❌ Tenant deletion failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  createTenantsTable()
    .then(() => {
      console.log('🏁 Tenants migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Tenants migration failed:', error);
      process.exit(1);
    });
}

export default createTenantsTable;
