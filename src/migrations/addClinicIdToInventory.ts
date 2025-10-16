import mongoose from 'mongoose';
import Inventory from '../models/Inventory';
import { Clinic, Tenant } from '../models';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to add clinic_id and tenant_id to existing inventory items
 * 
 * This script should be run once to update existing inventory items in the database
 * that were created before the clinic_id and tenant_id fields were added to the schema.
 * 
 * Usage: npx ts-node src/migrations/addClinicIdToInventory.ts
 */

async function addClinicIdToInventory() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-pro');
    console.log('✅ Connected to MongoDB');

    // Find all inventory items without clinic_id or tenant_id
    const inventoryWithoutIds = await Inventory.find({ 
      $or: [
        { clinic_id: { $exists: false } },
        { tenant_id: { $exists: false } }
      ]
    });
    console.log(`📋 Found ${inventoryWithoutIds.length} inventory items without clinic_id or tenant_id`);

    if (inventoryWithoutIds.length === 0) {
      console.log('✅ All inventory items already have clinic_id and tenant_id. No migration needed.');
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

    // Update inventory items without clinic_id or tenant_id
    const result = await Inventory.updateMany(
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

    console.log(`✅ Updated ${result.modifiedCount} inventory items with clinic_id and tenant_id`);
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
 * Alternative migration function to assign inventory items to specific clinic
 * Usage: assignInventoryToClinic('clinic-id-here')
 */
export async function assignInventoryToClinic(clinicId: string) {
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

    // Update inventory items
    const result = await Inventory.updateMany(
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

    console.log(`✅ Assigned ${result.modifiedCount} inventory items to clinic: ${clinic.name} and tenant: ${clinic.tenant_id}`);
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
  addClinicIdToInventory()
    .then(() => {
      console.log('🏁 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default addClinicIdToInventory;
