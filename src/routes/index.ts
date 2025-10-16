import { Router } from 'express';
import authRoutes from './authRoutes';
import superAdminRoutes from './auth/superAdminRoutes';
import superAdminTenantRoutes from './super-admin/tenantRoutes';
import superAdminUserRoutes from './super-admin/superAdminUserRoutes';
import stripeRoutes from './stripeRoutes';
import publicTenantRoutes from './publicv2/publicTenantRoutes';
import userRoutes from './userRoutes';
import clinicRoutes from './clinicRoutes';
import userClinicRoutes from './userClinicRoutes';
import patientRoutes from './patientRoutes';
import appointmentRoutes from './appointmentRoutes';
import medicalRecordRoutes from './medicalRecordRoutes';
import invoiceRoutes from './invoiceRoutes';
import paymentRoutes from './paymentRoutes';
import payrollRoutes from './payrollRoutes';
import inventoryRoutes from './inventoryRoutes';
import leadRoutes from './leadRoutes';
import prescriptionRoutes from './prescriptionRoutes';
import serviceRoutes from './serviceRoutes';
import testCategoryRoutes from './testCategoryRoutes';
import sampleTypeRoutes from './sampleTypeRoutes';
import testMethodologyRoutes from './testMethodologyRoutes';
import turnaroundTimeRoutes from './turnaroundTimeRoutes';
import testRoutes from './testRoutes';
import testReportRoutes from './testReportRoutes';
import departmentRoutes from './departmentRoutes';
import labVendorRoutes from './labVendorRoutes';
import dashboardRoutes from './dashboardRoutes';
import analyticsRoutes from './analyticsRoutes';
import settingsRoutes from './settingsRoutes';
import trainingRoutes from './trainingRoutes';
import receptionistRoutes from './receptionistRoutes';
import xrayAnalysisRoutes from './xrayAnalysisRoutes';
import aiTestAnalysisRoutes from './aiTestAnalysisRoutes';
import aiTestComparisonRoutes from './aiTestComparisonRoutes';
import odontogramRoutes from './odontogramRoutes';
import expenseRoutes from './expenseRoutes';
import performanceRoutes from './performanceRoutes';
import permissionRoutes from './permissionRoutes';
import roleRoutes from './roleRoutes';
import { getConnectionState, isConnectionHealthy } from '../config/database';
import autoPermissionGuard from '../middleware/autoPermission';
import { requireActiveSubscription } from '../middleware/subscriptionAuth';

const router = Router();

// ===== PUBLIC ROUTES (no auth required) =====
// Import payment controller for public endpoint
import { PaymentController } from '../controllers/paymentController';

// Verify payment by session ID (for Stripe success page - must be public)
router.get('/payments/verify-session/:session_id', (req: any, res: any) => {
  PaymentController.verifyPaymentBySessionId(req, res);
});

// Public tenant routes (for tenant selection and validation)
router.use('/public/tenants', publicTenantRoutes);

// Mount routes
// Mount Super Admin routes first (before global permission guard)
router.use('/super-admin/auth', superAdminRoutes);
router.use('/super-admin/tenants', superAdminTenantRoutes);
router.use('/super-admin/users', superAdminUserRoutes);
router.use('/super-admin/stripe', stripeRoutes);

// Global automatic permission guard for regular API routes
router.use(autoPermissionGuard as any);

// Public and authentication routes (no subscription validation needed)
router.use('/auth', authRoutes);
router.use('/public/tenants', publicTenantRoutes);

// Global subscription validation for all other authenticated routes
router.use(requireActiveSubscription as any);

router.use('/users', userRoutes);
router.use('/clinics', clinicRoutes);
router.use('/user', userClinicRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/medical-records', medicalRecordRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/payroll', payrollRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/leads', leadRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/services', serviceRoutes);
router.use('/test-categories', testCategoryRoutes);
router.use('/sample-types', sampleTypeRoutes);
router.use('/test-methodologies', testMethodologyRoutes);
router.use('/turnaround-times', turnaroundTimeRoutes);
router.use('/tests', testRoutes);
router.use('/test-reports', testReportRoutes);
router.use('/departments', departmentRoutes);
router.use('/lab-vendors', labVendorRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);
router.use('/training', trainingRoutes);
router.use('/receptionist', receptionistRoutes);
router.use('/xray-analysis', xrayAnalysisRoutes);
router.use('/ai-test-analysis', aiTestAnalysisRoutes);
router.use('/ai-test-comparison', aiTestComparisonRoutes);
router.use('/odontograms', odontogramRoutes);
router.use('/expenses', expenseRoutes);
router.use('/performance', performanceRoutes);
router.use('/permissions', permissionRoutes);
router.use('/roles', roleRoutes);

// Basic health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Clinic Management API is running',
    timestamp: new Date().toISOString()
  });
});

// Database health check route
router.get('/health/database', async (req, res) => {
  try {
    const connectionState = getConnectionState();
    const isHealthy = await isConnectionHealthy();
    
    const healthStatus = {
      success: true,
      message: isHealthy ? 'Database connection is healthy' : 'Database connection issues detected',
      timestamp: new Date().toISOString(),
      database: {
        healthy: isHealthy,
        connected: connectionState.isConnected,
        connecting: connectionState.isConnecting,
        host: connectionState.host,
        database: connectionState.database,
        readyState: connectionState.mongooseReadyState,
        readyStateLabel: connectionState.mongooseReadyStateLabel,
        collections: connectionState.collections,
        connectionAttempts: connectionState.connectionAttempts,
        lastConnectionTime: connectionState.lastConnectionTime,
        lastError: connectionState.lastError ? {
          message: connectionState.lastError.message,
          timestamp: connectionState.lastConnectionTime
        } : null
      },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    };

    // Set appropriate HTTP status based on health
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Connection state monitoring endpoint (for debugging)
router.get('/health/connection-state', async (req, res) => {
  try {
    const connectionState = getConnectionState();
    res.json({
      success: true,
      message: 'Connection state retrieved successfully',
      timestamp: new Date().toISOString(),
      connectionState
    });
  } catch (error) {
    console.error('Connection state error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve connection state',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 