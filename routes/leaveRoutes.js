
const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Leave = require("../models/Leave");

// Convert date into UTC midnight
function normalizeDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return null;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
        isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        return null;
    }

    return date;
}

// Calculate total leave days
function calculateDays(fromDate, toDate) {
    return Math.round(
        (toDate.getTime() - fromDate.getTime()) / 86400000
    ) + 1;
}

// Register employee
router.post("/register", async (req, res) => {
    try {
        const {
            username,
            email,
            rollNumber,
            casualLeave = 10,
            medicalLeave = 10
        } = req.body;

        if (
            !username?.trim() ||
            !email?.trim() ||
            !rollNumber?.trim()
        ) {
            return res.status(400).json({
                message: "Please fill in all required fields"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                message: "Invalid email format"
            });
        }

        const casual = Number(casualLeave);
        const medical = Number(medicalLeave);

        if (
            !Number.isInteger(casual) ||
            !Number.isInteger(medical) ||
            casual < 0 ||
            medical < 0 ||
            casual > 365 ||
            medical > 365
        ) {
            return res.status(400).json({
                message: "Leave balance must be between 0 and 365"
            });
        }

        const existingUser = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists with this email"
            });
        }

        await User.create({
            username: username.trim(),
            email: email.trim().toLowerCase(),
            rollNumber: rollNumber.trim(),
            casualLeave: casual,
            medicalLeave: medical
        });

        res.status(201).json({
            message: "User registered successfully"
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: "Email already registered"
            });
        }

        console.error("Registration error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
});

// Employee login using email
router.post("/login", async (req, res) => {
    try {
        const email = req.body.email;

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                message: "Please enter your email"
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found. Please register first."
            });
        }

        if (user.role === "admin") {
            return res.status(403).json({
                message: "Please use Admin Login"
            });
        }

        res.json({
            message: "Login successful",
            userId: user._id,
            username: user.username,
            rollNumber: user.rollNumber,
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
});

// Get employee leave balance
router.get("/leave-balance/:id", async (req, res) => {
    try {
        if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave
        });

    } catch (error) {
        console.error("Balance error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
});

// Apply for leave
router.post("/apply-leave/:id", async (req, res) => {
    try {
        const { type, fromDate, toDate } = req.body;

        if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        if (!["casual", "medical"].includes(type)) {
            return res.status(400).json({
                message: "Invalid leave type"
            });
        }

        const start = normalizeDate(fromDate);
        const end = normalizeDate(toDate);

        if (!start || !end) {
            return res.status(400).json({
                message: "Please select valid dates"
            });
        }

        if (end < start) {
            return res.status(400).json({
                message: "To Date cannot be before From Date"
            });
        }

        const today = new Date();

        const todayUTC = new Date(Date.UTC(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        ));

        if (start < todayUTC) {
            return res.status(400).json({
                message: "Past dates cannot be selected"
            });
        }

        const days = calculateDays(start, end);

        if (days > 365) {
            return res.status(400).json({
                message: "Leave period cannot exceed 365 days"
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const balanceField =
            type === "casual" ? "casualLeave" : "medicalLeave";

        // Count other pending requests that have not been deducted.
        const pendingLeaves = await Leave.find({
            userId: user._id,
            type,
            status: "Applied",
            balanceDeducted: false
        });

        const reservedDays = pendingLeaves.reduce(
            (total, leave) => total + leave.days,
            0
        );

        const availableBalance =
            user[balanceField] - reservedDays;

        if (availableBalance < days) {
            return res.status(400).json({
                message:
                    `Insufficient ${type} leave balance. ` +
                    `Available: ${Math.max(0, availableBalance)}, ` +
                    `Required: ${days}`
            });
        }

        // Create request without deducting balance.
        const leave = await Leave.create({
            userId: user._id,
            type,
            fromDate: start,
            toDate: end,
            days,
            status: "Applied",
            rejectionReason: "",
            balanceDeducted: false
        });

        res.status(201).json({
            message: "Leave applied successfully! Waiting for admin approval.",
            leave: {
                _id: leave._id,
                type: leave.type,
                fromDate: leave.fromDate,
                toDate: leave.toDate,
                days: leave.days,
                status: leave.status,
                rejectionReason: leave.rejectionReason
            },
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave
        });

    } catch (error) {
        console.error("Leave application error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
});

// Get employee leave history
router.get("/leave-history/:id", async (req, res) => {
    try {
        if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const leaves = await Leave.find({
            userId: user._id
        }).sort({ createdAt: -1 });

        res.json(leaves);

    } catch (error) {
        console.error("Leave history error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
});

module.exports = router;
