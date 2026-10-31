
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    rollNumber: {
        type: String,
        required: true,
        trim: true
    },

    casualLeave: {
        type: Number,
        default: 10,
        min: 0
    },

    medicalLeave: {
        type: Number,
        default: 10,
        min: 0
    },

    role: {
        type: String,
        enum: ["employee", "admin"],
        default: "employee"
    },

    passwordHash: {
        type: String,
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
