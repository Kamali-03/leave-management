
let userId = null;
let adminToken = null;

const $ = (id) => document.getElementById(id);

function showMessage(message, type = "error") {
    $("response-message").textContent = message;
    $("response-message").className = type;
}

async function api(url, options = {}) {
   const API_URL = "http://localhost:5050";
    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

// Employee/Admin login selection
function showEmployeeLogin() {
    $("login-form").classList.remove("hidden");
    $("admin-login-form").classList.add("hidden");
    $("employee-register-option").classList.remove("hidden");

    showMessage("");
}

function showAdminLogin() {
    $("login-form").classList.add("hidden");
    $("admin-login-form").classList.remove("hidden");
    $("employee-register-option").classList.add("hidden");

    showMessage("");
}

// Date formatting
function formatDate(date) {
    if (!date) return "-";

    const d = new Date(date);

    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
}

function todayString() {
    const now = new Date();

    const local = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    );

    return local.toISOString().slice(0, 10);
}

function updateDateLimits() {
    const today = todayString();

    $("from-date").min = today;
    $("to-date").min = $("from-date").value || today;

    if ($("to-date").value &&
        $("to-date").value < $("to-date").min) {
        $("to-date").value = "";
    }

    updateDateSummary();
}

function updateDateSummary() {
    const from = $("from-date").value;
    const to = $("to-date").value;

    if (!from || !to || to < from) {
        $("selected-period").textContent = "Choose valid dates";
        $("total-days").textContent = "0";
        return;
    }

    const start = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");

    const days = Math.round((end - start) / 86400000) + 1;

    $("selected-period").textContent =
        `${formatDate(from)} to ${formatDate(to)}`;

    $("total-days").textContent = days;
}

// Display leave balance
function displayBalance(data) {
    $("casual-leave-display").textContent = data.casualLeave;
    $("medical-leave-display").textContent = data.medicalLeave;
}

// Employee registration
async function registerUser(event) {
    event.preventDefault();

    try {
        const data = await api("/api/register", {
            method: "POST",
            body: JSON.stringify({
                username: $("username").value.trim(),
                email: $("reg-email").value.trim(),
                rollNumber: $("roll-number").value.trim(),
                casualLeave: Number($("casual-leave").value),
                medicalLeave: Number($("medical-leave").value)
            })
        });

        const registeredEmail = $("reg-email").value.trim();

        $("registration-form").reset();
        $("registration-section").classList.add("hidden");
        $("login-section").classList.remove("hidden");

        showEmployeeLogin();
        $("email").value = registeredEmail;

        showMessage(data.message, "success");

    } catch (error) {
        showMessage(error.message);
    }
}

// Employee login
async function loginUser(event) {
    event.preventDefault();

    try {
        const data = await api("/api/login", {
            method: "POST",
            body: JSON.stringify({
                email: $("email").value.trim()
            })
        });

        userId = data.userId;

        $("username-display").textContent = data.username;
        $("roll-number-display").textContent = data.rollNumber;

        displayBalance(data);

        $("login-section").classList.add("hidden");
        $("registration-section").classList.add("hidden");
        $("dashboard").classList.remove("hidden");

        $("leave-form").reset();
        updateDateLimits();

        await loadLeaveHistory();

        showMessage(data.message, "success");

    } catch (error) {
        showMessage(error.message);
    }
}

// Admin login
async function loginAdmin(event) {
    event.preventDefault();

    try {
        const data = await api("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({
                email: $("admin-email").value.trim(),
                password: $("admin-password").value
            })
        });

        if (!data.token) {
            throw new Error("Admin authentication token missing");
        }

        adminToken = data.token;

        // Keep the token only for this browser tab session.
        sessionStorage.setItem("adminToken", adminToken);

        showMessage("Admin login successful", "success");

        window.location.href = "/admin.html";

    } catch (error) {
        showMessage(error.message);
    }
}

// Refresh leave balance
async function refreshLeaveBalance() {
    if (!userId) return;

    try {
        const data = await api(`/api/leave-balance/${userId}`);

        displayBalance(data);

        showMessage("Leave balance updated", "success");

    } catch (error) {
        showMessage(error.message);
    }
}

// Apply for leave
async function applyLeave(event) {
    event.preventDefault();

    if (!userId) {
        showMessage("Please login first");
        return;
    }

    const fromDate = $("from-date").value;
    const toDate = $("to-date").value;

    if (!fromDate || !toDate) {
        showMessage("Please select both From Date and To Date");
        return;
    }

    if (fromDate < todayString()) {
        showMessage("Past dates cannot be selected");
        return;
    }

    if (toDate < fromDate) {
        showMessage("To Date cannot be before From Date");
        return;
    }

    try {
        const data = await api(`/api/apply-leave/${userId}`, {
            method: "POST",
            body: JSON.stringify({
                type: $("leave-type").value,
                fromDate,
                toDate
            })
        });

        displayBalance(data);

        $("leave-form").reset();
        updateDateLimits();

        await loadLeaveHistory();

        showMessage(
            `${data.message} ${formatDate(data.leave.fromDate)} to ` +
            `${formatDate(data.leave.toDate)} (${data.leave.days} days).`,
            "success"
        );

    } catch (error) {
        showMessage(error.message);
    }
}

// Load employee leave history
async function loadLeaveHistory() {
    if (!userId) return;

    try {
        const leaves = await api(`/api/leave-history/${userId}`);

        const tbody = $("leave-history");

        tbody.replaceChildren();

        if (!leaves.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 6;
            cell.textContent = "No applications yet";

            return;
        }

        leaves.forEach((leave) => {
            const row = tbody.insertRow();

            const values = [
                leave.type.charAt(0).toUpperCase() + leave.type.slice(1),
                formatDate(leave.fromDate),
                formatDate(leave.toDate),
                leave.days,
                leave.status,
                leave.rejectionReason || "-"
            ];

            values.forEach((value) => {
                row.insertCell().textContent = value;
            });
        });

    } catch (error) {
        showMessage(error.message);
    }
}

// Employee logout
function logoutUser() {
    userId = null;

    $("dashboard").classList.add("hidden");
    $("login-section").classList.remove("hidden");
    $("registration-section").classList.add("hidden");

    $("login-form").reset();
    $("leave-form").reset();

    $("username-display").textContent = "";
    $("roll-number-display").textContent = "";

    $("leave-history").replaceChildren();

    $("casual-leave-display").textContent = "0";
    $("medical-leave-display").textContent = "0";

    showEmployeeLogin();

    showMessage("Logged out successfully", "success");
}

// Show registration
function showRegistration() {
    $("login-section").classList.add("hidden");
    $("registration-section").classList.remove("hidden");

    showMessage("");
}

// Back to login
function showLogin() {
    $("registration-section").classList.add("hidden");
    $("login-section").classList.remove("hidden");

    showEmployeeLogin();
    showMessage("");
}

// Event listeners
$("registration-form").addEventListener("submit", registerUser);

$("login-form").addEventListener("submit", loginUser);

$("admin-login-form").addEventListener("submit", loginAdmin);

$("leave-form").addEventListener("submit", applyLeave);

$("refresh-balance").addEventListener("click", refreshLeaveBalance);

$("logout-button").addEventListener("click", logoutUser);

$("from-date").addEventListener("change", updateDateLimits);

$("to-date").addEventListener("change", updateDateSummary);

$("show-registration").addEventListener("click", showRegistration);

$("show-login").addEventListener("click", showLogin);

$("employee-login-option").addEventListener("click", showEmployeeLogin);

$("admin-login-option").addEventListener("click", showAdminLogin);

// Initial setup
showEmployeeLogin();
updateDateLimits();
