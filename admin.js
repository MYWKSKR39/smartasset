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

// map related DOM
const toggleMapBtn = document.getElementById("toggleMapBtn");
const mapSection = document.getElementById("mapSection");
const mapStatus = document.getElementById("mapStatus");

// latest tracking info keyed by deviceId or assetId
// value has shape { data, timestampDate }
const latestDeviceInfo = new Map();

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

// add asset button, simple redirect to add.html
if (addAssetBtn) {
  addAssetBtn.addEventListener("click", () => {
    window.location.href = "add.html";
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
      const baseStatus = data.status || "";

      // compute tracking based status from latestDeviceInfo
      const statusCellText = computeTrackingStatusForAsset(assetId, baseStatus);

      tr.innerHTML = `
        <td>${assetId}</td>
        <td>${name}</td>
        <td>${category}</td>
        <td>${owner}</td>
        <td>${location}</td>
        <td>${statusCellText}</td>
        <td>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Remove</button>
        </td>
      `;

      // store assetId on the row so we can refresh it later
      tr.dataset.assetId = assetId;

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

    // after rebuilding rows, make sure tracking info is applied
    refreshAssetStatusesFromTracking();
  });
}

/**
 * Returns either:
 * - "Live" if last update less than 2 minutes old
 * - "Last seen X minutes ago"
 * - or the original status if there is no tracking info
 */
function computeTrackingStatusForAsset(assetId, fallbackStatus) {
  const info = latestDeviceInfo.get(assetId);
  if (!info || !info.timestampDate) {
    return fallbackStatus || "";
  }

  const now = Date.now();
  const ageMs = now - info.timestampDate.getTime();

  if (ageMs < 2 * 60 * 1000) {
    return "Live";
  }

  const minutes = Math.max(1, Math.floor(ageMs / 60000));
  const minutesText =
    minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;

  return `Last seen ${minutesText}`;
}

/**
 * Walks the asset table and updates the Status column using latestDeviceInfo.
 * This lets the status react in real time when tracking updates arrive.
 */
function refreshAssetStatusesFromTracking() {
  if (!assetTableBody) return;

  const rows = assetTableBody.querySelectorAll("tr");
  rows.forEach((row) => {
    const assetId = row.dataset.assetId;
    if (!assetId) return;

    const statusCell = row.children[5]; // 0 based: AssetId, Name, Category, Owner, Location, Status
    if (!statusCell) return;

    const current = statusCell.textContent || "";
    const updated = computeTrackingStatusForAsset(assetId, current);
    statusCell.textContent = updated;
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
          const note = prompt(
            "Optional rejection reason",
            data.adminNote || ""
          );
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
 * Live device map and tracking listener
 * -------------------------------------------------- */

let mapInstance = null;
let infoWindow = null;
const markerMap = new Map();
let locationsUnsub = null;

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

function initDeviceMap() {
  initDeviceMapInternal();
}
window.initDeviceMap = initDeviceMap;

function initDeviceMapInternal() {
  if (!mapSection) return;

  const mapDiv = document.getElementById("deviceMap");
  if (!mapDiv) return;

  if (!mapInstance) {
    mapInstance = new google.maps.Map(mapDiv, {
      center: { lat: 1.3521, lng: 103.8198 },
      zoom: 12,
    });
    infoWindow = new google.maps.InfoWindow();
  }

  if (locationsUnsub) return;

  const colRef = collection(db, "deviceLocations");

  locationsUnsub = onSnapshot(
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
          latestDeviceInfo.delete(id);
          return;
        }

        if (typeof lat !== "number" || typeof lng !== "number") {
          return;
        }

        const position = { lat, lng };
        let marker = markerMap.get(id);

        const batteryPct = data.batteryPct;
        const batteryTempC = data.batteryTempC;
        const batteryStatus = data.batteryStatus;
        const ts = data.timestamp?.toDate?.();

        const label =
          data.label ||
          data.deviceName ||
          `Device ${id}`;

        const infoLines = [];

        infoLines.push(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);

        if (typeof batteryPct === "number") {
          const statusText = typeof batteryStatus === "string"
            ? ` (${batteryStatus})`
            : "";
          infoLines.push(`Battery: ${batteryPct} percent${statusText}`);
        }

        if (typeof batteryTempC === "number") {
          infoLines.push(`Temperature: ${batteryTempC.toFixed(1)} °C`);
        }

        if (ts) {
          infoLines.push(`Last update: ${ts.toLocaleString()}`);
        }

        const infoHtml = `
          <div style="font-size:13px; line-height:1.4;">
            <strong>${label}</strong><br/>
            ${infoLines.join("<br/>")}
          </div>
        `;

        if (!marker) {
          marker = new google.maps.Marker({
            position,
            map: mapInstance,
            title: label,
          });
          markerMap.set(id, marker);
        } else {
          marker.setPosition(position);
          marker.setTitle(label);
        }

        marker.addListener("click", () => {
          if (!infoWindow) return;
          infoWindow.setContent(infoHtml);
          infoWindow.open({
            map: mapInstance,
            anchor: marker,
          });
        });

        // store latest tracking info keyed by device id
        const key = data.deviceId || id;
        latestDeviceInfo.set(key, {
          data,
          timestampDate: ts || null,
        });
      });

      // whenever tracking updates, refresh the asset table statuses
      refreshAssetStatusesFromTracking();
    },
    (err) => {
      console.error("Error listening to deviceLocations", err);
      if (mapStatus) {
        mapStatus.textContent =
          "Error loading locations: " + (err.code || err.message);
      }
    }
  );
}
