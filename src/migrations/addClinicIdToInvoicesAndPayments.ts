import mongoose from 'mongoose';
import { Invoice, Payment, Patient } from '../models';

/**
 * Migration to add clinic_id to existing Invoice and Payment documents
 * This migration will:
 * 1. Add clinic_id field to Invoice documents by looking up the patient's clinic
 * 2. Add clinic_id field to Payment documents by looking up the invoice's clinic
 * 3. Handle orphaned records appropriately
 */

export async function addClinicIdToInvoicesAndPayments() {
  console.log('Starting migration: Adding clinic_id to Invoice and Payment collections...');
  
  try {
    // Step 1: Update Invoice documents
    console.log('Updating Invoice documents...');
    
    const invoicesWithoutClinicId = await Invoice.find({ clinic_id: { $exists: false } });
    console.log(`Found ${invoicesWithoutClinicId.length} invoices without clinic_id`);
    
    let invoiceUpdateCount = 0;
    let invoiceErrorCount = 0;
    
    for (const invoice of invoicesWithoutClinicId) {
      try {
        // Find the patient to get clinic_id
        const patient = await Patient.findById(invoice.patient_id);
        
        if (patient && patient.clinic_id) {
          await Invoice.updateOne(
            { _id: invoice._id },
            { $set: { clinic_id: patient.clinic_id } }
          );
          invoiceUpdateCount++;
        } else {
          console.warn(`Warning: Invoice ${invoice._id} has no associated patient or patient has no clinic_id`);
          invoiceErrorCount++;
        }
      } catch (error) {
        console.error(`Error updating invoice ${invoice._id}:`, error);
        invoiceErrorCount++;
      }
    }
    
    console.log(`Invoice migration completed: ${invoiceUpdateCount} updated, ${invoiceErrorCount} errors`);
    
    // Step 2: Update Payment documents
    console.log('Updating Payment documents...');
    
    const paymentsWithoutClinicId = await Payment.find({ clinic_id: { $exists: false } });
    console.log(`Found ${paymentsWithoutClinicId.length} payments without clinic_id`);
    
    let paymentUpdateCount = 0;
    let paymentErrorCount = 0;
    
    for (const payment of paymentsWithoutClinicId) {
      try {
        // Find the invoice to get clinic_id
        const invoice = await Invoice.findById(payment.invoice_id);
        
        if (invoice && invoice.clinic_id) {
          await Payment.updateOne(
            { _id: payment._id },
            { $set: { clinic_id: invoice.clinic_id } }
          );
          paymentUpdateCount++;
        } else {
          // Fallback: try to get clinic_id from patient
          const patient = await Patient.findById(payment.patient_id);
          
          if (patient && patient.clinic_id) {
            await Payment.updateOne(
              { _id: payment._id },
              { $set: { clinic_id: patient.clinic_id } }
            );
            paymentUpdateCount++;
          } else {
            console.warn(`Warning: Payment ${payment._id} has no associated invoice/patient or they have no clinic_id`);
            paymentErrorCount++;
          }
        }
      } catch (error) {
        console.error(`Error updating payment ${payment._id}:`, error);
        paymentErrorCount++;
      }
    }
    
    console.log(`Payment migration completed: ${paymentUpdateCount} updated, ${paymentErrorCount} errors`);
    
    // Step 3: Verify migration results
    console.log('Verifying migration results...');
    
    const remainingInvoicesWithoutClinic = await Invoice.countDocuments({ clinic_id: { $exists: false } });
    const remainingPaymentsWithoutClinic = await Payment.countDocuments({ clinic_id: { $exists: false } });
    
    console.log(`Remaining invoices without clinic_id: ${remainingInvoicesWithoutClinic}`);
    console.log(`Remaining payments without clinic_id: ${remainingPaymentsWithoutClinic}`);
    
    console.log('Migration completed successfully!');
    
    return {
      invoices: {
        processed: invoicesWithoutClinicId.length,
        updated: invoiceUpdateCount,
        errors: invoiceErrorCount,
        remaining: remainingInvoicesWithoutClinic
      },
      payments: {
        processed: paymentsWithoutClinicId.length,
        updated: paymentUpdateCount,
        errors: paymentErrorCount,
        remaining: remainingPaymentsWithoutClinic
      }
    };
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Helper function to run migration standalone
export async function runMigration() {
  try {
    // Connect to database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/clinicpro');
    }
    
    const result = await addClinicIdToInvoicesAndPayments();
    
    console.log('Migration Summary:', JSON.stringify(result, null, 2));
    
    // Close connection if we opened it
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    return result;
  } catch (error) {
    console.error('Migration execution failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration().then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  });
}
