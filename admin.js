// admin.js

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- DEMO CONFIGURATION ---
const BASE_GMAIL_USER = "ernesttan24";
const GMAIL_DOMAIN = "@gmail.com";

// This must match the email you manually created in Firebase Console
const ADMIN_EMAIL = `${BASE_GMAIL_USER}+admin${GMAIL_DOMAIN}`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM references
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const addAssetBtn = document.getElementById("addAssetBtn");
const assetTableBody = document.getElementById("assetTableBody");
const requestTableBody = document.getElementById("requestTableBody");
const newEmpIdInput = document.getElementById("newEmpId");
const newEmpPasswordInput = document.getElementById("newEmpPassword");
const createEmpBtn = document.getElementById("createEmpBtn");
const createEmpMessage = document.getElementById("createEmpMessage");

// employee menu toggle
const toggleEmpMenu = document.getElementById("toggleEmpMenu");
const employeeMenu = document.getElementById("employeeMenu");

// map related DOM
const toggleMapBtn = document.getElementById("toggleMapBtn");
const mapSection = document.getElementById("mapSection");
const mapStatus = document.getElementById("mapStatus");

// helper to show text under Create employee login
function setEmpMessage(text, color) {
  if (!createEmpMessage) return;
  createEmpMessage.textContent = text;
  createEmpMessage.style.color = color;
}

/* ----------------------------------------------------
 * LIVE CACHE for deviceLocations (so assets table can show tracking)
 * -------------------------------------------------- */

let deviceLocationsUnsub = null;
const deviceLocationsCache = new Map();

function startDeviceLocationsListener() {
  if (deviceLocationsUnsub) return;

  const colRef = collection(db, "deviceLocations");

  deviceLocationsUnsub = onSnapshot(
    colRef,
    (snapshot) => {
      deviceLocationsCache.clear();
      snapshot.forEach((docSnap) => {
        deviceLocationsCache.set(docSnap.id, docSnap.data());
      });
      applyTrackingToAssetTable();
    },
    (err) => {
      console.error("Error listening to deviceLocations", err);
    }
  );
}

function formatTimestamp(ts) {
  if (!ts) return null;
  if (ts.toDate && typeof ts.toDate === "function") {
    return ts.toDate();
  }
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {}
  return null;
}

function applyTrackingToAssetTable() {
  if (!assetTableBody) return;

  const now = Date.now();

  // Build a reverse map: hardwareDeviceId → locationData
  // (deviceLocationsCache is already keyed by hardware device ID)
  const rows = assetTableBody.querySelectorAll("tr");

  rows.forEach((row) => {
    const trackingCell = row.querySelector(".asset-tracking-cell");
    if (!trackingCell) return;

    // Each row stores the linked hardware device ID as a data attribute
    const linkedDeviceId = row.dataset.deviceId;
    if (!linkedDeviceId) {
      trackingCell.textContent = "Not linked";
      trackingCell.title = "Edit the asset to add a Device ID";
      trackingCell.style.color = "#9ca3af";
      return;
    }

    const deviceData = deviceLocationsCache.get(linkedDeviceId);
    if (!deviceData) {
      trackingCell.textContent = "No signal";
      trackingCell.title = `Device ID: ${linkedDeviceId} — not reporting`;
      trackingCell.style.color = "#9ca3af";
      return;
    }

    const ts = formatTimestamp(deviceData.timestamp);
    if (!ts) {
      trackingCell.textContent = "Tracked, no timestamp";
      trackingCell.style.color = "";
      return;
    }

    const ageMs = now - ts.getTime();
    const ageMinutes = ageMs / 60000;
    const tsStr = `${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`;

    if (ageMinutes <= 2) {
      trackingCell.innerHTML = `<span style="color:#16a34a;font-weight:600;">● Live</span>`;
      trackingCell.title = `Last seen: ${tsStr}`;
    } else {
      trackingCell.textContent = `Last seen: ${tsStr}`;
      trackingCell.title = "";
      trackingCell.style.color = "";
    }
  });
}

/* ----------------------------------------------------
 * AUTH PROTECT (Redirect if not Admin)
 * -------------------------------------------------- */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  
  if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    window.location.href = "employee.html";
    return;
  }

  if (userEmailSpan) {
    userEmailSpan.textContent = user.displayName || "Admin"; 
  }

  startDeviceLocationsListener();
  startAssetsListener();
  startRequestsListener();
  setupMapUi();
});

// logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

// add asset button
if (addAssetBtn) {
  addAssetBtn.addEventListener("click", () => {
    window.location.href = "add.html";
  });
}

// toggle employee menu
if (toggleEmpMenu && employeeMenu) {
  toggleEmpMenu.addEventListener("click", () => {
    const isOpen = employeeMenu.style.display === "block";
    employeeMenu.style.display = isOpen ? "none" : "block";
    toggleEmpMenu.textContent = isOpen
      ? "Create employee login"
      : "Hide employee login";
  });
}

/* ----------------------------------------------------
 * Assets table
 * -------------------------------------------------- */

function startAssetsListener() {
  if (!assetTableBody) return;

  const colRef = collection(db, "assets");
  const q = query(colRef, orderBy("assetId"));

  onSnapshot(q, (snapshot) => {
    assetTableBody.innerHTML = "";

    if (snapshot.empty) {
      assetTableBody.innerHTML = '<tr><td colspan="8">No assets found.</td></tr>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tr = document.createElement("tr");

      const assetId = data.assetId || docSnap.id;
      const name = data.name || "";
      const category = data.category || "";
      const owner = data.owner || "";
      const location = data.location || "";
      const status = data.status || "";
      const deviceId = data.deviceId || "";

      // Store deviceId so applyTrackingToAssetTable can look it up
      if (deviceId) tr.dataset.deviceId = deviceId;

      // Status colour chip
      const statusColors = {
        "Available":  { bg: "#dcfce7", color: "#15803d" },
        "On loan":    { bg: "#dbeafe", color: "#1d4ed8" },
        "In repair":  { bg: "#fef9c3", color: "#a16207" },
        "Retired":    { bg: "#f3f4f6", color: "#6b7280" },
      };
      const chipStyle = statusColors[status] || { bg: "#f3f4f6", color: "#374151" };
      const statusChip = status
        ? `<span style="background:${chipStyle.bg};color:${chipStyle.color};padding:0.15rem 0.6rem;border-radius:999px;font-size:0.78rem;font-weight:600;">${status}</span>`
        : "";

      tr.innerHTML = `
        <td>${assetId}</td>
        <td>${name}</td>
        <td>${category}</td>
        <td>${owner}</td>
        <td>${location}</td>
        <td class="asset-status-cell">${statusChip}</td>
        <td class="asset-tracking-cell" style="color:#9ca3af;">Not linked</td>
        <td>
          <button class="edit-btn table-action-btn">Edit</button>
          <button class="delete-btn table-action-btn">Remove</button>
        </td>
      `;

      const editBtn = tr.querySelector(".edit-btn");
      const deleteBtn = tr.querySelector(".delete-btn");

      if (editBtn) {
        editBtn.addEventListener("click", () => {
          window.location.href = `add.html?assetId=${encodeURIComponent(docSnap.id)}`;
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          const ok = confirm(`Remove asset ${assetId}?`);
          if (!ok) return;
          await deleteDoc(doc(db, "assets", docSnap.id));
        });
      }

      assetTableBody.appendChild(tr);
    });

    applyTrackingToAssetTable();
  });
}

/* ----------------------------------------------------
 * Borrow requests table (UPDATED)
 * -------------------------------------------------- */

function startRequestsListener() {
  if (!requestTableBody) return;

  const colRef = collection(db, "borrowRequests");
  const q = query(colRef, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    requestTableBody.innerHTML = "";

    if (snapshot.empty) {
      requestTableBody.innerHTML = '<tr><td colspan="8">No borrow requests yet.</td></tr>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tr = document.createElement("tr");

      // Clean display name
      let displayName = data.requestedBy || "Unknown";
      if (displayName.includes("+")) {
        const parts = displayName.split("+");
        if (parts[1]) displayName = parts[1].split("@")[0];
      }

      // Status colour
      const statusText = data.status || "Pending";
      const statusColors = {
        "Pending":  { bg: "#fef9c3", color: "#a16207" },
        "Approved": { bg: "#dcfce7", color: "#15803d" },
        "Rejected": { bg: "#fee2e2", color: "#b91c1c" },
        "Returned": { bg: "#f3f4f6", color: "#6b7280" },
      };
      const sc = statusColors[statusText] || { bg: "#f3f4f6", color: "#374151" };
      const statusChip = `<span style="background:${sc.bg};color:${sc.color};padding:0.15rem 0.6rem;border-radius:999px;font-size:0.78rem;font-weight:600;">${statusText}</span>`;

      // Admin note shown if rejected
      const noteCell = (statusText === "Rejected" && data.adminNote)
        ? `<span style="font-size:0.75rem;color:#6b7280;display:block;">${data.adminNote}</span>`
        : "";

      tr.innerHTML = `
        <td>${data.assetId || ""}</td>
        <td>${displayName}</td>
        <td>${data.startDate || ""}</td>
        <td>${data.endDate || ""}</td>
        <td>${data.reason || ""}${noteCell}</td>
        <td>${statusChip}</td>
        <td>
          <button class="approve-btn table-action-btn" ${statusText !== "Pending" ? "disabled style='opacity:0.4;cursor:default;'" : ""}>Approve</button>
          <button class="reject-btn table-action-btn" ${["Rejected","Returned"].includes(statusText) ? "disabled style='opacity:0.4;cursor:default;'" : ""}>Reject</button>
          <button class="return-btn table-action-btn" ${statusText !== "Approved" ? "disabled style='opacity:0.4;cursor:default;'" : "style='background:#dbeafe;'"}>Returned</button>
        </td>
      `;

      const approveBtn = tr.querySelector(".approve-btn");
      const rejectBtn  = tr.querySelector(".reject-btn");
      const returnBtn  = tr.querySelector(".return-btn");

      if (approveBtn && statusText === "Pending") {
        approveBtn.addEventListener("click", async () => {
          const ok = confirm(`Approve borrow request for ${data.assetId}?`);
          if (!ok) return;
          // 1. Update request
          await updateDoc(doc(db, "borrowRequests", docSnap.id), {
            status: "Approved",
            reviewedAt: serverTimestamp(),
          });
          // 2. Auto-update asset status to "On loan"
          await updateDoc(doc(db, "assets", data.assetId), {
            status: "On loan",
          });
        });
      }

      if (rejectBtn && !["Rejected","Returned"].includes(statusText)) {
        rejectBtn.addEventListener("click", async () => {
          const note = prompt("Optional rejection reason:", data.adminNote || "");
          if (note === null) return; // cancelled
          const update = {
            status: "Rejected",
            reviewedAt: serverTimestamp(),
          };
          if (note.trim()) update.adminNote = note.trim();
          // 1. Update request
          await updateDoc(doc(db, "borrowRequests", docSnap.id), update);
          // 2. Set asset back to Available if it was on loan due to this request
          await updateDoc(doc(db, "assets", data.assetId), {
            status: "Available",
          });
        });
      }

      if (returnBtn && statusText === "Approved") {
        returnBtn.addEventListener("click", async () => {
          const ok = confirm(`Mark ${data.assetId} as returned?`);
          if (!ok) return;
          // 1. Update request
          await updateDoc(doc(db, "borrowRequests", docSnap.id), {
            status: "Returned",
            returnedAt: serverTimestamp(),
          });
          // 2. Set asset back to Available
          await updateDoc(doc(db, "assets", data.assetId), {
            status: "Available",
          });
        });
      }

      requestTableBody.appendChild(tr);
    });
  });
}

/* ----------------------------------------------------
 * Create employee login
 * -------------------------------------------------- */

if (createEmpBtn) {
  createEmpBtn.addEventListener("click", async () => {
    setEmpMessage("", "");
    const usernameRaw = newEmpIdInput.value.trim(); 
    const password = newEmpPasswordInput.value;

    if (!usernameRaw) {
      setEmpMessage("Please enter a Username or ID.", "red");
      return;
    }
    if (!password || password.length < 6) {
      setEmpMessage("Password must be at least 6 characters.", "red");
      return;
    }

    const realEmail = `${BASE_GMAIL_USER}+${usernameRaw}${GMAIL_DOMAIN}`;

    try {
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, realEmail, password);
      
      await updateProfile(userCredential.user, {
        displayName: usernameRaw
      });

      await signOut(secondaryAuth);

      setEmpMessage(`Created user: ${usernameRaw}`, "green");
      newEmpIdInput.value = "";
      newEmpPasswordInput.value = "";
      
    } catch (err) {
      console.error(err);
      setEmpMessage("Error: " + (err.code || err.message), "red");
    }
  });
}

/* ----------------------------------------------------
 * Live device map
 * -------------------------------------------------- */

let mapInstance = null;
const markerMap = new Map();
let mapLocationsUnsub = null;

function setupMapUi() {
  if (!toggleMapBtn || !mapSection) return;

  toggleMapBtn.addEventListener("click", () => {
    const visible = mapSection.style.display !== "none";
    if (visible) {
      mapSection.style.display = "none";
      toggleMapBtn.textContent = "Show map";
    } else {
      mapSection.style.display = "block";
      toggleMapBtn.textContent = "Hide map";

      if (typeof window.google !== "undefined") {
        initDeviceMapInternal();
      } else if (mapStatus) {
        mapStatus.textContent = "Loading map script...";
      }
    }
  });
}

function initDeviceMapInternal() {
  const mapDiv = document.getElementById("deviceMap");
  if (!mapDiv) return;

  if (!mapInstance && window.google && google.maps) {
    mapInstance = new google.maps.Map(mapDiv, {
      center: { lat: 1.3521, lng: 103.8198 },
      zoom: 12,
    });
  }

  if (mapLocationsUnsub) return;

  const colRef = collection(db, "deviceLocations");

  mapLocationsUnsub = onSnapshot(
    colRef,
    (snapshot) => {
      if (mapStatus) {
        mapStatus.textContent = snapshot.empty
          ? "No devices reporting location yet."
          : `Devices reporting: ${snapshot.size}`;
      }

      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = change.doc.data();
        const lat = data.lat;
        const lng = data.lng;

        if (change.type === "removed") {
          const marker = markerMap.get(id);
          if (marker) {
            marker.setMap(null);
            markerMap.delete(id);
          }
          return;
        }

        if (typeof lat !== "number" || typeof lng !== "number") return;

        const position = { lat, lng };
        const title = data.label || data.deviceName || `Device ${id}`;
        
        const ts = formatTimestamp(data.timestamp);
        const tsLine = ts
          ? `Updated: ${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`
          : "";

        const batPct  = data.batteryPct  != null ? `${data.batteryPct}%` : "?";
        const batStat = data.batteryStatus || "";
        const batTemp = data.batteryTempC != null ? `${Number(data.batteryTempC).toFixed(1)} °C` : null;

        const infoHtml = `
          <div style="font-family:system-ui,sans-serif;font-size:0.85rem;line-height:1.6;min-width:180px;">
            <strong style="font-size:0.95rem;">${title}</strong><br>
            🔋 ${batPct}${batStat ? ` · ${batStat}` : ""}${batTemp ? `<br>🌡️ ${batTemp}` : ""}
            ${tsLine ? `<br><span style="color:#888;font-size:0.78rem;">${tsLine}</span>` : ""}
          </div>`;

        let marker = markerMap.get(id);

        if (!marker) {
          marker = new google.maps.Marker({ position, map: mapInstance, title });
          const infoWindow = new google.maps.InfoWindow({ content: infoHtml });
          marker.addListener("click", () => infoWindow.open({ anchor: marker, map: mapInstance }));
          marker.infoWindow = infoWindow;
          markerMap.set(id, marker);
        } else {
          marker.setPosition(position);
          marker.setTitle(title);
          if (marker.infoWindow) marker.infoWindow.setContent(infoHtml);
        }
      });
    },
    (err) => {
      console.error("Error listening to map", err);
    }
  );
}
