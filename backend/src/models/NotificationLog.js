const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    event: { type: String, required: true, index: true },
    channel: { type: String, enum: ['email', 'push'], required: true },
    dedupeKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: '' },
    providerMessageId: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

notificationLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
