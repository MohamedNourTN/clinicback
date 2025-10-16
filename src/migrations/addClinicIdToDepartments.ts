import mongoose from 'mongoose';
import Department from '../models/Department';
import { Clinic, Tenant } from '../models';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to add clinic_id and tenant_id to existing departments
 * 
 * This script should be run once to update existing departments in the database
 * that were created before the clinic_id and tenant_id fields were added to the schema.
 * 
 * Usage: npx ts-node src/migrations/addClinicIdToDepartments.ts
 */

async function addClinicIdToDepartments() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    console.log('✅ Connected to MongoDB');

    // Find all departments without clinic_id or tenant_id
    const departmentsWithoutIds = await Department.find({ 
      $or: [
        { clinic_id: { $exists: false } },
        { tenant_id: { $exists: false } }
      ]
    });
    console.log(`📋 Found ${departmentsWithoutIds.length} departments without clinic_id or tenant_id`);

    if (departmentsWithoutIds.length === 0) {
      console.log('✅ All departments already have clinic_id and tenant_id. No migration needed.');
      return;
    }

    // Get the first available clinic with tenant_id
    const firstClinic = await Clinic.findOne({ is_active: true, tenant_id: { $exists: true } });
    if (!firstClinic) {
      console.error('❌ No active clinic with tenant_id found. Please create clinics with tenant associations first.');
      return;
    }

    console.log(`🏥 Using clinic: ${firstClinic.name} (${firstClinic._id})`);
    console.log(`🏢 Using tenant: ${firstClinic.tenant_id}`);

    // Update departments without clinic_id or tenant_id
    const result = await Department.updateMany(
      { 
        $or: [
          { clinic_id: { $exists: false } },
          { tenant_id: { $exists: false } }
        ]
      },
      { 
        $set: { 
          clinic_id: firstClinic._id,
          tenant_id: firstClinic.tenant_id
        } 
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} departments with clinic_id and tenant_id`);
    console.log('🎉 Migration completed successfully!');

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
 * Alternative migration function to assign departments to specific clinic
 * Usage: assignDepartmentsToClinic('clinic-id-here')
 */
export async function assignDepartmentsToClinic(clinicId: string) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    // Validate clinic exists and has tenant_id
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      throw new Error(`Clinic with ID ${clinicId} not found`);
    }
    if (!clinic.tenant_id) {
      throw new Error(`Clinic ${clinic.name} does not have a tenant_id assigned`);
    }

    // Update departments
    const result = await Department.updateMany(
      { 
        $or: [
          { clinic_id: { $exists: false } },
          { tenant_id: { $exists: false } }
        ]
      },
      { 
        $set: { 
          clinic_id: clinicId,
          tenant_id: clinic.tenant_id
        } 
      }
    );

    console.log(`✅ Assigned ${result.modifiedCount} departments to clinic: ${clinic.name} and tenant: ${clinic.tenant_id}`);
    return result.modifiedCount;

  } catch (error) {
    console.error('❌ Assignment failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  addClinicIdToDepartments()
    .then(() => {
      console.log('🏁 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default addClinicIdToDepartments;
