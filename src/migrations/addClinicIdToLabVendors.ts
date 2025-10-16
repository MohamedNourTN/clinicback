import mongoose from 'mongoose';
import LabVendor from '../models/LabVendor';
import { Clinic } from '../models';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to add clinic_id to existing lab vendors
 * 
 * This script should be run once to update existing lab vendors in the database
 * that were created before the clinic_id field was added to the schema.
 * 
 * Usage: npx ts-node src/migrations/addClinicIdToLabVendors.ts
 */

async function addClinicIdToLabVendors() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    console.log('✅ Connected to MongoDB');

    // Find all lab vendors without clinic_id
    const labVendorsWithoutClinicId = await LabVendor.find({ clinic_id: { $exists: false } });
    console.log(`📋 Found ${labVendorsWithoutClinicId.length} lab vendors without clinic_id`);

    if (labVendorsWithoutClinicId.length === 0) {
      console.log('✅ All lab vendors already have clinic_id. No migration needed.');
      return;
    }

    // Get the first available clinic
    const firstClinic = await Clinic.findOne({ is_active: true });
    if (!firstClinic) {
      console.error('❌ No active clinic found. Please create a clinic first.');
      return;
    }

    console.log(`🏥 Using clinic: ${firstClinic.name} (${firstClinic._id})`);

    // Update lab vendors without clinic_id
    const result = await LabVendor.updateMany(
      { clinic_id: { $exists: false } },
      { $set: { clinic_id: firstClinic._id } }
    );

    console.log(`✅ Updated ${result.modifiedCount} lab vendors with clinic_id`);
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
 * Alternative migration function to assign lab vendors to specific clinic
 * Usage: assignLabVendorsToClinic('clinic-id-here')
 */
export async function assignLabVendorsToClinic(clinicId: string) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    // Validate clinic exists
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      throw new Error(`Clinic with ID ${clinicId} not found`);
    }

    // Update lab vendors
    const result = await LabVendor.updateMany(
      { clinic_id: { $exists: false } },
      { $set: { clinic_id: clinicId } }
    );

    console.log(`✅ Assigned ${result.modifiedCount} lab vendors to clinic: ${clinic.name}`);
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
  addClinicIdToLabVendors()
    .then(() => {
      console.log('🏁 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default addClinicIdToLabVendors;
