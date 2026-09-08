# Driver Backend API

## Project Overview

This backend powers the Driver Mobile Application.

Main Features:

- Driver Registration
- Login with JWT Authentication
- Profile Management
- Vehicle Registration
- Document Upload
- Admin Verification
- Driver Status Management
- Live GPS Location Tracking
- Driver Location History
- REST APIs
- Socket.IO Support

---

## Technology Stack

- Node.js
- Express.js
- MySQL
- JWT Authentication
- Multer
- Socket.IO
- bcrypt
- express-validator

---

## Installation

Clone the project:

```bash
git clone <repository-url>
```

Install dependencies:

```bash
npm install
```

Create a `.env` file.

Start the server:

```bash
npm run dev
```

---

## Driver Registration Flow

1. Register account
2. Login
3. Complete profile
4. Add vehicle details
5. Upload required documents
6. Wait for admin verification
7. Admin approves the account
8. Driver goes online
9. Driver starts sending live location
10. Ready to receive ride requests

---

## Driver Documents

- Profile Photo
- Driving License
- Aadhaar Card
- PAN Card
- Vehicle RC
- Insurance Certificate
- Vehicle Photo
- Driver Selfie

---

## Driver Status

- Pending
- Approved
- Rejected
- Online
- Offline
- Busy
- On Trip

---

## API Modules

- Authentication
- Driver
- Vehicle
- Documents
- Admin
- Location

---

## Database

MySQL

---

## Author

Krishna Kumar



driver-backend
│
├── src
│   ├── app.js
│   ├── server.js
│   │
│   ├── config
│   │   ├── db.js
│   │   ├── jwt.js
│   │   ├── multer.js
│   │   ├── socket.js
│   │   └── constants.js
│   │
│   ├── controllers
│   │   ├── auth.controller.js
│   │   ├── driver.controller.js
│   │   ├── document.controller.js
│   │   ├── vehicle.controller.js
│   │   ├── location.controller.js
│   │   └── admin.controller.js
│   │
│   ├── routes
│   │   ├── auth.routes.js
│   │   ├── driver.routes.js
│   │   ├── vehicle.routes.js
│   │   ├── document.routes.js
│   │   ├── location.routes.js
│   │   └── admin.routes.js
│   │
│   ├── services
│   │   ├── auth.service.js
│   │   ├── driver.service.js
│   │   ├── vehicle.service.js
│   │   ├── document.service.js
│   │   ├── location.service.js
│   │   ├── upload.service.js
│   │   ├── jwt.service.js
│   │   └── admin.service.js
│   │
│   ├── middlewares
│   │   ├── auth.middleware.js
│   │   ├── admin.middleware.js
│   │   ├── upload.middleware.js
│   │   └── error.middleware.js
│   │
│   ├── models
│   │   ├── Driver.js
│   │   ├── DriverDocument.js
│   │   ├── DriverLocation.js
│   │   ├── Vehicle.js
│   │   └── Admin.js
│   │
│   ├── validations
│   ├── utils
│   ├── sockets
│   ├── uploads
│   ├── database
│   ├── migrations
│   ├── seeders
│   └── cron
│
├── package.json
├── .env
├── .gitignore
└── README.md

Driver Registration

↓

Login

↓

Complete Driver Profile

↓

Upload Documents
    • Aadhaar Front
    • Aadhaar Back
    • Driving License Front
    • Driving License Back
    • Selfie

↓

Admin Verification

↓

Approved

↓

Go Online

↓

Wait For Booking

↓

Customer Books Driver

↓

Driver Accepts Booking

↓

Driver Travels To Customer

↓

Live Location Shared To Customer

↓

Reach Customer

↓

Start Ride

↓

Complete Ride

↓

Payment Completed
====================================================================================================================================
Architecture for Your Acting Driver App

Authentication
    │
    ├── Register
    ├── Login
    ├── Change Password
    └── Logout

Driver
    ├── Get My Profile
    ├── Update My Profile
    ├── Upload Documents
    ├── Go Online
    ├── Go Offline
    └── Live Location

Admin
    ├── View All Drivers
    ├── View Driver Details
    ├── Approve Driver
    ├── Reject Driver
    └── Suspend Driver

Booking
    ├── Assign Driver
    ├── Accept Booking
    ├── Reject Booking
    ├── Start Trip
    └── End Trip

    ====================================================================================================================================
 
 completed has of now : 02-0802026
 ✅ Completed
Authentication
Driver Profile
Document Upload
Admin Approval
Driver Status (Online/Offline/Busy)
Live Location Update API
Booking Creation
Dispatch Engine
Accept / Reject Booking
Current Booking
Reached Pickup


## Driver Backend Status 🚗✅

### Completed (V1)
✅ Authentication  
✅ Driver Profile  
✅ Document Upload  
✅ Admin Verification  
✅ Online/Offline/Busy Status  
✅ Driver Live Location API  
✅ Booking Creation  
✅ Dispatch Engine  
✅ Accept/Reject Booking  
✅ Current Booking  
✅ Reached Pickup  
✅ Start Trip  
✅ Complete Trip  
✅ Trip History  
✅ Dashboard  
✅ Earnings  
✅ Settings  

---

## Remaining (Later / Production Features)

🔹 Firebase Push Notifications  
🔹 Socket.IO Live Tracking  
🔹 OTP Verification  
🔹 Driver/Customer Cancellation Flow  
🔹 Auto Reassign if Driver not moving  
🔹 Advanced Dispatch Rules  
🔹 Driver Performance Metrics  
🔹 Wallet & Withdrawal  
🔹 Cloud Storage for Documents  
🔹 Advanced Admin Controls  

---

## Recommended Next Step

✅ Start **Customer Backend**

Build:

1. Customer Authentication  
2. Customer Profile  
3. Vehicle Management  
4. Booking Creation  
5. Payment  
6. OTP  
7. Driver Tracking  
8. Trip History  
9. Rating  

After Customer Backend is ready, connect:

**Customer App ↔ Booking ↔ Dispatch ↔ Driver App**

Then implement Firebase + Socket.IO + OTP together. 🚀