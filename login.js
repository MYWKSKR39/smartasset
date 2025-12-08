// login.js
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_ID = "admin";
const ADMIN_EMAIL = "admin@smartasset.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById("loginForm");
const userInput = document.getElementById("userInput");      // admin ID, employee ID, or email
const passwordInput = document.getElementById("passwordInput");
const resetBtn = document.getElementById("resetBtn");
const loginMessage = document.getElementById("loginMessage");

// helper: turn 5 digit ID into internal email
function idToEmail(id) {
  return `${id}@smartasset.com`;
}

// show message helper
function showMessage(text, color) {
  if (!loginMessage) return;
  loginMessage.textContent = text;
  loginMessage.style.color = color;
}

// already logged in, redirect to correct page
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  if (user.email === ADMIN_EMAIL) {
    window.location.href = "index.html";
  } else {
    window.location.href = "employee.html";
  }
});

// login handler
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("", "");

    const rawUser = userInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!rawUser || !password) {
      showMessage("Please enter your ID or email and password.", "red");
      return;
    }

    let emailToUse = rawUser;

    if (!rawUser.includes("@")) {
      // admin login using ID "admin"
      if (rawUser === ADMIN_ID) {
        emailToUse = ADMIN_EMAIL;
      } else {
        // employee login using 5 digit ID
        if (!/^\d{5}$/.test(rawUser)) {
          showMessage("Employee ID must be 5 digits.", "red");
          return;
        }
        emailToUse = idToEmail(rawUser);
      }
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const user = cred.user;

      if (user.email === ADMIN_EMAIL) {
        window.location.href = "index.html";
      } else {
        window.location.href = "employee.html";
      }
    } catch (err) {
      console.error(err);
      showMessage("Login error: " + (err.code || err.message), "red");
    }
  });
}

// reset password button
if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    showMessage("", "");
    const rawUser = userInput.value.trim().toLowerCase();

    if (!rawUser) {
      showMessage("Enter your email or admin ID to reset password.", "red");
      return;
    }

    let emailForReset = rawUser;

    if (!rawUser.includes("@")) {
      // allow reset for admin ID only
      if (rawUser === ADMIN_ID) {
        emailForReset = ADMIN_EMAIL;
      } else {
        showMessage("Ask admin to reset your password for employee IDs.", "red");
        return;
      }
    }

    try {
      await sendPasswordResetEmail(auth, emailForReset);
      showMessage("Password reset email sent.", "green");
    } catch (err) {
      console.error(err);
      showMessage("Error sending reset email: " + (err.code || err.message), "red");
    }
  });
}
