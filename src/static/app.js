document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const authForm = document.getElementById("auth-form");
  const authEmailInput = document.getElementById("auth-email");
  const authPasswordInput = document.getElementById("auth-password");
  const authStatus = document.getElementById("auth-status");
  const logoutBtn = document.getElementById("logout-btn");
  const signupUser = document.getElementById("signup-user");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  let sessionToken = null;
  let currentUser = null;

  function setAuthUI() {
    const isAuthenticated = Boolean(currentUser && sessionToken);
    authEmailInput.disabled = isAuthenticated;
    authPasswordInput.disabled = isAuthenticated;
    logoutBtn.classList.toggle("hidden", !isAuthenticated);
    signupForm.querySelector("button[type='submit']").disabled = !isAuthenticated;
    signupUser.textContent = isAuthenticated
      ? `Logged in as ${currentUser.email} (${currentUser.role})`
      : "Please login to sign up.";
  }

  async function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (sessionToken) {
      headers.set("X-Session-Token", sessionToken);
    }
    return fetch(url, { ...options, headers });
  }

  function setAuthMessage(text, kind = "info") {
    authStatus.textContent = text;
    authStatus.className = kind;
    authStatus.classList.remove("hidden");
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await apiFetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        currentUser &&
                        (currentUser.role === "admin" || currentUser.email === email)
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const activity = document.getElementById("activity").value;

    if (!currentUser) {
      messageDiv.textContent = "Please login before signing up.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await apiFetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(currentUser.email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        activitySelect.value = "";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmailInput.value,
          password: authPasswordInput.value,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setAuthMessage(result.detail || "Login failed", "error");
        return;
      }

      sessionToken = result.token;
      currentUser = result.user;
      setAuthMessage(`Logged in as ${currentUser.email}`, "success");
      setAuthUI();
      fetchActivities();
    } catch (error) {
      setAuthMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (!sessionToken) {
      return;
    }

    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    sessionToken = null;
    currentUser = null;
    authEmailInput.value = "";
    authPasswordInput.value = "";
    setAuthMessage("Logged out", "info");
    setAuthUI();
    fetchActivities();
  });

  // Initialize app
  setAuthUI();
  fetchActivities();
});
