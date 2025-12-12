// admin.js

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
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

const ADMIN_EMAIL = "admin@smartasset.com";

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

// live device cache
// key is either assetId (preferred) or docId, value is the Firestore data
const deviceLocationsByAssetId = new Map();
const deviceLocationsByDocId = new Map();

const LIVE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

// helper to show text under Create employee login
function setEmpMessage(text, color) {
  if (!createEmpMessage) return;
  createEmpMessage.textContent = text;
  createEmpMessage.style.color = color;
}

// auth guard, only admin can stay here
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    window.location.href = "employee.html";
    return;
  }

  if (userEmailSpan) {
    userEmailSpan.textContent = user.email;
  }

  // start normal listeners
  startAssetsListener();
  startRequestsListener();

  // always listen to deviceLocations for live tracking status
  startDeviceLocationsListener();

  // map UI (map script will only be used when user clicks show map)
  setupMapUi();
});

// logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

// add asset button, simple redirect to add.html
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
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.textContent = "No assets found.";
      tr.appendChild(td);
      assetTableBody.appendChild(tr);
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

      tr.innerHTML = `
        <td>${assetId}</td>
        <td>${name}</td>
        <td>${category}</td>
        <td>${owner}</td>
        <td>${location}</td>
        <td class="asset-status-cell" data-base-status="${escapeHtml(status)}">${status}</td>
        <td>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Remove</button>
        </td>
      `;

      const editBtn = tr.querySelector(".edit-btn");
      const deleteBtn = tr.querySelector(".delete-btn");

      if (editBtn) {
        editBtn.addEventListener("click", () => {
          window.location.href = `add.html?assetId=${encodeURIComponent(
            docSnap.id
          )}`;
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

    // after rendering assets, apply live tracking indicators (if any devices are already cached)
    applyLiveTrackingToAssetTable();
  });
}

/* ----------------------------------------------------
 * Borrow requests table
 * -------------------------------------------------- */

function startRequestsListener() {
  if (!requestTableBody) return;

  const colRef = collection(db, "borrowRequests");
  const q = query(colRef, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    requestTableBody.innerHTML = "";

    if (snapshot.empty) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.textContent = "No borrow requests yet.";
      tr.appendChild(td);
      requestTableBody.appendChild(tr);
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${data.assetId || ""}</td>
        <td>${data.requestedBy || ""}</td>
        <td>${data.startDate || ""}</td>
        <td>${data.endDate || ""}</td>
        <td>${data.reason || ""}</td>
        <td>${data.status || ""}</td>
        <td>
          <button class="approve-btn">Approve</button>
          <button class="reject-btn">Reject</button>
        </td>
      `;

      const approveBtn = tr.querySelector(".approve-btn");
      const rejectBtn = tr.querySelector(".reject-btn");

      if (approveBtn) {
        approveBtn.addEventListener("click", async () => {
          await updateDoc(doc(db, "borrowRequests", docSnap.id), {
            status: "Approved",
            reviewedAt: serverTimestamp(),
          });
        });
      }

      if (rejectBtn) {
        rejectBtn.addEventListener("click", async () => {
          const note = prompt("Optional rejection reason", data.adminNote || "");
          const update = {
            status: "Rejected",
            reviewedAt: serverTimestamp(),
          };
          if (note && note.trim() !== "") {
            update.adminNote = note.trim();
          }
          await updateDoc(doc(db, "borrowRequests", docSnap.id), update);
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
    const idRaw = newEmpIdInput.value.trim();
    const password = newEmpPasswordInput.value;

    if (!/^\d{5}$/.test(idRaw)) {
      setEmpMessage("Employee ID must be 5 digits.", "red");
      return;
    }
    if (!password || password.length < 6) {
      setEmpMessage("Password must be at least 6 characters.", "red");
      return;
    }

    const email = `${idRaw}@smartasset.com`;

    try {
      // use a secondary app so admin does not get logged out
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, email, password);

      setEmpMessage(`Employee account created for ${email}.`, "green");
      newEmpIdInput.value = "";
      newEmpPasswordInput.value = "";
    } catch (err) {
      console.error(err);
      setEmpMessage("Error creating employee: " + (err.code || err.message), "red");
    }
  });
}

/* ----------------------------------------------------
 * Device locations listener (always on for admin)
 * -------------------------------------------------- */

let deviceLocationsUnsub = null;

function startDeviceLocationsListener() {
  if (deviceLocationsUnsub) return;

  const colRef = collection(db, "deviceLocations");

  deviceLocationsUnsub = onSnapshot(
    colRef,
    (snapshot) => {
      deviceLocationsByAssetId.clear();
      deviceLocationsByDocId.clear();

      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data() || {};

        // Prefer linking by assetId if your Android sends it as deviceId or assetId
        // Many setups use "deviceId" as the asset id, keep both options
        const assetId = (data.assetId || data.deviceId || "").toString().trim();

        if (assetId) {
          deviceLocationsByAssetId.set(assetId, data);
        }
        deviceLocationsByDocId.set(id, data);
      });

      // Update asset table status badges even if map is hidden
      applyLiveTrackingToAssetTable();

      // If map is currently shown, also update markers
      if (mapInstance) {
        applyMarkersFromCache();
      }

      if (mapStatus) {
        if (snapshot.empty) {
          mapStatus.textContent = "No devices reporting location yet.";
        } else {
          mapStatus.textContent = `Devices reporting location: ${snapshot.size}`;
        }
      }
    },
    (err) => {
      console.error("Error listening to deviceLocations", err);
      if (mapStatus) {
        mapStatus.textContent = "Error loading locations: " + (err.code || err.message);
      }
    }
  );
}

function getTimestampMs(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate().getTime();
  const d = new Date(ts);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isLiveDevice(data) {
  const ms = getTimestampMs(data.timestamp);
  if (!ms) return false;
  return Date.now() - ms <= LIVE_WINDOW_MS;
}

function getDeviceLabel(data, fallback) {
  return (data.label || data.deviceName || fallback || "Unknown device").toString();
}

function applyLiveTrackingToAssetTable() {
  if (!assetTableBody) return;

  const rows = assetTableBody.querySelectorAll("tr");
  rows.forEach((row) => {
    const idCell = row.cells && row.cells[0];
    const statusCell = row.querySelector(".asset-status-cell");
    if (!idCell || !statusCell) return;

    const assetId = (idCell.textContent || "").trim();
    if (!assetId) return;

    const baseStatus = statusCell.getAttribute("data-base-status") || statusCell.textContent || "";

    // Link priority:
    // 1) match assetId to data.assetId or data.deviceId (deviceLocationsByAssetId)
    // 2) if you later choose to store doc id same as assetId, this still works
    const deviceData =
      deviceLocationsByAssetId.get(assetId) ||
      deviceLocationsByDocId.get(assetId) ||
      null;

    if (!deviceData) {
      statusCell.textContent = baseStatus;
      return;
    }

    if (!isLiveDevice(deviceData)) {
      statusCell.textContent = baseStatus;
      return;
    }

    const label = getDeviceLabel(deviceData, assetId);
    statusCell.textContent = `${baseStatus} [Tracked live by ${label}]`;
  });
}

/* ----------------------------------------------------
 * Live device map UI
 * -------------------------------------------------- */

let mapInstance = null;
const markerMap = new Map(); // key -> google.maps.Marker

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

  // markers are driven from the cached deviceLocations listener
  applyMarkersFromCache();
}

function applyMarkersFromCache() {
  if (!mapInstance || !window.google || !google.maps) return;

  // Use docId cache so every device shows, even if assetId is empty
  deviceLocationsByDocId.forEach((data, id) => {
    const lat = data.lat;
    const lng = data.lng;

    if (typeof lat !== "number" || typeof lng !== "number") return;

    const position = { lat, lng };

    const batteryPct =
      typeof data.batteryPct === "number" ? `${data.batteryPct} percent` : "Unknown";
    const batteryStatus = data.batteryStatus || "";
    const batteryLine =
      batteryStatus !== "" ? `Battery: ${batteryPct} (${batteryStatus})` : `Battery: ${batteryPct}`;

    const tempLine =
      typeof data.batteryTempC === "number" ? `Temperature: ${data.batteryTempC.toFixed(1)} °C` : "";

    const tsMs = getTimestampMs(data.timestamp);
    const tsLine = tsMs ? `Last update: ${new Date(tsMs).toLocaleString()}` : "Last update: Unknown";

    const title = getDeviceLabel(data, `Device ${id}`);

    const infoHtml =
      `${escapeHtml(title)}<br>` +
      `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}<br>` +
      `${escapeHtml(batteryLine)}<br>` +
      (tempLine ? `${escapeHtml(tempLine)}<br>` : "") +
      escapeHtml(tsLine);

    let marker = markerMap.get(id);

    if (!marker) {
      marker = new google.maps.Marker({
        position,
        map: mapInstance,
        title,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: infoHtml,
      });

      marker.addListener("click", () => {
        infoWindow.open({
          anchor: marker,
          map: mapInstance,
          shouldFocus: false,
        });
      });

      marker.infoWindow = infoWindow;
      markerMap.set(id, marker);
    } else {
      marker.setPosition(position);
      marker.setTitle(title);
      if (marker.infoWindow) {
        marker.infoWindow.setContent(infoHtml);
      }
    }
  });
}

/* ----------------------------------------------------
 * Small helpers
 * -------------------------------------------------- */

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
