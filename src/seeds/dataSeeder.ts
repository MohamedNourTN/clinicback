import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import {
  Patient, Department, Service, TestCategory, Test, SampleType,
  TestMethodology, TurnaroundTime, LabVendor, Inventory, Lead,
  Appointment, MedicalRecord, Prescription, Invoice, Payment,
  TestReport, Expense, Payroll, Training, TrainingProgress,
  XrayAnalysis, User, Odontogram
} from '../models';
import seedOdontograms from './odontogramSeeder';

/**
 * Comprehensive data seeder for all models (10 rows per clinic)
 */
export async function seedAllData(clinicIds: mongoose.Types.ObjectId[], tenants: any[]): Promise<void> {
  console.log('Seeding comprehensive data for all models...');
  
  try {
    for (const clinicId of clinicIds) {
      console.log(`\nSeeding data for clinic: ${clinicId}`);
      
      // Get clinic to find its tenant_id
      const clinic = await mongoose.model('Clinic').findById(clinicId);
      if (!clinic) {
        throw new Error(`Clinic with ID ${clinicId} not found`);
      }
      const tenantId = clinic.tenant_id;
      
      // Seed foundational data first
      await seedDepartments(clinicId, tenantId);
      await seedTestCategories(clinicId, tenantId);
      await seedSampleTypes(clinicId, tenantId);
      await seedTestMethodologies(clinicId, tenantId);
      await seedTurnaroundTimes(clinicId, tenantId);
      await seedServices(clinicId, tenantId);
      await seedLabVendors(clinicId, tenantId);
      await seedInventory(clinicId, tenantId);
      await seedTests(clinicId, tenantId);
      
      // Seed patient data
      await seedPatients(clinicId, tenantId);
      await seedLeads(clinicId, tenantId);
      
      // Seed relational data
      await seedAppointments(clinicId, tenantId);
      await seedMedicalRecords(clinicId, tenantId);
      await seedOdontograms(clinicId, tenantId);
      await seedPrescriptions(clinicId, tenantId);
      await seedInvoices(clinicId, tenantId);
      await seedPayments(clinicId, tenantId);
      await seedTestReports(clinicId, tenantId);
      await seedExpenses(clinicId, tenantId);
      await seedPayroll(clinicId, tenantId);
      await seedXrayAnalysis(clinicId, tenantId);
    }
    
    // Seed global training data (not clinic-specific)
    await seedTraining();
    
    // Seed training progress for users
    await seedTrainingProgress();
    
    console.log('\nAll data seeding completed successfully!');
    
  } catch (error) {
    console.error('Error in comprehensive data seeding:', error);
    throw error;
  }
}

async function seedDepartments(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const departments = [
    'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Emergency Medicine',
    'General Medicine', 'Surgery', 'Radiology', 'Laboratory', 'ICU'
  ];
  
  const departmentData = departments.map((name, index) => ({
    tenant_id: tenantId,
    clinic_id: clinicId,
    code: `DEPT${String(index + 1).padStart(3, '0')}`,
    name,
    description: faker.lorem.sentence(),
    head: faker.person.fullName(),
    location: `Building ${faker.helpers.arrayElement(['A', 'B', 'C'])}, Floor ${faker.number.int({ min: 1, max: 5 })}`,
    phone: faker.phone.number().substring(0, 15),
    email: `${name.toLowerCase().replace(/\s+/g, '')}@clinic.com`,
    staffCount: faker.number.int({ min: 5, max: 25 }),
    budget: faker.number.int({ min: 100000, max: 500000 }),
    status: 'active' as const
  }));
  
  await Department.insertMany(departmentData);
  console.log(`  Created ${departmentData.length} departments`);
}

async function seedTestCategories(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const categories = [
    { name: 'Blood Chemistry', code: 'BLOOD_CHEM', color: '#FF6B6B', department: 'Laboratory' },
    { name: 'Hematology', code: 'HEMATOLOGY', color: '#4ECDC4', department: 'Laboratory' },
    { name: 'Microbiology', code: 'MICROBIOLOGY', color: '#45B7D1', department: 'Laboratory' },
    { name: 'Immunology', code: 'IMMUNOLOGY', color: '#96CEB4', department: 'Laboratory' },
    { name: 'Cardiology', code: 'CARDIOLOGY', color: '#FFEAA7', department: 'Cardiology' },
    { name: 'Radiology', code: 'RADIOLOGY', color: '#DDA0DD', department: 'Radiology' },
    { name: 'Endocrinology', code: 'ENDOCRINOLOGY', color: '#FFB6C1', department: 'Laboratory' },
    { name: 'Toxicology', code: 'TOXICOLOGY', color: '#98FB98', department: 'Laboratory' },
    { name: 'Molecular', code: 'MOLECULAR', color: '#F0E68C', department: 'Laboratory' },
    { name: 'Pathology', code: 'PATHOLOGY', color: '#FFA07A', department: 'Laboratory' }
  ];
  
  const categoryData = categories.map((cat, index) => ({
    tenant_id: tenantId,
    clinic_id: clinicId,
    ...cat,
    description: faker.lorem.sentence(),
    icon: faker.helpers.arrayElement(['beaker', 'test-tube', 'heart', 'zap', 'microscope', 'folder']),
    testCount: faker.number.int({ min: 5, max: 50 }),
    commonTests: faker.helpers.arrayElements([
      'CBC', 'BMP', 'CMP', 'Lipid Panel', 'TSH', 'A1C', 'PSA', 'PT/INR'
    ], { min: 2, max: 5 }),
    isActive: true,
    sortOrder: index + 1
  }));
  
  await TestCategory.insertMany(categoryData);
  console.log(`  Created ${categoryData.length} test categories`);
}

async function seedSampleTypes(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const sampleTypes = [
    { name: 'Venous Blood', code: 'VB', category: 'blood', container: 'EDTA tube', volume: '5ml' },
    { name: 'Arterial Blood', code: 'AB', category: 'blood', container: 'Heparin syringe', volume: '3ml' },
    { name: 'Urine', code: 'UR', category: 'urine', container: 'Sterile container', volume: '50ml' },
    { name: 'Throat Swab', code: 'TS', category: 'swab', container: 'Transport medium', volume: 'N/A' },
    { name: 'Nasal Swab', code: 'NS', category: 'swab', container: 'Transport medium', volume: 'N/A' },
    { name: 'Stool', code: 'ST', category: 'body_fluid', container: 'Specimen container', volume: '10ml' },
    { name: 'Sputum', code: 'SP', category: 'body_fluid', container: 'Sterile container', volume: '5ml' },
    { name: 'CSF', code: 'CSF', category: 'body_fluid', container: 'Sterile tube', volume: '2ml' },
    { name: 'Saliva', code: 'SA', category: 'body_fluid', container: 'Collection tube', volume: '2ml' },
    { name: 'Tissue Biopsy', code: 'TB', category: 'tissue', container: 'Formalin jar', volume: 'Variable' }
  ];
  
  const sampleTypeData = sampleTypes.map(sample => ({
    tenant_id: tenantId,
    clinic_id: clinicId,
    ...sample,
    description: faker.lorem.sentence(),
    collectionMethod: faker.lorem.words(3),
    preservative: faker.helpers.arrayElement(['None', 'EDTA', 'Heparin', 'Formalin']),
    storageTemp: faker.helpers.arrayElement(['Room temp', '2-8°C', '-20°C', '-80°C']),
    storageTime: faker.helpers.arrayElement(['2 hours', '24 hours', '48 hours', '1 week']),
    specialInstructions: faker.lorem.sentence(),
    commonTests: faker.helpers.arrayElements(['CBC', 'Chemistry', 'Culture', 'PCR'], { min: 1, max: 3 }),
    isActive: true
  }));
  
  await SampleType.insertMany(sampleTypeData);
  console.log(`  Created ${sampleTypeData.length} sample types`);
}

async function seedTestMethodologies(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const methodologies = [
    { name: 'ELISA', code: 'ELI', category: 'Immunology', equipment: 'ELISA Reader' },
    { name: 'PCR', code: 'PCR', category: 'Molecular', equipment: 'Thermal Cycler' },
    { name: 'Flow Cytometry', code: 'FC', category: 'Hematology', equipment: 'Flow Cytometer' },
    { name: 'Mass Spectrometry', code: 'MS', category: 'Chemistry', equipment: 'LC-MS/MS' },
    { name: 'Immunofluorescence', code: 'IF', category: 'Immunology', equipment: 'Fluorescence Microscope' },
    { name: 'Western Blot', code: 'WB', category: 'Molecular', equipment: 'Blotting System' },
    { name: 'RT-PCR', code: 'RTPCR', category: 'Molecular', equipment: 'Real-time PCR' },
    { name: 'Nephelometry', code: 'NEPH', category: 'Chemistry', equipment: 'Nephelometer' },
    { name: 'Turbidimetry', code: 'TURB', category: 'Chemistry', equipment: 'Turbidimeter' },
    { name: 'Chromatography', code: 'CHROM', category: 'Chemistry', equipment: 'HPLC System' }
  ];
  
  const methodologyData = methodologies.map(method => ({
    tenant_id: tenantId,
    clinic_id: clinicId,
    ...method,
    description: faker.lorem.sentence(),
    principles: faker.lorem.sentence(),
    applications: faker.helpers.arrayElements([
      'Disease diagnosis', 'Drug monitoring', 'Genetic testing', 'Infection detection'
    ], { min: 1, max: 3 }),
    advantages: faker.lorem.sentence(),
    limitations: faker.lorem.sentence(),
    isActive: true
  }));
  
  await TestMethodology.insertMany(methodologyData);
  console.log(`  Created ${methodologyData.length} test methodologies`);
}

async function seedTurnaroundTimes(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const turnaroundTimes = [
    { name: 'STAT', code: 'STAT', duration: '1 hour', durationMinutes: 60, priority: 'stat', category: 'Emergency' },
    { name: 'Urgent', code: 'URG', duration: '4 hours', durationMinutes: 240, priority: 'urgent', category: 'Priority' },
    { name: 'Routine', code: 'ROU', duration: '24 hours', durationMinutes: 1440, priority: 'routine', category: 'Standard' },
    { name: 'Extended', code: 'EXT', duration: '72 hours', durationMinutes: 4320, priority: 'extended', category: 'Specialty' },
    { name: 'Same Day', code: 'SD', duration: '8 hours', durationMinutes: 480, priority: 'urgent', category: 'Fast Track' },
    { name: 'Next Day', code: 'ND', duration: '48 hours', durationMinutes: 2880, priority: 'routine', category: 'Standard' },
    { name: 'Weekly', code: 'WEEK', duration: '7 days', durationMinutes: 10080, priority: 'extended', category: 'Specialty' },
    { name: 'Critical', code: 'CRIT', duration: '30 minutes', durationMinutes: 30, priority: 'stat', category: 'Critical' },
    { name: 'Expedited', code: 'EXP', duration: '2 hours', durationMinutes: 120, priority: 'urgent', category: 'Fast Track' },
    { name: 'Standard Plus', code: 'SP', duration: '36 hours', durationMinutes: 2160, priority: 'routine', category: 'Enhanced' }
  ];
  
  const tatData = turnaroundTimes.map(tat => ({
    tenant_id: tenantId,
    clinic_id: clinicId,
    ...tat,
    description: faker.lorem.sentence(),
    examples: faker.helpers.arrayElements([
      'Troponin', 'Blood gas', 'CBC', 'Basic metabolic panel', 'Lipid panel', 'HbA1c'
    ], { min: 1, max: 3 }),
    isActive: true
  }));
  
  await TurnaroundTime.insertMany(tatData);
  console.log(`  Created ${tatData.length} turnaround times`);
}

async function seedServices(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const services = [
    { name: 'General Consultation', category: 'Consultation', duration: 30, price: 150, department: 'General Medicine' },
    { name: 'Cardiology Consultation', category: 'Consultation', duration: 45, price: 250, department: 'Cardiology' },
    { name: 'Pediatric Checkup', category: 'Consultation', duration: 30, price: 120, department: 'Pediatrics' },
    { name: 'Blood Test Panel', category: 'Laboratory', duration: 15, price: 75, department: 'Laboratory' },
    { name: 'X-Ray Chest', category: 'Imaging', duration: 20, price: 125, department: 'Radiology' },
    { name: 'ECG', category: 'Diagnostic', duration: 15, price: 50, department: 'Cardiology' },
    { name: 'Ultrasound', category: 'Imaging', duration: 30, price: 200, department: 'Radiology' },
    { name: 'Physical Therapy', category: 'Therapy', duration: 60, price: 100, department: 'Rehabilitation' },
    { name: 'Vaccination', category: 'Preventive', duration: 10, price: 25, department: 'General Medicine' },
    { name: 'Emergency Consultation', category: 'Emergency', duration: 45, price: 300, department: 'Emergency Medicine' }
  ];
  
  const serviceData = services.map(service => ({
    tenant_id: tenantId,
    clinic_id: clinicId,
    ...service,
    description: faker.lorem.sentence(),
    isActive: true,
    prerequisites: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    followUpRequired: faker.datatype.boolean({ probability: 0.4 }),
    maxBookingsPerDay: faker.number.int({ min: 10, max: 50 }),
    specialInstructions: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 })
  }));
  
  await Service.insertMany(serviceData);
  console.log(`  Created ${serviceData.length} services`);
}

async function seedLabVendors(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const vendors: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const companyName = faker.company.name();
    vendors.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      name: `${companyName} Labs`,
      code: `LAB${String(i + 1).padStart(3, '0')}`,
      type: faker.helpers.arrayElement(['diagnostic_lab', 'pathology_lab', 'imaging_center', 'reference_lab', 'specialty_lab']),
      status: faker.helpers.arrayElement(['active', 'inactive', 'pending']),
      contactPerson: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number().substring(0, 15),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipCode: faker.location.zipCode(),
      website: faker.internet.url(),
      license: `LIC-${faker.string.alphanumeric(8).toUpperCase()}`,
      accreditation: faker.helpers.arrayElements(['CAP', 'CLIA', 'ISO', 'JCI'], { min: 1, max: 3 }),
      specialties: faker.helpers.arrayElements(['Molecular', 'Pathology', 'Hematology', 'Chemistry'], { min: 1, max: 3 }),
      rating: faker.number.float({ min: 3.0, max: 5.0, fractionDigits: 1 }),
      totalTests: faker.number.int({ min: 100, max: 5000 }),
      averageTurnaround: faker.helpers.arrayElement(['24 hours', '48 hours', '72 hours']),
      pricing: faker.helpers.arrayElement(['budget', 'moderate', 'premium']),
      contractStart: faker.date.past({ years: 2 }),
      contractEnd: faker.date.future({ years: 2 }),
      lastTestDate: faker.date.recent({ days: 30 }),
      notes: faker.lorem.paragraph()
    });
  }
  
  await LabVendor.insertMany(vendors);
  console.log(`  Created ${vendors.length} lab vendors`);
}

async function seedInventory(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const items: any[] = [];
  
  const categories = ['consumables', 'equipment', 'medications'];
  const itemTemplates = {
    consumables: ['Surgical Gloves', 'Syringes', 'Bandages', 'Cotton Swabs', 'Face Masks'],
    equipment: ['Blood Pressure Monitor', 'Stethoscope', 'Thermometer', 'Oximeter', 'ECG Machine'],
    medications: ['Paracetamol', 'Ibuprofen', 'Amoxicillin', 'Insulin', 'Aspirin']
  };
  
  for (let i = 0; i < 10; i++) {
    const category = faker.helpers.arrayElement(categories);
    const name = faker.helpers.arrayElement(itemTemplates[category]);
    
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + faker.number.int({ min: 1, max: 3 }));
    
    items.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      name: `${name} ${faker.string.alphanumeric(3).toUpperCase()}`,
      category,
      sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
      current_stock: faker.number.int({ min: 10, max: 1000 }),
      minimum_stock: faker.number.int({ min: 5, max: 100 }),
      unit_price: faker.number.float({ min: 0.50, max: 500, fractionDigits: 2 }),
      supplier: faker.company.name(),
      expiry_date: category === 'medications' ? futureDate : undefined
    });
  }
  
  await Inventory.insertMany(items);
  console.log(`  Created ${items.length} inventory items`);
}

async function seedTests(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const tests = [
    { name: 'Complete Blood Count', code: 'CBC', category: 'Hematology' },
    { name: 'Basic Metabolic Panel', code: 'BMP', category: 'Blood Chemistry' },
    { name: 'Lipid Panel', code: 'LIPID', category: 'Blood Chemistry' },
    { name: 'Liver Function Tests', code: 'LFT', category: 'Blood Chemistry' },
    { name: 'Thyroid Panel', code: 'TSH', category: 'Endocrinology' },
    { name: 'Urinalysis', code: 'UA', category: 'Microbiology' },
    { name: 'Blood Culture', code: 'BC', category: 'Microbiology' },
    { name: 'HbA1c', code: 'A1C', category: 'Endocrinology' },
    { name: 'PT/INR', code: 'PTINR', category: 'Hematology' },
    { name: 'Troponin I', code: 'TROP', category: 'Cardiology' }
  ];
  
  const testData = tests.map(test => ({
    tenant_id: tenantId,
    clinic_id: clinicId,
    ...test,
    description: faker.lorem.sentence(),
    normalRange: faker.helpers.arrayElement([
      '4.5-11.0 x 10³/μL', '70-100 mg/dL', '<200 mg/dL', '0.3-1.2 mg/dL'
    ]),
    units: faker.helpers.arrayElement(['mg/dL', 'μg/L', 'IU/L', 'mmol/L']),
    methodology: faker.helpers.arrayElement(['Spectrophotometry', 'Immunoassay', 'Enzymatic']),
    turnaroundTime: faker.helpers.arrayElement(['2-4 hours', '1 day', '2-3 days']),
    sampleType: faker.helpers.arrayElement(['Venous Blood', 'Urine', 'Serum']),
    isActive: true
  }));
  
  await Test.insertMany(testData);
  console.log(`  Created ${testData.length} tests`);
}

async function seedPatients(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const patients: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const gender = faker.helpers.arrayElement(['male', 'female', 'other']);
    
    patients.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      first_name: firstName,
      last_name: lastName,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      phone: faker.phone.number().substring(0, 15),
      date_of_birth: faker.date.birthdate({ min: 1, max: 80, mode: 'age' }),
      gender,
      address: faker.location.streetAddress({ useFullAddress: true }),
      emergency_contact: {
        name: faker.person.fullName(),
        relationship: faker.helpers.arrayElement(['spouse', 'parent', 'sibling', 'child', 'friend']),
        phone: faker.phone.number().substring(0, 15),
        email: faker.internet.email()
      },
      insurance_info: {
        provider: faker.helpers.arrayElement(['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Humana']),
        policy_number: faker.string.alphanumeric(10).toUpperCase(),
        group_number: faker.string.alphanumeric(6).toUpperCase(),
        expiry_date: faker.date.future({ years: 2 })
      }
    });
  }
  
  await Patient.insertMany(patients);
  console.log(`  Created ${patients.length} patients`);
}

async function seedLeads(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const leads: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    leads.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.helpers.maybe(() => faker.internet.email(), { probability: 0.8 }),
      phone: faker.phone.number().substring(0, 15),
      source: faker.helpers.arrayElement(['website', 'referral', 'social', 'advertisement', 'walk-in']),
      serviceInterest: faker.helpers.arrayElement([
        'General consultation', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Lab tests'
      ]),
      status: faker.helpers.arrayElement(['new', 'contacted', 'converted', 'lost']),
      assignedTo: faker.person.fullName(),
      notes: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.6 })
    });
  }
  
  await Lead.insertMany(leads);
  console.log(`  Created ${leads.length} leads`);
}

async function seedAppointments(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const patients = await Patient.find({ clinic_id: clinicId }).limit(10);
  const doctors = await User.find({ role: 'doctor' }).limit(5);
  
  if (patients.length === 0 || doctors.length === 0) {
    console.log('  No patients or doctors found for appointments');
    return;
  }
  
  const appointments: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const doctor = faker.helpers.arrayElement(doctors);
    
    appointments.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      patient_id: patient._id,
      doctor_id: doctor._id,
      appointment_date: faker.date.soon({ days: 30 }),
      duration: faker.helpers.arrayElement([30, 45, 60]),
      status: faker.helpers.arrayElement(['scheduled', 'confirmed', 'completed', 'cancelled']),
      type: faker.helpers.arrayElement(['consultation', 'follow-up', 'check-up', 'procedure']),
      reason: faker.lorem.sentence(),
      notes: faker.lorem.paragraph()
    });
  }
  
  await Appointment.insertMany(appointments);
  console.log(`  Created ${appointments.length} appointments`);
}

async function seedMedicalRecords(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const patients = await Patient.find({ clinic_id: clinicId }).limit(10);
  const doctors = await User.find({ role: 'doctor' }).limit(5);
  
  if (patients.length === 0 || doctors.length === 0) {
    console.log('  No patients or doctors found for medical records');
    return;
  }
  
  const records: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const doctor = faker.helpers.arrayElement(doctors);
    
    records.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      patient_id: patient._id,
      doctor_id: doctor._id,
      visit_date: faker.date.past({ years: 1 }),
      chief_complaint: faker.lorem.sentence(),
      diagnosis: faker.lorem.sentence(),
      treatment: faker.lorem.paragraph(),
      vital_signs: {
        temperature: faker.number.float({ min: 36.0, max: 39.0, fractionDigits: 1 }),
        blood_pressure: {
          systolic: faker.number.int({ min: 90, max: 160 }),
          diastolic: faker.number.int({ min: 60, max: 100 })
        },
        heart_rate: faker.number.int({ min: 60, max: 100 }),
        respiratory_rate: faker.number.int({ min: 12, max: 20 }),
        oxygen_saturation: faker.number.int({ min: 95, max: 100 }),
        weight: faker.number.float({ min: 50, max: 120, fractionDigits: 1 }),
        height: faker.number.int({ min: 150, max: 200 })
      },
      medications: [{
        name: faker.helpers.arrayElement(['Paracetamol', 'Ibuprofen', 'Amoxicillin']),
        dosage: faker.helpers.arrayElement(['500mg', '250mg', '100mg']),
        frequency: faker.helpers.arrayElement(['Once daily', 'Twice daily', 'Three times daily']),
        duration: faker.helpers.arrayElement(['7 days', '14 days', '30 days']),
        notes: faker.lorem.sentence()
      }],
      allergies: faker.helpers.maybe(() => [{
        allergen: faker.helpers.arrayElement(['Penicillin', 'Aspirin', 'Latex']),
        severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe']),
        reaction: faker.lorem.sentence()
      }], { probability: 0.3 }) || []
    });
  }
  
  await MedicalRecord.insertMany(records);
  console.log(`  Created ${records.length} medical records`);
}

async function seedPrescriptions(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const patients = await Patient.find({ clinic_id: clinicId }).limit(10);
  const doctors = await User.find({ role: 'doctor' }).limit(5);
  
  if (patients.length === 0 || doctors.length === 0) {
    console.log('  No patients or doctors found for prescriptions');
    return;
  }
  
  const prescriptions: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const doctor = faker.helpers.arrayElement(doctors);
    
    prescriptions.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      patient_id: patient._id,
      doctor_id: doctor._id,
      prescription_id: `RX-${faker.string.alphanumeric(8).toUpperCase()}`,
      diagnosis: faker.lorem.sentence(),
      medications: [{
        name: faker.helpers.arrayElement(['Paracetamol', 'Ibuprofen', 'Amoxicillin', 'Metformin', 'Lisinopril']),
        dosage: faker.helpers.arrayElement(['500mg', '250mg', '100mg', '50mg']),
        frequency: faker.helpers.arrayElement(['Once daily', 'Twice daily', 'Three times daily']),
        duration: faker.helpers.arrayElement(['7 days', '14 days', '30 days']),
        instructions: faker.lorem.sentence(),
        quantity: faker.number.int({ min: 10, max: 90 })
      }],
      status: faker.helpers.arrayElement(['active', 'completed', 'pending']),
      notes: faker.lorem.paragraph(),
      prescribed_date: faker.date.recent({ days: 30 }),
      follow_up_date: faker.helpers.maybe(() => faker.date.soon({ days: 30 }), { probability: 0.5 }),
      pharmacy_dispensed: faker.datatype.boolean({ probability: 0.7 }),
      dispensed_date: faker.helpers.maybe(() => faker.date.recent({ days: 7 }), { probability: 0.7 })
    });
  }
  
  await Prescription.insertMany(prescriptions);
  console.log(`  Created ${prescriptions.length} prescriptions`);
}

async function seedInvoices(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const patients = await Patient.find({ clinic_id: clinicId }).limit(10);
  
  if (patients.length === 0) {
    console.log('  No patients found for invoices');
    return;
  }
  
  const invoices: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const subtotal = faker.number.float({ min: 100, max: 1000, fractionDigits: 2 });
    const taxAmount = subtotal * 0.08; // 8% tax
    const discount = faker.helpers.maybe(() => faker.number.float({ min: 10, max: 50, fractionDigits: 2 }), { probability: 0.3 }) || 0;
    const totalAmount = subtotal + taxAmount - discount;
    
    invoices.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      patient_id: patient._id,
      invoice_number: `INV-${faker.string.alphanumeric(8).toUpperCase()}`,
      total_amount: totalAmount,
      tax_amount: taxAmount,
      subtotal: subtotal,
      discount: discount,
      status: faker.helpers.arrayElement(['pending', 'paid', 'overdue', 'cancelled']),
      issue_date: faker.date.recent({ days: 30 }),
      due_date: faker.date.soon({ days: 30 }),
      services: [{
        id: faker.string.uuid(),
        description: faker.helpers.arrayElement(['General Consultation', 'Lab Tests', 'X-Ray', 'Medication']),
        quantity: faker.number.int({ min: 1, max: 3 }),
        unit_price: faker.number.float({ min: 50, max: 300, fractionDigits: 2 }),
        total: subtotal,
        type: faker.helpers.arrayElement(['service', 'test', 'medication'])
      }]
    });
  }
  
  await Invoice.insertMany(invoices);
  console.log(`  Created ${invoices.length} invoices`);
}

async function seedPayments(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const invoices = await Invoice.find({ clinic_id: clinicId }).limit(8);
  
  if (invoices.length === 0) {
    console.log('  No invoices found for payments');
    return;
  }
  
  const payments: any[] = [];
  
  for (const invoice of invoices) {
    const processingFee = faker.number.float({ min: 1, max: 5, fractionDigits: 2 });
    
    payments.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      invoice_id: invoice._id,
      patient_id: invoice.patient_id,
      amount: invoice.total_amount,
      method: faker.helpers.arrayElement(['credit_card', 'cash', 'bank_transfer', 'insurance']),
      status: faker.helpers.arrayElement(['completed', 'pending', 'failed']),
      transaction_id: faker.string.alphanumeric(12).toUpperCase(),
      processing_fee: processingFee,
      net_amount: invoice.total_amount - processingFee,
      payment_date: faker.date.recent({ days: 30 }),
      description: `Payment for invoice ${invoice.invoice_number}`
    });
  }
  
  await Payment.insertMany(payments);
  console.log(`  Created ${payments.length} payments`);
}

async function seedTestReports(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const patients = await Patient.find({ clinic_id: clinicId }).limit(5);
  const tests = await Test.find({ clinic_id: clinicId }).limit(5);
  
  if (patients.length === 0 || tests.length === 0) {
    console.log('  No patients or tests found for test reports');
    return;
  }
  
  const reports: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const test = faker.helpers.arrayElement(tests);
    
    reports.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      reportNumber: `RPT-${faker.string.alphanumeric(8).toUpperCase()}`,
      patientId: patient._id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      patientAge: Math.floor((new Date().getTime() - patient.date_of_birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
      patientGender: patient.gender,
      testId: test._id,
      testName: test.name,
      testCode: test.code,
      category: test.category,
      externalVendor: faker.helpers.arrayElement(['Internal Lab', 'Quest Diagnostics', 'LabCorp']),
      testDate: faker.date.recent({ days: 7 }),
      recordedDate: faker.date.recent({ days: 3 }),
      recordedBy: faker.person.fullName(),
      status: faker.helpers.arrayElement(['pending', 'recorded', 'verified', 'delivered']),
      results: faker.lorem.paragraph(),
      normalRange: test.normalRange,
      units: test.units,
      notes: faker.lorem.sentence(),
      interpretation: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.7 }),
      verifiedBy: faker.helpers.maybe(() => faker.person.fullName(), { probability: 0.8 }),
      verifiedDate: faker.helpers.maybe(() => faker.date.recent({ days: 1 }), { probability: 0.8 })
    });
  }
  
  await TestReport.insertMany(reports);
  console.log(`  Created ${reports.length} test reports`);
}

async function seedExpenses(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const users = await User.find({ role: { $in: ['admin', 'accountant'] } }).limit(3);
  
  if (users.length === 0) {
    console.log('  No admin/accountant users found for expenses');
    return;
  }
  
  const expenses: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const createdBy = faker.helpers.arrayElement(users);
    
    expenses.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      amount: faker.number.float({ min: 50, max: 2000, fractionDigits: 2 }),
      category: faker.helpers.arrayElement(['supplies', 'equipment', 'utilities', 'maintenance', 'staff', 'marketing', 'insurance', 'rent', 'other']),
      vendor: faker.company.name(),
      payment_method: faker.helpers.arrayElement(['cash', 'card', 'bank_transfer', 'check']),
      date: faker.date.recent({ days: 90 }),
      status: faker.helpers.arrayElement(['pending', 'paid', 'cancelled']),
      notes: faker.lorem.paragraph(),
      created_by: createdBy._id
    });
  }
  
  await Expense.insertMany(expenses);
  console.log(`  Created ${expenses.length} expenses`);
}

async function seedPayroll(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const employees = await User.find({ clinic_id: clinicId }).limit(10);
  
  if (employees.length === 0) {
    console.log('  No employees found for payroll');
    return;
  }
  
  const payroll: any[] = [];
  
  for (const employee of employees) {
    const baseSalary = faker.number.float({ min: 3000, max: 15000, fractionDigits: 2 });
    const overtime = faker.number.float({ min: 0, max: 500, fractionDigits: 2 });
    const bonus = faker.helpers.maybe(() => faker.number.float({ min: 100, max: 1000, fractionDigits: 2 }), { probability: 0.4 }) || 0;
    const allowances = faker.number.float({ min: 0, max: 300, fractionDigits: 2 });
    const deductions = faker.number.float({ min: 50, max: 300, fractionDigits: 2 });
    const tax = (baseSalary + overtime + bonus + allowances) * 0.15;
    const netSalary = baseSalary + overtime + bonus + allowances - deductions - tax;
    
    payroll.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      employee_id: employee._id,
      month: faker.helpers.arrayElement(['January', 'February', 'March', 'April', 'May', 'June']),
      year: 2024,
      base_salary: baseSalary,
      overtime: overtime,
      bonus: bonus,
      allowances: allowances,
      deductions: deductions,
      tax: tax,
      net_salary: netSalary,
      status: faker.helpers.arrayElement(['draft', 'pending', 'processed', 'paid']),
      pay_date: faker.helpers.maybe(() => faker.date.recent({ days: 30 }), { probability: 0.7 }),
      working_days: faker.number.int({ min: 20, max: 22 }),
      total_days: faker.number.int({ min: 28, max: 31 }),
      leaves: faker.number.int({ min: 0, max: 3 })
    });
  }
  
  await Payroll.insertMany(payroll);
  console.log(`  Created ${payroll.length} payroll records`);
}

async function seedXrayAnalysis(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  const patients = await Patient.find({ clinic_id: clinicId }).limit(5);
  const doctors = await User.find({ role: 'doctor' }).limit(3);
  
  if (patients.length === 0 || doctors.length === 0) {
    console.log('  No patients or doctors found for X-ray analysis');
    return;
  }
  
  const analyses: any[] = [];
  
  for (let i = 0; i < 10; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const doctor = faker.helpers.arrayElement(doctors);
    
    analyses.push({
      tenant_id: tenantId,
      clinic_id: clinicId,
      patient_id: patient._id,
      doctor_id: doctor._id,
      image_url: faker.image.url(),
      image_filename: `xray_${faker.string.alphanumeric(8)}.jpg`,
      custom_prompt: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
      analysis_result: faker.lorem.paragraph(),
      analysis_date: faker.date.recent({ days: 30 }),
      status: faker.helpers.arrayElement(['pending', 'completed', 'failed']),
      confidence_score: faker.number.int({ min: 70, max: 99 }),
      findings: {
        cavities: faker.datatype.boolean({ probability: 0.3 }),
        wisdom_teeth: faker.helpers.arrayElement(['normal', 'impacted', 'extracted']),
        bone_density: faker.helpers.arrayElement(['normal', 'low', 'high']),
        infections: faker.datatype.boolean({ probability: 0.1 }),
        abnormalities: faker.helpers.maybe(() => [faker.lorem.words(2)], { probability: 0.2 }) || []
      },
      recommendations: faker.lorem.paragraph()
    });
  }
  
  await XrayAnalysis.insertMany(analyses);
  console.log(`  Created ${analyses.length} X-ray analyses`);
}

async function seedTraining(): Promise<void> {
  console.log('Seeding global training data...');
  
  // Clear existing training
  await Training.deleteMany({});
  
  const trainingData = [
    {
      role: 'admin',
      name: 'Administrator Training Program',
      description: 'Comprehensive system management and administration training',
      overview: 'Learn complete system administration, user management, and clinic operations oversight.',
      modules: [
        {
          title: 'System Overview',
          duration: '20 mins',
          lessons: ['Dashboard Navigation', 'User Interface', 'System Architecture', 'Security Basics'],
          description: 'Introduction to the clinic management system',
          order: 1
        },
        {
          title: 'User Management',
          duration: '30 mins',
          lessons: ['Adding Users', 'Role Assignment', 'Permission Management', 'User Deactivation'],
          description: 'Managing system users and their access levels',
          order: 2
        },
        {
          title: 'Clinic Configuration',
          duration: '25 mins',
          lessons: ['Clinic Settings', 'Working Hours', 'Services Setup', 'Department Management'],
          description: 'Configuring clinic-specific settings and parameters',
          order: 3
        },
        {
          title: 'Reports and Analytics',
          duration: '30 mins',
          lessons: ['Financial Reports', 'Patient Analytics', 'Performance Metrics', 'Data Export'],
          description: 'Generating and analyzing clinic performance reports',
          order: 4
        }
      ],
      is_active: true
    },
    {
      role: 'doctor',
      name: 'Doctor Clinical Workflow Training',
      description: 'Clinical workflow and patient management training for doctors',
      overview: 'Master patient care workflows, medical records, and clinical decision support tools.',
      modules: [
        {
          title: 'Patient Management',
          duration: '25 mins',
          lessons: ['Patient Registration', 'Medical History Review', 'Clinical Documentation', 'Patient Communication'],
          description: 'Comprehensive patient management workflows',
          order: 1
        },
        {
          title: 'Appointment Scheduling',
          duration: '20 mins',
          lessons: ['Calendar Management', 'Appointment Types', 'Scheduling Rules', 'Cancellation Policies'],
          description: 'Efficient appointment scheduling and management',
          order: 2
        },
        {
          title: 'Clinical Documentation',
          duration: '35 mins',
          lessons: ['Medical Records', 'Diagnosis Coding', 'Treatment Plans', 'Progress Notes'],
          description: 'Proper clinical documentation and record keeping',
          order: 3
        },
        {
          title: 'Test and Lab Orders',
          duration: '25 mins',
          lessons: ['Ordering Tests', 'Lab Integration', 'Result Interpretation', 'Patient Communication'],
          description: 'Laboratory and diagnostic test management',
          order: 4
        }
      ],
      is_active: true
    },
    {
      role: 'nurse',
      name: 'Nursing Workflow Training',
      description: 'Nursing procedures and patient care workflow training',
      overview: 'Learn nursing-specific workflows, patient care procedures, and clinical support tasks.',
      modules: [
        {
          title: 'Patient Care Procedures',
          duration: '30 mins',
          lessons: ['Vital Signs', 'Medication Administration', 'Patient Assessment', 'Care Planning'],
          description: 'Essential nursing care procedures and documentation',
          order: 1
        },
        {
          title: 'Inventory Management',
          duration: '25 mins',
          lessons: ['Stock Monitoring', 'Supply Ordering', 'Expiry Tracking', 'Usage Documentation'],
          description: 'Managing medical supplies and inventory',
          order: 2
        },
        {
          title: 'Clinical Support',
          duration: '20 mins',
          lessons: ['Lab Sample Collection', 'Test Preparation', 'Equipment Maintenance', 'Quality Control'],
          description: 'Supporting clinical operations and procedures',
          order: 3
        }
      ],
      is_active: true
    },
    {
      role: 'receptionist',
      name: 'Front Desk Operations Training',
      description: 'Reception and front desk operations training',
      overview: 'Master front desk operations, patient communication, and administrative workflows.',
      modules: [
        {
          title: 'Patient Reception',
          duration: '25 mins',
          lessons: ['Patient Check-in', 'Registration Process', 'Insurance Verification', 'Documentation'],
          description: 'Front desk patient reception and registration',
          order: 1
        },
        {
          title: 'Appointment Management',
          duration: '20 mins',
          lessons: ['Scheduling Appointments', 'Calendar Coordination', 'Reminder Systems', 'Cancellations'],
          description: 'Managing patient appointments and schedules',
          order: 2
        },
        {
          title: 'Communication Skills',
          duration: '30 mins',
          lessons: ['Phone Etiquette', 'Patient Communication', 'Conflict Resolution', 'Professional Demeanor'],
          description: 'Professional communication and customer service',
          order: 3
        }
      ],
      is_active: true
    },
    {
      role: 'accountant',
      name: 'Financial Management Training',
      description: 'Financial operations and accounting workflow training',
      overview: 'Learn financial management, billing procedures, and accounting workflows for healthcare.',
      modules: [
        {
          title: 'Billing and Invoicing',
          duration: '30 mins',
          lessons: ['Invoice Creation', 'Payment Processing', 'Insurance Claims', 'Billing Codes'],
          description: 'Healthcare billing and invoicing procedures',
          order: 1
        },
        {
          title: 'Financial Reporting',
          duration: '25 mins',
          lessons: ['Revenue Reports', 'Expense Tracking', 'Profit Analysis', 'Tax Compliance'],
          description: 'Financial reporting and analysis',
          order: 2
        },
        {
          title: 'Payroll Management',
          duration: '20 mins',
          lessons: ['Salary Processing', 'Deductions', 'Tax Calculations', 'Payroll Reports'],
          description: 'Employee payroll and compensation management',
          order: 3
        }
      ],
      is_active: true
    }
  ];
  
  await Training.insertMany(trainingData);
  console.log(`  Created ${trainingData.length} training programs`);
}

async function seedTrainingProgress(): Promise<void> {
  console.log('Seeding training progress...');
  
  // Clear existing progress
  await TrainingProgress.deleteMany({});
  
  const users = await User.find().limit(20);
  const trainings = await Training.find();
  
  if (users.length === 0 || trainings.length === 0) {
    console.log('  No users or trainings found for progress tracking');
    return;
  }
  
  const progressData: any[] = [];
  
  for (const user of users) {
    // Find training for user's role
    const roleTraining = trainings.find(t => t.role === user.role);
    if (!roleTraining) continue;
    
    const overallProgress = faker.number.int({ min: 0, max: 100 });
    const isCompleted = overallProgress === 100;
    
    const modulesProgress = roleTraining.modules.map((module, index) => ({
      module_id: `module-${index + 1}`,
      module_title: module.title,
      completed: faker.datatype.boolean({ probability: overallProgress / 100 }),
      completed_at: faker.helpers.maybe(() => faker.date.recent({ days: 30 }), { probability: overallProgress / 100 }),
      lessons_completed: faker.helpers.arrayElements(module.lessons, { 
        min: 0, 
        max: Math.floor(module.lessons.length * (overallProgress / 100)) 
      }),
      progress_percentage: faker.number.int({ min: 0, max: Math.min(100, overallProgress + 20) })
    }));
    
    progressData.push({
      user_id: user._id,
      training_id: roleTraining._id,
      role: user.role,
      overall_progress: overallProgress,
      modules_progress: modulesProgress,
      started_at: faker.date.recent({ days: 60 }),
      last_accessed: faker.date.recent({ days: 7 }),
      completed_at: isCompleted ? faker.date.recent({ days: 14 }) : undefined,
      is_completed: isCompleted,
      certificate_issued: isCompleted && faker.datatype.boolean({ probability: 0.8 }),
      clinic_id: user.clinic_id
    });
  }
  
  await TrainingProgress.insertMany(progressData);
  console.log(`  Created ${progressData.length} training progress records`);
}
