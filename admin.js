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
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- DEMO CONFIGURATION ---
const BASE_GMAIL_USER = "ernesttan24";
const GMAIL_DOMAIN = "@gmail.com";
const ADMIN_EMAIL = `${BASE_GMAIL_USER}+admin${GMAIL_DOMAIN}`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM references
const userEmailSpan       = document.getElementById("userEmail");
const logoutBtn           = document.getElementById("logoutBtn");
const addAssetBtn         = document.getElementById("addAssetBtn");
const assetTableBody      = document.getElementById("assetTableBody");
const requestTableBody    = document.getElementById("requestTableBody");
const newEmpIdInput       = document.getElementById("newEmpId");
const newEmpPasswordInput = document.getElementById("newEmpPassword");
const createEmpBtn        = document.getElementById("createEmpBtn");
const createEmpMessage    = document.getElementById("createEmpMessage");
const toggleEmpMenu       = document.getElementById("toggleEmpMenu");
const employeeMenu        = document.getElementById("employeeMenu");
const toggleMapBtn        = document.getElementById("toggleMapBtn");
const mapSection          = document.getElementById("mapSection");
const mapStatus           = document.getElementById("mapStatus");

function setEmpMessage(text, color) {
  if (!createEmpMessage) return;
  createEmpMessage.textContent = text;
  createEmpMessage.style.color = color;
}

/* ----------------------------------------------------
 * Asset History Logger
 * -------------------------------------------------- */

async function addToHistory(assetId, action, detail = "") {
  try {
    await addDoc(collection(db, "assetHistory"), {
      assetId,
      action,
      detail,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write history:", err);
  }
}

/* ----------------------------------------------------
 * History Modal
 * -------------------------------------------------- */

const historyModal = document.createElement("div");
historyModal.id = "historyModal";
historyModal.style.cssText = `
  display:none; position:fixed; inset:0; z-index:1000;
  background:rgba(0,0,0,0.45); align-items:center; justify-content:center;
`;
historyModal.innerHTML = `
  <div style="background:#fff;border-radius:16px;padding:1.5rem 2rem;max-width:600px;
              width:90%;max-height:80vh;display:flex;flex-direction:column;gap:1rem;
              box-shadow:0 20px 40px rgba(0,0,0,0.2);">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <h2 id="historyModalTitle" style="margin:0;font-size:1.1rem;">Asset History</h2>
      <button id="closeHistoryModal" style="background:none;border:none;font-size:1.4rem;
        cursor:pointer;color:#6b7280;line-height:1;">×</button>
    </div>
    <div id="historyModalBody" style="overflow-y:auto;flex:1;">
      <p style="color:#9ca3af;font-size:0.85rem;">Loading...</p>
    </div>
  </div>
`;
document.body.appendChild(historyModal);

document.getElementById("closeHistoryModal").addEventListener("click", () => {
  historyModal.style.display = "none";
});
historyModal.addEventListener("click", (e) => {
  if (e.target === historyModal) historyModal.style.display = "none";
});

let historyUnsub    = null;
let historyReqUnsub = null;

function openHistoryModal(assetId) {
  historyModal.style.display = "flex";
  document.getElementById("historyModalTitle").textContent = `History — ${assetId}`;
  const body = document.getElementById("historyModalBody");
  body.innerHTML = `<p style="color:#9ca3af;font-size:0.85rem;">Loading...</p>`;

  if (historyUnsub) historyUnsub();
  if (historyReqUnsub) historyReqUnsub();

  const actionColors = {
    "Borrowed":  { bg: "#dbeafe", color: "#1d4ed8" },
    "Returned":  { bg: "#dcfce7", color: "#15803d" },
    "Rejected":  { bg: "#fee2e2", color: "#b91c1c" },
    "Pending":   { bg: "#fef9c3", color: "#a16207" },
    "Added":     { bg: "#f3e8ff", color: "#7c3aed" },
    "Edited":    { bg: "#fef9c3", color: "#a16207" },
    "Removed":   { bg: "#fee2e2", color: "#b91c1c" },
  };

  let historyDocs = [];
  let requestDocs = [];

  function renderMerged() {
    const events = [];

    historyDocs.forEach((d) => {
      const h  = d.data();
      const ts = h.timestamp?.toDate?.() || null;
      events.push({ ts, action: h.action, detail: h.detail || "" });
    });

    requestDocs.forEach((d) => {
      const r = d.data();
      let name = r.requestedBy || "Unknown";
      if (name.includes("+")) {
        const parts = name.split("+");
        if (parts[1]) name = parts[1].split("@")[0];
      }
      const dateRange = `${r.startDate || "?"} → ${r.endDate || "?"}`;

      if (r.createdAt) {
        events.push({
          ts: r.createdAt.toDate?.() || null,
          action: "Requested",
          detail: `${name} requested · ${dateRange}${r.reason ? ` · "${r.reason}"` : ""}`,
        });
      }
      if (r.reviewedAt && r.status === "Approved") {
        events.push({
          ts: r.reviewedAt.toDate?.() || null,
          action: "Borrowed",
          detail: `Approved for ${name} · ${dateRange}`,
        });
      }
      if (r.reviewedAt && r.status === "Rejected") {
        events.push({
          ts: r.reviewedAt.toDate?.() || null,
          action: "Rejected",
          detail: `Request by ${name} rejected${r.adminNote ? `: ${r.adminNote}` : ""}`,
        });
      }
      if (r.returnedAt) {
        events.push({
          ts: r.returnedAt.toDate?.() || null,
          action: "Returned",
          detail: `Returned by ${name}`,
        });
      }
    });

    if (events.length === 0) {
      body.innerHTML = `<p style="color:#9ca3af;font-size:0.85rem;">No history recorded yet.</p>`;
      return;
    }

    events.sort((a, b) => {
      if (!a.ts) return -1;
      if (!b.ts) return 1;
      return b.ts - a.ts;
    });

    body.innerHTML = events.map(({ ts, action, detail }) => {
      const timeStr = ts
        ? `${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`
        : "Just now";
      const ac = actionColors[action] || { bg: "#f3f4f6", color: "#374151" };
      return `
        <div style="display:flex;align-items:flex-start;gap:0.75rem;
                    padding:0.65rem 0;border-bottom:1px solid #f3f4f6;">
          <span style="background:${ac.bg};color:${ac.color};padding:0.15rem 0.6rem;
                       border-radius:999px;font-size:0.75rem;font-weight:600;
                       white-space:nowrap;flex-shrink:0;">${action}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.85rem;color:#111827;">${detail}</div>
            <div style="font-size:0.75rem;color:#9ca3af;margin-top:0.1rem;">${timeStr}</div>
          </div>
        </div>`;
    }).join("");
  }

  const qHistory = query(
    collection(db, "assetHistory"),
    where("assetId", "==", assetId),
    orderBy("timestamp", "desc")
  );
  historyUnsub = onSnapshot(qHistory, (snapshot) => {
    historyDocs = snapshot.docs;
    renderMerged();
  });

  const qReqs = query(
    collection(db, "borrowRequests"),
    where("assetId", "==", assetId)
  );
  historyReqUnsub = onSnapshot(qReqs, (snapshot) => {
    requestDocs = snapshot.docs;
    renderMerged();
  });
}

/* ----------------------------------------------------
 * LIVE CACHE for deviceLocations
 * -------------------------------------------------- */

let deviceLocationsUnsub = null;
const deviceLocationsCache = new Map();

function startDeviceLocationsListener() {
  if (deviceLocationsUnsub) return;
  const colRef = collection(db, "deviceLocations");
  deviceLocationsUnsub = onSnapshot(colRef, (snapshot) => {
    deviceLocationsCache.clear();
    snapshot.forEach((docSnap) => {
      deviceLocationsCache.set(docSnap.id, docSnap.data());
    });
    applyTrackingToAssetTable();
  }, (err) => {
    console.error("Error listening to deviceLocations", err);
  });
}

function formatTimestamp(ts) {
  if (!ts) return null;
  if (ts.toDate && typeof ts.toDate === "function") return ts.toDate();
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
    const trackingCell = row.querySelector(".asset-tracking-cell");
    if (!trackingCell) return;
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
    const ageMinutes = (now - ts.getTime()) / 60000;
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
 * Geofence Alerts
 * -------------------------------------------------- */

// Relative time helper — "Just now", "2 mins ago", "1 hr ago", etc.
function timeAgo(ts) {
  if (!ts) return "—";
  const secs = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (secs < 10)  return "Just now";
  if (secs < 60)  return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

// Store latest per-device data so the ticker can refresh without a Firestore re-read
const geofenceDeviceMap = new Map(); // deviceId -> { ts, label, isExit }
let geofenceTickerInterval = null;

// Look up asset name from allAssets by matching deviceId field
function getAssetNameForDevice(hwDeviceId) {
  const asset = allAssets.find(a => a.deviceId === hwDeviceId);
  return asset ? (asset.name || asset.assetId || null) : null;
}

function renderGeofenceRows() {
  const alertsBody = document.getElementById("geofenceAlertsBody");
  if (!alertsBody) return;

  if (geofenceDeviceMap.size === 0) {
    alertsBody.innerHTML = `
      <tr><td colspan="5" style="color:#9ca3af;text-align:center;padding:1rem;">
        No devices tracked yet.
      </td></tr>`;
    return;
  }

  alertsBody.innerHTML = "";
  geofenceDeviceMap.forEach(({ ts, label, deviceId, isExit }) => {
    const chipBg    = isExit ? "#fee2e2" : "#dcfce7";
    const chipColor = isExit ? "#b91c1c" : "#15803d";
    const chipText  = isExit ? "⚠ Outside Zone" : "✓ Inside Zone";
    const absolute  = ts ? `${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}` : "—";

    // Prefer asset name; fall back to hardware label
    const assetName = getAssetNameForDevice(deviceId) || label;

    // Show "● Live" if updated within last 2 minutes, else relative time
    const ageMs   = ts ? Date.now() - ts.getTime() : Infinity;
    const isLive  = ageMs <= 2 * 60 * 1000;
    const timeCell = isLive
      ? `<span style="color:#16a34a;font-weight:600;">● Live</span>`
      : `<span style="color:#9ca3af;" title="${absolute}">${timeAgo(ts)}</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-size:0.85rem;font-weight:500;">${assetName}</td>
      <td style="font-family:monospace;font-size:0.75rem;color:#6b7280;">${deviceId}</td>
      <td>
        <span style="background:${chipBg};color:${chipColor};padding:0.15rem 0.6rem;
                     border-radius:999px;font-size:0.78rem;font-weight:600;">
          ${chipText}
        </span>
      </td>
      <td style="color:#6b7280;font-size:0.82rem;">East Singapore Zone</td>
      <td style="font-size:0.78rem;">${timeCell}</td>
    `;
    alertsBody.appendChild(tr);
  });
}

function startGeofenceAlertsListener() {
  const alertsBody = document.getElementById("geofenceAlertsBody");
  if (!alertsBody) return;

  const q = query(
    collection(db, "geofenceAlerts"),
    orderBy("timestamp", "desc")
  );

  onSnapshot(q, (snapshot) => {
    // Rebuild latest-per-device from geofence events
    const latestPerDevice = new Map();
    snapshot.forEach((docSnap) => {
      const d  = docSnap.data();
      const id = d.deviceId || "unknown";
      if (!latestPerDevice.has(id)) latestPerDevice.set(id, d);
    });

    // Fill in devices with location data but no geofence events
    deviceLocationsCache.forEach((locData, hwId) => {
      if (!latestPerDevice.has(hwId)) {
        const lat = locData.lat;
        const lng = locData.lng;
        if (typeof lat === "number" && typeof lng === "number") {
          const inside = isInsideGeofence(lat, lng);
          latestPerDevice.set(hwId, {
            deviceId:  hwId,
            event:     inside ? "Entered East Singapore Zone" : "Exited East Singapore Zone",
            isAlert:   !inside,
            timestamp: locData.timestamp,
          });
        }
      }
    });

    // Update the shared map
    geofenceDeviceMap.clear();
    latestPerDevice.forEach((d, deviceId) => {
      const locData = deviceLocationsCache.get(deviceId);
      const isExit  = d.isAlert === true ||
        (d.event && d.event.toLowerCase().includes("exit"));
      geofenceDeviceMap.set(deviceId, {
        deviceId,
        label:  locData?.label || deviceId,
        ts:     formatTimestamp(d.timestamp),
        isExit,
      });
    });

    renderGeofenceRows();
  }, (err) => {
    console.error("Error listening to geofenceAlerts", err);
  });

  // Refresh relative timestamps every 30 seconds
  if (geofenceTickerInterval) clearInterval(geofenceTickerInterval);
  geofenceTickerInterval = setInterval(renderGeofenceRows, 30_000);
}

// Check if a coordinate is inside the East Singapore geofence
function isInsideGeofence(lat, lng) {
  const centreLat = 1.3560;
  const centreLng = 103.9700;
  const radiusM   = 6000;

  const R    = 6371000; // Earth radius in metres
  const dLat = (lat - centreLat) * Math.PI / 180;
  const dLng = (lng - centreLng) * Math.PI / 180;
  const a    = Math.sin(dLat/2) * Math.sin(dLat/2) +
               Math.cos(centreLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
               Math.sin(dLng/2) * Math.sin(dLng/2);
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return dist <= radiusM;
}

/* ----------------------------------------------------
 * AUTH PROTECT
 * -------------------------------------------------- */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    window.location.replace("employee.html");
    return;
  }

  document.body.style.visibility = "visible";

  if (userEmailSpan) {
    userEmailSpan.textContent = user.displayName || "Admin";
  }

  startDeviceLocationsListener();
  startAssetsListener();
  startRequestsListener();
  startGeofenceAlertsListener();
  setupMapUi();
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

if (addAssetBtn) {
  addAssetBtn.addEventListener("click", () => {
    window.location.href = "add.html";
  });
}

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
 * Assets table — sortable columns
 * -------------------------------------------------- */

let allAssets = [];
let sortKey   = "assetId";
let sortAsc   = true;

function startAssetsListener() {
  if (!assetTableBody) return;

  onSnapshot(query(collection(db, "assets")), (snapshot) => {
    allAssets = [];
    snapshot.forEach((docSnap) => {
      allAssets.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderAssets();
  });

  const table = assetTableBody.closest("table");
  if (table) {
    table.querySelectorAll("th[data-sort]").forEach((th) => {
      th.style.cursor     = "pointer";
      th.style.userSelect = "none";
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (sortKey === key) {
          sortAsc = !sortAsc;
        } else {
          sortKey = key;
          sortAsc = true;
        }
        table.querySelectorAll("th[data-sort]").forEach((h) => {
          h.querySelector(".sort-icon").textContent = " ↕";
        });
        th.querySelector(".sort-icon").textContent = sortAsc ? " ↑" : " ↓";
        renderAssets();
      });
    });
  }
}

function renderAssets() {
  if (!assetTableBody) return;

  if (allAssets.length === 0) {
    assetTableBody.innerHTML = '<tr><td colspan="9">No assets found.</td></tr>';
    return;
  }

  const sorted = [...allAssets].sort((a, b) => {
    const aVal = (a[sortKey] || "").toString().toLowerCase();
    const bVal = (b[sortKey] || "").toString().toLowerCase();
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  assetTableBody.innerHTML = "";

  const statusColors = {
    "Available": { bg: "#dcfce7", color: "#15803d" },
    "In use":    { bg: "#dbeafe", color: "#1d4ed8" },
    "On loan":   { bg: "#e0e7ff", color: "#4338ca" },
    "Active":    { bg: "#dbeafe", color: "#1d4ed8" },
    "In repair": { bg: "#fef9c3", color: "#a16207" },
    "Retired":   { bg: "#fee2e2", color: "#b91c1c" },
  };

  sorted.forEach((data) => {
    const tr = document.createElement("tr");

    const assetId  = data.assetId || data.id;
    const name     = data.name     || "";
    const category = data.category || "";
    const owner    = data.owner    || "";
    const location = data.location || "";
    const status   = data.status   || "";
    const deviceId = data.deviceId || "";

    if (deviceId) tr.dataset.deviceId = deviceId;

    const chipStyle  = statusColors[status] || { bg: "#f3f4f6", color: "#374151" };
    const statusChip = status
      ? `<span style="background:${chipStyle.bg};color:${chipStyle.color};
                      padding:0.15rem 0.6rem;border-radius:999px;
                      font-size:0.78rem;font-weight:600;">${status}</span>`
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
        <button class="history-btn table-action-btn">History</button>
        <button class="edit-btn table-action-btn">Edit</button>
        <button class="delete-btn table-action-btn">Remove</button>
      </td>
    `;

    tr.querySelector(".history-btn").addEventListener("click", () => openHistoryModal(assetId));
    tr.querySelector(".edit-btn").addEventListener("click", () => {
      window.location.href = `add.html?assetId=${encodeURIComponent(data.id)}`;
    });
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      const ok = confirm(`Remove asset ${assetId}?`);
      if (!ok) return;
      await addToHistory(assetId, "Removed", `Asset ${assetId} (${name}) permanently removed`);
      await deleteDoc(doc(db, "assets", data.id));
    });

    assetTableBody.appendChild(tr);
  });

  applyTrackingToAssetTable();
}

/* ----------------------------------------------------
 * Borrow requests table
 * -------------------------------------------------- */

function startRequestsListener() {
  if (!requestTableBody) return;

  const q = query(collection(db, "borrowRequests"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    requestTableBody.innerHTML = "";

    if (snapshot.empty) {
      requestTableBody.innerHTML = '<tr><td colspan="7">No borrow requests yet.</td></tr>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tr   = document.createElement("tr");

      let displayName = data.requestedBy || "Unknown";
      if (displayName.includes("+")) {
        const parts = displayName.split("+");
        if (parts[1]) displayName = parts[1].split("@")[0];
      }

      const statusText   = data.status || "Pending";
      const statusColors = {
        "Pending":  { bg: "#fef9c3", color: "#a16207" },
        "Approved": { bg: "#dcfce7", color: "#15803d" },
        "Rejected": { bg: "#fee2e2", color: "#b91c1c" },
        "Returned": { bg: "#f3f4f6", color: "#6b7280" },
      };
      const sc         = statusColors[statusText] || { bg: "#f3f4f6", color: "#374151" };
      const statusChip = `<span style="background:${sc.bg};color:${sc.color};
                           padding:0.15rem 0.6rem;border-radius:999px;
                           font-size:0.78rem;font-weight:600;">${statusText}</span>`;
      const noteCell   = (statusText === "Rejected" && data.adminNote)
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
          <button class="approve-btn table-action-btn"
            ${statusText !== "Pending" ? "disabled style='opacity:0.4;cursor:default;'" : ""}>
            Approve</button>
          <button class="reject-btn table-action-btn"
            ${["Rejected","Returned"].includes(statusText) ? "disabled style='opacity:0.4;cursor:default;'" : ""}>
            Reject</button>
          <button class="return-btn table-action-btn"
            ${statusText !== "Approved" ? "disabled style='opacity:0.4;cursor:default;'" : "style='background:#dbeafe;'"}>
            Returned</button>
        </td>
      `;

      const approveBtn = tr.querySelector(".approve-btn");
      const rejectBtn  = tr.querySelector(".reject-btn");
      const returnBtn  = tr.querySelector(".return-btn");

      if (approveBtn && statusText === "Pending") {
        approveBtn.addEventListener("click", async () => {
          const ok = confirm(`Approve borrow request for ${data.assetId}?`);
          if (!ok) return;
          await updateDoc(doc(db, "borrowRequests", docSnap.id), {
            status: "Approved", reviewedAt: serverTimestamp(),
          });
          await updateDoc(doc(db, "assets", data.assetId), { status: "On loan" });
          await addToHistory(data.assetId, "Borrowed",
            `Approved for ${displayName} · ${data.startDate} → ${data.endDate}`);
        });
      }

      if (rejectBtn && !["Rejected","Returned"].includes(statusText)) {
        rejectBtn.addEventListener("click", async () => {
          const note = prompt("Optional rejection reason:", data.adminNote || "");
          if (note === null) return;
          const update = { status: "Rejected", reviewedAt: serverTimestamp() };
          if (note.trim()) update.adminNote = note.trim();
          await updateDoc(doc(db, "borrowRequests", docSnap.id), update);
          await updateDoc(doc(db, "assets", data.assetId), { status: "Available" });
          await addToHistory(data.assetId, "Rejected",
            `Request by ${displayName} rejected${note.trim() ? `: ${note.trim()}` : ""}`);
        });
      }

      if (returnBtn && statusText === "Approved") {
        returnBtn.addEventListener("click", async () => {
          const ok = confirm(`Mark ${data.assetId} as returned?`);
          if (!ok) return;
          await updateDoc(doc(db, "borrowRequests", docSnap.id), {
            status: "Returned", returnedAt: serverTimestamp(),
          });
          await updateDoc(doc(db, "assets", data.assetId), { status: "Available" });
          await addToHistory(data.assetId, "Returned", `Returned by ${displayName}`);
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
    const password    = newEmpPasswordInput.value;

    if (!usernameRaw) { setEmpMessage("Please enter a Username or ID.", "red"); return; }
    if (!password || password.length < 6) {
      setEmpMessage("Password must be at least 6 characters.", "red"); return;
    }

    const realEmail = `${BASE_GMAIL_USER}+${usernameRaw}${GMAIL_DOMAIN}`;

    try {
      const secondaryApp  = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, realEmail, password);
      await updateProfile(userCredential.user, { displayName: usernameRaw });
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

let mapInstance     = null;
const markerMap     = new Map();
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

    // Draw East Singapore geofence boundary
    // Centre: Tampines/Loyang area, 6km radius covers east mainland only
    new google.maps.Circle({
      map: mapInstance,
      center: { lat: 1.3560, lng: 103.9700 },
      radius: 6000,
      strokeColor: "#2563eb",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#3b82f6",
      fillOpacity: 0.15,
    });
  }

  if (mapLocationsUnsub) return;

  mapLocationsUnsub = onSnapshot(collection(db, "deviceLocations"), (snapshot) => {
    if (mapStatus) {
      mapStatus.textContent = snapshot.empty
        ? "No devices reporting location yet."
        : `Devices reporting: ${snapshot.size}`;
    }

    const activeIds = new Set();

    snapshot.forEach((docSnap) => {
      const id   = docSnap.id;
      const data = docSnap.data();
      const lat  = data.lat;
      const lng  = data.lng;

      if (typeof lat !== "number" || typeof lng !== "number") return;

      activeIds.add(id);
      const position = { lat, lng };
      const title    = data.label || data.deviceName || `Device ${id}`;
      const ts       = formatTimestamp(data.timestamp);
      const tsLine   = ts
        ? `Updated: ${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`
        : "";

      const batPct  = data.batteryPct  != null ? `${data.batteryPct}%`                        : "?";
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

    markerMap.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.setMap(null);
        markerMap.delete(id);
      }
    });
  }, (err) => {
    console.error("Error listening to map", err);
  });
}
