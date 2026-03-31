const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    username: {
      type:      String,
      unique:    true,
      required:  true,
      lowercase: true,
      trim:      true,
      match: [/^[a-z0-9_]{3,30}$/, "Username must be 3–30 chars: letters, numbers, underscores"],
    },

    email: {
      type:      String,
      unique:    true,
      required:  true,
      lowercase: true,
      trim:      true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },

    password: {
      type:     String,
      required: function () { return this.provider === "local"; },
      /* Never returned by default — routes that need it use .select("+password") */
      select:   false,
    },

    state: {
      type:     String,
      required: function () { return this.provider === "local"; },
      trim:     true,
    },

    role: {
      type:    String,
      enum:    ["citizen", "admin"],
      default: "citizen",
    },

    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^[0-9]{10}$/.test(v),
        message:   "Phone number must be exactly 10 digits",
      },
    },

    provider: {
      type:    String,
      enum:    ["local", "google"],
      default: "local",
    },

    profilePhoto: {
      type:    String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* Indexes */
userSchema.index({ email: 1, username: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);