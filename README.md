# Samsung Lab Attendance System

Attendance management for Samsung IoT and Samsung Coding labs.  
Admin uploads shortlisted students, marks attendance via USN scan/entry.  
Students can view their own attendance records.

## Architecture

```
Client (React)  ←→  Node.js + Express  ←→  MongoDB
```

**MongoDB Collections:**
- `admins` — login credentials
- `students` — shortlisted USNs tagged with lab ("iot" or "coding")
- `attendance_logs` — USN + lab + session + timestamp per scan
- `sessions` — admin-created sessions per lab per date

**Key Rule (Shortlist Gate):**  
Only USNs in the `students` collection can have attendance marked or log in.

---

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (or MongoDB Atlas URI)

### 1. Backend

```bash
cd backend
npm install
```

Edit `.env` if needed:
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/samsung_lab_attendance
JWT_SECRET=samsung_lab_secret_key_change_in_production
```

Seed the default admin:
```bash
npm run seed
```
This creates: **admin@samsung.com** / **admin123**

Start the server:
```bash
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

Opens at http://localhost:3000 (proxies API calls to :5000)

---

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/admin/login | — | Admin login |
| POST | /api/auth/student/login | — | Student login (shortlist gate) |
| GET | /api/shortlist?lab= | Admin | List shortlisted students |
| POST | /api/shortlist | Admin | Add single student |
| POST | /api/shortlist/upload-csv | Admin | Bulk CSV upload |
| PUT | /api/shortlist/:id | Admin | Update student |
| DELETE | /api/shortlist/:id | Admin | Remove student |
| GET | /api/sessions?lab= | Admin | List sessions |
| GET | /api/sessions/active?lab= | Any | Active sessions |
| POST | /api/sessions | Admin | Open new session |
| PATCH | /api/sessions/:id/close | Admin | Close session |
| POST | /api/attendance/mark | Admin | Mark attendance (shortlist gate) |
| GET | /api/attendance/student/:usn | Any | Student's attendance |
| GET | /api/attendance/report?lab= | Admin | Full report |

---

## CSV Format for Bulk Upload

```csv
usn,name,email,phone,lab,password
1RV21CS001,John Doe,john@email.com,9876543210,iot,
1RV21CS002,Jane Smith,jane@email.com,9876543211,coding,
```

- `lab` must be `iot` or `coding`
- `password` is optional — defaults to the USN

---

## Default Credentials

- **Admin:** admin@samsung.com / admin123
- **Student:** USN / USN (e.g., 1RV21CS001 / 1RV21CS001)
