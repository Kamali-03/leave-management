require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function resetAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const passwordHash = await bcrypt.hash(
            process.env.ADMIN_PASSWORD,
            12
        );

        const admin = await User.findOneAndUpdate(
            { role: "admin" },
            {
                username: "Admin",
                email: process.env.ADMIN_EMAIL.toLowerCase(),
                rollNumber: "ADMIN",
                passwordHash: passwordHash
            },
            { new: true }
        );

        if (!admin) {
            console.log("Admin account not found.");
        } else {
            console.log("Admin email and password updated successfully.");
        }

    } catch (error) {
        console.log(error.message);
    } finally {
        await mongoose.disconnect();
    }
}

resetAdmin();