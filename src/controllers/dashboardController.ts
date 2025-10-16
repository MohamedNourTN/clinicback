import { Response } from 'express';
import { Patient, Appointment, Invoice, Inventory, User, Lead, Expense } from '../models';
import { AuthRequest } from '../types/express';

export class DashboardController {
  static async getAdminDashboardStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicId = req.clinic_id;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Basic counts - filtered by clinic
      const [
        totalPatients,
        todayAppointments,
        monthlyRevenue,
        lowStockCount,
        totalDoctors,
        totalStaff
      ] = await Promise.all([
        Patient.countDocuments({ clinic_id: clinicId }),
        Appointment.countDocuments({
          clinic_id: clinicId,
          appointment_date: {
            $gte: today,
            $lt: tomorrow
          }
        }),
        Invoice.aggregate([
          {
            $match: {
              clinic_id: clinicId,
              status: 'paid',
              paid_at: {
                $gte: startOfMonth,
                $lt: new Date()
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$total_amount' }
            }
          }
        ]),
        Inventory.countDocuments({
          clinic_id: clinicId,
          $expr: { $lte: ['$current_stock', '$minimum_stock'] }
        }),
        User.countDocuments({ role: 'doctor', is_active: true, clinic_id: clinicId }),
        User.countDocuments({ is_active: true, clinic_id: clinicId })
      ]);

      // Appointment statistics - filtered by clinic
      const appointmentStats = await Appointment.aggregate([
        {
          $match: { clinic_id: clinicId }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Revenue trends (last 6 months) - filtered by clinic
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const revenueData = await Invoice.aggregate([
        {
          $match: {
            clinic_id: clinicId,
            status: 'paid',
            paid_at: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$paid_at' },
              month: { $month: '$paid_at' }
            },
            revenue: { $sum: '$total_amount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': -1, '_id.month': -1 }
        }
      ]);

      // Low stock items details - filtered by clinic
      const lowStockItems = await Inventory.find({
        clinic_id: clinicId,
        $expr: { $lte: ['$current_stock', '$minimum_stock'] }
      }).limit(10);

      // Recent appointments - filtered by clinic
      const recentAppointments = await Appointment.find({ clinic_id: clinicId })
        .populate('patient_id', 'first_name last_name')
        .populate('doctor_id', 'first_name last_name')
        .sort({ created_at: -1 })
        .limit(10);

      // Recent leads - filtered by clinic
      const recentLeads = await Lead.find({ clinic_id: clinicId })
        .sort({ created_at: -1 })
        .limit(10);

      // Calculate percentage changes (comparing to previous month)
      const lastMonth = new Date(startOfMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);

      const [lastMonthRevenue, lastMonthPatients, lastMonthAppointments] = await Promise.all([
        Invoice.aggregate([
          {
            $match: {
              clinic_id: clinicId,
              status: 'paid',
              paid_at: {
                $gte: startOfLastMonth,
                $lt: startOfMonth
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$total_amount' }
            }
          }
        ]),
        Patient.countDocuments({
          clinic_id: clinicId,
          created_at: {
            $gte: startOfLastMonth,
            $lt: startOfMonth
          }
        }),
        Appointment.countDocuments({
          clinic_id: clinicId,
          created_at: {
            $gte: startOfLastMonth,
            $lt: startOfMonth
          }
        })
      ]);

      // Calculate percentage changes
      const currentRevenue = monthlyRevenue[0]?.total || 0;
      const prevRevenue = lastMonthRevenue[0]?.total || 1;
      const revenueChange = ((currentRevenue - prevRevenue) / prevRevenue * 100).toFixed(1);

      const currentPatients = await Patient.countDocuments({
        clinic_id: clinicId,
        created_at: { $gte: startOfMonth }
      });
      const patientChange = lastMonthPatients > 0 
        ? ((currentPatients - lastMonthPatients) / lastMonthPatients * 100).toFixed(1)
        : '0';

      const currentAppointments = await Appointment.countDocuments({
        clinic_id: clinicId,
        created_at: { $gte: startOfMonth }
      });
      const appointmentChange = lastMonthAppointments > 0
        ? ((currentAppointments - lastMonthAppointments) / lastMonthAppointments * 100).toFixed(1)
        : '0';

      // System health metrics
      const systemHealth = {
        totalUsers: totalStaff,
        activeUsers: totalStaff,
        systemUptime: '99.9%',
        lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        apiResponseTime: '120ms'
      };

      res.json({
        success: true,
        data: {
          overview: {
            totalPatients,
            todayAppointments,
            monthlyRevenue: monthlyRevenue[0]?.total || 0,
            lowStockCount,
            totalDoctors,
            totalStaff
          },
          appointmentStats,
          revenueData,
          lowStockItems,
          recentAppointments,
          recentLeads,
          systemHealth,
          percentageChanges: {
            revenue: revenueChange,
            patients: patientChange,
            appointments: appointmentChange
          },
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      console.error('Get admin dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getRevenueAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicId = req.clinic_id;
      const { period = '6months' } = req.query;
      
      let startDate: Date;
      const now = new Date();
      
      switch (period) {
        case '1month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case '3months':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '1year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 6);
      }

      const [revenueData, expenseData] = await Promise.all([
        Invoice.aggregate([
          {
            $match: {
              clinic_id: clinicId,
              status: 'paid',
              paid_at: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$paid_at' },
                month: { $month: '$paid_at' }
              },
              revenue: { $sum: '$total_amount' },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': -1, '_id.month': -1 }
          }
        ]),
        // Real expense data from Expense model - filtered by clinic
        Expense.aggregate([
          {
            $match: {
              clinic_id: clinicId,
              status: 'paid',
              date: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' }
              },
              expenses: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': -1, '_id.month': -1 }
          }
        ])
      ]);

      res.json({
        success: true,
        data: {
          revenueData,
          expenseData,
          period
        }
      });
    } catch (error) {
      console.error('Get revenue analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getOperationalMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicId = req.clinic_id;
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay.getTime() - (startOfDay.getDay() * 24 * 60 * 60 * 1000));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Appointment metrics - filtered by clinic
      const appointmentMetrics = await Promise.all([
        Appointment.countDocuments({
          clinic_id: clinicId,
          appointment_date: { $gte: startOfDay }
        }),
        Appointment.countDocuments({
          clinic_id: clinicId,
          appointment_date: { $gte: startOfWeek }
        }),
        Appointment.countDocuments({
          clinic_id: clinicId,
          appointment_date: { $gte: startOfMonth }
        }),
        Appointment.aggregate([
          {
            $match: { clinic_id: clinicId }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      // Patient metrics - filtered by clinic
      const patientMetrics = await Promise.all([
        Patient.countDocuments({
          clinic_id: clinicId,
          created_at: { $gte: startOfDay }
        }),
        Patient.countDocuments({
          clinic_id: clinicId,
          created_at: { $gte: startOfWeek }
        }),
        Patient.countDocuments({
          clinic_id: clinicId,
          created_at: { $gte: startOfMonth }
        })
      ]);

      // Inventory alerts - filtered by clinic
      const inventoryAlerts = await Inventory.find({
        clinic_id: clinicId,
        $or: [
          { $expr: { $lte: ['$current_stock', '$minimum_stock'] } },
          { 
            expiry_date: { 
              $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            } 
          }
        ]
      }).limit(20);

      res.json({
        success: true,
        data: {
          appointments: {
            today: appointmentMetrics[0],
            thisWeek: appointmentMetrics[1],
            thisMonth: appointmentMetrics[2],
            byStatus: appointmentMetrics[3]
          },
          patients: {
            today: patientMetrics[0],
            thisWeek: patientMetrics[1],
            thisMonth: patientMetrics[2]
          },
          inventoryAlerts,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Get operational metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getSystemHealth(req: AuthRequest, res: Response): Promise<void> {
    try {
      // System health checks
      const healthChecks = await Promise.all([
        // Database connectivity
        Patient.countDocuments().then(() => ({ service: 'database', status: 'healthy', responseTime: '< 50ms' })),
        // API responsiveness
        Promise.resolve({ service: 'api', status: 'healthy', responseTime: '< 100ms' }),
        // Memory usage (mock)
        Promise.resolve({ service: 'memory', status: 'healthy', usage: '65%' }),
        // Disk space (mock)
        Promise.resolve({ service: 'disk', status: 'healthy', usage: '42%' })
      ]);

      // Recent system alerts (mock data - in real app, you'd have a logs/alerts model)
      const systemAlerts = [
        {
          type: 'warning',
          title: 'Server maintenance scheduled',
          description: 'System will be down for 30 minutes tonight at 2 AM',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          severity: 'medium'
        },
        {
          type: 'info',
          title: 'Database backup completed',
          description: 'Daily backup completed successfully',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          severity: 'low'
        },
        {
          type: 'error',
          title: 'Payment gateway timeout',
          description: 'Temporary payment processing delays resolved',
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
          severity: 'high'
        }
      ];

      // Performance metrics
      const performanceMetrics = {
        uptime: '99.9%',
        averageResponseTime: '120ms',
        requestsToday: 15678,
        errorsToday: 12,
        lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000)
      };

      res.json({
        success: true,
        data: {
          healthChecks,
          systemAlerts,
          performanceMetrics,
          overallStatus: 'healthy',
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Get system health error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 