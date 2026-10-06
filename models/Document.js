import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      'Receipt',
      'Invoice',
      'Contract',
      'Bank Statement',
      'Payment Voucher',
      'Funding Document',
      'Tax Document',
      'Other',
    ],
    default: 'Other',
  },
  description: {
    type: String,
    default: '',
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
})

export default mongoose.model('Document', documentSchema)