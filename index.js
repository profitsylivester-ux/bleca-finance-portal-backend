import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes from './routes/auth.js'
import transactionRoutes from './routes/transactions.js'
import documentRoutes from './routes/documents.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(cors())
app.use(express.json())

// Serve uploaded files (for CEO and Finance Lead to download)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err))

// Routes
app.get('/', (req, res) => {
  res.send('BLECA Finance portal backend is running.')
})

app.use('/auth', authRoutes)
app.use('/transactions', transactionRoutes)
app.use('/documents', documentRoutes)

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})