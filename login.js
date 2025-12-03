// js/login.js
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
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const resetBtn = document.getElementById("resetBtn");
const loginMessage = document.getElementById("loginMessage");

// Already logged in - send to correct page
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  if (user.email === "admin@go-aheadsingapore.com"){
    window.location.href = "index.html";
  }else{
    window.location.href = "employee.html";
  }
});

// login
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password){
    loginMessage.textContent = "Please enter email and password.";
    loginMessage.style.color = "red";
    return;
  }

  try{
    const cred = await signInWithEmailAndPassword(auth,email,password);
    const user = cred.user;
    if (user.email === "admin@go-aheadsingapore.com"){
      window.location.href = "index.html";
    }else{
      window.location.href = "employee.html";
    }
  }catch(err){
    console.error(err);
    loginMessage.textContent = "Login error: " + (err.code || err.message);
    loginMessage.style.color = "red";
  }
});

// reset password
resetBtn.addEventListener("click", async () => {
  loginMessage.textContent = "";
  const email = emailInput.value.trim();
  if (!email){
    loginMessage.textContent = "Enter your email first.";
    loginMessage.style.color = "red";
    return;
  }
  try{
    await sendPasswordResetEmail(auth,email);
    loginMessage.textContent = "Password reset email sent.";
    loginMessage.style.color = "green";
  }catch(err){
    console.error(err);
    loginMessage.textContent = "Error sending reset email: " + (err.code || err.message);
    loginMessage.style.color = "red";
  }
});
