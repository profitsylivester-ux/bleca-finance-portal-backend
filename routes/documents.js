import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import Document from '../models/Document.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadDir = path.join(__dirname, '..', 'uploads')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, unique + ext)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
})

// GET all documents
router.get('/', authMiddleware, async (req, res) => {
  try {
    const documents = await Document.find()
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 })

    res.json(documents)
  } catch (error) {
    console.error('Fetch documents error:', error)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
})

// POST upload a document
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { type, description, transactionId } = req.body

    const document = await Document.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      type: type || 'Other',
      description: description || '',
      transactionId: transactionId || null,
      uploadedBy: req.user.userId,
    })

    const populated = await document.populate('uploadedBy', 'name email')

    res.status(201).json(populated)
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload document' })
  }
})

export default router