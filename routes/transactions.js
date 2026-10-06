import express from 'express'
import Transaction from '../models/Transaction.js'
import { authMiddleware, requireCEO } from '../middleware/auth.js'

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

// POST a new transaction (auth required)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      date,
      description,
      amount,
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
      type,
      category: category || 'Other',
      project: project || 'General',
      paymentMethod: paymentMethod || 'Cash',
      createdBy: req.user.userId,
      status: 'pending',
    })

    const populated = await transaction.populate('createdBy', 'name email')

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
    transaction.rejectionReason = reason || 'No reason provided'

    await transaction.save()

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