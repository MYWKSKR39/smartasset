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
  addDoc,
  getDoc,
  setDoc,
  collection,
  serverTimestamp,
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
const deviceIdInput = document.getElementById("deviceId");

const formMessage = document.getElementById("formMessage");

// current asset id if editing
let existingAssetId = null;

// read assetId from query string, for example add.html?assetId=IT00123
(function readQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const assetId = params.get("assetId");
  if (assetId) {
    existingAssetId = assetId;
  }
})();

// helper to show messages
function setFormMessage(text, color) {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.style.color = color || "";
}

// auth guard
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    window.location.replace("employee.html");
    return;
  }

  // Auth confirmed — reveal the page
  document.body.style.visibility = "visible";
  userEmailSpan.textContent = user.displayName || "Admin";

  // admin logged in, if editing load the asset
  if (existingAssetId) {
    await loadAsset(existingAssetId);
  }
});

// back button
backBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

// logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("login.html");
});

// load data for edit mode
async function loadAsset(assetId) {
  try {
    const ref = doc(db, "assets", assetId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      setFormMessage(
        `Asset ${assetId} not found. You can create it as a new asset.`,
        "orange"
      );
      assetIdInput.value = assetId;
      return;
    }

    const data = snap.data();

    formTitle.textContent = `Edit asset ${assetId}`;

    assetIdInput.value = assetId;
    assetIdInput.disabled = true; // cannot change id in edit mode

    nameInput.value = data.name || "";
    categoryInput.value = data.category || "";
    ownerInput.value = data.owner || "";
    locationInput.value = data.location || "";
    statusInput.value = data.status || "";
    if (deviceIdInput) deviceIdInput.value = data.deviceId || "";

    // Show Device ID field only in edit mode
    const deviceIdRow = document.getElementById("deviceIdRow");
    if (deviceIdRow) deviceIdRow.style.display = "flex";
  } catch (err) {
    console.error("Error loading asset", err);
    setFormMessage("Error loading asset: " + (err.code || err.message), "red");
  }
}

// handle save
assetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormMessage("", "");
  assetIdInput.style.border = ""; // reset border

  const assetId = assetIdInput.value.trim();
  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const owner = ownerInput.value.trim();
  const location = locationInput.value.trim();
  const status = statusInput.value.trim();
  const deviceId = deviceIdInput ? deviceIdInput.value.trim() : "";

  if (!assetId || !name) {
    setFormMessage("Asset ID and Name are required.", "red");
    if (!assetId) {
      assetIdInput.style.border = "2px solid red";
    }
    if (!name) {
      nameInput.style.border = "2px solid red";
    }
    return;
  }

  // check for duplicate asset id only when creating a new asset
  if (!existingAssetId) {
    try {
      const ref = doc(db, "assets", assetId);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setFormMessage(
          "Error: Asset ID already exists. Please use a unique ID.",
          "red"
        );
        assetIdInput.style.border = "2px solid red";
        return; // stop saving
      }
    } catch (err) {
      console.error("Error checking duplicate Asset ID", err);
      setFormMessage(
        "Error checking Asset ID: " + (err.code || err.message),
        "red"
      );
      return;
    }
  }

  // save or update asset
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
        deviceId,
      },
      { merge: true }
    );

    setFormMessage("Asset saved successfully.", "green");

    // Log to history
    const action = existingAssetId ? "Edited" : "Added";
    const detail = existingAssetId
      ? `${name} updated`
      : `${name} added to inventory`;
    await addDoc(collection(db, "assetHistory"), {
      assetId,
      action,
      detail,
      timestamp: serverTimestamp(),
    });

    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);
  } catch (err) {
    console.error("Error saving asset", err);
    setFormMessage("Error saving asset: " + (err.code || err.message), "red");
  }
});
