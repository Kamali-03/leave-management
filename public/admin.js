
const token = sessionStorage.getItem("adminToken");

const tableBody = document.getElementById("leave-table-body");
const message = document.getElementById("admin-message");

// Check admin login
if (!token) {
    window.location.href = "/";
}

// API request helper
async function adminRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("adminToken");
        window.location.href = "/";
        throw new Error(data.message || "Admin login required");
    }

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

// Load all leave requests
async function loadLeaves() {
    try {
        message.textContent = "Loading requests...";

        const leaves = await adminRequest("/api/admin/leaves");

        tableBody.innerHTML = "";

        if (leaves.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">No leave requests found.</td>
                </tr>
            `;
            message.textContent = "";
            return;
        }

        leaves.forEach(leave => {
            const employee = leave.userId || {};

            const row = document.createElement("tr");

            const values = [
                employee.username || "Unknown",
                employee.rollNumber || "N/A",
                leave.type || "",
                leave.fromDate ? new Date(leave.fromDate).toLocaleDateString() : "",
                leave.toDate ? new Date(leave.toDate).toLocaleDateString() : "",
                leave.days,
                leave.status
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actionCell = document.createElement("td");

            if (leave.status === "Applied") {
                const approveButton = document.createElement("button");
                approveButton.textContent = "Approve";
                approveButton.className = "approve-btn";

                approveButton.onclick = () => approveLeave(leave._id);

                const rejectButton = document.createElement("button");
                rejectButton.textContent = "Reject";
                rejectButton.className = "reject-btn";

                rejectButton.onclick = () => rejectLeave(leave._id);

                actionCell.appendChild(approveButton);
                actionCell.appendChild(rejectButton);
            } else {
                actionCell.textContent = leave.status;
            }

            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });

        message.textContent = "";

    } catch (error) {
        message.textContent = error.message;
    }
}

// Approve leave
async function approveLeave(id) {
    const confirmed = confirm("Are you sure you want to approve this leave?");

    if (!confirmed) return;

    try {
        const data = await adminRequest(
            `/api/admin/leaves/${id}/approve`,
            { method: "PATCH" }
        );

        alert(data.message);
        loadLeaves();

    } catch (error) {
        alert(error.message);
    }
}

// Reject leave
async function rejectLeave(id) {
    const reason = prompt("Enter the reason for rejecting this leave:");

    if (reason === null) return;

    if (!reason.trim()) {
        alert("Please enter a rejection reason.");
        return;
    }

    try {
        const data = await adminRequest(
            `/api/admin/leaves/${id}/reject`,
            {
                method: "PATCH",
                body: JSON.stringify({ reason })
            }
        );

        alert(data.message);
        loadLeaves();

    } catch (error) {
        alert(error.message);
    }
}

// Admin logout
document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("adminToken");
    window.location.href = "/";
});

// Load dashboard
loadLeaves();
