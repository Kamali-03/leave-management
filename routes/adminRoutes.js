router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await User.findOne({
            email: String(email || "").trim().toLowerCase(),
            role: "admin"
        });

        console.log("ADMIN FOUND:", !!admin);
        console.log("PASSWORD RECEIVED:", !!password);
        console.log("PASSWORD HASH EXISTS:", !!admin?.passwordHash);

        if (!admin || !admin.passwordHash) {
            return res.status(401).json({
                message: "Invalid admin email or password"
            });
        }

        const isMatch = await bcrypt.compare(
            password || "",
            admin.passwordHash
        );

        console.log("PASSWORD MATCH:", isMatch);

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid admin email or password"
            });
        }

        const token = jwt.sign(
            { userId: admin._id, role: "admin" },
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
        console.error("Admin login error:", error.message);
        res.status(500).json({
            message: "Admin login failed"
        });
    }
});