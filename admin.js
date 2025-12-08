// admin.js
// Logic for admin dashboard (index.html)

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ----- Firebase init -----
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ----- DOM elements -----
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const assetTbody = document.getElementById("assetTableBody");
const requestTbody = document.getElementById("requestTableBody");
const addAssetBtn = document.getElementById("addAssetBtn");

const newEmpIdInput = document.getElementById("newEmpId");
const newEmpPasswordInput = document.getElementById("newEmpPassword");
const createEmpBtn = document.getElementById("createEmpBtn");
const createEmpMessage = document.getElementById("createEmpMessage");

// allowed categories for assets
const allowedCategories = ["Laptop", "Mobile", "IT", "Other"];

// status values you want to support
const allowedStatuses = ["Available", "In Use", "Under Maintenance", "On loan", "Retired"];

// ----- Auth guard -----
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // only admin should access this page
  if (user.email !== "admin@go-aheadsingapore.com") {
    window.location.href = "employee.html";
    return;
  }

  if (userEmailSpan) {
    userEmailSpan.textContent = user.email;
  }

  // once we know it is admin, load dashboard data
  if (assetTbody) {
    initDashboard();
  }
});

// ----- Logout -----
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      window.location.href = "login.html";
    }
  });
}

// ----- Add asset button -----
if (addAssetBtn) {
  addAssetBtn.addEventListener("click", () => {
    window.location.href = "add.html";
  });
}

// ----- Helper: map employee ID to internal email -----
function employeeIdToEmail(empId) {
  return `${empId}@smartasset.com`;
}

// ----- Init dashboard -----
function initDashboard() {
  loadAssets();
  loadBorrowRequests();
  wireCreateEmployee();
}

// ======================
//  Assets table
// ======================

async function loadAssets() {
  if (!assetTbody) return;

  assetTbody.innerHTML = '<tr><td colspan="7">Loading assets...</td></tr>';

  try {
    const snap = await getDocs(collection(db, "assets"));
    assetTbody.innerHTML = "";

    if (snap.empty) {
      assetTbody.innerHTML =
        '<tr><td colspan="7">No assets found.</td></tr>';
      return;
    }

    snap.forEach((docSnap) => {
      const a = docSnap.data() || {};

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.assetId || "-"}</td>
        <td>${a.name || "-"}</td>
        <td>${a.category || "-"}</td>
        <td>${a.owner || "-"}</td>
        <td>${a.location || "-"}</td>
        <td>${a.status || "-"}</td>
        <td>
          <button class="btn-small btn-edit" data-id="${docSnap.id}">Edit</button>
          <button class="btn-small btn-danger btn-remove" data-id="${docSnap.id}">Remove</button>
        </td>
      `;
      assetTbody.appendChild(tr);
    });

    // attach events
    assetTbody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        editAsset(id);
      });
    });

    assetTbody.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        removeAsset(id);
      });
    });
  } catch (err) {
    console.error("Error loading assets:", err);
    assetTbody.innerHTML =
      '<tr><td colspan="7">Error loading assets.</td></tr>';
  }
}

// edit asset with prompts, including location
async function editAsset(id) {
  try {
    const ref = doc(db, "assets", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Asset not found.");
      return;
    }

    const a = snap.data() || {};

    let assetId = prompt("Asset ID", a.assetId || "");
    if (!assetId) return;
    assetId = assetId.trim().toUpperCase();

    let name = prompt("Name", a.name || "");
    if (!name) return;
    name = name.trim();

    let category = prompt(
      "Category (Laptop, Mobile, IT, Other)",
      a.category || "Laptop"
    );
    if (!category) return;
    category = category.trim();
    if (!allowedCategories.includes(category)) {
      alert("Invalid category. Keeping original category.");
      category = a.category || "Laptop";
    }

    let owner = prompt("Owner", a.owner || "");
    if (!owner) return;
    owner = owner.trim();

    let location = prompt("Location", a.location || "");
    if (!location) return;
    location = location.trim();

    let status = prompt(
      "Status (Available, In Use, Under Maintenance, On loan, Retired)",
      a.status || "Available"
    );
    if (!status) return;
    status = status.trim();
    if (!allowedStatuses.includes(status)) {
      alert("Invalid status. Keeping original status.");
      status = a.status || "Available";
    }

    await updateDoc(ref, {
      assetId,
      name,
      category,
      owner,
      location,
      status
    });

    loadAssets();
  } catch (err) {
    console.error("Error updating asset:", err);
    alert("Error updating asset.");
  }
}

// remove asset
async function removeAsset(id) {
  const confirmDelete = confirm("Are you sure you want to remove this asset?");
  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(db, "assets", id));
    loadAssets();
  } catch (err) {
    console.error("Error removing asset:", err);
    alert("Error removing asset.");
  }
}

// ======================
//  Borrow requests table
// ======================

async function loadBorrowRequests() {
  if (!requestTbody) return;

  requestTbody.innerHTML =
    '<tr><td colspan="7">Loading requests...</td></tr>';

  try {
    const snap = await getDocs(collection(db, "borrowRequests"));
    requestTbody.innerHTML = "";

    if (snap.empty) {
      requestTbody.innerHTML =
        '<tr><td colspan="7">No borrow requests yet.</td></tr>';
      return;
    }

    snap.forEach((docSnap) => {
      const r = docSnap.data() || {};
      const status = r.status || "Pending";

      let actionsHtml = "No actions";
      if (status === "Pending") {
        actionsHtml = `
          <button class="btn-small btn-approve" data-id="${docSnap.id}">Approve</button>
          <button class="btn-small btn-danger btn-reject" data-id="${docSnap.id}">Reject</button>
        `;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.assetId || "-"}</td>
        <td>${r.requestedBy || "-"}</td>
        <td>${r.startDate || "-"}</td>
        <td>${r.endDate || "-"}</td>
        <td>${r.reason || "-"}</td>
        <td>${status}</td>
        <td>${actionsHtml}</td>
      `;
      requestTbody.appendChild(tr);
    });

    // attach approve/reject events
    requestTbody.querySelectorAll(".btn-approve").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        updateRequestStatus(id, "Approved");
      });
    });

    requestTbody.querySelectorAll(".btn-reject").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        updateRequestStatus(id, "Rejected");
      });
    });
  } catch (err) {
    console.error("Error loading borrow requests:", err);
    requestTbody.innerHTML =
      '<tr><td colspan="7">Error loading requests.</td></tr>';
  }
}

async function updateRequestStatus(id, newStatus) {
  const confirmText =
    newStatus === "Approved"
      ? "Approve this request?"
      : "Reject this request?";
  const ok = confirm(confirmText);
  if (!ok) return;

  try {
    const ref = doc(db, "borrowRequests", id);
    await updateDoc(ref, { status: newStatus });
    loadBorrowRequests();
  } catch (err) {
    console.error("Error updating request:", err);
    alert("Error updating request status.");
  }
}

// ======================
//  Create employee login
// ======================

function wireCreateEmployee() {
  if (!createEmpBtn) return;

  createEmpBtn.addEventListener("click", async () => {
    if (!newEmpIdInput || !newEmpPasswordInput || !createEmpMessage) return;

    createEmpMessage.textContent = "";

    const empId = (newEmpIdInput.value || "").trim();
    const empPassword = newEmpPasswordInput.value || "";

    if (!/^\d{5}$/.test(empId)) {
      createEmpMessage.textContent = "Employee ID must be exactly 5 digits.";
      createEmpMessage.style.color = "red";
      return;
    }

    if (empPassword.length < 6) {
      createEmpMessage.textContent = "Password must be at least 6 characters.";
      createEmpMessage.style.color = "red";
      return;
    }

    const empEmail = employeeIdToEmail(empId);

    try {
      await createUserWithEmailAndPassword(auth, empEmail, empPassword);
      createEmpMessage.textContent = `Employee account ${empId} created.`;
      createEmpMessage.style.color = "green";

      newEmpIdInput.value = "";
      newEmpPasswordInput.value = "";
    } catch (err) {
      console.error("Error creating employee account:", err);
      createEmpMessage.textContent = "Error: " + (err.code || err.message);
      createEmpMessage.style.color = "red";
    }
  });
}
