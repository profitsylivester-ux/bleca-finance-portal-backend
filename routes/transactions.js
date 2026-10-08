import express from 'express'
import Transaction from '../models/Transaction.js'
import { authMiddleware, requireCEO } from '../middleware/auth.js'
import { logActivity } from '../utils/activity.js'

const router = express.Router()

// GET all transactions (auth required)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })

    res.json(transactions)
  } catch (error) {
    console.error('Fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})

// GET dashboard summary (auth required)
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const all = await Transaction.find()

    const approved = all.filter((t) => t.status === 'approved')
    const pending = all.filter((t) => t.status === 'pending')

    const cashPosition = approved.reduce((sum, t) => {
      return t.type === 'income' ? sum + t.amount : sum - t.amount
    }, 0)

    const thisMonth = approved.filter((t) => t.date >= startOfMonth)

    const receivedThisMonth = thisMonth
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const spentThisMonth = thisMonth
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    res.json({
      cashPosition,
      receivedThisMonth,
      spentThisMonth,
      pendingApprovals: pending.length,
    })
  } catch (error) {
    console.error('Summary error:', error)
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

// GET analytics (auth required)
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const period = req.query.period || 'monthly'
    const validPeriods = ['weekly', 'monthly', 'quarterly', 'annual']
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
      })
    }

    const all = await Transaction.find()
    const approved = all.filter((t) => t.status === 'approved')

    const now = new Date()

    // Build a list of bucket keys and start dates for the chosen period
    const buckets = []

    if (period === 'weekly') {
      // Last 8 weeks (week starts on Monday)
      for (let i = 7; i >= 0; i--) {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const day = start.getDay() // 0=Sun ... 6=Sat
        const diffToMonday = (day + 6) % 7
        start.setDate(start.getDate() - diffToMonday - i * 7)
        const end = new Date(start)
        end.setDate(end.getDate() + 7)
        const year = start.getFullYear()
        const week = String(
          Math.ceil(
            ((start - new Date(start.getFullYear(), 0, 1)) / 86400000 +
              new Date(start.getFullYear(), 0, 1).getDay() +
              1) /
              7
          )
        ).padStart(2, '0')
        buckets.push({ label: `${year}-W${week}`, start, end })
      }
    } else if (period === 'monthly') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
        buckets.push({ label, start, end })
      }
    } else if (period === 'quarterly') {
      // Last 4 quarters
      const currentQuarter = Math.floor(now.getMonth() / 3)
      for (let i = 3; i >= 0; i--) {
        const q = currentQuarter - i
        const yearOffset = Math.floor(q / 4)
        const qNorm = ((q % 4) + 4) % 4
        const start = new Date(now.getFullYear() + yearOffset, qNorm * 3, 1)
        const end = new Date(now.getFullYear() + yearOffset, qNorm * 3 + 3, 1)
        buckets.push({
          label: `${start.getFullYear()}-Q${qNorm + 1}`,
          start,
          end,
        })
      }
    } else {
      // annual — last 3 years
      for (let i = 2; i >= 0; i--) {
        const start = new Date(now.getFullYear() - i, 0, 1)
        const end = new Date(now.getFullYear() - i + 1, 0, 1)
        buckets.push({ label: String(start.getFullYear()), start, end })
      }
    }

    // Sum income and expense into each bucket
    const series = buckets.map(({ label, start, end }) => {
      const inBucket = approved.filter((t) => t.date >= start && t.date < end)
      const income = inBucket
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0)
      const expense = inBucket
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)
      return { label, income, expense }
    })

    // Aggregate expenses by category across the whole visible range
    const rangeStart = buckets[0].start
    const rangeEnd = buckets[buckets.length - 1].end
    const inRange = approved.filter(
      (t) => t.date >= rangeStart && t.date < rangeEnd && t.type === 'expense'
    )
    const categoryMap = new Map()
    for (const t of inRange) {
      const key = t.category || 'Other'
      categoryMap.set(key, (categoryMap.get(key) || 0) + t.amount)
    }
    const categories = Array.from(categoryMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)

    res.json({ period, series, categories })
  } catch (error) {
    console.error('Analytics error:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

// POST a new transaction (auth required)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      date,
      description,
      amount,
      currency,
      type,
      category,
      project,
      paymentMethod,
    } = req.body

    if (!date || !description || !amount || !type) {
      return res.status(400).json({
        error: 'Date, description, amount, and type are required',
      })
    }

    const transaction = await Transaction.create({
      date: new Date(date),
      description: description.trim(),
      amount: Number(amount),
      currency: currency || 'TZS',
      type,
      category: category || 'Other',
      project: project || 'General',
      paymentMethod: paymentMethod || 'Cash',
      createdBy: req.user.userId,
      status: 'pending',
    })

    const populated = await transaction.populate('createdBy', 'name email')
    await logActivity(req.user, 'Transaction created', `${transaction.description} · ${transaction.amount} TZS`)

    res.status(201).json(populated)
  } catch (error) {
    console.error('Create error:', error)
    res.status(500).json({ error: 'Failed to create transaction' })
  }
})

// PUT approve a transaction (CEO only)
router.put('/:id/approve', authMiddleware, requireCEO, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending transactions can be approved' })
    }

    transaction.status = 'approved'
    transaction.approvedBy = req.user.userId
    transaction.approvalDate = new Date()

    await transaction.save()
    await logActivity(req.user, 'Transaction approved', `${transaction.description} · ${transaction.amount} TZS`)

    const populated = await transaction
      .populate('createdBy', 'name email')
      .then((t) => t.populate('approvedBy', 'name email'))

    res.json(populated)
  } catch (error) {
    console.error('Approve error:', error)
    res.status(500).json({ error: 'Failed to approve' })
  }
})

// PUT reject a transaction (CEO only)
router.put('/:id/reject', authMiddleware, requireCEO, async (req, res) => {
  try {
    const { reason } = req.body
    const transaction = await Transaction.findById(req.params.id)

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending transactions can be rejected' })
    }

    transaction.status = 'rejected'
    transaction.approvedBy = req.user.userId
    transaction.approvalDate = new Date()
    const rejectionReason = typeof reason === 'string' ? reason.trim() : ''
    transaction.rejectionReason = rejectionReason || 'No reason provided'

    await transaction.save()
    await logActivity(
      req.user,
      'Transaction rejected',
      `${transaction.description} · Reason: ${transaction.rejectionReason}`
    )

    const populated = await transaction
      .populate('createdBy', 'name email')
      .then((t) => t.populate('approvedBy', 'name email'))

    res.json(populated)
  } catch (error) {
    console.error('Reject error:', error)
    res.status(500).json({ error: 'Failed to reject' })
  }
})

export default router