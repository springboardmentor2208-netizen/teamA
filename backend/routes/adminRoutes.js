const express = require("express");
const router  = express.Router();

const Issue = require("../models/Issue");
const User  = require("../models/User");
const auth  = require("../middleware/authMiddleware");

/* ─────────────────────────────────────────
   MIDDLEWARE: reusable admin guard
   FIX: was copy-pasted in every route — centralise it
───────────────────────────────────────── */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ msg: "Admin access required" });
  }
  next();
};

/* Apply auth + adminOnly to every route in this file */
router.use(auth, adminOnly);

/* ═══════════════════════════════════════════
   ANALYTICS  —  GET /api/admin/analytics
═══════════════════════════════════════════ */
router.get("/analytics", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    /* FIX: run all independent queries in parallel — was sequential before */
    const [
      totalComplaints,
      pending,
      users,
      resolvedToday,
      issueTypeStats,
      weeklyRaw,
    ] = await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: "pending" }),
      User.countDocuments(),
      Issue.countDocuments({ status: "resolved", updatedAt: { $gte: today } }),
      Issue.aggregate([
        { $group:   { _id: "$issueType", count: { $sum: 1 } } },
        { $sort:    { count: -1 } },
        { $limit:   6 },
        { $project: { _id: 0, name: "$_id", count: 1 } },
      ]),
      Issue.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id:      { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            reported: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    /* Build full 7-day array even for days with no data */
    const DAY_LABELS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyTrend = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key   = d.toISOString().slice(0, 10);
      const found = weeklyRaw.find((r) => r._id === key);
      weeklyTrend.push({
        day:      DAY_LABELS[d.getDay()],
        reported: found?.reported ?? 0,
        resolved: found?.resolved ?? 0,
      });
    }

    res.json({ totalComplaints, pending, users, resolvedToday, issueTypeStats, weeklyTrend });
  } catch (err) {
    console.error("ADMIN ANALYTICS ERROR:", err);
    res.status(500).json({
      totalComplaints: 0, pending: 0, users: 0, resolvedToday: 0,
      issueTypeStats: [], weeklyTrend: [],
    });
  }
});

/* ═══════════════════════════════════════════
   ALL USERS  —  GET /api/admin/users
═══════════════════════════════════════════ */
router.get("/users", async (req, res) => {
  try {
    /* FIX: use aggregation to JOIN users + issue counts in one DB round-trip
       instead of fetching all issues into memory and mapping them in JS */
    const users = await User.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from:         "issues",
          localField:   "_id",
          foreignField: "user",
          as:           "issues",
          pipeline: [
            {
              $project: {
                _id:       1,
                issueType: 1,
                status:    1,
                priority:  1,
                address:   1,
                createdAt: 1,
                upvotes:   1,
                /* FIX: only return comment IDs, not full comment objects */
                comments: { $map: { input: "$comments", as: "c", in: "$$c._id" } },
              },
            },
          ],
        },
      },
      /* FIX: never return password to frontend */
      { $project: { password: 0 } },
    ]);

    res.json(users);
  } catch (err) {
    console.error("ADMIN USERS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch users" });
  }
});

/* ═══════════════════════════════════════════
   REPORTS  —  GET /api/admin/reports
═══════════════════════════════════════════ */

const PRIORITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

/* FIX: add pagination to avoid loading thousands of documents at once */
const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 50;

router.get("/reports", async (req, res) => {
  try {
    const {
      status,
      priority,
      issueType,
      dateFrom,
      dateTo,
      sort      = "newest",
      page      = DEFAULT_PAGE,
      limit     = DEFAULT_LIMIT,
    } = req.query;

    /* Build filter */
    const filter = {};
    if (status    && status    !== "all") filter.status    = status;
    if (priority  && priority  !== "all") filter.priority  = priority;
    if (issueType && issueType !== "all") filter.issueType = issueType;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    /* Build sort — priority sort still needs in-memory sort (no native MongoDB field) */
    let mongoSort = { createdAt: -1 };
    if (sort === "oldest") mongoSort = { createdAt: 1 };
    /* FIX: sort by upvotes array size using aggregation-compatible sort */
    if (sort === "votes")  mongoSort = { upvotesCount: -1, createdAt: -1 };

    const pageNum  = Math.max(1, parseInt(page)  || DEFAULT_PAGE);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));
    const skip     = (pageNum - 1) * limitNum;

    /* FIX: run data query and count in parallel */
    const [issues, totalCount] = await Promise.all([
      Issue.find(filter)
        .populate("user", "name email state")
        .sort(sort === "votes" ? { createdAt: -1 } : mongoSort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Issue.countDocuments(filter),
    ]);

    /* In-memory priority sort (only on the current page) */
    if (sort === "priority") {
      issues.sort((a, b) =>
        (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0)
      );
    }

    /* FIX: votes sort needs upvotes length — compute after fetch */
    if (sort === "votes") {
      issues.sort((a, b) =>
        (b.upvotes?.length ?? 0) - (a.upvotes?.length ?? 0)
      );
    }

    /* Summary stats on filtered set (counts only — no heavy data) */
    const [summaryStats, byTypeRaw] = await Promise.all([
      Issue.aggregate([
        { $match: filter },
        {
          $group: {
            _id:        null,
            total:      { $sum: 1 },
            resolved:   { $sum: { $cond: [{ $eq: ["$status",   "resolved"]   }, 1, 0] } },
            pending:    { $sum: { $cond: [{ $eq: ["$status",   "pending"]    }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ["$status",   "in-progress"]}, 1, 0] } },
            critical:   { $sum: { $cond: [{ $eq: ["$priority", "critical"]   }, 1, 0] } },
          },
        },
      ]),
      Issue.aggregate([
        { $match: filter },
        { $group:   { _id: "$issueType", count: { $sum: 1 } } },
        { $sort:    { count: -1 } },
        { $limit:   8 },
        { $project: { _id: 0, name: "$_id", count: 1 } },
      ]),
    ]);

    const summary = summaryStats[0] ?? {
      total: 0, resolved: 0, pending: 0, inProgress: 0, critical: 0,
    };
    delete summary._id;

    res.json({
      issues,
      summary,
      byType:     byTypeRaw,
      pagination: {
        page:       pageNum,
        limit:      limitNum,
        total:      totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    console.error("ADMIN REPORTS ERROR:", err);
    res.status(500).json({ msg: "Failed to generate report", issues: [], summary: {}, byType: [] });
  }
});

/* ═══════════════════════════════════════════
   REPORT SUMMARY STATS  —  GET /api/admin/reports/summary
═══════════════════════════════════════════ */
router.get("/reports/summary", async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    /* FIX: run all three aggregations in parallel */
    const [summaryRaw, monthlyRaw, topTypes] = await Promise.all([
      Issue.aggregate([
        {
          $group: {
            _id:        null,
            total:      { $sum: 1 },
            resolved:   { $sum: { $cond: [{ $eq: ["$status",   "resolved"]   }, 1, 0] } },
            pending:    { $sum: { $cond: [{ $eq: ["$status",   "pending"]    }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ["$status",   "in-progress"]}, 1, 0] } },
            critical:   { $sum: { $cond: [{ $eq: ["$priority", "critical"]   }, 1, 0] } },
          },
        },
      ]),
      Issue.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id:      { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            reported: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Issue.aggregate([
        { $group:   { _id: "$issueType", count: { $sum: 1 } } },
        { $sort:    { count: -1 } },
        { $limit:   5 },
        { $project: { _id: 0, name: "$_id", count: 1 } },
      ]),
    ]);

    /* Build 6-month array with zero-fill for missing months */
    const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun",
                          "Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyTrend = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key   = d.toISOString().slice(0, 7);
      const found = monthlyRaw.find((r) => r._id === key);
      monthlyTrend.push({
        month:    MONTH_LABELS[d.getMonth()],
        reported: found?.reported ?? 0,
        resolved: found?.resolved ?? 0,
      });
    }

    const summary = summaryRaw[0] ?? {
      total: 0, resolved: 0, pending: 0, inProgress: 0, critical: 0,
    };
    delete summary._id;

    res.json({ summary, monthlyTrend, topTypes });
  } catch (err) {
    console.error("REPORTS SUMMARY ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch report summary" });
  }
});

module.exports = router;