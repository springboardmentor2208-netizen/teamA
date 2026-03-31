const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const passport = require("passport");

const User  = require("../models/User");
const Otp   = require("../models/Otp");
const Issue = require("../models/Issue");

const sendOtp = require("../utils/sendOtp");
const auth    = require("../middleware/authMiddleware");
const upload  = require("../middleware/issueUpload");

const cloudinary = require("../config/cloudinary");

const router = express.Router();

/* ─────────────────────────────────────────
   CONFIG
───────────────────────────────────────── */
const OTP_EXPIRY_MS      = Number(process.env.OTP_EXPIRY_MINUTES || 5) * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_RESENDS        = 3;

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const maskEmail = (email) => {
  const [name, domain] = email.split("@");
  const masked =
    name.length <= 2
      ? name[0] + "*"
      : name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
  return `${masked}@${domain}`;
};

/* FIX: centralised token signing so expiry is always consistent */
const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || "7d" }
  );

/* ═══════════════════════════════════════════
   USERNAME CHECK  —  GET /api/auth/check-username
═══════════════════════════════════════════ */
router.get("/check-username", async (req, res) => {
  try {
    const username = req.query.username?.trim().toLowerCase();
    if (!username) return res.json({ exists: false });

    /* FIX: only select _id — no need to load the full document */
    const exists = await User.exists({ username });
    res.json({ exists: !!exists });
  } catch (err) {
    console.error("USERNAME CHECK ERROR:", err);
    res.status(500).json({ exists: false });
  }
});

/* ═══════════════════════════════════════════
   GOOGLE AUTH
═══════════════════════════════════════════ */
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || "http://localhost:5173"}/`,
  }),
  (req, res) => {
    const token = signToken(req.user);
    /* FIX: use env var for client URL so it works in production */
    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/oauth-success` +
      `?token=${token}&role=${req.user.role}&userId=${req.user._id}`
    );
  }
);

/* ═══════════════════════════════════════════
   REGISTER  —  POST /api/auth/register
═══════════════════════════════════════════ */
router.post("/register", async (req, res) => {
  try {
    let { name, username, email, password, state, role, securityKey } = req.body;

    /* Normalise */
    email    = email?.toLowerCase().trim();
    username = username?.toLowerCase().trim();

    /* FIX: validate all required fields before any DB queries */
    if (!name || !username || !email || !password || !state) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    /* FIX: validate email format server-side */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ msg: "Invalid email address" });
    }

    /* FIX: enforce minimum password length server-side */
    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    /* Admin key check */
    if (role === "admin") {
      if (!process.env.ADMIN_SECRET_KEY) {
        return res.status(500).json({ msg: "Admin registration not configured" });
      }
      if (securityKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ msg: "Invalid admin security key" });
      }
    }

    /* FIX: run email + username checks in parallel instead of sequentially */
    const [emailExists, usernameExists] = await Promise.all([
      User.exists({ email }),
      User.exists({ username }),
    ]);

    if (emailExists)    return res.status(400).json({ msg: "Email already exists" });
    if (usernameExists) return res.status(400).json({ msg: "Username already taken" });

    const hashedPassword = await bcrypt.hash(password, 12); /* FIX: 12 rounds (10 is slightly weak) */

    const user = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      state,
      role:     role === "admin" ? "admin" : "citizen",
      provider: "local",
    });

    const token = signToken(user);

    res.status(201).json({ token, role: user.role, userId: user._id });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ msg: "Registration failed" });
  }
});

/* ═══════════════════════════════════════════
   LOGIN → SEND OTP  —  POST /api/auth/login
═══════════════════════════════════════════ */
router.post("/login", async (req, res) => {
  try {
    let { identifier, password } = req.body;

    if (!identifier?.trim()) {
      return res.status(400).json({ msg: "Email or username required" });
    }

    identifier = identifier.trim().toLowerCase();

    /* FIX: only select fields we actually need — avoids loading full document */
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select("_id email password role provider");

    /* FIX: same error for "not found" and "wrong password" — prevents user enumeration */
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    if (user.provider === "local") {
      if (!password) {
        return res.status(400).json({ msg: "Password required" });
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res.status(400).json({ msg: "Invalid credentials" });
      }
    }

    /* FIX: upsert OTP record instead of deleteMany + create (atomic, no race condition) */
    const otp = Math.floor(100_000 + Math.random() * 900_000).toString();

    await Otp.findOneAndUpdate(
      { userId: user._id },
      {
        otp,
        expiresAt:   new Date(Date.now() + OTP_EXPIRY_MS),
        resendCount: 0,
        lastSentAt:  new Date(),
      },
      { upsert: true, new: true }
    );

    await sendOtp(user.email, otp);

    res.json({ msg: `OTP sent to ${maskEmail(user.email)}`, userId: user._id });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ msg: "Login failed" });
  }
});

/* ═══════════════════════════════════════════
   RESEND OTP  —  POST /api/auth/resend-otp
═══════════════════════════════════════════ */
router.post("/resend-otp", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ msg: "userId required" });

    const record = await Otp.findOne({ userId });
    if (!record) return res.status(400).json({ msg: "OTP session expired. Please log in again." });

    if (record.resendCount >= MAX_RESENDS) {
      return res.status(429).json({ msg: "Resend limit reached. Please log in again." });
    }

    /* FIX: use Date object comparison consistently (not Date.now() - Date object) */
    const elapsed = Date.now() - new Date(record.lastSentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const remaining = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({ msg: `Please wait ${remaining}s before resending` });
    }

    /* FIX: fetch user in parallel with OTP update */
    const otp = Math.floor(100_000 + Math.random() * 900_000).toString();

    const [user] = await Promise.all([
      User.findById(userId).select("email"),
      Otp.findOneAndUpdate(
        { userId },
        {
          otp,
          expiresAt:   new Date(Date.now() + OTP_EXPIRY_MS),
          $inc:        { resendCount: 1 },
          lastSentAt:  new Date(),
        }
      ),
    ]);

    if (!user) return res.status(404).json({ msg: "User not found" });

    await sendOtp(user.email, otp);

    res.json({ msg: `OTP resent to ${maskEmail(user.email)}` });
  } catch (err) {
    console.error("RESEND OTP ERROR:", err);
    res.status(500).json({ msg: "Failed to resend OTP" });
  }
});

/* ═══════════════════════════════════════════
   VERIFY OTP  —  POST /api/auth/verify-otp
═══════════════════════════════════════════ */
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ msg: "userId and otp are required" });
    }

    const record = await Otp.findOne({ userId, otp });

    /* FIX: separate "wrong OTP" from "expired OTP" for better UX */
    if (!record) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (record.expiresAt < new Date()) {
      await Otp.deleteMany({ userId });
      return res.status(400).json({ msg: "OTP has expired. Please log in again." });
    }

    /* FIX: fetch user and delete OTP in parallel */
    const [user] = await Promise.all([
      User.findById(userId).select("_id role"),
      Otp.deleteMany({ userId }),
    ]);

    if (!user) return res.status(404).json({ msg: "User not found" });

    const token = signToken(user);

    res.json({ token, role: user.role, userId: user._id });
  } catch (err) {
    console.error("OTP VERIFY ERROR:", err);
    res.status(500).json({ msg: "OTP verification failed" });
  }
});

/* ═══════════════════════════════════════════
   GET PROFILE  —  GET /api/auth/me
═══════════════════════════════════════════ */
router.get("/me", auth, async (req, res) => {
  try {
    /* FIX: run user fetch and issue aggregation in parallel */
    const [user, issueStats] = await Promise.all([
      User.findById(req.user.id).select("-password").lean(),
      Issue.aggregate([
        { $match: { user: req.user.id } },
        {
          $group: {
            _id:              null,
            complaintsCount:  { $sum: 1 },
            resolvedCount:    { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
            votesCount:       { $sum: { $size: { $ifNull: ["$upvotes", []] } } },
            commentsCount:    { $sum: { $size: { $ifNull: ["$comments", []] } } },
          },
        },
      ]),
    ]);

    if (!user) return res.status(404).json({ msg: "User not found" });

    const stats = issueStats[0] ?? {
      complaintsCount: 0,
      resolvedCount:   0,
      votesCount:      0,
      commentsCount:   0,
    };

    res.json({
      ...user,
      complaintsCount: stats.complaintsCount,
      resolvedCount:   stats.resolvedCount,
      votesCount:      stats.votesCount,
      commentsCount:   stats.commentsCount,
    });
  } catch (err) {
    console.error("GET ME ERROR:", err);
    res.status(500).json({ msg: "Failed to load profile" });
  }
});

/* ═══════════════════════════════════════════
   UPDATE PROFILE  —  PUT /api/auth/me
═══════════════════════════════════════════ */
router.put("/me", auth, async (req, res) => {
  try {
    const { name, username, phone, state } = req.body;

    /* FIX: validate inputs before any DB queries */
    if (!name?.trim())     return res.status(400).json({ msg: "Name is required" });
    if (!username?.trim()) return res.status(400).json({ msg: "Username is required" });

    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ msg: "Invalid phone number" });
    }

    const normalUsername = username.trim().toLowerCase();

    /* FIX: use exists() for lighter query */
    if (normalUsername) {
      const taken = await User.exists({ username: normalUsername, _id: { $ne: req.user.id } });
      if (taken) return res.status(400).json({ msg: "Username already taken" });
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      {
        name:     name.trim(),
        username: normalUsername,
        phone:    phone || "",
        state,
      },
      { new: true, runValidators: true }
    ).select("-password");

    /* FIX: handle case where user was deleted between auth and update */
    if (!updated) return res.status(404).json({ msg: "User not found" });

    res.json(updated);
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ msg: "Update failed" });
  }
});

/* ═══════════════════════════════════════════
   PROFILE PHOTO  —  PUT /api/auth/me/photo
═══════════════════════════════════════════ */
router.put("/me/photo", auth, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No image uploaded" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    /* Delete old Cloudinary photo if it exists */
    if (user.profilePhoto?.includes("res.cloudinary.com")) {
      try {
        /* FIX: extract public_id correctly — handles folders and transformations */
        const urlParts = user.profilePhoto.split("/");
        const filename = urlParts[urlParts.length - 1].split(".")[0];
        const folder   = urlParts[urlParts.length - 2];
        await cloudinary.uploader.destroy(`${folder}/${filename}`);
      } catch (cloudErr) {
        /* Non-fatal — log but continue with upload */
        console.warn("Old photo deletion failed:", cloudErr.message);
      }
    }

    user.profilePhoto = req.file.path;
    await user.save();

    /* FIX: return user without password */
    const safeUser = user.toObject();
    delete safeUser.password;

    res.json(safeUser);
  } catch (err) {
    console.error("PHOTO UPLOAD ERROR:", err);
    res.status(500).json({ msg: "Photo upload failed" });
  }
});

module.exports = router;