// admin.js
// Shared Firebase setup for all admin pages

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
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// common elements (may be null on some pages)
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

// elements that exist only on some pages
const assetTbody = document.getElementById("assetTableBody");
const requestTbody = document.getElementById("requestTableBody");
const addAssetForm = document.getElementById("addAssetForm");

// allowed categories for assets
const allowedCategories = ["Laptop", "Mobile", "IT", "Other"];

// auth guard for all admin pages
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // only admin allowed on admin pages
  if (user.email !== "admin@go-aheadsingapore.com") {
    window.location.href = "employee.html";
    return;
  }

  if (userEmailSpan) {
    userEmailSpan.textContent = user.email;
  }

  // initialise per page
  if (assetTbody) {
    initDashboard();
  }

  if (addAssetForm) {
    initAddAsset();
  }
});

// logout button
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    } finally {
      window.location.href = "login.html";
    }
  });
}

// ---------------- dashboard (index.html) ----------------

function initDashboard() {
  loadAssets();
  loadBorrowRequests();
}

// load assets into Current Assets table
async function loadAssets() {
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

    // attach handlers
    assetTbody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => editAsset(btn.dataset.id));
    });
    assetTbody.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", () => removeAsset(btn.dataset.id));
    });
  } catch (err) {
    console.error(err);
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
      `Category (Laptop, Mobile, IT, Other)`,
      a.category || "Laptop"
    );
    if (!category) return;
    category = category.trim();
    // keep previous category if invalid
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
      "Status (Available, In Use, Under Maintenance)",
      a.status || "Available"
    );
    if (!status) return;
    status = status.trim();

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
    console.error(err);
    alert("Error updating asset.");
  }
}

// remove asset
async function removeAsset(id) {
  const ok = confirm("Are you sure you want to remove this asset?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "assets", id));
    loadAssets();
  } catch (err) {
    console.error(err);
    alert("Error removing asset.");
  }
}

// load borrow requests
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

    // attach handlers
    requestTbody.querySelectorAll(".btn-approve").forEach((btn) => {
      btn.addEventListener("click", () =>
        updateRequestStatus(btn.dataset.id, "Approved")
      );
    });
    requestTbody.querySelectorAll(".btn-reject").forEach((btn) => {
      btn.addEventListener("click", () =>
        updateRequestStatus(btn.dataset.id, "Rejected")
      );
    });
  } catch (err) {
    console.error(err);
    requestTbody.innerHTML =
      '<tr><td colspan="7">Error loading requests.</td></tr>';
  }
}

// approve or reject request
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
    console.error(err);
    alert("Error updating request.");
  }
}

// ---------------- add asset page (add.html) ----------------

function initAddAsset() {
  addAssetForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const assetIdInput = document.getElementById("assetId");
    const nameInput = document.getElementById("assetName");
    const categoryInput = document.getElementById("category");
    const ownerInput = document.getElementById("owner");
    const locationInput = document.getElementById("location");
    const statusInput = document.getElementById("status");

    let assetId = assetIdInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();
    let category = categoryInput.value.trim();
    const owner = ownerInput.value.trim();
    const location = locationInput.value.trim();
    const status = statusInput.value.trim();

    if (!assetId || !name || !category || !owner || !location || !status) {
      alert("Please fill in all fields.");
      return;
    }

    if (!allowedCategories.includes(category)) {
      alert("Invalid category.");
      return;
    }

    try {
      await addDoc(collection(db, "assets"), {
        assetId,
        name,
        category,
        owner,
        location,
        status
      });

      alert("Asset added.");
      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("Error adding asset.");
    }
  });
}
