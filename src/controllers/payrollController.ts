import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Payroll, User, Department } from '../models';
import { AuthRequest } from '../types/express';
import mongoose from 'mongoose';

export class PayrollController {
  // Create a new payroll entry
  static async createPayroll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const payrollData = {
        ...req.body,
        clinic_id: req.clinic_id
      };

      const payroll = new Payroll(payrollData);
      await payroll.save();

      const populatedPayroll = await Payroll.findById(payroll._id)
        .populate('employee_id', 'first_name last_name email role phone');

      res.status(201).json({
        success: true,
        message: 'Payroll entry created successfully',
        data: populatedPayroll
      });
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Payroll entry already exists for this employee in the specified month/year'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create payroll entry',
        error: error.message
      });
    }
  }

  // Get all payroll entries with filters
  static async getAllPayrolls(req: AuthRequest, res: Response) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        month, 
        year,
        employee_id,
        department 
      } = req.query;

      const query: any = {
        clinic_id: req.clinic_id
      };
      
      if (status) query.status = status;
      if (month) query.month = month;
      if (year) query.year = Number(year);
      if (employee_id) query.employee_id = employee_id;

      const skip = (Number(page) - 1) * Number(limit);

      // If department filter is applied, get employees from that department first
      let employeeIds: string[] = [];
      if (department) {
        const employees = await User.find({ 
          clinic_id: req.clinic_id,
          department 
        }).select('_id');
        employeeIds = employees.map(emp => (emp._id as any).toString());
        query.employee_id = { $in: employeeIds };
      }

      const payrolls = await Payroll.find(query)
        .populate('employee_id', 'first_name last_name email role phone')
        .sort({ year: -1, month: -1, created_at: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Payroll.countDocuments(query);

      res.json({
        success: true,
        data: {
          items: payrolls,
          pagination: {
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            total: total,
            limit: Number(limit)
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payroll entries',
        error: error.message
      });
    }
  }

  // Get payroll by ID
  static async getPayrollById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payroll ID'
        });
        return;
      }

      const payroll = await Payroll.findOne({
        _id: id,
        clinic_id: req.clinic_id
      }).populate('employee_id', 'first_name last_name email role phone');

      if (!payroll) {
        res.status(404).json({
          success: false,
          message: 'Payroll entry not found'
        });
        return;
      }

      res.json({
        success: true,
        data: payroll
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payroll entry',
        error: error.message
      });
    }
  }

  // Update payroll entry
  static async updatePayroll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payroll ID'
        });
        return;
      }

      const payroll = await Payroll.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id }, 
        req.body, 
        { 
          new: true, 
          runValidators: true 
        }
      ).populate('employee_id', 'first_name last_name email role phone');

      if (!payroll) {
        res.status(404).json({
          success: false,
          message: 'Payroll entry not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Payroll entry updated successfully',
        data: payroll
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update payroll entry',
        error: error.message
      });
    }
  }

  // Update payroll status
  static async updatePayrollStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payroll ID'
        });
        return;
      }

      const updateData: any = { status };
      if (status === 'paid') {
        updateData.pay_date = new Date();
      }

      const payroll = await Payroll.findOneAndUpdate(
        { _id: id, clinic_id: req.clinic_id }, 
        updateData, 
        { new: true }
      ).populate('employee_id', 'first_name last_name email role phone');

      if (!payroll) {
        res.status(404).json({
          success: false,
          message: 'Payroll entry not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Payroll status updated successfully',
        data: payroll
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update payroll status',
        error: error.message
      });
    }
  }

  // Generate payroll for all employees for a specific month/year
  static async generatePayroll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { month, year, employee_ids } = req.body;

      if (!month || !year) {
        res.status(400).json({
          success: false,
          message: 'Month and year are required'
        });
        return;
      }

      // Get employees to generate payroll for (filter by clinic)
      const query: any = { 
        clinic_id: req.clinic_id,
        is_active: true 
      };
      
      if (employee_ids && employee_ids.length > 0) {
        query._id = { $in: employee_ids };
      }

      const employees = await User.find(query);

      if (employees.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No active employees found in this clinic'
        });
        return;
      }

      const generatedPayrolls: any[] = [];
      const errors: string[] = [];

      for (const employee of employees) {
        try {
          // Check if payroll already exists
          const existingPayroll = await Payroll.findOne({
            clinic_id: req.clinic_id,
            employee_id: employee._id,
            month,
            year
          });

          if (existingPayroll) {
            errors.push(`Payroll already exists for ${employee.first_name} ${employee.last_name}`);
            continue;
          }

          // Calculate base salary based on role (you can make this more sophisticated)
          const baseSalaries: { [key: string]: number } = {
            'doctor': 15000,
            'nurse': 6500,
            'admin': 8000,
            'receptionist': 4500,
            'accountant': 8000,
            'staff': 5000
          };

          const baseSalary = baseSalaries[employee.role] || 5000;
          
          // Calculate working days (you can integrate with attendance system)
          const totalDays = new Date(year, getMonthNumber(month), 0).getDate();
          const workingDays = Math.floor(totalDays * 0.95); // Assume 95% attendance
          const leaves = totalDays - workingDays;

          const payrollData = {
            clinic_id: req.clinic_id,
            employee_id: employee._id,
            month,
            year,
            base_salary: baseSalary,
            overtime: 0,
            bonus: 0,
            allowances: 0,
            deductions: 0,
            tax: Math.floor(baseSalary * 0.15), // 15% tax
            working_days: workingDays,
            total_days: totalDays,
            leaves,
            status: 'draft' as const
          };

          const payroll = new Payroll(payrollData);
          await payroll.save();

          const populatedPayroll = await Payroll.findById(payroll._id)
            .populate('employee_id', 'first_name last_name email role');

          if (populatedPayroll) {
            generatedPayrolls.push(populatedPayroll);
          }
        } catch (error: any) {
          errors.push(`Failed to generate payroll for ${employee.first_name} ${employee.last_name}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: `Payroll generated for ${generatedPayrolls.length} employees`,
        data: {
          generated: generatedPayrolls,
          errors
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate payroll',
        error: error.message
      });
    }
  }

  // Get payroll statistics
  static async getPayrollStats(req: AuthRequest, res: Response) {
    try {
      const { month, year } = req.query;

      const clinicFilter = { clinic_id: req.clinic_id };
      const query: any = { ...clinicFilter };
      
      if (month) query.month = month;
      if (year) query.year = Number(year);

      const stats = await Payroll.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total_employees: { $sum: 1 },
            total_payroll: { $sum: '$net_salary' },
            paid_entries: {
              $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
            },
            pending_entries: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            draft_entries: {
              $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
            },
            processed_entries: {
              $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] }
            },
            average_salary: { $avg: '$net_salary' },
            total_overtime: { $sum: '$overtime' },
            total_bonus: { $sum: '$bonus' },
            total_deductions: { $sum: '$deductions' },
            total_tax: { $sum: '$tax' }
          }
        }
      ]);

      const departmentStats = await Payroll.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'employee_id',
            foreignField: '_id',
            as: 'employee'
          }
        },
        { $unwind: '$employee' },
        {
          $group: {
            _id: '$employee.role',
            count: { $sum: 1 },
            total_salary: { $sum: '$net_salary' },
            average_salary: { $avg: '$net_salary' }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          overview: stats[0] || {
            total_employees: 0,
            total_payroll: 0,
            paid_entries: 0,
            pending_entries: 0,
            draft_entries: 0,
            processed_entries: 0,
            average_salary: 0,
            total_overtime: 0,
            total_bonus: 0,
            total_deductions: 0,
            total_tax: 0
          },
          by_department: departmentStats
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payroll statistics',
        error: error.message
      });
    }
  }

  // Delete payroll entry
  static async deletePayroll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payroll ID'
        });
        return;
      }

      const payroll = await Payroll.findOne({
        _id: id,
        clinic_id: req.clinic_id
      });

      if (!payroll) {
        res.status(404).json({
          success: false,
          message: 'Payroll entry not found'
        });
        return;
      }

      if (payroll.status === 'paid') {
        res.status(400).json({
          success: false,
          message: 'Cannot delete paid payroll entries'
        });
        return;
      }

      await Payroll.findOneAndDelete({
        _id: id,
        clinic_id: req.clinic_id
      });

      res.json({
        success: true,
        message: 'Payroll entry deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete payroll entry',
        error: error.message
      });
    }
  }
}

// Helper function to convert month name to number
function getMonthNumber(monthName: string): number {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months.indexOf(monthName);
}

export default PayrollController;
