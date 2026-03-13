# Agent Lottery System 🎰

ระบบจัดการหวยออนไลน์ 3 Role (Admin / เจ้ามือ / ลูกค้า)

## Tech Stack
- **Backend:** Node.js + Express + MongoDB (Render)
- **Frontend:** React + Vite (Netlify)
- **Database:** MongoDB Atlas

## Features
- ✅ Login 3 Role (Admin / เจ้ามือ / ลูกค้า)
- ✅ RBAC (Role Based Access Control)
- ✅ Dashboard แยกตามสิทธิ์
- ✅ CRUD เจ้ามือ / ลูกค้า
- ✅ ระบบบันทึกการแทง (6 ประเภท)
- ✅ ระบบคำนวณผลอัตโนมัติ
- ✅ ดึง API ผลหวยไทย
- ✅ สรุปยอดรายวัน / รายงวด
- ✅ ป้องกันแก้ไขข้อมูลย้อนหลัง
- ✅ Logging ขั้นพื้นฐาน
- ✅ Responsive (มือถือ)

## Setup

### Backend
```bash
cd backend
npm install
# แก้ไข .env ถ้าจำเป็น
npm run seed   # สร้าง admin account
npm run dev    # Start server (port 5000)
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # Start dev server (port 3000)
```

### Default Admin Account
- Username: `admin`
- Password: `admin123`

## Deploy
- **Backend (Render):** Deploy จาก `/backend` folder
- **Frontend (Netlify):** Deploy จาก `/frontend` folder, build command: `npm run build`, publish: `dist`

## Environment Variables (Backend)
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5000
```

## อัตราจ่าย
| ประเภท | อัตรา |
|--------|-------|
| 3 ตัวบน | x500 |
| 3 ตัวโต๊ด | x100 |
| 2 ตัวบน | x70 |
| 2 ตัวล่าง | x70 |
| วิ่งบน | x3 |
| วิ่งล่าง | x2 |
