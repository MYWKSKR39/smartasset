// login.js
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// --- DEMO CONFIGURATION ---
// Your real email prefix. 
// Any username typed will become: ernesttan24+username@gmail.com
const BASE_GMAIL_USER = "ernesttan24"; 
const GMAIL_DOMAIN = "@gmail.com";

// Define which specific alias counts as the "Admin" for redirection purposes
const ADMIN_EMAIL_ALIAS = `${BASE_GMAIL_USER}+admin${GMAIL_DOMAIN}`; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById("loginForm");
const userInput = document.getElementById("userInput");       // admin, ernest.tan, or 12345
const passwordInput = document.getElementById("passwordInput");
const resetBtn = document.getElementById("resetBtn");
const loginMessage = document.getElementById("loginMessage");

// --- HELPER: Turn Username into Real Gmail ---
// Input: "admin"      -> Output: "ernesttan24+admin@gmail.com"
// Input: "ernest.tan" -> Output: "ernesttan24+ernest.tan@gmail.com"
function getRealEmail(username) {
  // 1. If they actually typed a full email, use it as is.
  if (username.includes("@")) {
    return username;
  }
  
  // 2. Otherwise, attach your real Gmail with the '+' trick
  return `${BASE_GMAIL_USER}+${username}${GMAIL_DOMAIN}`;
}

// show message helper
function showMessage(text, color) {
  if (!loginMessage) return;
  loginMessage.textContent = text;
  loginMessage.style.color = color;
}

// --- AUTH STATE LISTENER ---
// Redirects user to the correct page after login
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  // Check if the logged-in email matches your specific Admin alias
  if (user.email.toLowerCase() === ADMIN_EMAIL_ALIAS.toLowerCase()) {
    window.location.href = "index.html";
  } else {
    window.location.href = "employee.html";
  }
});

// --- LOGIN HANDLER ---
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("", "");

    const rawUser = userInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!rawUser || !password) {
      showMessage("Please enter your Username and password.", "red");
      return;
    }

    // Convert the username to the real email address
    const emailToUse = getRealEmail(rawUser);

    try {
      await signInWithEmailAndPassword(auth, emailToUse, password);
      // Redirect happens in onAuthStateChanged above
    } catch (err) {
      console.error(err);
      
      let msg = "Login failed.";
      if (err.code === "auth/invalid-credential") {
        msg = "Wrong username or password.";
      } else if (err.code === "auth/user-not-found") {
        msg = "User not found. (Did you create this user in Firebase?)";
      }
      showMessage(msg, "red");
    }
  });
}

// --- RESET PASSWORD HANDLER ---
if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    showMessage("", "");
    const rawUser = userInput.value.trim().toLowerCase();

    if (!rawUser) {
      showMessage("Enter your username first to reset password.", "red");
      return;
    }

    // 1. Convert username to real email
    const emailForReset = getRealEmail(rawUser);

    try {
      // 2. Send the reset email
      await sendPasswordResetEmail(auth, emailForReset);
      
      // 3. Show success message (telling you where to check)
      showMessage(`Reset link sent! Check inbox for ${BASE_GMAIL_USER}@gmail.com`, "green");
      
    } catch (err) {
      console.error(err);
      showMessage("Error sending reset email: " + (err.code || err.message), "red");
    }
  });
}
