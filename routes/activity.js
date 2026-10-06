import express from 'express'
import Activity from '../models/Activity.js'
import { authMiddleware, requireCEO } from '../middleware/auth.js'

const router = express.Router()

router.get('/', authMiddleware, requireCEO, async (req, res) => {
  try {
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    res.json(activities)
  } catch (error) {
    console.error('Activity fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch activity' })
  }
})

export default router
