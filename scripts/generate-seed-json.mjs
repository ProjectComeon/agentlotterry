/**
 * Run: node scripts/generate-seed-json.mjs
 * Generates seed data JSON files for MongoDB Atlas import
 */
import { createWriteStream } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

async function generate() {
  const adminHash = await bcrypt.hash("admin1234", 10);
  const dealerHash = await bcrypt.hash("dealer1234", 10);
  const customerHash = await bcrypt.hash("customer1234", 10);

  // Generate ObjectIds (simple hex strings for Atlas import)
  const adminId = "000000000000000000000001";
  const dealerId = "000000000000000000000002";
  const customerId = "000000000000000000000003";
  const now = new Date().toISOString();

  const users = [
    {
      _id: { $oid: adminId },
      username: "admin",
      password: adminHash,
      role: "admin",
      displayName: "ผู้ดูแลระบบ",
      dealerId: null,
      isActive: true,
      createdAt: { $date: now },
      updatedAt: { $date: now },
    },
    {
      _id: { $oid: dealerId },
      username: "dealer1",
      password: dealerHash,
      role: "dealer",
      displayName: "เจ้ามือ 1",
      dealerId: null,
      isActive: true,
      createdAt: { $date: now },
      updatedAt: { $date: now },
    },
    {
      _id: { $oid: customerId },
      username: "customer1",
      password: customerHash,
      role: "customer",
      displayName: "ลูกค้า 1",
      dealerId: { $oid: dealerId },
      isActive: true,
      createdAt: { $date: now },
      updatedAt: { $date: now },
    },
  ];

  const out = createWriteStream("scripts/seed-users.json");
  out.write(JSON.stringify(users, null, 2));
  out.end();

  console.log("✅ Created scripts/seed-users.json");
  console.log("   Import this file into MongoDB Atlas:");
  console.log("   Database: admin-lottery | Collection: users");
  console.log("");
  console.log("   Users created:");
  console.log("   admin     / admin1234");
  console.log("   dealer1   / dealer1234");
  console.log("   customer1 / customer1234");
}

generate().catch(console.error);
