import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

// PUT /api/dealers/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  const update: any = {};

  if (body.displayName) update.displayName = body.displayName;
  if (body.isActive !== undefined) update.isActive = body.isActive;
  if (body.password) update.password = await bcrypt.hash(body.password, 10);

  const dealer = await User.findByIdAndUpdate(params.id, update, { new: true }).select("-password");
  if (!dealer) return NextResponse.json({ error: "ไม่พบเจ้ามือ" }, { status: 404 });

  return NextResponse.json({ dealer });
}

// DELETE /api/dealers/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  await User.findByIdAndUpdate(params.id, { isActive: false });
  return NextResponse.json({ success: true });
}
