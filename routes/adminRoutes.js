const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Leave = require("../models/Leave");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const adminAuth = require("../middleware/adminAuth");

// Get correct balance field based on leave type
function getBalanceField(type) {
    const normalizedType = String(type).toLowerCase();

    if (normalizedType === "casual") {
        return "casualLeave";
    }

    if (normalizedType === "medical") {
        return "medicalLeave";
    }

    return null;
}

// ADMIN LOGIN
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await User.findOne({
            email: String(email || "").trim().toLowerCase(),
            role: "admin"
        });

        if (!admin || !admin.passwordHash) {
            return res.status(401).json({
                message: "Invalid admin email or password"
            });
        }

        const isMatch = await bcrypt.compare(
            password || "",
            admin.passwordHash
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid admin email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: admin._id,
                role: "admin"
            },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({
            message: "Admin login successful",
            token,
            admin: {
                username: admin.username,
                email: admin.email
            }
        });

    } catch (error) {
        console.error("Admin login error:", error);

        res.status(500).json({
            message: "Admin login failed"
        });
    }
});

// GET ALL LEAVE REQUESTS
router.get("/leaves", adminAuth, async (req, res) => {
    try {
        const leaves = await Leave.find()
            .populate("userId", "username email rollNumber")
            .sort({ createdAt: -1 });

        res.json(leaves);

    } catch (error) {
        console.error("Fetch leaves error:", error);

        res.status(500).json({
            message: "Unable to fetch leave requests"
        });
    }
});

// APPROVE LEAVE
router.patch("/leaves/:id/approve", adminAuth, async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({
                message: "Leave request not found"
            });
        }

        if (leave.status !== "Applied") {
            return res.status(400).json({
                message: "This request has already been processed"
            });
        }

        const user = await User.findById(leave.userId);

        if (!user) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        const balanceField = getBalanceField(leave.type);

        if (!balanceField) {
            return res.status(400).json({
                message: "Invalid leave type"
            });
        }

        // Deduct only the matching leave balance
        if (leave.balanceDeducted !== true) {

            if (user[balanceField] < leave.days) {
                return res.status(400).json({
                    message: "Insufficient leave balance"
                });
            }

            user[balanceField] -= leave.days;

            await user.save();

            leave.balanceDeducted = true;
        }

        leave.status = "Approved";
        leave.rejectionReason = "";

        await leave.save();

        res.json({
            message: "Leave approved successfully"
        });

    } catch (error) {
        console.error("Approve leave error:", error);

        res.status(500).json({
            message: "Unable to approve leave"
        });
    }
});

// REJECT LEAVE
router.patch("/leaves/:id/reject", adminAuth, async (req, res) => {
    try {
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({
                message: "Please provide a rejection reason"
            });
        }

        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({
                message: "Leave request not found"
            });
        }

        if (leave.status !== "Applied") {
            return res.status(400).json({
                message: "This request has already been processed"
            });
        }

        // Refund only if balance was previously deducted
        if (leave.balanceDeducted === true) {

            const user = await User.findById(leave.userId);

            if (!user) {
                return res.status(404).json({
                    message: "Employee not found"
                });
            }

            const balanceField = getBalanceField(leave.type);

            if (!balanceField) {
                return res.status(400).json({
                    message: "Invalid leave type"
                });
            }

            user[balanceField] += leave.days;

            await user.save();

            leave.balanceDeducted = false;
        }

        leave.status = "Rejected";
        leave.rejectionReason = reason.trim();

        await leave.save();

        res.json({
            message: "Leave rejected successfully"
        });

    } catch (error) {
        console.error("Reject leave error:", error);

        res.status(500).json({
            message: "Unable to reject leave"
        });
    }
});

module.exports = router;