import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { Patient, Appointment, Invoice, User, Lead, Expense, Inventory } from '../models';
import { getClinicScopedFilter } from '../middleware/clinicContext';

export class AnalyticsController {
  // Get comprehensive analytics data
  static async getAnalyticsOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
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

      // Revenue and expense data with patient counts
      const clinicFilter = getClinicScopedFilter(req);
      const [revenueExpenseData, patientData] = await Promise.all([
        Invoice.aggregate([
          {
            $match: {
              ...clinicFilter,
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
        Patient.aggregate([
          {
            $match: {
              ...clinicFilter,
              created_at: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$created_at' },
                month: { $month: '$created_at' }
              },
              patients: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': -1, '_id.month': -1 }
          }
        ])
      ]);

      // Get expense data
      const expenseData = await Expense.aggregate([
        {
          $match: {
            ...clinicFilter,
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
      ]);

      // Combine revenue, expense, and patient data
      const combinedData = revenueExpenseData.map((rev, index) => {
        const exp = expenseData.find(e => 
          e._id.year === rev._id.year && e._id.month === rev._id.month
        );
        const pat = patientData.find(p => 
          p._id.year === rev._id.year && p._id.month === rev._id.month
        );
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        return {
          month: monthNames[rev._id.month - 1],
          revenue: rev.revenue || 0,
          expenses: exp?.expenses || 0,
          patients: pat?.patients || 0,
          year: rev._id.year,
          monthNumber: rev._id.month
        };
      });

      res.json({
        success: true,
        data: {
          revenueExpenseData: combinedData,
          period
        }
      });
    } catch (error) {
      console.error('Get analytics overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get department performance analytics
  static async getDepartmentAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Mock department data - in real app, you'd have Department-linked invoices
      const clinicFilter = getClinicScopedFilter(req);
      const departmentData = await Invoice.aggregate([
        { $match: { ...clinicFilter, status: 'paid' } },
        {
          $lookup: {
            from: 'appointments',
            localField: 'appointment_id',
            foreignField: '_id',
            as: 'appointment'
          }
        },
        { $unwind: { path: '$appointment', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$appointment.type', // Using appointment type as department proxy
            revenue: { $sum: '$total_amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } }
      ]);

      // Transform to expected format with colors
      const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];
      const formattedData = departmentData.map((dept, index) => ({
        name: dept._id || 'General',
        revenue: dept.revenue,
        patients: dept.count,
        color: colors[index % colors.length]
      }));

      res.json({
        success: true,
        data: formattedData
      });
    } catch (error) {
      console.error('Get department analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get appointment status analytics
  static async getAppointmentAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicFilter = getClinicScopedFilter(req);
      const appointmentStats = await Appointment.aggregate([
        {
          $match: clinicFilter
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Calculate percentages and add colors
      const total = appointmentStats.reduce((sum, stat) => sum + stat.count, 0);
      const colors = {
        'completed': '#10B981',
        'scheduled': '#3B82F6', 
        'cancelled': '#EF4444',
        'no-show': '#9CA3AF'
      };

      const formattedData = appointmentStats.map(stat => ({
        name: stat._id.charAt(0).toUpperCase() + stat._id.slice(1),
        value: Math.round((stat.count / total) * 100),
        count: stat.count,
        color: colors[stat._id as keyof typeof colors] || '#6B7280'
      }));

      res.json({
        success: true,
        data: formattedData
      });
    } catch (error) {
      console.error('Get appointment analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get patient demographics analytics
  static async getPatientDemographics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicFilter = getClinicScopedFilter(req);
      const demographics = await Patient.aggregate([
        {
          $match: clinicFilter
        },
        {
          $addFields: {
            birthDate: {
              $cond: {
                if: { $eq: [{ $type: '$date_of_birth' }, 'string'] },
                then: { $dateFromString: { dateString: '$date_of_birth' } },
                else: '$date_of_birth'
              }
            }
          }
        },
        {
          $addFields: {
            age: {
              $floor: {
                $divide: [
                  { $subtract: [new Date(), '$birthDate'] },
                  1000 * 60 * 60 * 24 * 365.25
                ]
              }
            }
          }
        },
        {
          $addFields: {
            ageGroup: {
              $switch: {
                branches: [
                  { case: { $lte: ['$age', 18] }, then: '0-18' },
                  { case: { $lte: ['$age', 35] }, then: '19-35' },
                  { case: { $lte: ['$age', 50] }, then: '36-50' },
                  { case: { $lte: ['$age', 65] }, then: '51-65' },
                ],
                default: '65+'
              }
            }
          }
        },
        {
          $group: {
            _id: {
              ageGroup: '$ageGroup',
              gender: '$gender'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.ageGroup': -1, '_id.gender': -1 } }
      ]);

      // Transform to chart format
      const ageGroups = ['0-18', '19-35', '36-50', '51-65', '65+'];
      const formattedData = ageGroups.map(ageGroup => {
        const male = demographics.find(d => d._id.ageGroup === ageGroup && d._id.gender === 'male')?.count || 0;
        const female = demographics.find(d => d._id.ageGroup === ageGroup && d._id.gender === 'female')?.count || 0;
        
        return {
          ageGroup,
          male,
          female,
          total: male + female
        };
      });

      res.json({
        success: true,
        data: formattedData
      });
    } catch (error) {
      console.error('Get patient demographics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get top services analytics
  static async getTopServices(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicFilter = getClinicScopedFilter(req);
      const topServices = await Invoice.aggregate([
        { $match: { ...clinicFilter, status: 'paid' } },
        { $unwind: '$services' },
        {
          $group: {
            _id: '$services.description',
            count: { $sum: '$services.quantity' },
            revenue: { $sum: '$services.total' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 }
      ]);

      const formattedData = topServices.map(service => ({
        service: service._id,
        count: service.count,
        revenue: service.revenue
      }));

      res.json({
        success: true,
        data: formattedData
      });
    } catch (error) {
      console.error('Get top services error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get payment methods analytics
  static async getPaymentMethodAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clinicFilter = getClinicScopedFilter(req);
      const paymentStats = await Invoice.aggregate([
        { $match: { ...clinicFilter, status: 'paid' } },
        {
          $group: {
            _id: '$payment_method',
            count: { $sum: 1 },
            amount: { $sum: '$total_amount' }
          }
        }
      ]);

      const totalAmount = paymentStats.reduce((sum, stat) => sum + stat.amount, 0);
      
      const formattedData = paymentStats.map(stat => ({
        method: stat._id || 'Unknown',
        percentage: Math.round((stat.amount / totalAmount) * 100),
        amount: stat.amount,
        count: stat.count
      }));

      res.json({
        success: true,
        data: formattedData
      });
    } catch (error) {
      console.error('Get payment methods analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get comprehensive analytics stats
  static async getAnalyticsStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonth = new Date(startOfMonth);
      previousMonth.setMonth(previousMonth.getMonth() - 1);

      // Current month stats
      const clinicFilter = getClinicScopedFilter(req);
      const [currentStats, previousStats] = await Promise.all([
        Promise.all([
          Invoice.aggregate([
            { $match: { ...clinicFilter, status: 'paid', paid_at: { $gte: startOfMonth } } },
            { $group: { _id: null, revenue: { $sum: '$total_amount' }, count: { $sum: 1 } } }
          ]),
          Patient.countDocuments({ ...clinicFilter, created_at: { $gte: startOfMonth } }),
          Appointment.countDocuments({ ...clinicFilter, created_at: { $gte: startOfMonth } }),
        ]),
        Promise.all([
          Invoice.aggregate([
            { $match: { ...clinicFilter, status: 'paid', paid_at: { $gte: previousMonth, $lt: startOfMonth } } },
            { $group: { _id: null, revenue: { $sum: '$total_amount' }, count: { $sum: 1 } } }
          ]),
          Patient.countDocuments({ ...clinicFilter, created_at: { $gte: previousMonth, $lt: startOfMonth } }),
          Appointment.countDocuments({ ...clinicFilter, created_at: { $gte: previousMonth, $lt: startOfMonth } }),
        ])
      ]);

      const currentRevenue = currentStats[0][0]?.revenue || 0;
      const currentPatients = currentStats[1];
      const currentAppointments = currentStats[2];

      const previousRevenue = previousStats[0][0]?.revenue || 1;
      const previousPatients = previousStats[1] || 1;
      const previousAppointments = previousStats[2] || 1;

      // Calculate growth percentages
      const revenueGrowth = ((currentRevenue - previousRevenue) / previousRevenue * 100);
      const patientGrowth = ((currentPatients - previousPatients) / previousPatients * 100);
      const appointmentGrowth = ((currentAppointments - previousAppointments) / previousAppointments * 100);

      // Additional stats
      const totalAppointments = await Appointment.countDocuments(clinicFilter);
      const completedAppointments = await Appointment.countDocuments({ ...clinicFilter, status: 'completed' });
      const completionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments * 100) : 0;

      res.json({
        success: true,
        data: {
          currentMonth: {
            revenue: currentRevenue,
            patients: currentPatients,
            appointments: currentAppointments,
            completionRate
          },
          growth: {
            revenue: revenueGrowth,
            patients: patientGrowth,
            appointments: appointmentGrowth
          }
        }
      });
    } catch (error) {
      console.error('Get analytics stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 