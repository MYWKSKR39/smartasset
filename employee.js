// employee.js

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
  getDocs,
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

// --- DOM REFERENCES ---
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const assetTableBody = document.getElementById("assetTableBody");
const myRequestsTableBody = document.getElementById("myRequestTableBody"); 

const requestForm = document.getElementById("borrowForm");
const assetIdInput = document.getElementById("assetIdInput"); 
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const reasonInput = document.getElementById("reasonInput"); 
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

  // --- NAME DISPLAY LOGIC ---
  if (userEmailSpan) {
    let displayNameToShow = user.email; 

    if (user.displayName) {
      displayNameToShow = user.displayName;
    } else if (user.email.includes("+")) {
      const parts = user.email.split('@')[0].split('+');
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

// --- MY REQUESTS TABLE (UPDATED COLOR LOGIC) ---
function startMyRequestsListener() {
  if (!myRequestsTableBody || !currentUserEmail) return;

  const colRef = collection(db, "borrowRequests");
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

      let statusColor = "#374151";
      let statusBg = "#f3f4f6";
      let statusText = data.status || "Pending";
      
      if (statusText === "Approved")      { statusColor = "#15803d"; statusBg = "#dcfce7"; }
      else if (statusText === "Rejected") { statusColor = "#b91c1c"; statusBg = "#fee2e2"; }
      else if (statusText === "Returned") { statusColor = "#6b7280"; statusBg = "#f3f4f6"; }
      else if (statusText === "Pending")  { statusColor = "#a16207"; statusBg = "#fef9c3"; }

      const statusChip = `<span style="background:${statusBg};color:${statusColor};padding:0.15rem 0.6rem;border-radius:999px;font-size:0.78rem;font-weight:600;">${statusText}</span>`;
      const noteCell = (statusText === "Rejected" && data.adminNote)
        ? `<span style="font-size:0.75rem;color:#6b7280;display:block;">Reason: ${data.adminNote}</span>`
        : "";

      tr.innerHTML = `
        <td>${data.assetId || ""}</td>
        <td>${data.startDate || ""}</td>
        <td>${data.endDate || ""}</td>
        <td>${data.reason || ""}${noteCell}</td>
        <td>${statusChip}</td>
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

    const newStartObj = new Date(start);
    const newEndObj = new Date(end);

    if (newStartObj > newEndObj) {
        setRequestMessage("Error: End date cannot be earlier than start date.", "red");
        return; 
    }

    setRequestMessage("Checking availability...", "blue");

    try {
      const qConflict = query(
          collection(db, "borrowRequests"), 
          where("assetId", "==", assetId)
      );
      
      const querySnapshot = await getDocs(qConflict);
      let conflictFound = false;

      querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.status === "Rejected" || data.status === "Returned") return;

          const existingStart = new Date(data.startDate);
          const existingEnd = new Date(data.endDate);

          if (newStartObj <= existingEnd && newEndObj >= existingStart) {
              conflictFound = true;
          }
      });

      if (conflictFound) {
          setRequestMessage("Unavailable: Asset is already booked for these dates.", "red");
          return; 
      }

      await addDoc(collection(db, "borrowRequests"), {
        assetId,
        startDate: start,
        endDate: end,
        reason,
        requestedBy: currentUserEmail, 
        status: "Pending",
        createdAt: serverTimestamp()
      });

      setRequestMessage("Request submitted successfully!", "green");

      assetIdInput.value = "";
      startDateInput.value = "";
      endDateInput.value = "";
      reasonInput.value = "";
      
    } catch (err) {
      console.error(err);
      setRequestMessage("Error processing request: " + (err.code || err.message), "red");
    }
  });
}
