import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { Odontogram, IOdontogram, IToothCondition, Patient, User } from '../models';

/**
 * Comprehensive odontogram seeder with realistic dental data
 */
export async function seedOdontograms(clinicId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId): Promise<void> {
  console.log(`  Seeding odontograms for clinic: ${clinicId}`);
  
  try {
    // Get existing patients and doctors for this clinic
    const patients = await Patient.find({ tenant_id: tenantId, clinic_id: clinicId }).limit(10);
    const doctors = await User.find({ 
      role: 'doctor',
      tenant_id: tenantId,
      clinic_id: clinicId 
    }).limit(5);
    
    if (patients.length === 0) {
      console.log('    No patients found for odontograms');
      return;
    }
    
    if (doctors.length === 0) {
      console.log('    No doctors found for odontograms');
      return;
    }
    
    const odontograms: any[] = [];
    
    // Create 10 odontogram records
    for (let i = 0; i < 10; i++) {
      const patient = faker.helpers.arrayElement(patients);
      const doctor = faker.helpers.arrayElement(doctors);
      
      // Determine patient type based on age
      const patientAge = Math.floor((new Date().getTime() - patient.date_of_birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const patientType = patientAge < 18 ? 'child' : 'adult';
      
      // Create realistic tooth conditions
      const teethConditions = generateTeethConditions(patientType);
      
      // Generate version (some patients might have multiple versions)
      const version = faker.helpers.arrayElement([1, 1, 1, 1, 2, 2, 3]); // Most have version 1
      
      // Create odontogram
      const odontogram = {
        tenant_id: tenantId,
        clinic_id: clinicId,
        patient_id: patient._id,
        doctor_id: doctor._id,
        examination_date: faker.date.recent({ days: 180 }), // Within last 6 months
        numbering_system: faker.helpers.arrayElement(['universal', 'palmer', 'fdi']),
        patient_type: patientType,
        teeth_conditions: teethConditions,
        general_notes: faker.lorem.paragraph(),
        periodontal_assessment: generatePeriodontalAssessment(),
        version: version,
        is_active: version === 1 ? true : faker.datatype.boolean({ probability: 0.3 }) // Newer versions more likely to be active
      };
      
      odontograms.push(odontogram);
    }
    
    // Insert odontograms
    const createdOdontograms = await Odontogram.insertMany(odontograms);
    
    // Calculate treatment summaries for each odontogram
    for (const odontogram of createdOdontograms) {
      await odontogram.calculateTreatmentSummary();
      await odontogram.save();
    }
    
    console.log(`    Created ${createdOdontograms.length} odontograms`);
    
  } catch (error) {
    console.error(`    Error seeding odontograms for clinic ${clinicId}:`, error);
    throw error;
  }
}

/**
 * Generate realistic teeth conditions based on patient type
 */
function generateTeethConditions(patientType: 'adult' | 'child'): IToothCondition[] {
  const conditions: IToothCondition[] = [];
  
  // Determine tooth range based on patient type
  const toothRange = patientType === 'adult' 
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
    : [55, 54, 53, 52, 51, 61, 62, 63, 64, 65, 75, 74, 73, 72, 71, 81, 82, 83, 84, 85]; // Primary teeth
  
  // Generate conditions for a subset of teeth (not all teeth need documentation)
  const teethToDocument = faker.helpers.arrayElements(toothRange, { 
    min: Math.min(8, toothRange.length), 
    max: Math.min(16, toothRange.length) 
  });
  
  for (const toothNumber of teethToDocument) {
    const condition = generateToothCondition(toothNumber, patientType);
    conditions.push(condition);
  }
  
  return conditions;
}

/**
 * Generate a realistic tooth condition
 */
function generateToothCondition(toothNumber: number, patientType: 'adult' | 'child'): IToothCondition {
  const surfaces = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'incisal'];
  const dentalConditions = [
    'healthy', 'caries', 'filling', 'crown', 'bridge', 'implant', 
    'extraction', 'root_canal', 'missing', 'fractured', 'wear', 
    'restoration_needed', 'sealant', 'veneer', 'temporary_filling', 'periapical_lesion'
  ];
  
  // Adult teeth more likely to have complex conditions
  const conditionProbabilities = patientType === 'adult' ? {
    healthy: 0.4,
    caries: 0.2,
    filling: 0.15,
    crown: 0.08,
    missing: 0.05,
    restoration_needed: 0.1
  } : {
    healthy: 0.6,
    caries: 0.25,
    sealant: 0.1,
    filling: 0.05
  };
  
  const overallCondition = faker.helpers.weightedArrayElement([
    { weight: 40, value: 'healthy' },
    { weight: 20, value: 'caries' },
    { weight: 15, value: 'filling' },
    { weight: 8, value: 'crown' },
    { weight: 5, value: 'missing' },
    { weight: 7, value: 'restoration_needed' },
    { weight: 3, value: 'root_canal' },
    { weight: 2, value: 'fractured' }
  ]);
  
  // Generate surface conditions
  const numberOfSurfaces = faker.number.int({ min: 1, max: 4 });
  const selectedSurfaces = faker.helpers.arrayElements(surfaces, numberOfSurfaces);
  
  const surfaceConditions = selectedSurfaces.map(surface => ({
    surface: surface as any,
    condition: overallCondition === 'healthy' 
      ? 'healthy' 
      : faker.helpers.arrayElement(dentalConditions) as any,
    notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    color_code: getConditionColor(overallCondition),
    date_diagnosed: faker.date.recent({ days: 90 }),
    severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe'])
  }));
  
  // Generate treatment plan if needed
  const needsTreatment = !['healthy', 'filling', 'crown', 'missing'].includes(overallCondition);
  const treatmentPlan = needsTreatment ? generateTreatmentPlan(overallCondition) : undefined;
  
  const condition: IToothCondition = {
    tooth_number: toothNumber,
    tooth_name: getToothName(toothNumber),
    surfaces: surfaceConditions,
    overall_condition: overallCondition as any,
    mobility: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 3 }), { probability: 0.2 }),
    periodontal_pocket_depth: faker.helpers.maybe(() => ({
      mesial: faker.number.float({ min: 1, max: 8, fractionDigits: 1 }),
      distal: faker.number.float({ min: 1, max: 8, fractionDigits: 1 }),
      buccal: faker.number.float({ min: 1, max: 8, fractionDigits: 1 }),
      lingual: faker.number.float({ min: 1, max: 8, fractionDigits: 1 })
    }), { probability: 0.3 }),
    treatment_plan: treatmentPlan,
    notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    created_at: new Date(),
    updated_at: new Date()
  };
  
  return condition;
}

/**
 * Generate treatment plan for a tooth condition
 */
function generateTreatmentPlan(condition: string) {
  const treatmentMap: { [key: string]: string[] } = {
    caries: ['Composite filling', 'Amalgam filling', 'Crown restoration'],
    restoration_needed: ['Crown', 'Onlay', 'Composite restoration'],
    root_canal: ['Root canal therapy', 'Post and core', 'Crown restoration'],
    fractured: ['Crown restoration', 'Extraction', 'Root canal therapy'],
    periapical_lesion: ['Root canal therapy', 'Apicoectomy', 'Extraction'],
    wear: ['Crown restoration', 'Composite bonding', 'Veneer']
  };
  
  const possibleTreatments = treatmentMap[condition] || ['Examination', 'Consultation'];
  const plannedTreatment = faker.helpers.arrayElement(possibleTreatments);
  
  const treatmentCosts: { [key: string]: [number, number] } = {
    'Composite filling': [80, 150],
    'Amalgam filling': [60, 120],
    'Crown restoration': [800, 1500],
    'Root canal therapy': [600, 1200],
    'Extraction': [100, 300],
    'Veneer': [800, 1800],
    'Onlay': [400, 800],
    'Post and core': [200, 400],
    'Apicoectomy': [800, 1500],
    'Composite bonding': [150, 400],
    'Examination': [50, 100],
    'Consultation': [75, 150]
  };
  
  const costRange = treatmentCosts[plannedTreatment] || [50, 200];
  const estimatedCost = faker.number.float({ 
    min: costRange[0], 
    max: costRange[1], 
    fractionDigits: 2 
  });
  
  return {
    planned_treatment: plannedTreatment,
    priority: faker.helpers.weightedArrayElement([
      { weight: 10, value: 'urgent' },
      { weight: 25, value: 'high' },
      { weight: 45, value: 'medium' },
      { weight: 20, value: 'low' }
    ]) as any,
    estimated_cost: estimatedCost,
    estimated_duration: getTreatmentDuration(plannedTreatment),
    status: faker.helpers.weightedArrayElement([
      { weight: 50, value: 'planned' },
      { weight: 25, value: 'in_progress' },
      { weight: 20, value: 'completed' },
      { weight: 5, value: 'cancelled' }
    ]) as any,
    planned_date: faker.helpers.maybe(() => faker.date.soon({ days: 60 }), { probability: 0.7 }),
    completed_date: faker.helpers.maybe(() => faker.date.recent({ days: 30 }), { probability: 0.2 }),
    notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 })
  };
}

/**
 * Generate periodontal assessment
 */
function generatePeriodontalAssessment() {
  return {
    bleeding_on_probing: faker.datatype.boolean({ probability: 0.3 }),
    plaque_index: faker.helpers.maybe(() => faker.number.float({ min: 0, max: 3, fractionDigits: 1 }), { probability: 0.8 }),
    gingival_index: faker.helpers.maybe(() => faker.number.float({ min: 0, max: 3, fractionDigits: 1 }), { probability: 0.8 }),
    calculus_present: faker.datatype.boolean({ probability: 0.4 }),
    general_notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 })
  };
}

/**
 * Get color code for dental condition
 */
function getConditionColor(condition: string): string {
  const colorMap: { [key: string]: string } = {
    healthy: '#22C55E',      // Green
    caries: '#EF4444',       // Red
    filling: '#3B82F6',      // Blue
    crown: '#F59E0B',        // Amber
    missing: '#6B7280',      // Gray
    restoration_needed: '#F97316', // Orange
    root_canal: '#8B5CF6',   // Purple
    fractured: '#DC2626',    // Dark red
    sealant: '#10B981',      // Emerald
    veneer: '#06B6D4',       // Cyan
    bridge: '#F59E0B',       // Amber
    implant: '#6366F1'       // Indigo
  };
  
  return colorMap[condition] || '#6B7280';
}

/**
 * Get tooth name based on tooth number
 */
function getToothName(toothNumber: number): string {
  // Universal numbering system mapping
  const toothNames: { [key: number]: string } = {
    // Adult teeth (1-32)
    1: 'Upper Right Third Molar', 2: 'Upper Right Second Molar', 3: 'Upper Right First Molar',
    4: 'Upper Right Second Premolar', 5: 'Upper Right First Premolar', 6: 'Upper Right Canine',
    7: 'Upper Right Lateral Incisor', 8: 'Upper Right Central Incisor',
    9: 'Upper Left Central Incisor', 10: 'Upper Left Lateral Incisor', 11: 'Upper Left Canine',
    12: 'Upper Left First Premolar', 13: 'Upper Left Second Premolar', 14: 'Upper Left First Molar',
    15: 'Upper Left Second Molar', 16: 'Upper Left Third Molar',
    17: 'Lower Left Third Molar', 18: 'Lower Left Second Molar', 19: 'Lower Left First Molar',
    20: 'Lower Left Second Premolar', 21: 'Lower Left First Premolar', 22: 'Lower Left Canine',
    23: 'Lower Left Lateral Incisor', 24: 'Lower Left Central Incisor',
    25: 'Lower Right Central Incisor', 26: 'Lower Right Lateral Incisor', 27: 'Lower Right Canine',
    28: 'Lower Right First Premolar', 29: 'Lower Right Second Premolar', 30: 'Lower Right First Molar',
    31: 'Lower Right Second Molar', 32: 'Lower Right Third Molar',
    
    // Primary teeth (55-85)
    55: 'Upper Right Second Primary Molar', 54: 'Upper Right First Primary Molar',
    53: 'Upper Right Primary Canine', 52: 'Upper Right Primary Lateral Incisor',
    51: 'Upper Right Primary Central Incisor', 61: 'Upper Left Primary Central Incisor',
    62: 'Upper Left Primary Lateral Incisor', 63: 'Upper Left Primary Canine',
    64: 'Upper Left First Primary Molar', 65: 'Upper Left Second Primary Molar',
    75: 'Lower Left Second Primary Molar', 74: 'Lower Left First Primary Molar',
    73: 'Lower Left Primary Canine', 72: 'Lower Left Primary Lateral Incisor',
    71: 'Lower Left Primary Central Incisor', 81: 'Lower Right Primary Central Incisor',
    82: 'Lower Right Primary Lateral Incisor', 83: 'Lower Right Primary Canine',
    84: 'Lower Right First Primary Molar', 85: 'Lower Right Second Primary Molar'
  };
  
  return toothNames[toothNumber] || `Tooth ${toothNumber}`;
}

/**
 * Get treatment duration based on treatment type
 */
function getTreatmentDuration(treatment: string): string {
  const durationMap: { [key: string]: string[] } = {
    'Composite filling': ['30 minutes', '45 minutes', '60 minutes'],
    'Amalgam filling': ['30 minutes', '45 minutes'],
    'Crown restoration': ['90 minutes', '120 minutes'],
    'Root canal therapy': ['60 minutes', '90 minutes', '120 minutes'],
    'Extraction': ['15 minutes', '30 minutes', '45 minutes'],
    'Veneer': ['60 minutes', '90 minutes'],
    'Onlay': ['60 minutes', '90 minutes'],
    'Post and core': ['45 minutes', '60 minutes'],
    'Apicoectomy': ['90 minutes', '120 minutes'],
    'Composite bonding': ['30 minutes', '45 minutes'],
    'Examination': ['15 minutes', '30 minutes'],
    'Consultation': ['15 minutes', '30 minutes']
  };
  
  const durations = durationMap[treatment] || ['30 minutes'];
  return faker.helpers.arrayElement(durations);
}

export default seedOdontograms;
