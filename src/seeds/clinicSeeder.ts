import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { Clinic } from '../models/Clinic';

/**
 * Comprehensive clinic seeder with realistic data
 * Creates multiple unique clinics for each tenant
 */
export async function seedClinics(tenants: any[]): Promise<mongoose.Types.ObjectId[]> {
  console.log('Seeding clinics for multi-tenant architecture...');
  
  try {
    // Clear existing clinics
    await Clinic.deleteMany({});
    
    const allClinics: any[] = [];
    
    // Define clinic templates for different types
    const clinicTypes = [
      { type: 'general', suffix: 'Medical Center' },
      { type: 'family', suffix: 'Family Care' },
      { type: 'specialty', suffix: 'Specialty Clinic' },
      { type: 'dental', suffix: 'Dental Center' },
      { type: 'pediatric', suffix: 'Children\'s Clinic' }
    ];
    
    const cities = [
      { name: 'New York', state: 'NY', timezone: 'America/New_York' },
      { name: 'Los Angeles', state: 'CA', timezone: 'America/Los_Angeles' },
      { name: 'Chicago', state: 'IL', timezone: 'America/Chicago' },
      { name: 'Houston', state: 'TX', timezone: 'America/Chicago' },
      { name: 'Phoenix', state: 'AZ', timezone: 'America/Phoenix' },
      { name: 'Philadelphia', state: 'PA', timezone: 'America/New_York' },
      { name: 'San Antonio', state: 'TX', timezone: 'America/Chicago' },
      { name: 'San Diego', state: 'CA', timezone: 'America/Los_Angeles' },
      { name: 'Dallas', state: 'TX', timezone: 'America/Chicago' },
      { name: 'San Jose', state: 'CA', timezone: 'America/Los_Angeles' }
    ];
    
    let clinicCounter = 1;
    
    // Create clinics for each tenant
    for (let tenantIndex = 0; tenantIndex < tenants.length; tenantIndex++) {
      const tenant = tenants[tenantIndex];
      const tenantName = tenant.name.replace(/\s+(Network|Group|Systems|Partners|Care)$/i, '');
      
      console.log(`  Creating clinics for tenant: ${tenant.name}`);
      
      // Each tenant gets 2-3 clinics
      const clinicsPerTenant = faker.number.int({ min: 2, max: 3 });
      
      for (let i = 0; i < clinicsPerTenant; i++) {
        const clinicType = faker.helpers.arrayElement(clinicTypes);
        const city = faker.helpers.arrayElement(cities);
        
        // Generate unique clinic name for this tenant
        const clinicName = i === 0 
          ? `${tenantName} Main Campus` 
          : `${tenantName} ${city.name} ${clinicType.suffix}`;
        
        const clinic = {
          tenant_id: tenant._id,
          name: clinicName,
          code: `CLN${String(clinicCounter).padStart(3, '0')}`,
          description: `${clinicType.type.charAt(0).toUpperCase() + clinicType.type.slice(1)} healthcare facility providing comprehensive medical services`,
          address: {
            street: faker.location.streetAddress(),
            city: city.name,
            state: city.state,
            zipCode: faker.location.zipCode(),
            country: 'USA'
          },
          contact: {
            phone: faker.phone.number().substring(0, 15),
            email: `contact@${clinicName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`,
            website: `https://${clinicName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`
          },
          settings: {
            timezone: city.timezone,
            currency: 'USD',
            language: 'en',
            working_hours: {
              monday: { 
                start: faker.helpers.arrayElement(['07:00', '08:00', '09:00']), 
                end: faker.helpers.arrayElement(['17:00', '18:00', '19:00']), 
                isWorking: true 
              },
              tuesday: { 
                start: faker.helpers.arrayElement(['07:00', '08:00', '09:00']), 
                end: faker.helpers.arrayElement(['17:00', '18:00', '19:00']), 
                isWorking: true 
              },
              wednesday: { 
                start: faker.helpers.arrayElement(['07:00', '08:00', '09:00']), 
                end: faker.helpers.arrayElement(['17:00', '18:00', '19:00']), 
                isWorking: true 
              },
              thursday: { 
                start: faker.helpers.arrayElement(['07:00', '08:00', '09:00']), 
                end: faker.helpers.arrayElement(['17:00', '18:00', '19:00']), 
                isWorking: true 
              },
              friday: { 
                start: faker.helpers.arrayElement(['07:00', '08:00', '09:00']), 
                end: faker.helpers.arrayElement(['16:00', '17:00', '18:00']), 
                isWorking: true 
              },
              saturday: { 
                start: faker.helpers.arrayElement(['08:00', '09:00', '10:00']), 
                end: faker.helpers.arrayElement(['14:00', '15:00', '16:00']), 
                isWorking: faker.datatype.boolean({ probability: 0.7 })
              },
              sunday: { 
                start: '10:00', 
                end: '15:00', 
                isWorking: faker.datatype.boolean({ probability: 0.3 })
              }
            }
          },
          is_active: true
        };
        
        allClinics.push(clinic);
        clinicCounter++;
      }
    }
    
    const createdClinics = await Clinic.insertMany(allClinics);
    console.log(`  Created ${createdClinics.length} clinics across ${tenants.length} tenants`);
    
    // Log clinic details grouped by tenant
    for (let tenantIndex = 0; tenantIndex < tenants.length; tenantIndex++) {
      const tenant = tenants[tenantIndex];
      const tenantClinics = createdClinics.filter(clinic => 
        clinic.tenant_id.toString() === tenant._id.toString()
      );
      
      console.log(`    ${tenant.name}: ${tenantClinics.length} clinics`);
      tenantClinics.forEach((clinic, index) => {
        console.log(`      ${index + 1}. ${clinic.name} (${clinic.code}) - ${clinic._id}`);
      });
    }
    
    return createdClinics.map(clinic => clinic._id);
    
  } catch (error) {
    console.error('Error seeding clinics:', error);
    throw error;
  }
}
