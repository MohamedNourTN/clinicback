import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { User, UserClinic, Role, Clinic } from '../models';

/**
 * Comprehensive user seeder with realistic data and multi-clinic relationships
 */
export async function seedUsers(clinicIds: mongoose.Types.ObjectId[], tenants: any[]): Promise<void> {
  console.log('Seeding users and user-clinic relationships...');
  
  try {
    // Clear existing users and user-clinic relationships
    await User.deleteMany({});
    await UserClinic.deleteMany({});
    
    // Define user roles and their counts per clinic (excluding super_admin which is created separately)
    const roleTemplates = {
      admin: 1,      // 1 admin per clinic
      doctor: 3,     // 3 doctors per clinic
      nurse: 2,      // 2 nurses per clinic
      receptionist: 2, // 2 receptionists per clinic
      accountant: 1,  // 1 accountant per clinic
      staff: 1       // 1 general staff per clinic
    };
    
    const specializations = [
      'General Medicine', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics',
      'Dermatology', 'Gynecology', 'Psychiatry', 'Radiology', 'Anesthesiology',
      'Emergency Medicine', 'Internal Medicine', 'Family Medicine'
    ];
    
    const departments = [
      'Emergency', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics',
      'General Medicine', 'ICU', 'Surgery', 'Radiology', 'Laboratory'
    ];
    
    let totalUsersCreated = 0;
    let totalUserClinicsCreated = 0;
    
    for (const clinicId of clinicIds) {
      console.log(`  Creating users for clinic: ${clinicId}`);
      
      // Get the clinic to find its tenant_id
      const clinic = await Clinic.findById(clinicId);
      if (!clinic) {
        throw new Error(`Clinic with ID ${clinicId} not found`);
      }
      
      for (const [role, count] of Object.entries(roleTemplates)) {
        for (let i = 0; i < count; i++) {
          const firstName = faker.person.firstName();
          const lastName = faker.person.lastName();
          const email = faker.internet.email({ firstName, lastName }).toLowerCase();
          
          const userData = {
            tenant_id: clinic.tenant_id,
            clinic_id: clinicId,
            first_name: firstName,
            last_name: lastName,
            email: email,
            password_hash: 'password123', // Will be hashed by pre-save middleware
            phone: faker.phone.number().substring(0, 15),
            role: role as 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'accountant' | 'staff',
            is_active: faker.datatype.boolean({ probability: 0.95 }),
            is_verified: faker.datatype.boolean({ probability: 0.9 }),
            base_currency: 'USD',
            address: faker.location.streetAddress({ useFullAddress: true }),
            bio: faker.lorem.paragraph(),
            date_of_birth: faker.date.birthdate({ min: 25, max: 65, mode: 'age' }),
            specialization: role === 'doctor' ? faker.helpers.arrayElement(specializations) : undefined,
            license_number: role === 'doctor' ? `LIC-${faker.string.alphanumeric(8).toUpperCase()}` : undefined,
            department: ['nurse', 'staff'].includes(role) ? faker.helpers.arrayElement(departments) : undefined,
            avatar: faker.image.avatar(),
            schedule: role === 'doctor' ? {
              monday: { start: "08:00", end: "17:00", isWorking: true },
              tuesday: { start: "08:00", end: "17:00", isWorking: true },
              wednesday: { start: "08:00", end: "17:00", isWorking: true },
              thursday: { start: "08:00", end: "17:00", isWorking: true },
              friday: { start: "08:00", end: "16:00", isWorking: true },
              saturday: { start: "09:00", end: "14:00", isWorking: faker.datatype.boolean() },
              sunday: { start: "00:00", end: "00:00", isWorking: false }
            } : undefined
          };
          
          const createdUser = await User.create(userData);
          totalUsersCreated++;
          
          // Create UserClinic relationship with new role system
          const roleDoc = await Role.findOne({ 
            tenant_id: clinic.tenant_id,
            name: role.toLowerCase(), 
            is_system_role: true 
          });
          if (!roleDoc) {
            throw new Error(`System role '${role}' not found for tenant ${clinic.tenant_id}. Make sure roles are seeded first.`);
          }
          
          const userClinicData = {
            tenant_id: clinic.tenant_id,
            user_id: createdUser._id,
            clinic_id: clinicId,
            roles: [{
              role_id: roleDoc._id,
              assigned_at: new Date(),
              assigned_by: createdUser._id, // Self-assigned for seeding
              is_primary: true
            }],
            permission_overrides: [], // No overrides for seeded users
            is_active: true,
            joined_at: faker.date.recent({ days: 365 })
          };
          
          await UserClinic.create(userClinicData);
          totalUserClinicsCreated++;
        }
      }
    }
    
    // Create some super admins that have access to multiple clinics
    console.log('  Creating super admins with multi-clinic access...');
    
    for (let i = 0; i < 2; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName }).toLowerCase();
      
      // Get the first clinic to find its tenant_id
      const primaryClinic = await Clinic.findById(clinicIds[0]);
      if (!primaryClinic) {
        throw new Error(`Primary clinic not found`);
      }
      
      const superAdminData = {
        tenant_id: primaryClinic.tenant_id,
        clinic_id: clinicIds[0], // Primary clinic
        first_name: firstName,
        last_name: lastName,
        email: email,
        password_hash: 'password123', // Will be hashed by pre-save middleware
        phone: faker.phone.number().substring(0, 15),
        role: 'super_admin' as const, // Now using super_admin directly in User model
        is_active: true,
        is_verified: true,
        base_currency: 'USD',
        address: faker.location.streetAddress({ useFullAddress: true }),
        bio: 'Super Administrator with unrestricted multi-clinic access',
        date_of_birth: faker.date.birthdate({ min: 30, max: 55, mode: 'age' }),
        avatar: faker.image.avatar()
      };
      
      const createdSuperAdmin = await User.create(superAdminData);
      totalUsersCreated++;
      
      // Create UserClinic relationships for all clinics
      const superAdminRole = await Role.findOne({ 
        tenant_id: primaryClinic.tenant_id,
        name: 'super_admin', 
        is_system_role: true 
      });
      if (!superAdminRole) {
        throw new Error(`Super Admin role not found for tenant ${primaryClinic.tenant_id}. Make sure roles are seeded first.`);
      }
      
      for (const clinicId of clinicIds) {
        // Get clinic to find its tenant_id
        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
          throw new Error(`Clinic with ID ${clinicId} not found`);
        }
        
        const userClinicData = {
          tenant_id: clinic.tenant_id,
          user_id: createdSuperAdmin._id,
          clinic_id: clinicId,
          roles: [{
            role_id: superAdminRole._id,
            assigned_at: new Date(),
            assigned_by: createdSuperAdmin._id, // Self-assigned for seeding
            is_primary: true
          }],
          permission_overrides: [], // No overrides for super admin
          is_active: true,
          joined_at: faker.date.recent({ days: 365 })
        };
        
        await UserClinic.create(userClinicData);
        totalUserClinicsCreated++;
      }
    }
    
    console.log(`  Created ${totalUsersCreated} users`);
    console.log(`  Created ${totalUserClinicsCreated} user-clinic relationships`);
    
  } catch (error) {
    console.error('Error seeding users:', error);
    throw error;
  }
}

// Removed getDefaultPermissionsByRole function - permissions are now handled through the Role system
