// ======================================
// 1. SUPABASE CONNECTION
// ======================================
const APP_URL = "https://selewambere.github.io/my-personal-checklist/";
const SUPABASE_URL = "https://fksqbjxekxztjxgznfjy.supabase.co";
const SUPABASE_KEY = "sb_publishable_LWpcW87Og7bMWWhFCI51pg_x75g_ltS";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ======================================
// 2. HTML ELEMENTS
// ======================================
const authSection = document.getElementById("authSection");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");
const taskMessage = document.getElementById("taskMessage");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const dueDateInput = document.getElementById("dueDate");
const reminderAtInput = document.getElementById("reminderAt");
const taskList = document.getElementById("taskList");
const resendEmailBtn = document.getElementById("resendEmailBtn");
const logoutBtn = document.getElementById("logoutBtn");
const clearCompletedBtn = document.getElementById("clearCompleted");
const enableNotificationsBtn = document.getElementById("enableNotifications");
const notificationStatus = document.getElementById("notificationStatus");

let currentUser = null;
let taskChannel = null;
let reminderTimer = null;

function showAuthMessage(message) {
    if (authMessage) authMessage.textContent = message;
}

function showTaskMessage(message) {
    if (taskMessage) taskMessage.textContent = message;
}

// ======================================
// 3. LOGIN / DASHBOARD DISPLAY
// ======================================
function showDashboard(user) {
    currentUser = user;

    if (user) {
        authSection.hidden = true;
        dashboard.hidden = false;
        document.getElementById("userEmail").textContent = user.email || "User";
        loadTasks();
        startRealtime();
        startReminderChecks();
        updateNotificationStatus();
    } else {
        authSection.hidden = false;
        dashboard.hidden = true;
        taskList.innerHTML = "";

        if (taskChannel) {
            db.removeChannel(taskChannel);
            taskChannel = null;
        }
        if (reminderTimer) {
            clearInterval(reminderTimer);
            reminderTimer = null;
        }
    }
}

// ======================================
// 4. USER REGISTRATION
// ======================================
registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    showAuthMessage("Creating your account...");

    try {
        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: APP_URL }
        });

        if (error) {
            showAuthMessage(error.message);
            return;
        }

        registerForm.reset();

        if (data.session) {
            showAuthMessage("Account created successfully!");
            showDashboard(data.user);
        } else {
            showAuthMessage("Account created! Check your email and confirm your account before logging in.");
        }
    } catch (error) {
        showAuthMessage(error.message);
    }
});

// ======================================
// 5. USER LOGIN
// ======================================
loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    showAuthMessage("Logging in...");

    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });

        if (error) {
            showAuthMessage(error.message);
            return;
        }

        loginForm.reset();
        showAuthMessage("Login successful!");
        showDashboard(data.user);
    } catch (error) {
        showAuthMessage(error.message);
    }
});

// ======================================
// 6. RESEND CONFIRMATION EMAIL
// ======================================
if (resendEmailBtn) {
    resendEmailBtn.addEventListener("click", async function () {
        const email = document.getElementById("registerEmail").value.trim();

        if (!email) {
            showAuthMessage("Please enter your registered email address first.");
            return;
        }

        showAuthMessage("Sending confirmation email...");

        try {
            const { error } = await db.auth.resend({
                type: "signup",
                email,
                options: { emailRedirectTo: APP_URL }
            });

            showAuthMessage(error ? error.message : "Confirmation email sent! Check your inbox.");
        } catch (error) {
            showAuthMessage(error.message);
        }
    });
}

// ======================================
// 7. LOGOUT
// ======================================
logoutBtn.addEventListener("click", async function () {
    const { error } = await db.auth.signOut();
    if (error) showTaskMessage(error.message);
});

// ======================================
// 8. ADD TASK WITH DUE DATE + REMINDER
// ======================================
taskForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!currentUser) return;

    const taskName = taskInput.value.trim();
    if (!taskName) return;

    const dueDate = dueDateInput.value || null;
    const reminderValue = reminderAtInput.value;
    const reminderAt = reminderValue ? new Date(reminderValue).toISOString() : null;

    if (dueDate && reminderValue && new Date(reminderValue).toISOString().slice(0, 10) > dueDate) {
        showTaskMessage("Reminder date cannot be later than the task due date.");
        return;
    }

    showTaskMessage("Saving task...");

    const { error } = await db.from("tasks").insert({
        task_name: taskName,
        completed: false,
        due_date: dueDate,
        reminder_at: reminderAt
    });

    if (error) {
        showTaskMessage(error.message);
        return;
    }

    taskForm.reset();
    showTaskMessage("Task saved successfully.");
    await loadTasks();
});

// ======================================
// 9. LOAD TASKS
// ======================================
async function loadTasks() {
    if (!currentUser) return;

    const { data, error } = await db
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        showTaskMessage(error.message);
        return;
    }

    displayTasks(data || []);
}

// ======================================
// 10. DISPLAY TASKS + DEADLINE STATUS
// ======================================
function displayTasks(tasks) {
    taskList.innerHTML = "";

    if (tasks.length === 0) {
        taskList.innerHTML = '<li class="empty">No tasks yet. Add your first task!</li>';
        updateProgress(tasks);
        return;
    }

    tasks.forEach(function (task) {
        const li = document.createElement("li");
        li.className = "task-item";

        if (task.completed) li.classList.add("completed");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", "Mark task completed");
        checkbox.addEventListener("change", function () {
            updateTask(task.id, checkbox.checked);
        });

        const details = document.createElement("div");
        details.className = "task-details";

        const name = document.createElement("span");
        name.className = "task-name";
        name.textContent = task.task_name;
        details.appendChild(name);

        if (task.due_date) {
            const due = document.createElement("small");
            due.className = "task-date";
            due.textContent = "Due: " + formatDate(task.due_date);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDay = new Date(task.due_date + "T00:00:00");

            if (!task.completed && dueDay < today) {
                due.classList.add("overdue");
                due.textContent += " — OVERDUE";
                li.classList.add("overdue-task");
            } else if (!task.completed && dueDay.getTime() === today.getTime()) {
                due.classList.add("due-today");
                due.textContent += " — DUE TODAY";
            }

            details.appendChild(due);
        }

        if (task.reminder_at) {
            const reminder = document.createElement("small");
            reminder.className = "task-reminder";
            reminder.textContent = "Reminder: " + formatDateTime(task.reminder_at);
            details.appendChild(reminder);
        }

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";
        deleteButton.addEventListener("click", function () {
            deleteTask(task.id);
        });

        li.appendChild(checkbox);
        li.appendChild(details);
        li.appendChild(deleteButton);
        taskList.appendChild(li);
    });

    updateProgress(tasks);
}

function formatDate(dateString) {
    return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric"
    });
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

// ======================================
// 11. UPDATE TASK STATUS
// ======================================
async function updateTask(id, completed) {
    const { error } = await db.from("tasks")
        .update({ completed })
        .eq("id", id);

    if (error) {
        showTaskMessage(error.message);
        return;
    }

    await loadTasks();
}

// ======================================
// 12. DELETE TASK
// ======================================
async function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) return;

    const { error } = await db.from("tasks").delete().eq("id", id);

    if (error) {
        showTaskMessage(error.message);
        return;
    }

    showTaskMessage("");
    await loadTasks();
}

// ======================================
// 13. CLEAR COMPLETED TASKS
// ======================================
if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener("click", async function () {
        if (!confirm("Delete all completed tasks?")) return;

        const { error } = await db.from("tasks")
            .delete()
            .eq("completed", true);

        if (error) {
            showTaskMessage(error.message);
            return;
        }

        showTaskMessage("");
        await loadTasks();
    });
}

// ======================================
// 14. PROGRESS
// ======================================
function updateProgress(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    document.getElementById("percentage").textContent = percentage + "%";
    document.getElementById("progress").style.width = percentage + "%";
    document.getElementById("taskCount").textContent =
        completed + " of " + total + " tasks completed";
}

// ======================================
// 15. REAL-TIME SYNCHRONIZATION
// ======================================
function startRealtime() {
    if (!currentUser) return;

    if (taskChannel) db.removeChannel(taskChannel);

    taskChannel = db.channel("my-checklist-sync")
        .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "tasks"
        }, function () {
            loadTasks();
        })
        .subscribe();
}

// ======================================
// 16. BROWSER NOTIFICATIONS
// ======================================
function updateNotificationStatus() {
    if (!("Notification" in window)) {
        notificationStatus.textContent = "This browser does not support notifications.";
        enableNotificationsBtn.disabled = true;
        return;
    }

    notificationStatus.textContent = Notification.permission === "granted"
        ? "Notifications are enabled on this device."
        : Notification.permission === "denied"
            ? "Notifications are blocked. Change this site's permission in browser settings."
            : "Notifications are not enabled yet.";
}

enableNotificationsBtn.addEventListener("click", async function () {
    if (!("Notification" in window)) {
        updateNotificationStatus();
        return;
    }

    const permission = await Notification.requestPermission();
    updateNotificationStatus();

    if (permission === "granted") {
        new Notification("My Personal Checklist", {
            body: "Notifications are now enabled on this device."
        });
    }
});

function startReminderChecks() {
    if (reminderTimer) clearInterval(reminderTimer);
    checkDueReminders();
    reminderTimer = setInterval(checkDueReminders, 30000);
}

async function checkDueReminders() {
    if (!currentUser || !("Notification" in window) ||
        Notification.permission !== "granted") return;

    const { data, error } = await db
        .from("tasks")
        .select("id, task_name, completed, reminder_at")
        .not("reminder_at", "is", null)
        .eq("completed", false);

    if (error || !data) return;

    const storageKey = "checklist_notified_" + currentUser.id;
    let notified = {};

    try {
        notified = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (_) {
        notified = {};
    }

    const now = Date.now();
    let changed = false;

    data.forEach(function (task) {
        const reminderTime = new Date(task.reminder_at).getTime();
        const reminderKey = String(task.id) + "_" + task.reminder_at;

        if (Number.isFinite(reminderTime) && reminderTime <= now && !notified[reminderKey]) {
            new Notification("Checklist reminder", {
                body: task.task_name + (reminderTime < now - 60000 ? " (reminder time has passed)" : "")
            });
            notified[reminderKey] = true;
            changed = true;
        }
    });

    if (changed) localStorage.setItem(storageKey, JSON.stringify(notified));
}

// ======================================
// 17. CHECK EXISTING LOGIN SESSION
// ======================================
async function initializeApp() {
    try {
        const { data, error } = await db.auth.getSession();

        if (error) {
            showAuthMessage(error.message);
            return;
        }

        showDashboard(data.session ? data.session.user : null);

        db.auth.onAuthStateChange(function (event, session) {
            showDashboard(session ? session.user : null);
        });
    } catch (error) {
        showAuthMessage(error.message);
    }
}

// ======================================
// 18. START APPLICATION
// ======================================
if (!SUPABASE_URL || !SUPABASE_KEY ||
    SUPABASE_URL.includes("YOUR_") || SUPABASE_KEY.includes("YOUR_")) {
    showAuthMessage("Please enter your Supabase Project URL and Publishable Key.");
} else {
    initializeApp();
}
