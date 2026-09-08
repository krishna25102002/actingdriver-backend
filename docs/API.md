# Acting Driver API Documentation

## Project Overview
- **Tech Stack**: Node.js, Express, TypeScript, MongoDB (Mongoose), Cloudinary
- **Authentication**: JWT with httpOnly cookies

## Environment Variables (.env)
```
PORT=3000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Database Models

### Driver
| Field | Type | Required | Unique | Default |
|-------|------|----------|-------|---------|
| name | String | Yes | No | - |
| phoneNumber | String | Yes | Yes | - |
| email | String | Yes | Yes | - |
| city | String | Yes | No | - |
| state | String | Yes | No | - |
| vehicleType | String | Yes | No | - |
| vehicleNumber | String | Yes | Yes | - |
| passwordHash | String | Yes | No | - |
| isApproved | Boolean | No | No | false |

### DriverUpload
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fileKey | String | Yes | Cloudinary public_id |
| fileType | String | Yes | Type of file |
| driverId | ObjectId | Yes | Reference to Driver |
| status | String | No | pending/approved/rejected |
| createdAt | Date | Auto | Timestamp |
| updatedAt | Date | Auto | Timestamp |

### DriverAvailability
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| driverId | ObjectId | Yes | Reference to Driver |
| location | Object | Yes | { lat: number, long: number } |
| lastUpdateTime | Date | Yes | Timestamp |
| availability | Boolean | No | true/false |

## API Routes

### Driver Authentication (`/api/driver/auth`)
| Method | Route | Auth | Description |
|-------|-------|------|-------------|
| POST | /signup | No | Register new driver |
| POST | /signin | No | Login driver |
| PUT | /change-password | Yes | Change password |

#### Signup Payload
```json
{
  "name": "string",
  "phoneNumber": "string",
  "email": "string",
  "city": "string",
  "state": "string",
  "vehicleType": "string",
  "vehicleNumber": "string",
  "password": "string"
}
```

#### Signin Payload
```json
{
  "email": "string",
  "password": "string"
}
```

#### Change Password Payload
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

### Driver Routes (`/api/driver`)
| Method | Route | Auth | Description |
|-------|-------|------|-------------|
| POST | /upload | Yes | Upload file to Cloudinary |
| GET | /uploads | Yes | Get driver's uploads |
| PUT | /availability | Yes | Update availability & location |
| GET | /availability | Yes | Get current availability |

#### Upload Payload (multipart/form-data)
```
file: file
fileType: string (optional)
```

#### Availability Payload
```json
{
  "lat": number,
  "long": number,
  "availability": boolean (optional, default: true)
}
```

### Admin Authentication (`/api/admin/auth`)
| Method | Route | Auth | Description |
|-------|-------|------|-------------|
| POST | /signin | No | Admin login |

#### Admin Signin Payload
```json
{
  "username": "admin",
  "password": "admin"
}
```

### Admin Routes (`/api/admin/auth`)
| Method | Route | Auth | Description |
|-------|-------|------|-------------|
| PUT | /upload/status | Yes | Update upload status |
| PUT | /driver/approve | Yes | Approve/reject driver |
| GET | /drivers | Yes | Get all drivers |
| GET | /uploads | Yes | Get all uploads |

#### Update Upload Status Payload
```json
{
  "uploadId": "string",
  "status": "pending" | "approved" | "rejected"
}
```

#### Approve Driver Payload
```json
{
  "driverId": "string",
  "isApproved": boolean
}
```

## Authentication

### Driver JWT
```json
{
  "driverId": "string",
  "isApproved": boolean
}
```

### Admin JWT
```json
{
  "isAdmin": true
}
```

- Tokens stored in httpOnly cookies
- Fallback: Authorization header Bearer token
- Expiry: 7 days

## Folder Structure
```
src/
├── config/
│   ├── database.ts
│   └── cloudinary.ts
├── controllers/
│   ├── adminController.ts
│   ├── authController.ts
│   ├── availabilityController.ts
│   └── fileController.ts
├── middleware/
│   ├── adminAuthMiddleware.ts
│   └── authMiddleware.ts
├── models/
│   ├── Driver.ts
│   ├── DriverAvailability.ts
│   └── DriverUpload.ts
├── routes/
│   ├── adminRoutes.ts
│   ├── authRoutes.ts
│   └── driverRoutes.ts
├── utils/
│   └── jwt.ts
└── index.ts
```