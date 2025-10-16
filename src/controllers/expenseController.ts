import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Expense, User } from '../models';
import { AuthRequest } from '../types/express';
import mongoose from 'mongoose';

export class ExpenseController {
  // Create a new expense
  static async createExpense(req: AuthRequest, res: Response): Promise<void> {
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

      const expenseData = {
        ...req.body,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id,
        created_by: req.user?.id
      };
      
      const expense = new Expense(expenseData);
      await expense.save();

      const populatedExpense = await Expense.findById(expense._id)
        .populate('created_by', 'first_name last_name email role');

      res.status(201).json({
        success: true,
        message: 'Expense created successfully',
        data: populatedExpense
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create expense',
        error: error.message
      });
    }
  }

  // Get all expenses with filters
  static async getAllExpenses(req: AuthRequest, res: Response) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        category,
        status, 
        vendor,
        payment_method,
        start_date, 
        end_date,
        search
      } = req.query;

      const query: any = {
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      };
      
      if (category) query.category = category;
      if (status) query.status = status;
      if (vendor) query.vendor = { $regex: vendor, $options: 'i' };
      if (payment_method) query.payment_method = payment_method;
      
      if (start_date || end_date) {
        query.date = {};
        if (start_date) query.date.$gte = new Date(start_date as string);
        if (end_date) query.date.$lte = new Date(end_date as string);
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const expenses = await Expense.find(query)
        .populate('created_by', 'first_name last_name email role')
        .sort({ date: -1, created_at: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Expense.countDocuments(query);

      res.json({
        success: true,
        data: {
          items: expenses,
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
        message: 'Failed to fetch expenses',
        error: error.message
      });
    }
  }

  // Get expense by ID
  static async getExpenseById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid expense ID'
        });
        return;
      }

      const expense = await Expense.findOne({
        _id: id,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      }).populate('created_by', 'first_name last_name email role');

      if (!expense) {
        res.status(404).json({
          success: false,
          message: 'Expense not found'
        });
        return;
      }

      res.json({
        success: true,
        data: expense
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expense',
        error: error.message
      });
    }
  }

  // Update expense
  static async updateExpense(req: AuthRequest, res: Response): Promise<void> {
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

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid expense ID'
        });
        return;
      }

      const expense = await Expense.findOneAndUpdate(
        { _id: id, tenant_id: req.tenant_id, clinic_id: req.clinic_id },
        req.body,
        { new: true, runValidators: true }
      ).populate('created_by', 'first_name last_name email role');

      if (!expense) {
        res.status(404).json({
          success: false,
          message: 'Expense not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Expense updated successfully',
        data: expense
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update expense',
        error: error.message
      });
    }
  }

  // Delete expense
  static async deleteExpense(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid expense ID'
        });
        return;
      }

      const expense = await Expense.findOneAndDelete({
        _id: id,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      });

      if (!expense) {
        res.status(404).json({
          success: false,
          message: 'Expense not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Expense deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete expense',
        error: error.message
      });
    }
  }

  // Get expense statistics
  static async getExpenseStats(req: AuthRequest, res: Response) {
    try {
      const { start_date, end_date } = req.query;
      
      // Convert clinic_id to ObjectId for proper matching in aggregation
      const clinicObjectId = typeof req.clinic_id === 'string' 
        ? new mongoose.Types.ObjectId(req.clinic_id)
        : req.clinic_id;
      
      const dateFilter: any = {
        clinic_id: clinicObjectId
      };
      if (start_date || end_date) {
        dateFilter.date = {};
        if (start_date) dateFilter.date.$gte = new Date(start_date as string);
        if (end_date) dateFilter.date.$lte = new Date(end_date as string);
      }

      // Get current month dates for monthly expense calculation
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [totalStats, monthlyStats, categoryStats, statusStats] = await Promise.all([
        // Total stats calculation
        Expense.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: null,
              total_expenses: { $sum: 1 },
              total_amount: { $sum: '$amount' },
              pending_expenses: {
                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
              },
              paid_expenses: {
                $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
              },
              cancelled_expenses: {
                $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
              },
              pending_amount: {
                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
              },
              paid_amount: {
                $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
              }
            }
          }
        ]),
        // Current month expenses calculation
        Expense.aggregate([
          { 
            $match: { 
              clinic_id: clinicObjectId,
              date: { 
                $gte: startOfMonth,
                $lt: startOfNextMonth
              }
            } 
          },
          {
            $group: {
              _id: null,
              monthly_total: { $sum: '$amount' },
              monthly_count: { $sum: 1 }
            }
          }
        ]),
        // Category-wise breakdown
        Expense.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              total_amount: { $sum: '$amount' },
              average_amount: { $avg: '$amount' }
            }
          },
          { $sort: { total_amount: -1 } }
        ]),
        // Status-wise breakdown
        Expense.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              total_amount: { $sum: '$amount' }
            }
          }
        ])
      ]);

      // Recent expenses trend (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyTrend = await Expense.aggregate([
        { 
          $match: { 
            clinic_id: clinicObjectId,
            date: { $gte: sixMonthsAgo }
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' }
            },
            total_amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            ...(totalStats[0] || {
              total_expenses: 0,
              total_amount: 0,
              pending_expenses: 0,
              paid_expenses: 0,
              cancelled_expenses: 0,
              pending_amount: 0,
              paid_amount: 0
            }),
            monthly_total: monthlyStats[0]?.monthly_total || 0,
            monthly_count: monthlyStats[0]?.monthly_count || 0
          },
          by_category: categoryStats,
          by_status: statusStats,
          monthly_trend: monthlyTrend
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expense statistics',
        error: error.message
      });
    }
  }

  // Bulk create expenses
  static async bulkCreateExpenses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { expenses } = req.body;

      if (!Array.isArray(expenses) || expenses.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Expenses array is required and cannot be empty'
        });
        return;
      }

      const expenseData = expenses.map(expense => ({
        ...expense,
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id,
        created_by: req.user?.id
      }));

      const createdExpenses = await Expense.insertMany(expenseData);

      res.status(201).json({
        success: true,
        message: `${createdExpenses.length} expenses created successfully`,
        data: {
          count: createdExpenses.length,
          expenses: createdExpenses
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create bulk expenses',
        error: error.message
      });
    }
  }

  // Get expense categories summary
  static async getExpenseCategories(req: AuthRequest, res: Response) {
    try {
      const categories = [
        'supplies', 'equipment', 'utilities', 'maintenance', 
        'staff', 'marketing', 'insurance', 'rent', 'other'
      ];

      // Convert clinic_id to ObjectId for proper matching in aggregation
      const clinicObjectId = typeof req.clinic_id === 'string' 
        ? new mongoose.Types.ObjectId(req.clinic_id)
        : req.clinic_id;

      const categoryStats = await Expense.aggregate([
        { $match: { clinic_id: clinicObjectId } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            total_amount: { $sum: '$amount' },
            last_expense_date: { $max: '$date' }
          }
        }
      ]);

      // Add categories with zero counts
      const allCategories = categories.map(category => {
        const stat = categoryStats.find(s => s._id === category);
        return {
          category,
          count: stat?.count || 0,
          total_amount: stat?.total_amount || 0,
          last_expense_date: stat?.last_expense_date || null
        };
      });

      res.json({
        success: true,
        data: allCategories
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expense categories',
        error: error.message
      });
    }
  }

  // Get recent expenses
  static async getRecentExpenses(req: AuthRequest, res: Response) {
    try {
      const { limit = 5 } = req.query;

      const recentExpenses = await Expense.find({
        tenant_id: req.tenant_id,
        clinic_id: req.clinic_id
      })
        .populate('created_by', 'first_name last_name')
        .sort({ created_at: -1 })
        .limit(Number(limit));

      res.json({
        success: true,
        data: recentExpenses
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent expenses',
        error: error.message
      });
    }
  }
}

export default ExpenseController;
