// add.js

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const ADMIN_EMAIL = "admin@smartasset.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM references
const userEmailSpan = document.getElementById("userEmail");
const backBtn = document.getElementById("backBtn");
const logoutBtn = document.getElementById("logoutBtn");

const formTitle = document.getElementById("formTitle");
const assetForm = document.getElementById("assetForm");
const assetIdInput = document.getElementById("assetId");
const nameInput = document.getElementById("name");
const categoryInput = document.getElementById("category");
const ownerInput = document.getElementById("owner");
const locationInput = document.getElementById("location");
const statusInput = document.getElementById("status");
const formMessage = document.getElementById("formMessage");

// current asset id from query string for edit mode
let existingAssetId = null;

// parse ?assetId=IT00123 from URL
(function readQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const assetId = params.get("assetId");
  if (assetId) {
    existingAssetId = assetId;
  }
})();

// auth guard, admin only
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (userEmailSpan) {
    userEmailSpan.textContent = user.email;
  }

  if (user.email !== ADMIN_EMAIL) {
    // non admin goes to employee view
    window.location.href = "employee.html";
    return;
  }

  // admin is allowed, now load asset data if editing
  if (existingAssetId) {
    await loadAsset(existingAssetId);
  }
});

// back button
if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

// logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

function setFormMessage(text, color) {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.style.color = color || "";
}

async function loadAsset(assetId) {
  try {
    const ref = doc(db, "assets", assetId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      setFormMessage(`Asset ${assetId} not found, creating a new one.`, "orange");
      assetIdInput.value = assetId;
      return;
    }

    const data = snap.data();

    if (formTitle) {
      formTitle.textContent = `Edit asset ${assetId}`;
    }

    assetIdInput.value = assetId;
    assetIdInput.disabled = true; // prevent changing id on edit
    nameInput.value = data.name || "";
    categoryInput.value = data.category || "";
    ownerInput.value = data.owner || "";
    locationInput.value = data.location || "";
    statusInput.value = data.status || "";

  } catch (err) {
    console.error("Error loading asset", err);
    setFormMessage("Error loading asset: " + (err.code || err.message), "red");
  }
}

// handle save
if (assetForm) {
  assetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setFormMessage("", "");

    const assetId = (assetIdInput.value || "").trim();
    const name = (nameInput.value || "").trim();
    const category = (categoryInput.value || "").trim();
    const owner = (ownerInput.value || "").trim();
    const location = (locationInput.value || "").trim();
    const status = (statusInput.value || "").trim();

    if (!assetId || !name) {
      setFormMessage("Asset ID and name are required.", "red");
      return;
    }

    try {
      const ref = doc(db, "assets", assetId);
      await setDoc(
        ref,
        {
          assetId,
          name,
          category,
          owner,
          location,
          status,
        },
        { merge: true }
      );

      setFormMessage("Asset saved successfully.", "green");

      // after short delay go back to dashboard
      setTimeout(() => {
        window.location.href = "index.html";
      }, 800);
    } catch (err) {
      console.error("Error saving asset", err);
      setFormMessage("Error saving asset: " + (err.code || err.message), "red");
    }
  });
}
