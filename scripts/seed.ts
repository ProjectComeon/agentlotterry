/**
 * Seed script – run with: npx ts-node --project tsconfig.json scripts/seed.ts
 * Or after installing tsx: npx tsx scripts/seed.ts
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/admin-lottery";

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  displayName: String,
  dealerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // Clear existing
  await User.deleteMany({});

  const adminPw = await bcrypt.hash("admin1234", 10);
  const dealerPw = await bcrypt.hash("dealer1234", 10);
  const customerPw = await bcrypt.hash("customer1234", 10);

  // Admin
  const admin = await User.create({
    username: "admin",
    password: adminPw,
    role: "admin",
    displayName: "ผู้ดูแลระบบ",
    dealerId: null,
  });

  // Dealer
  const dealer = await User.create({
    username: "dealer1",
    password: dealerPw,
    role: "dealer",
    displayName: "เจ้ามือ 1",
    dealerId: null,
  });

  // Customer
  await User.create({
    username: "customer1",
    password: customerPw,
    role: "customer",
    displayName: "ลูกค้า 1",
    dealerId: dealer._id,
  });

  console.log("✅ Seed data created:");
  console.log("   Admin    → username: admin       / password: admin1234");
  console.log("   Dealer   → username: dealer1     / password: dealer1234");
  console.log("   Customer → username: customer1   / password: customer1234");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
