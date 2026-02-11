const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: function () {
        return this.provider !== "google";
      },
    },

    phone: {
      type: String,
      validate: {
        validator: (v) => !v || /^[0-9]{10}$/.test(v),
        message: "Phone number must be exactly 10 digits",
      },
    },

    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
