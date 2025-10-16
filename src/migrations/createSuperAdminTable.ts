import mongoose from 'mongoose';
import { SuperAdmin } from '../models';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to create the SuperAdmin collection and seed with default super admin
 * 
 * This script should be run once to set up the SuperAdmin system.
 * It will create the collection with proper indexes and add a default super admin user.
 * 
 * Usage: npx ts-node src/migrations/createSuperAdminTable.ts
 */

async function createSuperAdminTable() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    console.log('✅ Connected to MongoDB');

    // Check if SuperAdmin collection already has data
    const existingSuperAdmins = await SuperAdmin.countDocuments();
    console.log(`📊 Found ${existingSuperAdmins} existing super admin(s)`);

    // Ensure indexes are created (Mongoose handles this automatically when the model is first used)
    console.log('📂 Ensuring SuperAdmin collection exists with proper indexes...');
    // Force model initialization to create collection and indexes
    await SuperAdmin.init();
    console.log('✅ SuperAdmin collection and indexes ready');

    // Create default super admin if none exist
    if (existingSuperAdmins === 0) {
      console.log('👤 Creating default super admin...');
      
      const defaultSuperAdmin = new SuperAdmin({
        email: 'superadmin@clinicpro.com',
        password_hash: 'SuperAdmin123!', // Will be hashed by pre-save middleware
        first_name: 'Super',
        last_name: 'Administrator',
        is_active: true,
        two_factor_enabled: false
      });

      await defaultSuperAdmin.save();
      
      console.log('✅ Default super admin created successfully');
      console.log('📧 Email: superadmin@clinicpro.com');
      console.log('🔐 Password: SuperAdmin123!');
      console.log('⚠️  IMPORTANT: Please change the default password after first login!');
    } else {
      console.log('ℹ️  SuperAdmin collection already has data. Skipping default user creation.');
    }

    console.log('🎉 SuperAdmin table setup completed successfully!');

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
 * Function to create additional super admin users
 * Usage: createSuperAdmin('email@example.com', 'password', 'FirstName', 'LastName')
 */
export async function createSuperAdmin(email: string, password: string, firstName: string, lastName: string) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    // Check if super admin with this email already exists
    const existingSuperAdmin = await SuperAdmin.findOne({ email: email.toLowerCase() });
    if (existingSuperAdmin) {
      throw new Error(`Super admin with email ${email} already exists`);
    }

    // Create new super admin
    const superAdmin = new SuperAdmin({
      email: email.toLowerCase(),
      password_hash: password, // Will be hashed by pre-save middleware
      first_name: firstName,
      last_name: lastName,
      is_active: true,
      two_factor_enabled: false
    });

    await superAdmin.save();
    console.log(`✅ Super admin created successfully: ${firstName} ${lastName} (${email})`);
    return superAdmin;

  } catch (error) {
    console.error('❌ Super admin creation failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Function to reset a super admin's password
 * Usage: resetSuperAdminPassword('email@example.com', 'newPassword')
 */
export async function resetSuperAdminPassword(email: string, newPassword: string) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    // Find super admin by email
    const superAdmin = await SuperAdmin.findOne({ email: email.toLowerCase() });
    if (!superAdmin) {
      throw new Error(`Super admin with email ${email} not found`);
    }

    // Update password
    superAdmin.password_hash = newPassword; // Will be hashed by pre-save middleware
    superAdmin.login_attempts = 0; // Reset login attempts
    superAdmin.locked_until = undefined; // Remove any lock
    await superAdmin.save();

    console.log(`✅ Password reset successfully for: ${superAdmin.first_name} ${superAdmin.last_name} (${email})`);
    return superAdmin;

  } catch (error) {
    console.error('❌ Password reset failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Function to deactivate a super admin
 * Usage: deactivateSuperAdmin('email@example.com')
 */
export async function deactivateSuperAdmin(email: string) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    // Find and deactivate super admin
    const superAdmin = await SuperAdmin.findOneAndUpdate(
      { email: email.toLowerCase() },
      { is_active: false },
      { new: true }
    );

    if (!superAdmin) {
      throw new Error(`Super admin with email ${email} not found`);
    }

    console.log(`✅ Super admin deactivated: ${superAdmin.first_name} ${superAdmin.last_name} (${email})`);
    return superAdmin;

  } catch (error) {
    console.error('❌ Deactivation failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  createSuperAdminTable()
    .then(() => {
      console.log('🏁 SuperAdmin migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 SuperAdmin migration failed:', error);
      process.exit(1);
    });
}

export default createSuperAdminTable;
