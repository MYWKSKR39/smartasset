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
    window.location.replace("login.html");
    return;
  }

  // Redirect admin to the correct dashboard
  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    window.location.replace("index.html");
    return;
  }

  // Auth confirmed — reveal the page
  document.body.style.visibility = "visible";

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
    window.location.replace("login.html");
  });
}

// --- ASSETS TABLE ---
// --- ASSETS TABLE with sorting and colour chips ---

let allEmpAssets = [];
let empSortKey = "assetId";
let empSortAsc = true;

const STATUS_COLORS = {
  "Available": { bg: "#dcfce7", color: "#15803d" },
  "In use":    { bg: "#dbeafe", color: "#1d4ed8" },
  "On loan":   { bg: "#e0e7ff", color: "#4338ca" },
  "Active":    { bg: "#dbeafe", color: "#1d4ed8" },
  "In repair": { bg: "#fef9c3", color: "#a16207" },
  "Retired":   { bg: "#fee2e2", color: "#b91c1c" },
};

function startAssetsListener() {
  if (!assetTableBody) return;

  const colRef = collection(db, "assets");
  const q = query(colRef);

  onSnapshot(q, (snapshot) => {
    allEmpAssets = [];
    snapshot.forEach((docSnap) => {
      allEmpAssets.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderEmpAssets();
  });

  // Wire up sortable headers
  const table = assetTableBody.closest("table");
  if (table) {
    table.querySelectorAll("th[data-sort]").forEach((th) => {
      th.style.cursor = "pointer";
      th.style.userSelect = "none";
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (empSortKey === key) {
          empSortAsc = !empSortAsc;
        } else {
          empSortKey = key;
          empSortAsc = true;
        }
        table.querySelectorAll("th[data-sort]").forEach((h) => {
          h.querySelector(".sort-icon").textContent = " ↕";
        });
        th.querySelector(".sort-icon").textContent = empSortAsc ? " ↑" : " ↓";
        renderEmpAssets();
      });
    });
  }
}

function renderEmpAssets() {
  if (!assetTableBody) return;

  if (allEmpAssets.length === 0) {
    assetTableBody.innerHTML = '<tr><td colspan="6">No assets found.</td></tr>';
    return;
  }

  const sorted = [...allEmpAssets].sort((a, b) => {
    const aVal = (a[empSortKey] || "").toString().toLowerCase();
    const bVal = (b[empSortKey] || "").toString().toLowerCase();
    if (aVal < bVal) return empSortAsc ? -1 : 1;
    if (aVal > bVal) return empSortAsc ? 1 : -1;
    return 0;
  });

  assetTableBody.innerHTML = "";

  sorted.forEach((data) => {
    const tr = document.createElement("tr");
    const status = data.status || "";
    const chip = STATUS_COLORS[status] || { bg: "#f3f4f6", color: "#374151" };
    const statusChip = status
      ? `<span style="background:${chip.bg};color:${chip.color};padding:0.15rem 0.6rem;border-radius:999px;font-size:0.78rem;font-weight:600;">${status}</span>`
      : "";

    tr.innerHTML = `
      <td>${data.assetId || data.id}</td>
      <td>${data.name || ""}</td>
      <td>${data.category || ""}</td>
      <td>${data.owner || ""}</td>
      <td>${data.location || ""}</td>
      <td>${statusChip}</td>
    `;

    // Click row to pre-fill borrow form
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => {
      const assetIdInput = document.getElementById("assetIdInput");
      if (assetIdInput) {
        assetIdInput.value = data.assetId || data.id;
        document.getElementById("borrowForm")?.scrollIntoView({ behavior: "smooth" });
      }
    });

    assetTableBody.appendChild(tr);
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

      const statusText = data.status || "Pending";
      const statusColors = {
        "Pending":  { bg: "#fef9c3", color: "#a16207" },
        "Approved": { bg: "#dcfce7", color: "#15803d" },
        "Rejected": { bg: "#fee2e2", color: "#b91c1c" },
        "Returned": { bg: "#f3f4f6", color: "#6b7280" },
      };
      const sc = statusColors[statusText] || { bg: "#f3f4f6", color: "#374151" };
      const statusChip = `<span style="background:${sc.bg};color:${sc.color};padding:0.15rem 0.6rem;border-radius:999px;font-size:0.78rem;font-weight:600;">${statusText}</span>`;
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
