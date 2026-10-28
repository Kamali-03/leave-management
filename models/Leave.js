const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ["casual", "medical"],
        required: true
    },
    fromDate: {
        type: Date,
        required: true
    },
    toDate: {
        type: Date,
        required: true
    },
    days: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        default: "Applied"
    }
}, { timestamps: true });

module.exports = mongoose.model("Leave", leaveSchema);