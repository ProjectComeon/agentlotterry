# 🍀 AdminAgent Lottery – ระบบหวยออนไลน์

ระบบบริหารจัดการหวยออนไลน์แบบ Web App รองรับมือถือ มี 3 ระดับผู้ใช้งาน

## Features

- ✅ Login 3 Role (Admin / เจ้ามือ / ลูกค้า)
- ✅ RBAC – Route protection ตามสิทธิ์
- ✅ Dashboard แยกตามสิทธิ์
- ✅ CRUD เจ้ามือ (Admin)
- ✅ CRUD ลูกค้า (Admin + เจ้ามือ)
- ✅ ระบบแทงเลข (ลูกค้า)
- ✅ คำนวณผลอัตโนมัติ + ล็อกข้อมูลย้อนหลัง
- ✅ ดึง API หวยไทย (rayriffy.com)
- ✅ สรุปยอดรายงวด
- ✅ Mobile-friendly + Bottom Navigation

---

## Tech Stack

- **Next.js 14** (App Router)
- **MongoDB** + Mongoose
- **NextAuth.js** (JWT)
- **Tailwind CSS** (Green Dark Theme)

---

## การติดตั้ง

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า `.env.local`

```
MONGODB_URI=mongodb://localhost:27017/admin-lottery
NEXTAUTH_SECRET=your-super-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

> **MongoDB**: ใช้ [MongoDB Community](https://www.mongodb.com/try/download/community) หรือ [MongoDB Atlas](https://www.mongodb.com/atlas) (ฟรี)

### 3. สร้างข้อมูลเริ่มต้น (Seed)

```bash
npx tsx scripts/seed.ts
```

ข้อมูล Default:

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin1234` |
| เจ้ามือ | `dealer1` | `dealer1234` |
| ลูกค้า | `customer1` | `customer1234` |

### 4. รัน Development Server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

---

## โครงสร้างหน้า

| Role | หน้า |
|------|------|
| Admin | `/admin/dashboard`, `/admin/dealers`, `/admin/customers`, `/admin/lottery` |
| เจ้ามือ | `/dealer/dashboard`, `/dealer/customers`, `/dealer/summary` |
| ลูกค้า | `/customer/dashboard`, `/customer/bet`, `/customer/history`, `/customer/summary` |

---

## อัตราจ่ายเริ่มต้น

| ประเภท | อัตราจ่าย |
|--------|-----------|
| 2 ตัวบน | x70 |
| 2 ตัวล่าง | x70 |
| 3 ตัวบน | x500 |
| 3 ตัวโต๊ด | x100 |
| วิ่งบน | x3 |
| วิ่งล่าง | x4.5 |

---

## API Endpoints

| Method | Path | Role | คำอธิบาย |
|--------|------|------|-----------|
| GET | `/api/dealers` | Admin | ดูเจ้ามือทั้งหมด |
| POST | `/api/dealers` | Admin | เพิ่มเจ้ามือ |
| PUT | `/api/dealers/:id` | Admin | แก้ไขเจ้ามือ |
| GET | `/api/customers` | Admin/Dealer | ดูลูกค้า |
| POST | `/api/customers` | Admin/Dealer | เพิ่มลูกค้า |
| GET | `/api/bets` | All | ดูการแทง (scoped) |
| POST | `/api/bets` | Customer | แทงเลข |
| GET | `/api/lottery` | All | ดึงผลหวยไทย |
| POST | `/api/lottery` | Admin | คำนวณผล + ล็อก |
| GET | `/api/summary` | All | สรุปยอด (scoped) |
