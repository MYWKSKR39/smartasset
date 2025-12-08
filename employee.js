// employee.js
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
  doc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const ADMIN_EMAIL = "admin@smartasset.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM references
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const assetTableBody = document.getElementById("assetTableBody");
const myRequestsTableBody = document.getElementById("myRequestsTableBody");

const requestForm = document.getElementById("borrowForm");
const assetIdInput = document.getElementById("borrowAssetId");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const reasonInput = document.getElementById("reason");
const requestMessage = document.getElementById("requestMessage");

let currentUserEmail = null;

// helper for status text under the form
function setRequestMessage(text, color) {
  if (!requestMessage) return;
  requestMessage.textContent = text;
  requestMessage.style.color = color;
}

// auth guard, redirect admin away from this page
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (user.email === ADMIN_EMAIL) {
    window.location.href = "index.html";
    return;
  }

  currentUserEmail = user.email;

  if (userEmailSpan) {
    userEmailSpan.textContent = user.email;
  }

  startAssetsListener();
  startMyRequestsListener();
});

// logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

// show all assets in top table
function startAssetsListener() {
  if (!assetTableBody) return;

  const colRef = collection(db, "assets");
  const q = query(colRef, orderBy("assetId"));

  onSnapshot(q, (snapshot) => {
    assetTableBody.innerHTML = "";

    if (snapshot.empty) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
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
      `;

      assetTableBody.appendChild(tr);
    });
  });
}

// show only this user's requests in bottom table
function startMyRequestsListener() {
  if (!myRequestsTableBody || !currentUserEmail) return;

  const colRef = collection(db, "borrowRequests");
  const q = query(
    colRef,
    where("requestedBy", "==", currentUserEmail),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    myRequestsTableBody.innerHTML = "";

    if (snapshot.empty) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "You have no requests yet.";
      tr.appendChild(td);
      myRequestsTableBody.appendChild(tr);
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${data.assetId || ""}</td>
        <td>${data.startDate || ""}</td>
        <td>${data.endDate || ""}</td>
        <td>${data.reason || ""}</td>
        <td>${data.status || ""}</td>
      `;

      myRequestsTableBody.appendChild(tr);
    });
  });
}

// handle submit of new borrow request
if (requestForm) {
  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setRequestMessage("", "");

    const assetId = assetIdInput.value.trim();
    const start = startDateInput.value;
    const end = endDateInput.value;
    const reason = reasonInput.value.trim();

    if (!assetId || !start || !end) {
      setRequestMessage("Please fill in asset ID, start date and end date.", "red");
      return;
    }

    try {
      await addDoc(collection(db, "borrowRequests"), {
        assetId,
        startDate: start,
        endDate: end,
        reason,
        requestedBy: currentUserEmail,
        status: "Pending",
        createdAt: serverTimestamp()
      });

      setRequestMessage("Request submitted.", "green");

      assetIdInput.value = "";
      startDateInput.value = "";
      endDateInput.value = "";
      reasonInput.value = "";
    } catch (err) {
      console.error(err);
      setRequestMessage(
        "Error submitting request: " + (err.code || err.message),
        "red"
      );
    }
  });
}
