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
// Map<deviceId, deviceData>
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

      // update tracking column in assets table whenever locations change
      applyTrackingToAssetTable();
    },
    (err) => {
      console.error("Error listening to deviceLocations", err);
    }
  );
}

function formatTimestamp(ts) {
  if (!ts) return null;

  // Firestore Timestamp
  if (ts.toDate && typeof ts.toDate === "function") {
    return ts.toDate();
  }

  // number millis or string date
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {}

  return null;
}

function applyTrackingToAssetTable() {
  if (!assetTableBody) return;

  const now = Date.now();
  const rows = assetTableBody.querySelectorAll("tr");

  rows.forEach((row) => {
    const idCell = row.cells && row.cells[0];
    if (!idCell) return;

    const assetId = (idCell.textContent || "").trim();
    if (!assetId) return;

    const trackingCell = row.querySelector(".asset-tracking-cell");
    if (!trackingCell) return;

    const deviceData = deviceLocationsCache.get(assetId);

    if (!deviceData) {
      trackingCell.textContent = "Not tracked";
      trackingCell.title = "";
      return;
    }

    const ts = formatTimestamp(deviceData.timestamp);
    if (!ts) {
      trackingCell.textContent = "Tracked, no timestamp";
      trackingCell.title = "";
      return;
    }

    const ageMs = now - ts.getTime();
    const ageMinutes = ageMs / 60000;

    if (ageMinutes <= 2) {
      trackingCell.textContent = "Live";
      trackingCell.title = `Last seen: ${ts.toLocaleString()}`;
    } else {
      trackingCell.textContent = `Last seen: ${ts.toLocaleString()}`;
      trackingCell.title = `Last seen: ${ts.toLocaleString()}`;
    }
  });
}

/* ----------------------------------------------------
 * AUTH
 * -------------------------------------------------- */

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

  // IMPORTANT: start locations listener even if map is hidden
  startDeviceLocationsListener();

  // start normal listeners
  startAssetsListener();
  startRequestsListener();

  // map support
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
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8; // Asset table now has 8 columns including Tracking
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
        <td class="asset-status-cell">${status}</td>
        <td class="asset-tracking-cell">Not tracked</td>
        <td>
          <button class="edit-btn table-action-btn">Edit</button>
          <button class="delete-btn table-action-btn">Remove</button>
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

    // after rendering assets, apply tracking based on cached locations
    applyTrackingToAssetTable();
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
          <button class="approve-btn table-action-btn">Approve</button>
          <button class="reject-btn table-action-btn">Reject</button>
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
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, email, password);

      setEmpMessage(`Employee account created for ${email}.`, "green");
      newEmpIdInput.value = "";
      newEmpPasswordInput.value = "";
    } catch (err) {
      console.error(err);
      setEmpMessage(
        "Error creating employee: " + (err.code || err.message),
        "red"
      );
    }
  });
}

/* ----------------------------------------------------
 * Live device map (reads Firestore in realtime)
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
          : `Devices reporting location: ${snapshot.size}`;
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

        const batteryPct =
          typeof data.batteryPct === "number" ? `${data.batteryPct} percent` : "Unknown";
        const batteryStatus = data.batteryStatus || "";
        const batteryLine =
          batteryStatus !== ""
            ? `Battery: ${batteryPct} (${batteryStatus})`
            : `Battery: ${batteryPct}`;

        const tempLine =
          typeof data.batteryTempC === "number"
            ? `Temperature: ${data.batteryTempC.toFixed(1)} °C`
            : "";

        const ts = formatTimestamp(data.timestamp);
        const tsLine = ts ? `Last update: ${ts.toLocaleString()}` : "Last update: Unknown";

        const title = data.label || data.deviceName || `Device ${id}`;

        const infoHtml =
          `${title}<br>` +
          `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}<br>` +
          `${batteryLine}<br>` +
          (tempLine ? `${tempLine}<br>` : "") +
          tsLine;

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
    },
    (err) => {
      console.error("Error listening to deviceLocations for map", err);
      if (mapStatus) {
        mapStatus.textContent = "Error loading locations: " + (err.code || err.message);
      }
    }
  );
}
