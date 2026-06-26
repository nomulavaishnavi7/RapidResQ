# 🚑 RapidResQ

> **Real-time Emergency Medical Routing and Healthcare Coordination Platform**

RapidResQ is a full-stack emergency healthcare platform designed to reduce response time during medical emergencies by intelligently connecting patients, hospitals, and administrators through real-time communication and resource management.

The platform helps patients reach the most suitable hospital based on emergency type, available medical resources, hospital capacity, and proximity instead of simply routing them to the nearest hospital.

---

# Project Structure

```
RapidResQ
│
├── mobile_app/             # Flutter mobile application for patients
├── hospital-dashboard/     # React dashboard for hospitals
├── admin-panel/            # React admin monitoring system
├── functions/              # Firebase Cloud Functions
│
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

---

# Features

### Patient Mobile Application

* User Registration & Login
* Emergency Request
* Live Emergency Tracking
* Hospital Recommendation
* GPS Location
* Google Maps Navigation
* User Profile

---

### Hospital Dashboard

* Receive Emergency Requests
* View Patient Information
* Manage Hospital Resources
* Emergency Assignment
* Hospital Capacity Monitoring

---

### Admin Panel

* Monitor Active Emergencies
* Analytics Dashboard
* Hospital Monitoring
* Resource Management
* Emergency Tracking
* City-wide Monitoring

---

### Backend

* Firebase Authentication
* Cloud Firestore
* Firebase Cloud Functions
* Real-time Data Synchronization

---

# Technology Stack

## Mobile

* Flutter
* Dart

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

## Backend

* Firebase
* Firestore
* Firebase Cloud Functions

## APIs

* Google Maps API
* GPS Location Services

---

# System Workflow

1. Patient reports an emergency.
2. Patient location is captured.
3. Emergency request is stored in Firebase.
4. Suitable hospitals are identified.
5. Hospital dashboard receives the request.
6. Hospital accepts the emergency.
7. Patient receives real-time updates.
8. Administrator monitors the entire process.

---

# Repository Structure

| Folder             | Description                      |
| ------------------ | -------------------------------- |
| mobile_app         | Flutter application for patients |
| hospital-dashboard | Hospital management portal       |
| admin-panel        | Administration dashboard         |
| functions          | Firebase backend functions       |

---

# Future Enhancements

* AI-based hospital recommendation
* Voice-enabled SOS
* Offline emergency support
* Ambulance live tracking
* Wearable device integration
* Push notifications

---

# Installation

```bash
git clone https://github.com/nomulavaishnavi7/RapidResQ.git

cd RapidResQ
```

### Mobile App

```bash
cd mobile_app
flutter pub get
flutter run
```

### Hospital Dashboard

```bash
cd hospital-dashboard
npm install
npm run dev
```

### Admin Panel

```bash
cd admin-panel
npm install
npm run dev
```

### Firebase Functions

```bash
cd functions
npm install
firebase deploy
```

---

# Authors

* N. Vaishnavi
* B. Deepak
**Repository maintained by:** N. Vaishnavi
