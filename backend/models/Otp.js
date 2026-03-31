const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      unique:   true, // one OTP record per user at a time
    },

    otp: {
      type:     String,
      required: true,
    },

    expiresAt: {
      type:     Date,
      required: true,
    },

    resendCount: {
      type:    Number,
      default: 0,
    },

    lastSentAt: {
      type:    Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

/* TTL index — MongoDB auto-deletes expired OTP documents ~60s after expiresAt */
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 });
otpSchema.index({ userId: 1 });

module.exports = mongoose.model("Otp", otpSchema);