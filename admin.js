// admin.js
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
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM refs
const userEmailSpan = document.getElementById("userEmail");
const assetTbody = document.getElementById("assetTableBody");
const requestTbody = document.getElementById("requestTableBody");
const logoutBtn = document.getElementById("logoutBtn");
const addBtn = document.getElementById("addBtn");

// logout
logoutBtn.addEventListener("click", async () => {
  try{
    await signOut(auth);
  }catch(err){
    console.error("Logout error:", err);
  }finally{
    window.location.href = "login.html";
  }
});

// go to add.html
addBtn.addEventListener("click", () => {
  window.location.href = "add.html";
});

// asset table events
assetTbody.addEventListener("click", async (event) => {
  const deleteBtn = event.target.closest(".btn-delete");
  const editBtn = event.target.closest(".btn-edit");

  // delete
  if (deleteBtn){
    const id = deleteBtn.getAttribute("data-id");
    if (!id) return;
    if (!window.confirm("Remove this asset?")) return;

    try{
      await deleteDoc(doc(db, "assets", id));
      const row = deleteBtn.closest("tr");
      if (row) row.remove();
    }catch(err){
      console.error(err);
      alert("Error removing asset: " + err.message);
    }
    return;
  }

  // edit
  if (editBtn){
    const id = editBtn.getAttribute("data-id");
    if (!id) return;

    const row = editBtn.closest("tr");
    if (!row) return;

    const currentAssetId = row.children[0].textContent.trim();
    const currentName    = row.children[1].textContent.trim();
    const currentCategory= row.children[2].textContent.trim();
    const currentOwner   = row.children[3].textContent.trim();
    const currentLocation= row.children[4].textContent.trim();
    const currentStatus  = row.children[5].textContent.trim();

    let newAssetId = window.prompt("Asset ID", currentAssetId);
    if (newAssetId === null) return;
    newAssetId = newAssetId.trim() || currentAssetId;

    let newName = window.prompt("Asset name", currentName);
    if (newName === null) return;
    newName = newName.trim() || currentName;

    let newCategory = window.prompt("Category", currentCategory);
    if (newCategory === null) return;
    newCategory = newCategory.trim() || currentCategory;

    let newOwner = window.prompt("Owner", currentOwner);
    if (newOwner === null) return;
    newOwner = newOwner.trim() || currentOwner;

    let newLocation = window.prompt("Location", currentLocation);
    if (newLocation === null) return;
    newLocation = newLocation.trim() || currentLocation;

    let newStatus = window.prompt("Status", currentStatus);
    if (newStatus === null) return;
    newStatus = newStatus.trim() || currentStatus;

    try{
      await updateDoc(doc(db, "assets", id), {
        assetId: newAssetId,
        name: newName,
        category: newCategory,
        owner: newOwner,
        location: newLocation,
        status: newStatus
      });

      row.children[0].textContent = newAssetId;
      row.children[1].textContent = newName;
      row.children[2].textContent = newCategory;
      row.children[3].textContent = newOwner;
      row.children[4].textContent = newLocation;
      row.children[5].textContent = newStatus;
    }catch(err){
      console.error(err);
      alert("Error updating asset: " + err.message);
    }
  }
});

// load assets
async function loadAssets(){
  assetTbody.innerHTML = '<tr><td colspan="7">Loading assets...</td></tr>';
  try{
    const qAssets = query(collection(db, "assets"), orderBy("assetId"));
    const snapshot = await getDocs(qAssets);
    assetTbody.innerHTML = "";
    if (snapshot.empty){
      assetTbody.innerHTML = '<tr><td colspan="7">No assets found.</td></tr>';
      return;
    }
    snapshot.forEach((docSnap) => {
      const asset = docSnap.data() || {};
      const assetId = asset.assetId || asset.AssetID || asset.id || "";
      const name = asset.name || asset.assetName || asset.type || "Unknown";
      const category = asset.category || asset.Category || "";
      const owner = asset.owner || asset.Owner || "";
      const location = asset.location || asset.Location || "";
      const status = asset.status || asset.Status || "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${assetId || "-"}</td>
        <td>${name || "-"}</td>
        <td>${category || "-"}</td>
        <td>${owner || "-"}</td>
        <td>${location || "-"}</td>
        <td>${status || "-"}</td>
        <td>
          <button class="btn-table btn-edit" data-id="${docSnap.id}">Edit</button>
          <button class="btn-table btn-delete" data-id="${docSnap.id}">Remove</button>
        </td>
      `;
      assetTbody.appendChild(tr);
    });
  }catch(err){
    console.error(err);
    assetTbody.innerHTML = '<tr><td colspan="7">Error loading assets.</td></tr>';
    alert("Error loading assets: " + err.message);
  }
}

// load borrow requests
async function loadRequests(){
  requestTbody.innerHTML = '<tr><td colspan="7">Loading requests...</td></tr>';
  try{
    const qReq = query(collection(db, "borrowRequests"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(qReq);
    requestTbody.innerHTML = "";
    if (snapshot.empty){
      requestTbody.innerHTML = '<tr><td colspan="7">No requests found.</td></tr>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const r = docSnap.data() || {};
      const id = docSnap.id;
      const assetId = r.assetId || "";
      const requestedBy = r.requestedBy || "";
      const startDate = r.startDate || "";
      const endDate = r.endDate || "";
      const reason = r.reason || "";
      const status = r.status || "Pending";

      const lower = status.toLowerCase();
      let statusClass = "status-pending";
      if (lower === "approved") statusClass = "status-approved";
      else if (lower === "rejected") statusClass = "status-rejected";

      const actionsHtml =
        lower === "pending"
          ? `<button class="btn-table btn-approve" data-id="${id}">Approve</button>
             <button class="btn-table btn-reject" data-id="${id}">Reject</button>`
          : `<span class="no-actions">No actions</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${assetId || "-"}</td>
        <td>${requestedBy || "-"}</td>
        <td>${startDate || "-"}</td>
        <td>${endDate || "-"}</td>
        <td>${reason || "-"}</td>
        <td><span class="status-chip ${statusClass}">${status}</span></td>
        <td>${actionsHtml}</td>
      `;
      requestTbody.appendChild(tr);
    });
  }catch(err){
    console.error(err);
    requestTbody.innerHTML = '<tr><td colspan="7">Error loading requests.</td></tr>';
    alert("Error loading requests: " + err.message);
  }
}

// approve / reject click
requestTbody.addEventListener("click", async (event) => {
  const approveButton = event.target.closest(".btn-approve");
  const rejectButton = event.target.closest(".btn-reject");
  const button = approveButton || rejectButton;
  if (!button) return;

  const id = button.getAttribute("data-id");
  if (!id) return;

  const newStatus = approveButton ? "Approved" : "Rejected";

  try{
    button.disabled = true;
    await updateDoc(doc(db, "borrowRequests", id), { status: newStatus });
    await loadRequests();
  }catch(err){
    console.error(err);
    alert("Error updating request: " + err.message);
  }finally{
    button.disabled = false;
  }
});

// auth gate
onAuthStateChanged(auth, async (user) => {
  if (!user){
    window.location.href = "login.html";
    return;
  }
  if (user.email !== "admin@go-aheadsingapore.com"){
    alert("Access denied. Admin only.");
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }
  userEmailSpan.textContent = user.email || "";
  loadAssets();
  loadRequests();
});
