import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Failed to log in' })
  }
})

// GET CURRENT USER (for token verification)
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    user: {
      userId: req.user.userId,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    },
  })
})

export default router