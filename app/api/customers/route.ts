import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

// GET /api/customers – Admin sees all, Dealer sees own
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();

  const filter: any = { role: "customer" };
  if (session.user.role === "dealer") {
    filter.dealerId = session.user.id;
  } else if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dealerFilter = searchParams.get("dealerId");
  if (dealerFilter && session.user.role === "admin") {
    filter.dealerId = dealerFilter;
  }

  const customers = await User.find(filter)
    .select("-password")
    .populate("dealerId", "displayName username")
    .sort({ createdAt: -1 });

  return NextResponse.json({ customers });
}

// POST /api/customers – Admin or Dealer creates
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "dealer"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { username, password, displayName, dealerId } = body;

  if (!username || !password || !displayName) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  await dbConnect();

  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีแล้ว" }, { status: 400 });
  }

  // Dealer can only create customer under themselves
  const assignedDealer =
    session.user.role === "dealer" ? session.user.id : dealerId;

  const hashed = await bcrypt.hash(password, 10);
  const customer = await User.create({
    username: username.toLowerCase(),
    password: hashed,
    role: "customer",
    displayName,
    dealerId: assignedDealer,
  });

  const { password: _, ...safe } = customer.toObject();
  return NextResponse.json({ customer: safe }, { status: 201 });
}
