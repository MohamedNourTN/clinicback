import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { SuperAdmin } from '../models';

/**
 * Comprehensive super admin seeder with realistic data
 */
export async function seedSuperAdmins(): Promise<mongoose.Types.ObjectId[]> {
  console.log('Seeding super admins...');
  
  try {
    // Check if SuperAdmin collection already has data
    const existingSuperAdmins = await SuperAdmin.countDocuments();
    console.log(`  Found ${existingSuperAdmins} existing super admin(s)`);

    // Don't clear existing super admins, just add if needed
    if (existingSuperAdmins >= 3) {
      console.log('  ✅ Sufficient super admins already exist. Skipping creation.');
      const existingAdmins = await SuperAdmin.find({ is_active: true }).limit(3);
      return existingAdmins.map(admin => admin._id);
    }

    // Ensure indexes are created
    console.log('  📂 Ensuring SuperAdmin collection exists with proper indexes...');
    await SuperAdmin.init();
    console.log('  ✅ SuperAdmin collection and indexes ready');

    const superAdmins: any[] = [];
    const superAdminData = [
      {
        email: 'superadmin@clinicpro.com',
        password_hash: 'SuperAdmin123!', // Will be hashed by pre-save middleware
        first_name: 'Super',
        last_name: 'Administrator',
        phone: '+1 (555) 000-0001',
        is_active: true,
        two_factor_enabled: false,
        bio: 'Main system administrator with full access to all tenants and clinics.',
        address: '123 Admin Street, System City, SC 12345'
      },
      {
        email: 'admin.manager@clinicpro.com',
        password_hash: 'SuperAdmin123!',
        first_name: 'Admin',
        last_name: 'Manager',
        phone: '+1 (555) 000-0002',
        is_active: true,
        two_factor_enabled: false,
        bio: 'Secondary administrator for system management and oversight.',
        address: faker.location.streetAddress({ useFullAddress: true })
      },
      {
        email: 'system.supervisor@clinicpro.com',
        password_hash: 'SuperAdmin123!',
        first_name: 'System',
        last_name: 'Supervisor',
        phone: '+1 (555) 000-0003',
        is_active: true,
        two_factor_enabled: true,
        bio: 'System supervisor with advanced security features enabled.',
        address: faker.location.streetAddress({ useFullAddress: true })
      }
    ];

    // Create only the super admins we need
    const neededCount = Math.max(0, 3 - existingSuperAdmins);
    const adminsToCreate = superAdminData.slice(0, neededCount);

    console.log(`  👤 Creating ${adminsToCreate.length} super admin(s)...`);

    for (const adminData of adminsToCreate) {
      // Check if this email already exists
      const existingAdmin = await SuperAdmin.findOne({ 
        email: adminData.email.toLowerCase() 
      });
      
      if (!existingAdmin) {
        const superAdmin = new SuperAdmin({
          ...adminData,
          email: adminData.email.toLowerCase()
        });
        
        const savedAdmin = await superAdmin.save();
        superAdmins.push(savedAdmin);
        
        console.log(`    ✅ Created: ${adminData.first_name} ${adminData.last_name} (${adminData.email})`);
      } else {
        superAdmins.push(existingAdmin);
        console.log(`    ℹ️  Already exists: ${adminData.email}`);
      }
    }

    // Get all active super admins for return
    const allActiveSuperAdmins = await SuperAdmin.find({ is_active: true });
    console.log(`  ✅ Total active super admins: ${allActiveSuperAdmins.length}`);
    
    // Display access information
    if (adminsToCreate.length > 0) {
      console.log('\n  🔐 Super Admin Access Information:');
      console.log('     Email: superadmin@clinicpro.com');
      console.log('     Password: SuperAdmin123!');
      console.log('     ⚠️  IMPORTANT: Change default passwords after first login!');
    }
    
    return allActiveSuperAdmins.map(admin => admin._id);
    
  } catch (error) {
    console.error('Error seeding super admins:', error);
    throw error;
  }
}

/**
 * Create additional super admin with custom data
 */
export async function createSuperAdmin(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<mongoose.Types.ObjectId> {
  try {
    // Check if super admin with this email already exists
    const existingSuperAdmin = await SuperAdmin.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingSuperAdmin) {
      console.log(`Super admin with email ${email} already exists`);
      return existingSuperAdmin._id;
    }

    // Create new super admin
    const superAdmin = new SuperAdmin({
      email: email.toLowerCase(),
      password_hash: password, // Will be hashed by pre-save middleware
      first_name: firstName,
      last_name: lastName,
      phone: phone || faker.phone.number().substring(0, 15),
      is_active: true,
      two_factor_enabled: false,
      bio: `Custom super admin: ${firstName} ${lastName}`,
      address: faker.location.streetAddress({ useFullAddress: true })
    });

    const savedAdmin = await superAdmin.save();
    console.log(`✅ Super admin created: ${firstName} ${lastName} (${email})`);
    
    return savedAdmin._id;
  } catch (error) {
    console.error('Error creating super admin:', error);
    throw error;
  }
}

/**
 * Deactivate a super admin by email
 */
export async function deactivateSuperAdmin(email: string): Promise<boolean> {
  try {
    const result = await SuperAdmin.findOneAndUpdate(
      { email: email.toLowerCase() },
      { is_active: false },
      { new: true }
    );

    if (result) {
      console.log(`✅ Super admin deactivated: ${result.first_name} ${result.last_name} (${email})`);
      return true;
    } else {
      console.log(`⚠️ Super admin not found: ${email}`);
      return false;
    }
  } catch (error) {
    console.error('Error deactivating super admin:', error);
    return false;
  }
}

export default seedSuperAdmins;
