import { Router } from 'express';
import { body } from 'express-validator';
import { SampleTypeController } from '../controllers';
import { authenticate, requireMedicalStaff } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Validation middleware
const sampleTypeValidation = [
  body('name').notEmpty().withMessage('Sample type name is required'),
  body('code').notEmpty().withMessage('Sample type code is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('category').isIn(['blood', 'urine', 'body_fluid', 'tissue', 'swab', 'other']).withMessage('Invalid sample category'),
  body('collectionMethod').notEmpty().withMessage('Collection method is required'),
  body('container').notEmpty().withMessage('Container information is required'),
  body('storageTemp').notEmpty().withMessage('Storage temperature is required'),
  body('storageTime').notEmpty().withMessage('Storage time is required'),
  body('volume').notEmpty().withMessage('Volume requirement is required'),
  body('preservative').optional().isLength({ max: 100 }).withMessage('Preservative cannot exceed 100 characters'),
  body('specialInstructions').optional().isLength({ max: 1000 }).withMessage('Special instructions cannot exceed 1000 characters'),
  body('commonTests').optional().isArray().withMessage('Common tests must be an array')
];

// Routes - All sample type operations require authentication and clinic context
router.post('/', authenticate, clinicContext, sampleTypeValidation, SampleTypeController.createSampleType);
router.get('/', authenticate, clinicContext, SampleTypeController.getAllSampleTypes);
router.get('/stats', authenticate, clinicContext, SampleTypeController.getSampleTypeStats);
router.get('/:id', authenticate, clinicContext, SampleTypeController.getSampleTypeById);
router.put('/:id', authenticate, clinicContext, sampleTypeValidation, SampleTypeController.updateSampleType);
router.patch('/:id/toggle', authenticate, clinicContext, SampleTypeController.toggleStatus);
router.delete('/:id', authenticate, clinicContext, ...requireMedicalStaff, SampleTypeController.deleteSampleType);

export default router; 