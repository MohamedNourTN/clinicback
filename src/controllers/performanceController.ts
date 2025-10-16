import { Response } from 'express';
import { Invoice, Payment, Payroll, Expense, User, Appointment } from '../models';
import { AuthRequest } from '../types/express';
import mongoose from 'mongoose';

export class PerformanceController {
  // Get comprehensive performance statistics
  static async getPerformanceOverview(req: AuthRequest, res: Response) {
    try {
      const { 
        start_date, 
        end_date,
        period = 'monthly', // monthly, quarterly, yearly
        compare_with_previous = false 
      } = req.query;

      // Convert clinic_id to ObjectId for proper matching in aggregation
      const clinicObjectId = typeof req.clinic_id === 'string' 
        ? new mongoose.Types.ObjectId(req.clinic_id)
        : req.clinic_id;

      // Set default date range if not provided (last 12 months)
      const endDate = end_date ? new Date(end_date as string) : new Date();
      const startDate = start_date ? new Date(start_date as string) : new Date(endDate.getFullYear() - 1, endDate.getMonth(), 1);

      const dateFilter = {
        clinic_id: clinicObjectId,
        $expr: {
          $and: [
            { $gte: [{ $dateFromString: { dateString: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } } }, startDate] },
            { $lte: [{ $dateFromString: { dateString: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } } }, endDate] }
          ]
        }
      };

      const invoiceDateFilter = {
        clinic_id: clinicObjectId,
        issue_date: { $gte: startDate, $lte: endDate }
      };

      const paymentDateFilter = {
        clinic_id: clinicObjectId,
        payment_date: { $gte: startDate, $lte: endDate }
      };

      // Get period format for grouping
      const getGroupFormat = (period: string) => {
        switch (period) {
          case 'yearly':
            return { year: { $year: '$date' } };
          case 'quarterly':
            return { 
              year: { $year: '$date' },
              quarter: { $ceil: { $divide: [{ $month: '$date' }, 3] } }
            };
          case 'monthly':
          default:
            return { 
              year: { $year: '$date' },
              month: { $month: '$date' }
            };
        }
      };

      const getInvoiceGroupFormat = (period: string) => {
        switch (period) {
          case 'yearly':
            return { year: { $year: '$issue_date' } };
          case 'quarterly':
            return { 
              year: { $year: '$issue_date' },
              quarter: { $ceil: { $divide: [{ $month: '$issue_date' }, 3] } }
            };
          case 'monthly':
          default:
            return { 
              year: { $year: '$issue_date' },
              month: { $month: '$issue_date' }
            };
        }
      };

      const getPaymentGroupFormat = (period: string) => {
        switch (period) {
          case 'yearly':
            return { year: { $year: '$payment_date' } };
          case 'quarterly':
            return { 
              year: { $year: '$payment_date' },
              quarter: { $ceil: { $divide: [{ $month: '$payment_date' }, 3] } }
            };
          case 'monthly':
          default:
            return { 
              year: { $year: '$payment_date' },
              month: { $month: '$payment_date' }
            };
        }
      };

      const groupFormat = getGroupFormat(period as string);
      const invoiceGroupFormat = getInvoiceGroupFormat(period as string);
      const paymentGroupFormat = getPaymentGroupFormat(period as string);

      // Aggregate data from all financial modules
      const [
        invoiceStats,
        paymentStats,
        payrollStats,
        expenseStats,
        overallSummary
      ] = await Promise.all([
        // Invoice Statistics
        Invoice.aggregate([
          { $match: invoiceDateFilter },
          {
            $group: {
              _id: invoiceGroupFormat,
              total_invoices: { $sum: 1 },
              total_amount: { $sum: '$total_amount' },
              paid_invoices: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
              pending_invoices: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              overdue_invoices: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
              paid_amount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total_amount', 0] } },
              pending_amount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$total_amount', 0] } },
              average_invoice_value: { $avg: '$total_amount' }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.quarter': 1 } }
        ]),

        // Payment Statistics
        Payment.aggregate([
          { $match: paymentDateFilter },
          {
            $group: {
              _id: paymentGroupFormat,
              total_payments: { $sum: 1 },
              total_amount: { $sum: '$amount' },
              completed_payments: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              failed_payments: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              completed_amount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
              processing_fees: { $sum: '$processing_fee' },
              average_payment_value: { $avg: '$amount' },
              // Payment method breakdown
              cash_payments: { $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] } },
              card_payments: { $sum: { $cond: [{ $eq: ['$method', 'credit_card'] }, '$amount', 0] } },
              bank_transfer_payments: { $sum: { $cond: [{ $eq: ['$method', 'bank_transfer'] }, '$amount', 0] } },
              upi_payments: { $sum: { $cond: [{ $eq: ['$method', 'upi'] }, '$amount', 0] } }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.quarter': 1 } }
        ]),

        // Payroll Statistics
        Payroll.aggregate([
          {
            $match: {
              clinic_id: clinicObjectId,
              year: { $gte: startDate.getFullYear(), $lte: endDate.getFullYear() }
            }
          },
          {
            $group: {
              _id: {
                year: '$year',
                month: '$month'
              },
              total_payroll: { $sum: '$net_salary' },
              total_employees: { $sum: 1 },
              average_salary: { $avg: '$net_salary' },
              total_gross_salary: { $sum: { $add: ['$base_salary', '$overtime', '$bonus', '$allowances'] } },
              total_deductions: { $sum: { $add: ['$deductions', '$tax'] } },
              total_overtime: { $sum: '$overtime' },
              total_bonuses: { $sum: '$bonus' }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]),

        // Expense Statistics  
        Expense.aggregate([
          { $match: { clinic_id: clinicObjectId, date: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: groupFormat,
              total_expenses: { $sum: 1 },
              total_amount: { $sum: '$amount' },
              paid_expenses: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
              pending_expenses: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              paid_amount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
              pending_amount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
              average_expense_value: { $avg: '$amount' },
              // Category breakdown
              supplies_expenses: { $sum: { $cond: [{ $eq: ['$category', 'supplies'] }, '$amount', 0] } },
              equipment_expenses: { $sum: { $cond: [{ $eq: ['$category', 'equipment'] }, '$amount', 0] } },
              utilities_expenses: { $sum: { $cond: [{ $eq: ['$category', 'utilities'] }, '$amount', 0] } },
              staff_expenses: { $sum: { $cond: [{ $eq: ['$category', 'staff'] }, '$amount', 0] } },
              other_expenses: { $sum: { $cond: [{ $in: ['$category', ['maintenance', 'marketing', 'insurance', 'rent', 'other']] }, '$amount', 0] } }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.quarter': 1 } }
        ]),

        // Overall Summary
        Promise.all([
          // Total revenue (paid invoices + completed payments)
          Invoice.aggregate([
            { $match: { ...invoiceDateFilter, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$total_amount' } } }
          ]),
          // Total payments
          Payment.aggregate([
            { $match: { ...paymentDateFilter, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]),
          // Total payroll
          Payroll.aggregate([
            { $match: { clinic_id: clinicObjectId, year: { $gte: startDate.getFullYear(), $lte: endDate.getFullYear() } } },
            { $group: { _id: null, total: { $sum: '$net_salary' } } }
          ]),
          // Total expenses
          Expense.aggregate([
            { $match: { clinic_id: clinicObjectId, date: { $gte: startDate, $lte: endDate }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ])
        ])
      ]);

      // Calculate profit/loss
      const totalRevenue = (overallSummary[0][0]?.total || 0) + (overallSummary[1][0]?.total || 0);
      const totalCosts = (overallSummary[2][0]?.total || 0) + (overallSummary[3][0]?.total || 0);
      const netProfit = totalRevenue - totalCosts;

      // Format response
      const performanceData = {
        period: period,
        date_range: {
          start_date: startDate,
          end_date: endDate
        },
        summary: {
          total_revenue: totalRevenue,
          total_costs: totalCosts,
          net_profit: netProfit,
          profit_margin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0
        },
        modules: {
          invoices: invoiceStats,
          payments: paymentStats,
          payroll: payrollStats,
          expenses: expenseStats
        }
      };

      res.json({
        success: true,
        data: performanceData
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch performance statistics',
        error: error.message
      });
    }
  }

  // Get module-specific performance data
  static async getModulePerformance(req: AuthRequest, res: Response) {
    try {
      const { module } = req.params;
      const { start_date, end_date, metric = 'amount' } = req.query;

      const clinicObjectId = typeof req.clinic_id === 'string' 
        ? new mongoose.Types.ObjectId(req.clinic_id)
        : req.clinic_id;

      const endDate = end_date ? new Date(end_date as string) : new Date();
      const startDate = start_date ? new Date(start_date as string) : new Date(endDate.getFullYear() - 1, endDate.getMonth(), 1);

      let moduleData;

      switch (module.toLowerCase()) {
        case 'invoices':
          moduleData = await Invoice.aggregate([
            { 
              $match: { 
                clinic_id: clinicObjectId,
                issue_date: { $gte: startDate, $lte: endDate }
              } 
            },
            {
              $group: {
                _id: {
                  year: { $year: '$issue_date' },
                  month: { $month: '$issue_date' },
                  status: '$status'
                },
                count: { $sum: 1 },
                total_amount: { $sum: '$total_amount' }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
          ]);
          break;

        case 'payments':
          moduleData = await Payment.aggregate([
            { 
              $match: { 
                clinic_id: clinicObjectId,
                payment_date: { $gte: startDate, $lte: endDate }
              } 
            },
            {
              $group: {
                _id: {
                  year: { $year: '$payment_date' },
                  month: { $month: '$payment_date' },
                  method: '$method',
                  status: '$status'
                },
                count: { $sum: 1 },
                total_amount: { $sum: '$amount' }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
          ]);
          break;

        case 'payroll':
          moduleData = await Payroll.aggregate([
            { 
              $match: { 
                clinic_id: clinicObjectId,
                year: { $gte: startDate.getFullYear(), $lte: endDate.getFullYear() }
              } 
            },
            {
              $group: {
                _id: {
                  year: '$year',
                  month: '$month',
                  status: '$status'
                },
                count: { $sum: 1 },
                total_amount: { $sum: '$net_salary' },
                average_salary: { $avg: '$net_salary' }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
          ]);
          break;

        case 'expenses':
          moduleData = await Expense.aggregate([
            { 
              $match: { 
                clinic_id: clinicObjectId,
                date: { $gte: startDate, $lte: endDate }
              } 
            },
            {
              $group: {
                _id: {
                  year: { $year: '$date' },
                  month: { $month: '$date' },
                  category: '$category',
                  status: '$status'
                },
                count: { $sum: 1 },
                total_amount: { $sum: '$amount' }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
          ]);
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid module. Supported modules: invoices, payments, payroll, expenses'
          });
      }

      res.json({
        success: true,
        data: {
          module: module,
          date_range: { start_date: startDate, end_date: endDate },
          statistics: moduleData
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch module performance data',
        error: error.message
      });
    }
  }

  // Get comparative performance data
  static async getComparativePerformance(req: AuthRequest, res: Response) {
    try {
      const { 
        current_start, 
        current_end, 
        previous_start, 
        previous_end 
      } = req.query;

      const clinicObjectId = typeof req.clinic_id === 'string' 
        ? new mongoose.Types.ObjectId(req.clinic_id)
        : req.clinic_id;

      if (!current_start || !current_end || !previous_start || !previous_end) {
        return res.status(400).json({
          success: false,
          message: 'All date parameters are required for comparison'
        });
      }

      const currentStart = new Date(current_start as string);
      const currentEnd = new Date(current_end as string);
      const previousStart = new Date(previous_start as string);
      const previousEnd = new Date(previous_end as string);

      // Get data for both periods
      const [currentPeriod, previousPeriod] = await Promise.all([
        // Current period data
        Promise.all([
          Invoice.aggregate([
            { $match: { clinic_id: clinicObjectId, issue_date: { $gte: currentStart, $lte: currentEnd }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$total_amount' }, count: { $sum: 1 } } }
          ]),
          Payment.aggregate([
            { $match: { clinic_id: clinicObjectId, payment_date: { $gte: currentStart, $lte: currentEnd }, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
          ]),
          Expense.aggregate([
            { $match: { clinic_id: clinicObjectId, date: { $gte: currentStart, $lte: currentEnd }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
          ]),
          Payroll.aggregate([
            { $match: { clinic_id: clinicObjectId, year: { $gte: currentStart.getFullYear(), $lte: currentEnd.getFullYear() } } },
            { $group: { _id: null, total: { $sum: '$net_salary' }, count: { $sum: 1 } } }
          ])
        ]),
        // Previous period data
        Promise.all([
          Invoice.aggregate([
            { $match: { clinic_id: clinicObjectId, issue_date: { $gte: previousStart, $lte: previousEnd }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$total_amount' }, count: { $sum: 1 } } }
          ]),
          Payment.aggregate([
            { $match: { clinic_id: clinicObjectId, payment_date: { $gte: previousStart, $lte: previousEnd }, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
          ]),
          Expense.aggregate([
            { $match: { clinic_id: clinicObjectId, date: { $gte: previousStart, $lte: previousEnd }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
          ]),
          Payroll.aggregate([
            { $match: { clinic_id: clinicObjectId, year: { $gte: previousStart.getFullYear(), $lte: previousEnd.getFullYear() } } },
            { $group: { _id: null, total: { $sum: '$net_salary' }, count: { $sum: 1 } } }
          ])
        ])
      ]);

      // Calculate percentage changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100).toFixed(2);
      };

      const currentTotals = {
        invoices: currentPeriod[0][0]?.total || 0,
        payments: currentPeriod[1][0]?.total || 0,
        expenses: currentPeriod[2][0]?.total || 0,
        payroll: currentPeriod[3][0]?.total || 0
      };

      const previousTotals = {
        invoices: previousPeriod[0][0]?.total || 0,
        payments: previousPeriod[1][0]?.total || 0,
        expenses: previousPeriod[2][0]?.total || 0,
        payroll: previousPeriod[3][0]?.total || 0
      };

      const comparison = {
        current_period: {
          start_date: currentStart,
          end_date: currentEnd,
          totals: currentTotals,
          revenue: currentTotals.invoices + currentTotals.payments,
          costs: currentTotals.expenses + currentTotals.payroll,
          profit: (currentTotals.invoices + currentTotals.payments) - (currentTotals.expenses + currentTotals.payroll)
        },
        previous_period: {
          start_date: previousStart,
          end_date: previousEnd,
          totals: previousTotals,
          revenue: previousTotals.invoices + previousTotals.payments,
          costs: previousTotals.expenses + previousTotals.payroll,
          profit: (previousTotals.invoices + previousTotals.payments) - (previousTotals.expenses + previousTotals.payroll)
        },
        changes: {
          invoices: calculateChange(currentTotals.invoices, previousTotals.invoices),
          payments: calculateChange(currentTotals.payments, previousTotals.payments),
          expenses: calculateChange(currentTotals.expenses, previousTotals.expenses),
          payroll: calculateChange(currentTotals.payroll, previousTotals.payroll),
          revenue: calculateChange(
            currentTotals.invoices + currentTotals.payments,
            previousTotals.invoices + previousTotals.payments
          ),
          profit: calculateChange(
            (currentTotals.invoices + currentTotals.payments) - (currentTotals.expenses + currentTotals.payroll),
            (previousTotals.invoices + previousTotals.payments) - (previousTotals.expenses + previousTotals.payroll)
          )
        }
      };

      res.json({
        success: true,
        data: comparison
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch comparative performance data',
        error: error.message
      });
    }
  }

  // Get doctor payouts with sales incentives
  static async getDoctorPayouts(req: AuthRequest, res: Response) {
    try {
      const { 
        year = new Date().getFullYear(), 
        month = new Date().getMonth() + 1 
      } = req.query;

      const clinicObjectId = typeof req.clinic_id === 'string' 
        ? new mongoose.Types.ObjectId(req.clinic_id)
        : req.clinic_id;

      // Date range for the specified month
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

      // Emergency patch: Ensure all doctors have sales_percentage field
      await User.updateMany(
        { 
          clinic_id: clinicObjectId,
          role: 'doctor',
          $or: [
            { sales_percentage: { $exists: false } },
            { sales_percentage: null },
            { sales_percentage: undefined }
          ]
        },
        { $set: { sales_percentage: 0 } }
      );

      // Get all doctors in the clinic
      const doctors = await User.find({
        clinic_id: clinicObjectId,
        role: 'doctor',
        is_active: true
      }).select('first_name last_name email phone specialization sales_percentage');

      if (doctors.length === 0) {
        return res.json({
          success: true,
          data: {
            month: Number(month),
            year: Number(year),
            date_range: { start_date: startDate, end_date: endDate },
            doctors: []
          }
        });
      }

      const doctorIds = doctors.map(doctor => doctor._id);

      // Get doctor payouts in parallel
      const doctorPayouts = await Promise.all(
        doctors.map(async (doctor) => {
          // Get appointments for this doctor in the specified month
          const appointments = await Appointment.find({
            clinic_id: clinicObjectId,
            doctor_id: doctor._id,
            appointment_date: { $gte: startDate, $lte: endDate },
            status: { $in: ['completed', 'confirmed'] }
          });

          const appointmentIds = appointments.map(apt => apt._id);

          // Get revenue from invoices linked to these appointments
          const revenueData = await Invoice.aggregate([
            {
              $match: {
                clinic_id: clinicObjectId,
                appointment_id: { $in: appointmentIds },
                status: 'paid',
                issue_date: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: null,
                total_revenue: { $sum: '$total_amount' },
                invoice_count: { $sum: 1 }
              }
            }
          ]);

          const revenue = revenueData[0]?.total_revenue || 0;
          const invoiceCount = revenueData[0]?.invoice_count || 0;

          // Get base salary from most recent payroll
          const latestPayroll = await Payroll.findOne({
            clinic_id: clinicObjectId,
            employee_id: doctor._id,
            year: Number(year),
            month: Number(month)
          }).sort({ created_at: -1 });

          // If no payroll for specific month, try to get the most recent payroll
          let fallbackPayroll: any = null;
          if (!latestPayroll) {
            fallbackPayroll = await Payroll.findOne({
              clinic_id: clinicObjectId,
              employee_id: doctor._id
            }).sort({ year: -1, month: -1, created_at: -1 });
          }

          const baseSalary = latestPayroll?.base_salary || fallbackPayroll?.base_salary || 0;
          const salesPercentage = doctor.sales_percentage || 0;
          
          // Calculate sales incentive
          const salesIncentive = (revenue * salesPercentage) / 100;
          const totalPayout = baseSalary + salesIncentive;

          return {
            doctor_id: doctor._id,
            doctor_name: `${doctor.first_name} ${doctor.last_name}`,
            email: doctor.email,
            phone: doctor.phone,
            specialization: doctor.specialization,
            sales_percentage: salesPercentage,
            base_salary: baseSalary,
            revenue_generated: revenue,
            invoice_count: invoiceCount,
            appointment_count: appointments.length,
            sales_incentive: salesIncentive,
            total_payout: totalPayout,
            payout_breakdown: {
              base_salary: baseSalary,
              sales_incentive: salesIncentive,
              incentive_calculation: `${revenue} × ${salesPercentage}% = ${salesIncentive}`
            }
          };
        })
      );

      // Calculate totals
      const totals = doctorPayouts.reduce(
        (acc, doctor) => ({
          total_doctors: acc.total_doctors + 1,
          total_base_salary: acc.total_base_salary + doctor.base_salary,
          total_revenue: acc.total_revenue + doctor.revenue_generated,
          total_sales_incentive: acc.total_sales_incentive + doctor.sales_incentive,
          total_payout: acc.total_payout + doctor.total_payout,
          total_appointments: acc.total_appointments + doctor.appointment_count,
          total_invoices: acc.total_invoices + doctor.invoice_count
        }),
        {
          total_doctors: 0,
          total_base_salary: 0,
          total_revenue: 0,
          total_sales_incentive: 0,
          total_payout: 0,
          total_appointments: 0,
          total_invoices: 0
        }
      );

      const sortedDoctors = doctorPayouts.sort((a, b) => b.total_payout - a.total_payout);

      res.json({
        success: true,
        data: {
          month: Number(month),
          year: Number(year),
          date_range: { start_date: startDate, end_date: endDate },
          totals,
          doctors: sortedDoctors
        }
      });
    } catch (error: any) {
      console.error('Get doctor payouts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctor payouts',
        error: error.message
      });
    }
  }
}

export default PerformanceController;
