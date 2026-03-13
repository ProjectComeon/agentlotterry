import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

// PUT /api/customers/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "dealer"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  // Dealer can only update their own customers
  const customer = await User.findById(params.id);
  if (!customer) return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });

  if (session.user.role === "dealer" && customer.dealerId?.toString() !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const update: any = {};
  if (body.displayName) update.displayName = body.displayName;
  if (body.isActive !== undefined) update.isActive = body.isActive;
  if (body.password) update.password = await bcrypt.hash(body.password, 10);

  const updated = await User.findByIdAndUpdate(params.id, update, { new: true }).select("-password");
  return NextResponse.json({ customer: updated });
}

// DELETE /api/customers/[id] – soft delete
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "dealer"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const customer = await User.findById(params.id);
  if (!customer) return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });

  if (session.user.role === "dealer" && customer.dealerId?.toString() !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await User.findByIdAndUpdate(params.id, { isActive: false });
  return NextResponse.json({ success: true });
}
