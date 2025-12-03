// add.js
// Logic for Add Asset page

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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ----- Firebase init -----
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ----- Elements -----
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const assetIdInput = document.getElementById("assetId");
const nameInput = document.getElementById("assetName");
const categorySelect = document.getElementById("assetCategory");
const ownerInput = document.getElementById("assetOwner");
const locationInput = document.getElementById("assetLocation");
const statusSelect = document.getElementById("assetStatus");

const saveBtn = document.getElementById("saveAssetBtn");
const cancelBtn = document.getElementById("cancelBtn");

// categories we allow
const allowedCategories = ["Laptop", "Mobile", "IT", "Other"];

// ----- Auth guard -----
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // not logged in
    window.location.href = "login.html";
    return;
  }

  // only admin should use add asset
  if (userEmailSpan) {
    userEmailSpan.textContent = user.email;
  }

  if (user.email !== "admin@go-aheadsingapore.com") {
    // non admin goes to employee view
    window.location.href = "employee.html";
    return;
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

// ----- Save asset -----
if (saveBtn) {
  saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    let assetId = assetIdInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();
    let category = categorySelect.value.trim();
    const owner = ownerInput.value.trim();
    const location = locationInput.value.trim();
    const status = statusSelect.value.trim();

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
        status,
        createdAt: serverTimestamp()
      });

      alert("Asset added successfully.");
      window.location.href = "index.html";
    } catch (err) {
      console.error("Error adding asset:", err);
      alert("Error adding asset. See console for details.");
    }
  });
}

// ----- Cancel -----
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}
