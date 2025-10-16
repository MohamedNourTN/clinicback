import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// GET /api/settings - Get clinic settings
router.get('/', authenticate, clinicContext, getSettings);

// PUT /api/settings - Update clinic settings  
router.put('/', authenticate, clinicContext, updateSettings);

export default router; 