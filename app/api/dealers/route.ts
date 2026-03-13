import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

// GET /api/dealers – Admin only: list all dealers
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const dealers = await User.find({ role: "dealer" })
    .select("-password")
    .sort({ createdAt: -1 });

  return NextResponse.json({ dealers });
}

// POST /api/dealers – Admin only: create dealer
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { username, password, displayName } = body;

  if (!username || !password || !displayName) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  await dbConnect();

  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีแล้ว" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const dealer = await User.create({
    username: username.toLowerCase(),
    password: hashed,
    role: "dealer",
    displayName,
  });

  const { password: _, ...safe } = dealer.toObject();
  return NextResponse.json({ dealer: safe }, { status: 201 });
}
