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

// current asset id if editing
let existingAssetId = null;

// read URL query param
(function readQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const assetId = params.get("assetId");
  if (assetId) {
    existingAssetId = assetId;
  }
})();

// auth guard
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  userEmailSpan.textContent = user.email;

  if (user.email !== ADMIN_EMAIL) {
    window.location.href = "employee.html";
    return;
  }

  if (existingAssetId) {
    await loadAsset(existingAssetId);
  }
});

// go back to dashboard
backBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

// logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// helper
function setFormMessage(msg, color) {
  formMessage.textContent = msg;
  formMessage.style.color = color;
}

// load asset in Edit mode
async function loadAsset(assetId) {
  const ref = doc(db, "assets", assetId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    setFormMessage("Asset not found, creating new one.", "orange");
    assetIdInput.value = assetId;
    return;
  }

  const data = snap.data();

  formTitle.textContent = `Edit asset ${assetId}`;

  assetIdInput.value = assetId;
  assetIdInput.disabled = true; // cannot change ID when editing
  nameInput.value = data.name || "";
  categoryInput.value = data.category || "";
  ownerInput.value = data.owner || "";
  locationInput.value = data.location || "";
  statusInput.value = data.status || "";
}

// SAVE FORM
assetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormMessage("", "");

  const assetId = assetIdInput.value.trim();
  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const owner = ownerInput.value.trim();
  const location = locationInput.value.trim();
  const status = statusInput.value.trim();

  if (!assetId || !name) {
    setFormMessage("Asset ID and Name are required.", "red");
    return;
  }

  // -------------- DUPLICATE CHECK ONLY IF CREATING -----------------
  if (!existingAssetId) {
    const ref = doc(db, "assets", assetId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      setFormMessage(
        "Error: This Asset ID already exists. Please use a unique ID.",
        "red"
      );
      return; // stop saving
    }
  }
  // -------------------------------------------------------------------

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

    setFormMessage("Asset saved successfully!", "green");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);
  } catch (err) {
    setFormMessage("Error saving asset: " + err.message, "red");
  }
});
