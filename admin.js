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

  // start map support
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
      const status = data.status || "";

      tr.innerHTML = `
        <td>${assetId}</td>
        <td>${name}</td>
        <td>${category}</td>
        <td>${owner}</td>
        <td>${location}</td>
        <td>${status}</td>
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
      // use a secondary app so admin does not get logged out
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
let infoWindow = null;
const markerMap = new Map(); // docId -> google.maps.Marker
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

      // Map is visible, ensure it is initialised
      if (typeof window.google !== "undefined") {
        initDeviceMapInternal();
      } else {
        if (mapStatus) {
          mapStatus.textContent = "Loading map script...";
        }
      }
    }
  });
}

// optional global callback
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
      center: { lat: 1.3521, lng: 103.8198 }, // Singapore default
      zoom: 12,
    });
    infoWindow = new google.maps.InfoWindow();
  }

  if (locationsUnsub) return; // already listening

  const colRef = collection(db, "deviceLocations");

  locationsUnsub = onSnapshot(
    colRef,
    (snapshot) => {
      if (mapStatus) {
        if (snapshot.empty) {
          mapStatus.textContent = "No devices reporting location yet.";
        } else {
          mapStatus.textContent = `Devices reporting location: ${snapshot.size}`;
        }
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

        if (typeof lat !== "number" || typeof lng !== "number") {
          return;
        }

        const position = { lat, lng };
        let marker = markerMap.get(id);

        const batteryPct = data.batteryPct;
        const batteryTempC = data.batteryTempC;
        const ts = data.timestamp?.toDate?.();

        const baseLabel =
          data.label ||
          data.deviceName ||
          `Device ${id}`;

        const parts = [];

        if (typeof batteryPct === "number") {
          parts.push(`Battery ${batteryPct}%`);
        }
        if (typeof batteryTempC === "number") {
          parts.push(`Temp ${batteryTempC.toFixed(1)}°C`);
        }
        if (ts) {
          parts.push(`Updated ${ts.toLocaleString()}`);
        }

        const subtitle = parts.join(", ");

        const infoHtml = `
          <div>
            <strong>${baseLabel}</strong><br/>
            Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}<br/>
            ${subtitle ? subtitle + "<br/>" : ""}
          </div>
        `;

        if (!marker) {
          marker = new google.maps.Marker({
            position,
            map: mapInstance,
            title: baseLabel,
          });
          markerMap.set(id, marker);
        } else {
          marker.setPosition(position);
          marker.setTitle(baseLabel);
        }

        // Update click listener to show info window with battery and temperature
        marker.addListener("click", () => {
          if (!infoWindow) return;
          infoWindow.setContent(infoHtml);
          infoWindow.open({
            map: mapInstance,
            anchor: marker,
          });
        });
      });
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
