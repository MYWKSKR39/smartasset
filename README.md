# SmartAsset — IT Asset Management System

A full-stack IT asset management system built with Firebase, featuring a web admin dashboard, employee portal, and an Android app for live GPS device tracking.

---

## 🔗 Live Demo

**Web App:** https://mywkskr39.github.io/smartasset/

| Role | Email | Password |
|------|-------|----------|
| Admin | ernesttan24+admin@gmail.com | *(contact author)* |
| Employee | *(request access from admin)* | — |

---

## 📋 Overview

SmartAsset solves a real problem faced by organisations that manage shared physical IT equipment — the lack of visibility over where assets are, who has them, and whether they're available.

Traditional tracking methods (spreadsheets, paper logs) cause:
- Unknown asset locations
- Double-booking with no conflict detection
- No audit trail for accountability
- No way to locate high-value mobile assets

SmartAsset replaces this with a centralised, real-time system accessible from any browser.

---

## ✨ Features

### Web Dashboard (Admin)
- **Asset inventory** — full CRUD with category, owner, location and status tracking
- **Sortable table** — click any column header to sort assets instantly
- **Colour-coded status chips** — Available (green), In use (blue), On loan (indigo), In repair (yellow), Retired (red)
- **Borrow request management** — approve, reject or mark as returned with one click
- **Auto status updates** — asset status changes automatically when requests are approved or returned
- **Asset history log** — complete timeline of every action per asset (added, edited, borrowed, returned, rejected, removed)
- **Live GPS tracking** — real-time device locations displayed on Google Maps with battery %, temperature and timestamp
- **Employee account creation** — admin can create employee logins directly from the dashboard
- **Security** — role-based access control, no-cache headers, back-button protection after logout

### Employee Portal
- **View all assets** with live status and sortable columns
- **Submit borrow requests** — with date conflict detection and asset availability validation
- **Track own requests** — colour-coded status chips (Pending, Approved, Rejected, Returned)
- **Click-to-fill** — click any asset row to auto-fill the borrow form
- **Rejection reason visibility** — admin notes shown when a request is rejected

### Android Tracking App
- **Background GPS tracking** — runs as a foreground service, uninterrupted
- **Auto-start on boot** — begins tracking automatically when device powers on (requires "Allow all the time" location permission)
- **Battery monitoring** — reports battery percentage, charging status and temperature
- **Firebase integration** — pushes location data to Firestore every 60 seconds over WiFi/mobile data
- **Device identification** — uses Android ID as stable device identifier

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Firebase Backend                   │
│                                                     │
│   Firestore Collections:                            │
│   • assets          — inventory records             │
│   • borrowRequests  — loan request lifecycle        │
│   • deviceLocations — live GPS positions            │
│   • assetHistory    — audit log                     │
│                                                     │
│   Firebase Auth     — email/password authentication │
└────────────┬──────────────────┬────────────────────┘
             │                  │
    ┌────────▼──────┐  ┌────────▼──────────┐
    │   Web App     │  │   Android App     │
    │  (GitHub Pages│  │                   │
    │               │  │  LocationTracking │
    │  index.html   │  │  Service.kt       │
    │  employee.html│  │  → writes to      │
    │  add.html     │  │  deviceLocations  │
    │  login.html   │  │  every 60s        │
    └───────────────┘  └───────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript (ES Modules) |
| Backend | Firebase Firestore (NoSQL, real-time) |
| Auth | Firebase Authentication |
| Hosting | GitHub Pages |
| Maps | Google Maps JavaScript API |
| Android | Kotlin, FusedLocationProviderClient |
| Android Backend | Firebase Firestore SDK for Android |

---

## 📁 Project Structure

```
smartasset/
├── index.html          # Admin dashboard
├── employee.html       # Employee portal
├── add.html            # Add / edit asset form
├── login.html          # Login page
├── admin.js            # Admin dashboard logic
├── employee.js         # Employee portal logic
├── add.js              # Asset form logic
├── login.js            # Auth logic
├── admin.css           # Shared stylesheet
├── firebase-config.js  # Firebase project config
│
MobileDeviceManagement/
├── MainActivity.kt              # App entry, permission handling
├── LocationTrackingService.kt   # Foreground GPS service
├── BootReceiver.kt              # Auto-start on device boot
└── AndroidManifest.xml          # Permissions & component registration
```

---

## 🔒 Security

- **Firestore security rules** enforce role-based access:
  - Unauthenticated users cannot read or write anything
  - Employees can read assets and requests, and create their own requests
  - Only the admin account can approve/reject requests, edit assets, and view device locations
- **Auth guard** on every page — unauthenticated users are immediately redirected to login
- **No-cache headers** prevent access to cached pages after logout
- **Back-button protection** — `location.replace()` removes pages from browser history on logout

---

## ⚙️ Setup & Deployment

### Prerequisites
- Firebase project with Firestore and Authentication enabled
- Google Maps JavaScript API key
- Android Studio (for the mobile app)

### Web App

1. Clone the repository:
   ```bash
   git clone https://github.com/mywkskr39/smartasset.git
   ```

2. Update `firebase-config.js` with your Firebase project credentials:
   ```javascript
   export const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     ...
   };
   ```

3. Update the admin email in `admin.js`, `add.js`, and `employee.js`:
   ```javascript
   const ADMIN_EMAIL = "your-admin@email.com";
   ```

4. Deploy to GitHub Pages or Firebase Hosting.

### Firestore Security Rules

Paste the following into Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null &&
             request.auth.token.email == "your-admin@email.com";
    }

    match /deviceLocations/{deviceId} {
      allow create, update: if true;
      allow read, delete: if isAdmin();
    }

    match /borrowRequests/{docId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null;
      allow update, delete: if isAdmin();
    }

    match /assets/{docId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    match /assetHistory/{entryId} {
      allow read: if isAdmin();
      allow create: if request.auth != null;
    }

    match /{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
```

### Android App

1. Open `MobileDeviceManagement` in Android Studio
2. Add your `google-services.json` from Firebase Console to the `app/` directory
3. Build and run on a physical Android device
4. Grant **"Allow all the time"** location permission for boot tracking to work
5. The app will begin sending GPS data to Firestore automatically

---

## 📱 Linking a Device to an Asset

1. Install the Android app on the device to be tracked
2. Open the app and start tracking — a document will appear in Firestore → `deviceLocations`
3. Copy the document ID (e.g. `18928e44ec641a5c`)
4. In the admin dashboard, click **Edit** on the asset
5. Paste the document ID into the **Device ID** field and save
6. The asset's tracking column will now show live location status

---

## 🎯 Use Case

SmartAsset was designed for **public transport operators** managing shared IT equipment across multiple locations (depots and bus interchanges). Key scenarios:

| Problem | SmartAsset Solution |
|---------|-------------------|
| "Where is the iPad?" | Live GPS map + last seen timestamp |
| "Is the laptop free next week?" | Date conflict detection on borrow requests |
| "Who approved this loan?" | Full request history with admin actions |
| "A device left the depot" | Live tracking visible on admin map |
| "Staff deleted a record" | Admin-only write access + audit history |

---

## 🔮 Known Limitations & Future Work

- **Email notifications** — not implemented due to Firebase billing requirements for the email extension
- **Background location on Android 14+** — requires "Allow all the time" permission; cannot be silently granted
- **Device location writes are unauthenticated** — intentional trade-off to simplify the Android client; in production this would use service account authentication
- **Single admin account** — a future version would support multiple admin roles
- **No asset depreciation tracking** — out of scope; would require integration with a financial system

---

## 👤 Author

Ernest Tan  
GitHub: [@mywkskr39](https://github.com/mywkskr39)

---

*© 2025 SmartAsset. All rights reserved.*
