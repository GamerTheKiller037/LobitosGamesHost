// server/models/Session.js
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    deviceInfo: { type: String },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL automático
module.exports = mongoose.model("Session", sessionSchema);

// ─────────────────────────────────────────────────────────────

// server/models/RefreshToken.js
const mongoose2 = require("mongoose");

const refreshTokenSchema = new mongoose2.Schema(
  {
    userId: {
      type: mongoose2.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: { type: String, required: true },
    sessionId: { type: mongoose2.Schema.Types.ObjectId, ref: "Session" },
    revoked: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose2.model("RefreshToken", refreshTokenSchema);
