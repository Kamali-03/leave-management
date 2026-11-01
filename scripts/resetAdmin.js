
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function resetAdmin() {
    try {
        const {
            MONGO_URI,
            ADMIN_EMAIL,
            ADMIN_PASSWORD
        } = process.env;

        if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
            throw new Error(
                "MONGO_URI, ADMIN_EMAIL and ADMIN_PASSWORD are required"
            );
        }

        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected successfully");

        const passwordHash = await bcrypt.hash(
            ADMIN_PASSWORD,
            12
        );

        const admin = await User.findOneAndUpdate(
            { role: "admin" },
            {
                $set: {
                    username: "Admin",
                    email: ADMIN_EMAIL.toLowerCase(),
                    rollNumber: "ADMIN",
                    role: "admin",
                    passwordHash: passwordHash
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        console.log("Admin account reset successfully!");
        console.log("Admin email:", admin.email);

    } catch (error) {
        console.error("Admin reset failed:", error.message);
        process.exitCode = 1;

    } finally {
        await mongoose.disconnect();
    }
}

resetAdmin();
