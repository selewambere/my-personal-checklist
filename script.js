
// ======================================
// 1. SUPABASE CONNECTION
// ======================================
const APP_URL =
    "https://selewambere.github.io/my-personal-checklist/";
const SUPABASE_URL = "https://fksqbjxekxztjxgznfjy.supabase.co";

const SUPABASE_KEY = "sb_publishable_LWpcW87Og7bMWWhFCI51pg_x75g_ltS";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

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
const taskList = document.getElementById("taskList");

const resendEmailBtn = document.getElementById("resendEmailBtn");
const logoutBtn = document.getElementById("logoutBtn");
const clearCompletedBtn = document.getElementById("clearCompleted");

let currentUser = null;
let taskChannel = null;

// ======================================
// 3. DISPLAY MESSAGES
// ======================================

function showAuthMessage(message) {
    if (authMessage) {
        authMessage.textContent = message;
    }
}

function showTaskMessage(message) {
    if (taskMessage) {
        taskMessage.textContent = message;
    }
}

// ======================================
// 4. SHOW LOGIN OR DASHBOARD
// ======================================

function showDashboard(user) {

    currentUser = user;

    if (user) {

        authSection.hidden = true;
        dashboard.hidden = false;

        document.getElementById("userEmail").textContent =
            user.email || "User";

        loadTasks();
        startRealtime();

    } else {

        authSection.hidden = false;
        dashboard.hidden = true;

        taskList.innerHTML = "";

        if (taskChannel) {
            db.removeChannel(taskChannel);
            taskChannel = null;
        }
    }
}

// ======================================
// 5. USER REGISTRATION
// ======================================

registerForm.addEventListener("submit", async function(e) {

    e.preventDefault();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    showAuthMessage("Creating your account...");

    try {

        const { data, error } = await db.auth.signUp({

            email: email,
            password: password,

            options: {
               emailRedirectTo: APP_URL
            }

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

            showAuthMessage(
                "Account created! Please check your email and confirm your account before logging in."
            );

        }

    } catch (error) {

        showAuthMessage(error.message);

    }

});

// ======================================
// 6. USER LOGIN
// ======================================

loginForm.addEventListener("submit", async function(e) {

    e.preventDefault();

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    showAuthMessage("Logging in...");

    try {

        const { data, error } = await db.auth.signInWithPassword({

            email: email,
            password: password

        });

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
// 7. RESEND CONFIRMATION EMAIL
// ======================================

if (resendEmailBtn) {

    resendEmailBtn.addEventListener("click", async function() {

        const email =
            document.getElementById("registerEmail").value.trim();

        if (!email) {

            showAuthMessage(
                "Please enter your registered email address first."
            );

            return;

        }

        showAuthMessage("Sending confirmation email...");

        try {

            const { error } = await db.auth.resend({

                type: "signup",
                email: email,

                options: {
                   emailRedirectTo: APP_URL
                }

            });

            if (error) {

                showAuthMessage(error.message);

            } else {

                showAuthMessage(
                    "Confirmation email sent! Check your inbox."
                );

            }

        } catch (error) {

            showAuthMessage(error.message);

        }

    });

}

// ======================================
// 8. USER LOGOUT
// ======================================

logoutBtn.addEventListener("click", async function() {

    const { error } = await db.auth.signOut();

    if (error) {

        showTaskMessage(error.message);

    } else {

        showAuthMessage("You have logged out successfully.");

    }

});

// ======================================
// 9. ADD NEW TASK
// ======================================

taskForm.addEventListener("submit", async function(e) {

    e.preventDefault();

    if (!currentUser) return;

    const taskName = taskInput.value.trim();

    if (!taskName) return;

    showTaskMessage("Saving task...");

    const { error } = await db
        .from("tasks")
        .insert({
            task_name: taskName,
            completed: false
        });

    if (error) {

        showTaskMessage(error.message);
        return;

    }

    taskInput.value = "";

    showTaskMessage("");

    await loadTasks();

});

// ======================================
// 10. LOAD TASKS FROM DATABASE
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

    displayTasks(data);

}

// ======================================
// 11. DISPLAY TASKS
// ======================================

function displayTasks(tasks) {

    taskList.innerHTML = "";

    if (tasks.length === 0) {

        taskList.innerHTML =
            '<li class="empty">No tasks yet. Add your first task!</li>';

        updateProgress(tasks);
        return;

    }

    tasks.forEach(function(task) {

        const li = document.createElement("li");

        if (task.completed) {
            li.classList.add("completed");
        }

        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.checked = task.completed;

        checkbox.addEventListener("change", function() {

            updateTask(task.id, checkbox.checked);

        });

        const span = document.createElement("span");

        span.textContent = task.task_name;

        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";

        deleteButton.addEventListener("click", function() {

            deleteTask(task.id);

        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteButton);

        taskList.appendChild(li);

    });

    updateProgress(tasks);

}

// ======================================
// 12. UPDATE TASK STATUS
// ======================================

async function updateTask(id, completed) {

    const { error } = await db
        .from("tasks")
        .update({
            completed: completed
        })
        .eq("id", id);

    if (error) {

        showTaskMessage(error.message);
        return;

    }

    await loadTasks();

}

// ======================================
// 13. DELETE TASK
// ======================================

async function deleteTask(id) {

    const confirmed = confirm(
        "Are you sure you want to delete this task?"
    );

    if (!confirmed) return;

    const { error } = await db
        .from("tasks")
        .delete()
        .eq("id", id);

    if (error) {

        showTaskMessage(error.message);
        return;

    }

    showTaskMessage("");

    await loadTasks();

}

// ======================================
// 14. CLEAR COMPLETED TASKS
// ======================================

if (clearCompletedBtn) {

    clearCompletedBtn.addEventListener("click", async function() {

        const confirmed = confirm(
            "Delete all completed tasks?"
        );

        if (!confirmed) return;

        const { error } = await db
            .from("tasks")
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
// 15. UPDATE PROGRESS
// ======================================

function updateProgress(tasks) {

    const total = tasks.length;

    const completed = tasks.filter(function(task) {
        return task.completed;
    }).length;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    document.getElementById("percentage").textContent =
        percentage + "%";

    document.getElementById("progress").style.width =
        percentage + "%";

    document.getElementById("taskCount").textContent =
        completed + " of " + total + " tasks completed";

}

// ======================================
// 16. REAL-TIME SYNCHRONIZATION
// ======================================

function startRealtime() {

    if (!currentUser) return;

    if (taskChannel) {
        db.removeChannel(taskChannel);
    }

    taskChannel = db
        .channel("my-checklist-sync")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "tasks"
            },
            function() {
                loadTasks();
            }
        )
        .subscribe();

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

        showDashboard(
            data.session ? data.session.user : null
        );

        db.auth.onAuthStateChange(function(event, session) {

            showDashboard(
                session ? session.user : null
            );

        });

    } catch (error) {

        showAuthMessage(error.message);

    }

}

// ======================================
// 18. START APPLICATION
// ======================================

// Correct validation: only block missing or placeholder credentials.

if (
    !SUPABASE_URL ||
    !SUPABASE_KEY ||
    SUPABASE_URL.includes("YOUR_") ||
    SUPABASE_KEY.includes("YOUR_")
) {

    showAuthMessage(
        "Please enter your Supabase Project URL and Publishable Key."
    );

} else {

    initializeApp();

}
