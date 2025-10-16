import { Router } from 'express';
import { AppointmentController } from '../controllers';

const router = Router();

// Public routes - No authentication required
// Patient appointments access via public link
router.get('/appointments/:patientId', AppointmentController.getPublicPatientAppointments);

export default router; 