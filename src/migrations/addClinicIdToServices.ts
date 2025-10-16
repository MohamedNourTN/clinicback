import mongoose from 'mongoose';
import Service from '../models/Service';
import { Clinic } from '../models';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to add clinic_id to existing services
 * 
 * This script should be run once to update existing services in the database
 * that were created before the clinic_id field was added to the schema.
 * 
 * Usage: npx ts-node src/migrations/addClinicIdToServices.ts
 */

async function addClinicIdToServices() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    console.log('✅ Connected to MongoDB');

    // Find all services without clinic_id
    const servicesWithoutClinicId = await Service.find({ clinic_id: { $exists: false } });
    console.log(`📋 Found ${servicesWithoutClinicId.length} services without clinic_id`);

    if (servicesWithoutClinicId.length === 0) {
      console.log('✅ All services already have clinic_id. No migration needed.');
      return;
    }

    // Get the first available clinic
    const firstClinic = await Clinic.findOne({ is_active: true });
    if (!firstClinic) {
      console.error('❌ No active clinic found. Please create a clinic first.');
      return;
    }

    console.log(`🏥 Using clinic: ${firstClinic.name} (${firstClinic._id})`);

    // Update services without clinic_id
    const result = await Service.updateMany(
      { clinic_id: { $exists: false } },
      { $set: { clinic_id: firstClinic._id } }
    );

    console.log(`✅ Updated ${result.modifiedCount} services with clinic_id`);
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
 * Alternative migration function to assign services to specific clinic
 * Usage: assignServicesToClinic('clinic-id-here')
 */
export async function assignServicesToClinic(clinicId: string) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    
    // Validate clinic exists
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      throw new Error(`Clinic with ID ${clinicId} not found`);
    }

    // Update services
    const result = await Service.updateMany(
      { clinic_id: { $exists: false } },
      { $set: { clinic_id: clinicId } }
    );

    console.log(`✅ Assigned ${result.modifiedCount} services to clinic: ${clinic.name}`);
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
  addClinicIdToServices()
    .then(() => {
      console.log('🏁 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default addClinicIdToServices;
