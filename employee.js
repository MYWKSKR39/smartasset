import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- DEMO CONFIGURATION ---
const BASE_GMAIL_USER = "ernesttan24";
const GMAIL_DOMAIN = "@gmail.com";
const ADMIN_EMAIL = `${BASE_GMAIL_USER}+admin${GMAIL_DOMAIN}`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM REFERENCES (Matched to your HTML) ---
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const assetTableBody = document.getElementById("assetTableBody");
// Fixed: Removed 's' to match HTML id="myRequestTableBody"
const myRequestsTableBody = document.getElementById("myRequestTableBody"); 

const requestForm = document.getElementById("borrowForm");
// Fixed: Changed to match HTML id="assetIdInput"
const assetIdInput = document.getElementById("assetIdInput"); 
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
// Fixed: Changed to match HTML id="reasonInput"
const reasonInput = document.getElementById("reasonInput"); 
// Fixed: Changed to match HTML id="borrowMessage"
const requestMessage = document.getElementById("borrowMessage"); 

let currentUserEmail = null;

// Helper to show status messages
function setRequestMessage(text, color) {
  if (!requestMessage) return;
  requestMessage.textContent = text;
  requestMessage.style.color = color;
}

// --- AUTH LISTENER ---
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Redirect admin to the correct dashboard
  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    window.location.href = "index.html";
    return;
  }

  currentUserEmail = user.email;

  // --- NAME DISPLAY LOGIC (The fix you requested) ---
  if (userEmailSpan) {
    let displayNameToShow = user.email; // Default fallback

    // 1. Try to use the official Display Name from Firebase
    if (user.displayName) {
      displayNameToShow = user.displayName;
    } 
    // 2. If no Display Name, parse the "Gmail Plus" tag
    // Example: ernesttan24+ernest.tan@gmail.com -> extracts "ernest.tan"
    else if (user.email.includes("+")) {
      const parts = user.email.split('@')[0].split('+');
      // parts[0] is "ernesttan24", parts[1] is "ernest.tan"
      if (parts[1]) {
        displayNameToShow = parts[1];
      }
    }

    userEmailSpan.textContent = displayNameToShow;
  }

  // Start data listeners
  startAssetsListener();
  startMyRequestsListener();
});

// Logout Handler
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// --- ASSETS TABLE ---
function startAssetsListener() {
  if (!assetTableBody) return;

  const colRef = collection(db, "assets");
  const q = query(colRef, orderBy("assetId"));

  onSnapshot(q, (snapshot) => {
    assetTableBody.innerHTML = "";

    if (snapshot.empty) {
      assetTableBody.innerHTML = '<tr><td colspan="6">No assets found.</td></tr>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${data.assetId || docSnap.id}</td>
        <td>${data.name || ""}</td>
        <td>${data.category || ""}</td>
        <td>${data.owner || ""}</td>
        <td>${data.location || ""}</td>
        <td>${data.status || ""}</td>
      `;

      assetTableBody.appendChild(tr);
    });
  });
}

// --- MY REQUESTS TABLE ---
function startMyRequestsListener() {
  if (!myRequestsTableBody || !currentUserEmail) return;

  const colRef = collection(db, "borrowRequests");
  // Query only requests made by this specific email
  const q = query(
    colRef,
    where("requestedBy", "==", currentUserEmail),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    myRequestsTableBody.innerHTML = "";

    if (snapshot.empty) {
      myRequestsTableBody.innerHTML = '<tr><td colspan="5">You have no requests yet.</td></tr>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${data.assetId || ""}</td>
        <td>${data.startDate || ""}</td>
        <td>${data.endDate || ""}</td>
        <td>${data.reason || ""}</td>
        <td>${data.status || ""}</td>
      `;

      myRequestsTableBody.appendChild(tr);
    });
  });
}

// --- SUBMIT FORM HANDLER ---
if (requestForm) {
  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setRequestMessage("", "");

    const assetId = assetIdInput.value.trim();
    const start = startDateInput.value;
    const end = endDateInput.value;
    const reason = reasonInput.value.trim();

    if (!assetId || !start || !end) {
      setRequestMessage("Please fill in Asset ID, Start Date, and End Date.", "red");
      return;
    }

    try {
      await addDoc(collection(db, "borrowRequests"), {
        assetId,
        startDate: start,
        endDate: end,
        reason,
        requestedBy: currentUserEmail, // Saves "ernesttan24+ernest.tan@gmail.com"
        status: "Pending",
        createdAt: serverTimestamp()
      });

      setRequestMessage("Request submitted successfully!", "green");

      // Clear form
      assetIdInput.value = "";
      startDateInput.value = "";
      endDateInput.value = "";
      reasonInput.value = "";
    } catch (err) {
      console.error(err);
      setRequestMessage("Error submitting request: " + (err.code || err.message), "red");
    }
  });
}
