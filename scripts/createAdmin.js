
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function createAdmin() {
    try {
        const { MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

        if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
            throw new Error("MONGO_URI, ADMIN_EMAIL and ADMIN_PASSWORD are required in .env");
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing in .env");
        }

        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected");

        const existingAdmin = await User.findOne({
            role: "admin"
        });

        if (existingAdmin) {
            console.log("An admin account already exists.");
            return;
        }

        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

        await User.create({
            username: "Admin",
            email: ADMIN_EMAIL.toLowerCase(),
            rollNumber: "ADMIN",
            role: "admin",
            passwordHash
        });

        console.log("Admin account created successfully.");

    } catch (error) {
        console.error("Admin creation failed:", error.message);
        process.exitCode = 1;

    } finally {
        await mongoose.disconnect();
    }
}

createAdmin();
