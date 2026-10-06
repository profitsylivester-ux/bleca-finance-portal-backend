import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import Document from '../models/Document.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from '../utils/activity.js'

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

const documentTypes = [
  'Receipt',
  'Invoice',
  'Contract',
  'Bank Statement',
  'Payment Voucher',
  'Funding Document',
  'Tax Document',
  'Other',
]

const canManageDocument = (document, user) => {
  return user.role === 'ceo' || String(document.uploadedBy) === String(user.userId)
}

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
    await logActivity(req.user, 'Document uploaded', `${document.originalName} · ${document.type}`)

    res.status(201).json(populated)
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload document' })
  }
})

// PUT update document metadata (uploader or CEO)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }
    if (!canManageDocument(document, req.user)) {
      return res.status(403).json({ error: 'Only the uploader or CEO can edit this document' })
    }

    const { type, description } = req.body
    if (type === undefined && description === undefined) {
      return res.status(400).json({ error: 'No document changes provided' })
    }
    if (type !== undefined && !documentTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid document type' })
    }
    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be text' })
    }

    if (type !== undefined) document.type = type
    if (description !== undefined) document.description = description.trim()
    await document.save()

    const populated = await document.populate('uploadedBy', 'name email')
    await logActivity(req.user, 'Document updated', `${document.originalName} · ${document.type}`)
    res.json(populated)
  } catch (error) {
    console.error('Document update error:', error)
    res.status(500).json({ error: 'Failed to update document' })
  }
})

// DELETE a document and its uploaded file (uploader or CEO)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }
    if (!canManageDocument(document, req.user)) {
      return res.status(403).json({ error: 'Only the uploader or CEO can delete this document' })
    }

    const filePath = path.join(uploadDir, path.basename(document.filename))
    try {
      await fs.promises.unlink(filePath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }

    await document.deleteOne()
    await logActivity(req.user, 'Document deleted', document.originalName)
    res.json({ message: 'Document deleted' })
  } catch (error) {
    console.error('Document delete error:', error)
    res.status(500).json({ error: 'Failed to delete document' })
  }
})

export default router