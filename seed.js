import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import User from './models/User.js'

dotenv.config()

const users = [
  {
    email: 'chris@blecasmartlabs.com',
    password: 'ChangeMe2026!',
    name: 'Chris Bwesa',
    role: 'ceo',
  },
  {
    email: 'faida@blecasmartlabs.com',
    password: 'ChangeMe2026!',
    name: 'Faida Sylivester',
    role: 'finance_lead',
  },
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB')

    for (const user of users) {
      const existing = await User.findOne({ email: user.email })

      if (existing) {
        console.log(`User ${user.email} already exists — skipping`)
        continue
      }

      const hashed = await bcrypt.hash(user.password, 10)
      await User.create({
        email: user.email,
        password: hashed,
        name: user.name,
        role: user.role,
      })

      console.log(`Created user: ${user.email} (${user.role})`)
    }

    console.log('Done.')
    process.exit(0)
  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  }
}

seed()