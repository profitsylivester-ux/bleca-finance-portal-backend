import mongoose from 'mongoose'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import Transaction from './models/Transaction.js'
import Document from './models/Document.js'
import Activity from './models/Activity.js'
import User from './models/User.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, 'uploads')

async function reset() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB')

    const before = {
      transactions: await Transaction.countDocuments(),
      documents: await Document.countDocuments(),
      activities: await Activity.countDocuments(),
      users: await User.countDocuments(),
    }

    console.log('--- Before ---')
    console.log(before)

    // Wipe all portal data (numbers, documents, activity log).
    // Users (login accounts) are intentionally kept.
    const deleted = {
      transactions: (await Transaction.deleteMany({})).deletedCount,
      documents: (await Document.deleteMany({})).deletedCount,
      activities: (await Activity.deleteMany({})).deletedCount,
    }

    // Remove uploaded files from disk as well
    let uploadedFiles = 0
    if (fs.existsSync(uploadsDir)) {
      for (const file of fs.readdirSync(uploadsDir)) {
        fs.unlinkSync(path.join(uploadsDir, file))
        uploadedFiles++
      }
    }

    const after = {
      transactions: await Transaction.countDocuments(),
      documents: await Document.countDocuments(),
      activities: await Activity.countDocuments(),
      users: await User.countDocuments(),
    }

    console.log('--- Deleted ---')
    console.log(deleted)
    console.log(`Uploaded files removed: ${uploadedFiles}`)
    console.log('--- After ---')
    console.log(after)

    console.log('Reset complete. Portal data is now empty — users kept for login.')

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('Reset error:', error)
    process.exit(1)
  }
}

reset()