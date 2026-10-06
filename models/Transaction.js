import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'TZS',
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true,
  },
  category: {
    type: String,
    default: 'Other',
  },
  project: {
    type: String,
    default: 'General',
  },
  paymentMethod: {
    type: String,
    default: 'Cash',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  approvalDate: {
    type: Date,
    default: null,
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

export default mongoose.model('Transaction', transactionSchema)