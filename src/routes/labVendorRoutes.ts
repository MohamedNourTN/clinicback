import { Router } from 'express';
import { body } from 'express-validator';
import { LabVendorController } from '../controllers';
import { authenticate } from '../middleware/auth';
import { clinicContext } from '../middleware/clinicContext';

const router = Router();

// Apply authentication middleware first, then clinic context to all routes
router.use(authenticate);
router.use(clinicContext);

// Validation middleware
const labVendorValidation = [
  body('name')
    .notEmpty()
    .withMessage('Lab vendor name is required')
    .isLength({ max: 200 })
    .withMessage('Lab vendor name cannot exceed 200 characters'),
  body('code')
    .notEmpty()
    .withMessage('Lab vendor code is required')
    .isLength({ max: 10 })
    .withMessage('Lab vendor code cannot exceed 10 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Lab vendor code must contain only uppercase letters and numbers'),
  body('type')
    .isIn(['diagnostic_lab', 'pathology_lab', 'imaging_center', 'reference_lab', 'specialty_lab'])
    .withMessage('Invalid lab vendor type'),
  body('contactPerson')
    .notEmpty()
    .withMessage('Contact person is required')
    .isLength({ max: 100 })
    .withMessage('Contact person name cannot exceed 100 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  body('address')
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: 300 })
    .withMessage('Address cannot exceed 300 characters'),
  body('city')
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  body('state')
    .notEmpty()
    .withMessage('State is required')
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters'),
  body('zipCode')
    .notEmpty()
    .withMessage('Zip code is required')
    .isLength({ max: 20 })
    .withMessage('Zip code cannot exceed 20 characters'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Please provide a valid website URL'),
  body('license')
    .notEmpty()
    .withMessage('License number is required')
    .isLength({ max: 50 })
    .withMessage('License number cannot exceed 50 characters'),
  body('accreditation')
    .isArray()
    .withMessage('Accreditation must be an array'),
  body('accreditation.*')
    .isLength({ max: 100 })
    .withMessage('Accreditation name cannot exceed 100 characters'),
  body('specialties')
    .isArray()
    .withMessage('Specialties must be an array'),
  body('specialties.*')
    .isLength({ max: 100 })
    .withMessage('Specialty name cannot exceed 100 characters'),
  body('rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Rating must be between 0 and 5'),
  body('totalTests')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total tests must be a non-negative integer'),
  body('averageTurnaround')
    .notEmpty()
    .withMessage('Average turnaround time is required')
    .isLength({ max: 50 })
    .withMessage('Average turnaround cannot exceed 50 characters'),
  body('pricing')
    .isIn(['budget', 'moderate', 'premium'])
    .withMessage('Pricing must be budget, moderate, or premium'),
  body('contractStart')
    .isISO8601()
    .withMessage('Contract start date must be a valid date'),
  body('contractEnd')
    .isISO8601()
    .withMessage('Contract end date must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.contractStart)) {
        throw new Error('Contract end date must be after start date');
      }
      return true;
    }),
  body('lastTestDate')
    .optional()
    .isISO8601()
    .withMessage('Last test date must be a valid date'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Status must be active, inactive, pending, or suspended')
];

// Status update validation
const statusValidation = [
  body('status')
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Status must be active, inactive, pending, or suspended')
];

// Test count update validation
const testCountValidation = [
  body('increment')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Increment must be a positive integer')
];

// Routes
router.post('/', labVendorValidation, LabVendorController.createLabVendor);
router.get('/', LabVendorController.getAllLabVendors);
router.get('/stats', LabVendorController.getLabVendorStats);
router.get('/contract-expiring', LabVendorController.getContractExpiringVendors);
router.get('/:id', LabVendorController.getLabVendorById);
router.get('/:id/test-history', LabVendorController.getTestHistory);
router.get('/:id/contract', LabVendorController.getContractDetails);
router.get('/:id/billing', LabVendorController.getBillingPayments);
router.put('/:id', labVendorValidation, LabVendorController.updateLabVendor);
router.patch('/:id/status', statusValidation, LabVendorController.updateLabVendorStatus);
router.patch('/:id/test-count', testCountValidation, LabVendorController.updateTestCount);
router.delete('/:id', LabVendorController.deleteLabVendor);

export default router; 