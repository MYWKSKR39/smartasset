// login.js
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById("loginForm");
const userInput = document.getElementById("userInput");      // email or 5-digit ID
const passwordInput = document.getElementById("passwordInput");
const resetBtn = document.getElementById("resetBtn");
const loginMessage = document.getElementById("loginMessage");

// already logged in, redirect to correct page
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  if (user.email === "admin@go-aheadsingapore.com") {
    window.location.href = "index.html";
  } else {
    window.location.href = "employee.html";
  }
});

// helper: turn 5 digit ID into internal email
function idToEmail(id) {
  return `${id}@smartasset.com`;
}

// login handler
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";

  const rawUser = userInput.value.trim();
  const password = passwordInput.value;

  if (!rawUser || !password) {
    loginMessage.textContent = "Please enter your ID/email and password.";
    loginMessage.style.color = "red";
    return;
  }

  let emailToUse = rawUser;

  // if it does not contain '@', treat as 5 digit employee ID
  if (!rawUser.includes("@")) {
    if (!/^\d{5}$/.test(rawUser)) {
      loginMessage.textContent = "Employee ID must be 5 digits.";
      loginMessage.style.color = "red";
      return;
    }
    emailToUse = idToEmail(rawUser);
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
    const user = cred.user;

    if (user.email === "admin@go-aheadsingapore.com") {
      window.location.href = "index.html";
    } else {
      window.location.href = "employee.html";
    }
  } catch (err) {
    console.error(err);
    loginMessage.textContent = "Login error: " + (err.code || err.message);
    loginMessage.style.color = "red";
  }
});

// reset password button
resetBtn.addEventListener("click", async () => {
  loginMessage.textContent = "";
  const rawUser = userInput.value.trim();

  if (!rawUser) {
    loginMessage.textContent = "Enter your email to reset password.";
    loginMessage.style.color = "red";
    return;
  }

  // for safety, allow reset only for real emails
  if (!rawUser.includes("@")) {
    loginMessage.textContent = "Ask admin to reset your password for 5 digit IDs.";
    loginMessage.style.color = "red";
    return;
  }

  try {
    await sendPasswordResetEmail(auth, rawUser);
    loginMessage.textContent = "Password reset email sent.";
    loginMessage.style.color = "green";
  } catch (err) {
    console.error(err);
    loginMessage.textContent = "Error sending reset email: " + (err.code || err.message);
    loginMessage.style.color = "red";
  }
});
