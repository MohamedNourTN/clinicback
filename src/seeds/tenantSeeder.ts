import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { Tenant, SuperAdmin } from '../models';

/**
 * Comprehensive tenant seeder with realistic data
 */
export async function seedTenants(): Promise<mongoose.Types.ObjectId[]> {
  console.log('Seeding tenants...');
  
  try {
    // Get first super admin to use as created_by
    const superAdmin = await SuperAdmin.findOne({ is_active: true });
    if (!superAdmin) {
      throw new Error('No super admin found. Please run super admin migration first.');
    }

    // Clear existing tenants
    await Tenant.deleteMany({});
    
    const tenants: any[] = [];
    
    // Define specific tenant data for variety
    const tenantTemplates = [
      {
        name: 'Metropolitan Health Network',
        slug: 'metropolitan-health',
        email: 'admin@metropolitanhealth.com',
        phone: '+1 (555) 123-4567',
        subdomain: 'metropolitan-health',
        status: 'active',
        logo_url: 'https://avatar.iran.liara.run/public/47'
      },
      {
        name: 'Coastal Medical Group',
        slug: 'coastal-medical',
        email: 'contact@coastalmedical.com', 
        phone: '+1 (555) 987-6543',
        subdomain: 'coastal-medical',
        status: 'active',
        logo_url: 'https://avatar.iran.liara.run/public/12'
      },
      {
        name: 'Valley Healthcare Systems',
        slug: 'valley-healthcare',
        email: 'info@valleyhealthcare.org',
        phone: '+1 (555) 456-7890',
        subdomain: 'valley-healthcare',
        status: 'active',
        logo_url: 'https://avatar.iran.liara.run/public/23'
      },
      {
        name: 'Summit Medical Partners',
        slug: 'summit-medical',
        email: 'admin@summitmedical.com',
        phone: '+1 (555) 321-0987',
        subdomain: 'summit-medical',
        status: 'pending',
        logo_url: 'https://avatar.iran.liara.run/public/33'
      },
      {
        name: 'Riverside Family Care',
        slug: 'riverside-family',
        email: 'hello@riversidefamily.com',
        phone: '+1 (555) 654-3210',
        subdomain: 'riverside-family',
        status: 'active',
        logo_url: 'https://avatar.iran.liara.run/public/26'
      }
    ];
    
    for (const template of tenantTemplates) {
      const tenant = {
        ...template,
        created_by: superAdmin._id
      };
      
      tenants.push(tenant);
    }
    
    const createdTenants = await Tenant.insertMany(tenants);
    console.log(`  Created ${createdTenants.length} tenants`);
    
    // Log tenant details for reference
    createdTenants.forEach((tenant, index) => {
      console.log(`    ${index + 1}. ${tenant.name} (${tenant.slug}) - ${tenant._id}`);
    });
    
    return createdTenants.map(tenant => tenant._id);
    
  } catch (error) {
    console.error('Error seeding tenants:', error);
    throw error;
  }
}

export default seedTenants;
