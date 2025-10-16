import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Clinic Management System API',
      version: '1.0.0',
      description: 'A comprehensive REST API for clinic management including patient management, appointments, medical records, billing, and inventory.',
      contact: {
        name: 'API Support',
        email: ''
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        // Error response schema
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            errors: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['Validation error details']
            }
          }
        },
        
        // Success response schema
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation successful'
            },
            data: {
              type: 'object'
            }
          }
        },

        // Pagination schema
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1
            },
            limit: {
              type: 'integer',
              example: 10
            },
            total: {
              type: 'integer',
              example: 100
            },
            pages: {
              type: 'integer',
              example: 10
            }
          }
        },

        // User schemas - Updated to match current User model
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            first_name: {
              type: 'string',
              example: 'John'
            },
            last_name: {
              type: 'string',
              example: 'Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com'
            },
            role: {
              type: 'string',
              enum: ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'staff'],
              example: 'doctor'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            is_active: {
              type: 'boolean',
              example: true
            },
            base_currency: {
              type: 'string',
              enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED', 'SAR'],
              example: 'USD'
            },
            address: {
              type: 'string',
              example: '123 Medical Center Dr, City, State 12345'
            },
            bio: {
              type: 'string',
              example: 'Experienced cardiologist with 10+ years of practice'
            },
            date_of_birth: {
              type: 'string',
              format: 'date',
              example: '1985-03-15'
            },
            specialization: {
              type: 'string',
              example: 'Cardiology'
            },
            license_number: {
              type: 'string',
              example: 'MD123456789'
            },
            department: {
              type: 'string',
              example: 'Cardiology'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['first_name', 'last_name', 'email', 'role', 'phone', 'base_currency']
        },

        UserRegistration: {
          type: 'object',
          properties: {
            first_name: {
              type: 'string',
              example: 'John'
            },
            last_name: {
              type: 'string',
              example: 'Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com'
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'securePassword123'
            },
            role: {
              type: 'string',
              enum: ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'staff'],
              example: 'doctor'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            base_currency: {
              type: 'string',
              enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED', 'SAR'],
              example: 'USD'
            }
          },
          required: ['first_name', 'last_name', 'email', 'password', 'role', 'phone', 'base_currency']
        },

        UserLogin: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com'
            },
            password: {
              type: 'string',
              example: 'securePassword123'
            }
          },
          required: ['email', 'password']
        },

        // Patient schemas - Updated to match current Patient model
        Patient: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            first_name: {
              type: 'string',
              example: 'Jane'
            },
            last_name: {
              type: 'string',
              example: 'Smith'
            },
            date_of_birth: {
              type: 'string',
              format: 'date',
              example: '1990-05-15'
            },
            gender: {
              type: 'string',
              enum: ['male', 'female', 'other'],
              example: 'female'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'jane.smith@example.com'
            },
            address: {
              type: 'string',
              example: '123 Main St, City, State 12345'
            },
            emergency_contact: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  example: 'John Smith'
                },
                relationship: {
                  type: 'string',
                  example: 'Spouse'
                },
                phone: {
                  type: 'string',
                  example: '+1234567891'
                },
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'john.smith@example.com'
                }
              }
            },
            insurance_info: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  example: 'Blue Cross Blue Shield'
                },
                policy_number: {
                  type: 'string',
                  example: 'BC123456789'
                },
                group_number: {
                  type: 'string',
                  example: 'GRP001'
                },
                expiry_date: {
                  type: 'string',
                  format: 'date',
                  example: '2025-12-31'
                }
              }
            },
            last_visit: {
              type: 'string',
              format: 'date-time',
              description: 'Date of last completed appointment',
              example: '2024-01-15T10:30:00.000Z'
            },
            age: {
              type: 'integer',
              example: 34,
              description: 'Calculated virtual field'
            },
            full_name: {
              type: 'string',
              example: 'Jane Smith',
              description: 'Calculated virtual field'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'email', 'address']
        },

        // Appointment schemas - Updated to match current Appointment model
        Appointment: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            patient_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            doctor_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439013'
            },
            nurse_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439014',
              description: 'Optional assigned nurse'
            },
            appointment_date: {
              type: 'string',
              format: 'date-time',
              example: '2024-06-15T10:00:00Z'
            },
            duration: {
              type: 'integer',
              minimum: 15,
              maximum: 240,
              example: 30
            },
            type: {
              type: 'string',
              enum: ['consultation', 'follow-up', 'check-up', 'vaccination', 'procedure', 'emergency', 'screening', 'therapy', 'other'],
              example: 'consultation'
            },
            reason: {
              type: 'string',
              example: 'Regular checkup'
            },
            status: {
              type: 'string',
              enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
              example: 'scheduled'
            },
            notes: {
              type: 'string',
              example: 'Patient requested morning appointment'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['patient_id', 'doctor_id', 'appointment_date', 'duration', 'type']
        },

        // Inventory schemas - Updated to match current Inventory model
        Inventory: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Disposable Syringes 10ml'
            },
            category: {
              type: 'string',
              enum: ['medications', 'medical-devices', 'consumables', 'equipment', 'laboratory', 'office-supplies', 'other'],
              example: 'medical-devices'
            },
            sku: {
              type: 'string',
              example: 'SYR-10ML-001'
            },
            current_stock: {
              type: 'integer',
              minimum: 0,
              example: 50
            },
            minimum_stock: {
              type: 'integer',
              minimum: 0,
              example: 10
            },
            unit_price: {
              type: 'number',
              minimum: 0,
              example: 2.50
            },
            supplier: {
              type: 'string',
              example: 'Medical Supplies Inc.'
            },
            expiry_date: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '2025-12-31'
            },
            is_low_stock: {
              type: 'boolean',
              example: false,
              description: 'Calculated virtual field'
            },
            is_out_of_stock: {
              type: 'boolean',
              example: false,
              description: 'Calculated virtual field'
            },
            expiry_status: {
              type: 'string',
              enum: ['no-expiry', 'valid', 'expiring-soon', 'expired'],
              example: 'valid',
              description: 'Calculated virtual field'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['name', 'category', 'sku', 'current_stock', 'minimum_stock', 'unit_price', 'supplier']
        },

        // Dashboard specific schemas
        DashboardOverview: {
          type: 'object',
          properties: {
            totalPatients: {
              type: 'integer',
              example: 1500
            },
            todayAppointments: {
              type: 'integer',
              example: 25
            },
            monthlyRevenue: {
              type: 'number',
              example: 125000.00
            },
            lowStockCount: {
              type: 'integer',
              example: 8
            },
            totalDoctors: {
              type: 'integer',
              example: 12
            },
            totalStaff: {
              type: 'integer',
              example: 45
            }
          }
        },

        // Medical Record schemas
        MedicalRecord: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            patient_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            doctor_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439013'
            },
            visit_date: {
              type: 'string',
              format: 'date-time',
              example: '2024-06-15T10:00:00Z'
            },
            chief_complaint: {
              type: 'string',
              example: 'Chest pain'
            },
            diagnosis: {
              type: 'string',
              example: 'Hypertension and anxiety disorder'
            },
            treatment: {
              type: 'string',
              example: 'Prescribed medication and lifestyle changes'
            },
            medications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    example: 'Lisinopril'
                  },
                  dosage: {
                    type: 'string',
                    example: '10mg'
                  },
                  frequency: {
                    type: 'string',
                    example: 'once daily'
                  },
                  duration: {
                    type: 'string',
                    example: '30 days'
                  },
                  notes: {
                    type: 'string',
                    example: 'Take with food'
                  }
                }
              }
            },
            allergies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  allergen: {
                    type: 'string',
                    example: 'Penicillin'
                  },
                  severity: {
                    type: 'string',
                    enum: ['mild', 'moderate', 'severe'],
                    example: 'moderate'
                  },
                  reaction: {
                    type: 'string',
                    example: 'Skin rash and itching'
                  }
                }
              }
            },
            vital_signs: {
              type: 'object',
              properties: {
                temperature: {
                  type: 'number',
                  example: 98.6
                },
                blood_pressure: {
                  type: 'object',
                  properties: {
                    systolic: {
                      type: 'integer',
                      example: 120
                    },
                    diastolic: {
                      type: 'integer',
                      example: 80
                    }
                  }
                },
                heart_rate: {
                  type: 'integer',
                  example: 72
                },
                respiratory_rate: {
                  type: 'integer',
                  example: 16
                },
                oxygen_saturation: {
                  type: 'integer',
                  example: 98
                },
                weight: {
                  type: 'number',
                  example: 70.5
                },
                height: {
                  type: 'number',
                  example: 175.0
                }
              }
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['patient_id', 'doctor_id', 'visit_date', 'chief_complaint', 'diagnosis', 'treatment']
        },

        // Invoice schemas
        Invoice: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            invoice_number: {
              type: 'string',
              example: 'INV-2024-0001'
            },
            patient_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            appointment_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439013'
            },
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    example: 'srv_001'
                  },
                  description: {
                    type: 'string',
                    example: 'Consultation'
                  },
                  quantity: {
                    type: 'integer',
                    example: 1
                  },
                  unit_price: {
                    type: 'number',
                    example: 150.00
                  },
                  total: {
                    type: 'number',
                    example: 150.00
                  },
                  type: {
                    type: 'string',
                    enum: ['service', 'test', 'medication', 'procedure'],
                    example: 'service'
                  }
                }
              }
            },
            subtotal: {
              type: 'number',
              example: 150.00
            },
            tax_amount: {
              type: 'number',
              example: 15.00
            },
            discount: {
              type: 'number',
              example: 0.00
            },
            total_amount: {
              type: 'number',
              example: 165.00
            },
            status: {
              type: 'string',
              enum: ['draft', 'sent', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'],
              example: 'pending'
            },
            issue_date: {
              type: 'string',
              format: 'date',
              example: '2024-06-15'
            },
            due_date: {
              type: 'string',
              format: 'date',
              example: '2024-07-15'
            },
            payment_method: {
              type: 'string',
              example: 'credit_card'
            },
            paid_at: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['patient_id', 'services', 'subtotal', 'tax_amount', 'total_amount', 'issue_date', 'due_date']
        },

        // Prescription schemas
        Prescription: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            patient_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            doctor_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439013'
            },
            appointment_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439014'
            },
            prescription_id: {
              type: 'string',
              example: 'RX-2024-001'
            },
            diagnosis: {
              type: 'string',
              example: 'Hypertension'
            },
            medications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    example: 'Lisinopril'
                  },
                  dosage: {
                    type: 'string',
                    example: '10mg'
                  },
                  frequency: {
                    type: 'string',
                    example: 'once daily'
                  },
                  duration: {
                    type: 'string',
                    example: '30 days'
                  },
                  instructions: {
                    type: 'string',
                    example: 'Take with food in the morning'
                  },
                  quantity: {
                    type: 'integer',
                    example: 30
                  }
                }
              }
            },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'pending', 'cancelled', 'expired'],
              example: 'active'
            },
            notes: {
              type: 'string',
              example: 'Monitor blood pressure weekly'
            },
            follow_up_date: {
              type: 'string',
              format: 'date',
              example: '2024-07-15'
            },
            pharmacy_dispensed: {
              type: 'boolean',
              example: false
            },
            dispensed_date: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['patient_id', 'doctor_id', 'prescription_id', 'diagnosis', 'medications']
        },

        // Payment schemas
        Payment: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            invoice_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            patient_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439013'
            },
            amount: {
              type: 'number',
              example: 150.00
            },
            method: {
              type: 'string',
              enum: ['credit_card', 'cash', 'bank_transfer', 'upi', 'insurance'],
              example: 'credit_card'
            },
            status: {
              type: 'string',
              enum: ['completed', 'pending', 'processing', 'failed', 'refunded'],
              example: 'completed'
            },
            transaction_id: {
              type: 'string',
              example: 'txn_1234567890'
            },
            card_last4: {
              type: 'string',
              example: '4242'
            },
            insurance_provider: {
              type: 'string',
              example: 'Blue Cross Blue Shield'
            },
            processing_fee: {
              type: 'number',
              example: 3.50
            },
            net_amount: {
              type: 'number',
              example: 146.50
            },
            payment_date: {
              type: 'string',
              format: 'date-time',
              example: '2024-06-15T14:30:00Z'
            },
            failure_reason: {
              type: 'string',
              example: 'Insufficient funds'
            },
            description: {
              type: 'string',
              example: 'Payment for consultation services'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['invoice_id', 'patient_id', 'amount', 'method', 'description']
        },

        // Test Report schemas
        TestReport: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            reportNumber: {
              type: 'string',
              example: 'RPT2024123456'
            },
            patientId: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            patientName: {
              type: 'string',
              example: 'John Doe'
            },
            patientAge: {
              type: 'integer',
              example: 35
            },
            patientGender: {
              type: 'string',
              enum: ['male', 'female', 'other'],
              example: 'male'
            },
            testId: {
              type: 'string',
              example: '507f1f77bcf86cd799439013'
            },
            testName: {
              type: 'string',
              example: 'Complete Blood Count'
            },
            testCode: {
              type: 'string',
              example: 'CBC001'
            },
            category: {
              type: 'string',
              example: 'Hematology'
            },
            externalVendor: {
              type: 'string',
              example: 'LabCorp'
            },
            testDate: {
              type: 'string',
              format: 'date',
              example: '2024-06-15'
            },
            recordedDate: {
              type: 'string',
              format: 'date',
              example: '2024-06-16'
            },
            recordedBy: {
              type: 'string',
              example: 'Lab Technician'
            },
            status: {
              type: 'string',
              enum: ['pending', 'recorded', 'verified', 'delivered'],
              example: 'verified'
            },
            results: {
              type: 'object',
              example: {
                "WBC": "7.2",
                "RBC": "4.8",
                "Hemoglobin": "14.5"
              }
            },
            normalRange: {
              type: 'string',
              example: 'WBC: 4.0-11.0, RBC: 4.2-5.4, Hemoglobin: 12.0-16.0'
            },
            units: {
              type: 'string',
              example: '10^3/µL, 10^6/µL, g/dL'
            },
            notes: {
              type: 'string',
              example: 'All values within normal range'
            },
            interpretation: {
              type: 'string',
              example: 'Normal complete blood count'
            },
            verifiedBy: {
              type: 'string',
              example: 'Dr. Smith'
            },
            verifiedDate: {
              type: 'string',
              format: 'date-time'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['patientId', 'patientName', 'patientAge', 'patientGender', 'testId', 'testName', 'testCode', 'category', 'externalVendor', 'testDate', 'recordedDate', 'recordedBy']
        },

        // Test schemas
        Test: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Complete Blood Count'
            },
            code: {
              type: 'string',
              example: 'CBC001'
            },
            category: {
              type: 'string',
              example: 'Hematology'
            },
            description: {
              type: 'string',
              example: 'Complete blood count with differential'
            },
            normalRange: {
              type: 'string',
              example: 'WBC: 4.0-11.0 x10^3/µL'
            },
            units: {
              type: 'string',
              example: '10^3/µL'
            },
            methodology: {
              type: 'string',
              example: 'Flow cytometry'
            },
            turnaroundTime: {
              type: 'string',
              example: '24-48 hours'
            },
            sampleType: {
              type: 'string',
              example: 'Whole blood'
            },
            isActive: {
              type: 'boolean',
              example: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['name', 'code', 'category', 'description', 'turnaroundTime']
        },

        // Department schemas
        Department: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            code: {
              type: 'string',
              example: 'CARD'
            },
            name: {
              type: 'string',
              example: 'Cardiology'
            },
            description: {
              type: 'string',
              example: 'Department specializing in heart and cardiovascular diseases'
            },
            head: {
              type: 'string',
              example: 'Dr. John Smith'
            },
            location: {
              type: 'string',
              example: 'Building A, Floor 3'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'cardiology@hospital.com'
            },
            staffCount: {
              type: 'integer',
              example: 15
            },
            budget: {
              type: 'number',
              example: 500000.00
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['code', 'name', 'description', 'head', 'location', 'phone', 'email', 'staffCount', 'budget']
        },

        // Lead schemas
        Lead: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            firstName: {
              type: 'string',
              example: 'John'
            },
            lastName: {
              type: 'string',
              example: 'Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            source: {
              type: 'string',
              enum: ['website', 'referral', 'social', 'advertisement', 'walk-in'],
              example: 'website'
            },
            serviceInterest: {
              type: 'string',
              example: 'Cardiology consultation'
            },
            status: {
              type: 'string',
              enum: ['new', 'contacted', 'converted', 'lost'],
              example: 'new'
            },
            assignedTo: {
              type: 'string',
              example: 'Sales Rep 1'
            },
            notes: {
              type: 'string',
              example: 'Interested in heart health checkup'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['firstName', 'lastName', 'phone', 'source', 'serviceInterest']
        },

        // Expense schemas
        Expense: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            title: {
              type: 'string',
              example: 'Medical Equipment Purchase'
            },
            description: {
              type: 'string',
              example: 'New ECG machine for cardiology department'
            },
            amount: {
              type: 'number',
              example: 15000.00
            },
            category: {
              type: 'string',
              enum: ['supplies', 'equipment', 'utilities', 'maintenance', 'staff', 'marketing', 'insurance', 'rent', 'other'],
              example: 'equipment'
            },
            vendor: {
              type: 'string',
              example: 'Medical Supplies Inc.'
            },
            payment_method: {
              type: 'string',
              enum: ['cash', 'card', 'bank_transfer', 'check'],
              example: 'bank_transfer'
            },
            date: {
              type: 'string',
              format: 'date',
              example: '2024-06-15'
            },
            status: {
              type: 'string',
              enum: ['pending', 'paid', 'cancelled'],
              example: 'paid'
            },
            receipt_url: {
              type: 'string',
              example: 'https://example.com/receipts/receipt123.pdf'
            },
            notes: {
              type: 'string',
              example: 'Approved by department head'
            },
            created_by: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['title', 'amount', 'category', 'payment_method', 'date', 'created_by']
        },

        // Payroll schemas
        Payroll: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            employee_id: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            month: {
              type: 'string',
              enum: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
              example: 'June'
            },
            year: {
              type: 'integer',
              example: 2024
            },
            base_salary: {
              type: 'number',
              example: 5000.00
            },
            overtime: {
              type: 'number',
              example: 500.00
            },
            bonus: {
              type: 'number',
              example: 1000.00
            },
            allowances: {
              type: 'number',
              example: 300.00
            },
            deductions: {
              type: 'number',
              example: 200.00
            },
            tax: {
              type: 'number',
              example: 800.00
            },
            net_salary: {
              type: 'number',
              example: 5800.00
            },
            status: {
              type: 'string',
              enum: ['draft', 'pending', 'processed', 'paid'],
              example: 'processed'
            },
            pay_date: {
              type: 'string',
              format: 'date',
              example: '2024-06-30'
            },
            working_days: {
              type: 'integer',
              example: 22
            },
            total_days: {
              type: 'integer',
              example: 30
            },
            leaves: {
              type: 'integer',
              example: 2
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['employee_id', 'month', 'year', 'base_salary', 'working_days', 'total_days']
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Health Check',
        description: 'API health status'
      },
      {
        name: 'Dashboard',
        description: 'Dashboard statistics and analytics'
      },
      {
        name: 'Patients',
        description: 'Patient management operations'
      },
      {
        name: 'Appointments',
        description: 'Appointment scheduling and management'
      },
      {
        name: 'Medical Records',
        description: 'Medical record management'
      },
      {
        name: 'Prescriptions',
        description: 'Electronic prescription management'
      },
      {
        name: 'Invoices',
        description: 'Billing and invoice management'
      },
      {
        name: 'Payments',
        description: 'Payment processing and transaction management'
      },
      {
        name: 'Inventory',
        description: 'Medical inventory management'
      },
      {
        name: 'Users',
        description: 'User management operations'
      },
      {
        name: 'Test Categories',
        description: 'Laboratory test category management'
      },
      {
        name: 'Sample Types',
        description: 'Sample type management for laboratory tests'
      },
      {
        name: 'Test Methodologies',
        description: 'Test methodology management'
      },
      {
        name: 'Turnaround Times',
        description: 'Test turnaround time management'
      },
      {
        name: 'Tests',
        description: 'Laboratory test management'
      },
      {
        name: 'Test Reports',
        description: 'Test report management'
      },
      {
        name: 'Lab Vendors',
        description: 'External laboratory vendor management'
      },
      {
        name: 'Departments',
        description: 'Hospital department management'
      },
      {
        name: 'Leads',
        description: 'Lead management and patient acquisition'
      },
      {
        name: 'Services',
        description: 'Medical service management'
      },
      {
        name: 'Payroll',
        description: 'Employee payroll and salary management'
      },
      {
        name: 'Analytics',
        description: 'Business analytics and reporting'
      },
      {
        name: 'Settings',
        description: 'System settings and configuration'
      },
      {
        name: 'Training',
        description: 'Staff training and development'
      },
      {
        name: 'Receptionist',
        description: 'Receptionist specific operations'
      }
    ]
  },
  apis: [
    './src/routes/*.ts', 
    './src/controllers/*.ts',
    './src/docs/swagger.yaml'
  ]
};

const specs = swaggerJsdoc(options);

export default specs; 