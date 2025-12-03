// js/employee.js
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
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const assetTbody = document.getElementById("assetTableBody");
const myReqTbody = document.getElementById("myRequestTableBody");

const borrowForm = document.getElementById("borrowForm");
const assetIdInput = document.getElementById("assetIdInput");
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const reasonInput = document.getElementById("reasonInput");
const borrowMessage = document.getElementById("borrowMessage");

// logout
logoutBtn.addEventListener("click", async () => {
  try{
    await signOut(auth);
  }catch(e){
    console.error(e);
  }finally{
    window.location.href = "login.html";
  }
});

// load assets
async function loadAssets(){
  assetTbody.innerHTML = '<tr><td colspan="6">Loading assets...</td></tr>';
  try{
    const snap = await getDocs(collection(db,"assets"));
    assetTbody.innerHTML = "";
    if (snap.empty){
      assetTbody.innerHTML = '<tr><td colspan="6">No assets found.</td></tr>';
      return;
    }
    snap.forEach(docSnap => {
      const a = docSnap.data() || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.assetId || "-"}</td>
        <td>${a.name || "-"}</td>
        <td>${a.category || "-"}</td>
        <td>${a.owner || "-"}</td>
        <td>${a.location || "-"}</td>
        <td>${a.status || "-"}</td>
      `;
      assetTbody.appendChild(tr);
    });
  }catch(err){
    console.error(err);
    assetTbody.innerHTML = '<tr><td colspan="6">Error loading assets.</td></tr>';
  }
}

// load current user's requests
async function loadMyRequests(email){
  myReqTbody.innerHTML = '<tr><td colspan="5">Loading requests...</td></tr>';
  try{
    const qReq = query(
      collection(db,"borrowRequests"),
      where("requestedBy","==",email),
      orderBy("createdAt","desc")
    );
    const snap = await getDocs(qReq);
    myReqTbody.innerHTML = "";
    if (snap.empty){
      myReqTbody.innerHTML = '<tr><td colspan="5">You have no requests yet.</td></tr>';
      return;
    }
    snap.forEach(docSnap => {
      const r = docSnap.data() || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.assetId || "-"}</td>
        <td>${r.startDate || "-"}</td>
        <td>${r.endDate || "-"}</td>
        <td>${r.reason || "-"}</td>
        <td>${r.status || "Pending"}</td>
      `;
      myReqTbody.appendChild(tr);
    });
  }catch(err){
    console.error(err);
    myReqTbody.innerHTML = '<tr><td colspan="5">Error loading requests.</td></tr>';
  }
}

// submit borrow request
borrowForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  borrowMessage.textContent = "";

  const assetIdRaw = assetIdInput.value.trim();
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  const reason = reasonInput.value.trim();

  if (!assetIdRaw || !startDate || !endDate){
    borrowMessage.textContent = "Please fill in asset ID and both dates.";
    borrowMessage.style.color = "red";
    return;
  }

  if (endDate < startDate){
    borrowMessage.textContent = "End date cannot be earlier than start date.";
    borrowMessage.style.color = "red";
    return;
  }

  const user = auth.currentUser;
  if (!user){
    borrowMessage.textContent = "You must be logged in.";
    borrowMessage.style.color = "red";
    return;
  }

  const assetId = assetIdRaw.toUpperCase();

  try{
    await addDoc(collection(db,"borrowRequests"), {
      assetId,
      requestedBy: user.email || "",
      startDate,
      endDate,
      reason,
      status: "Pending",
      createdAt: serverTimestamp()
    });
    borrowMessage.textContent = "Request submitted.";
    borrowMessage.style.color = "green";

    // clear form
    reasonInput.value = "";
    // keep dates and asset id if you want, or clear them
    // assetIdInput.value = "";
    // startDateInput.value = "";
    // endDateInput.value = "";

    // refresh my requests
    loadMyRequests(user.email || "");
  }catch(err){
    console.error(err);
    borrowMessage.textContent = "Error submitting request.";
    borrowMessage.style.color = "red";
  }
});

// auth guard
onAuthStateChanged(auth, (user) => {
  if (!user){
    window.location.href = "login.html";
    return;
  }
  // admin should not use employee page
  if (user.email === "admin@go-aheadsingapore.com"){
    window.location.href = "index.html";
    return;
  }
  userEmailSpan.textContent = user.email || "";
  loadAssets();
  loadMyRequests(user.email || "");
});
