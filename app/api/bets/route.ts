import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Bet from "@/models/Bet";
import User from "@/models/User";
import { PAYOUT_RATES } from "@/lib/rbac";

// GET /api/bets – Scoped by role
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  const filter: any = {};

  if (period) filter.period = period;

  if (session.user.role === "customer") {
    filter.customerId = session.user.id;
  } else if (session.user.role === "dealer") {
    filter.dealerId = session.user.id;
  }
  // admin sees all

  const bets = await Bet.find(filter)
    .populate("customerId", "displayName username")
    .populate("dealerId", "displayName username")
    .sort({ createdAt: -1 });

  return NextResponse.json({ bets });
}

// POST /api/bets – Customer only
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { number, betType, amount, period } = body;

  if (!number || !betType || !amount || !period) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  // Validate number format
  const lengthMap: Record<string, number> = {
    "2_top": 2, "2_bottom": 2,
    "3_top": 3, "3_tote": 3,
    "run_top": 1, "run_bottom": 1,
  };
  const expected = lengthMap[betType];
  if (!expected || !/^\d+$/.test(number) || number.length !== expected) {
    return NextResponse.json({ error: "รูปแบบเลขไม่ถูกต้อง" }, { status: 400 });
  }

  const payoutRate = PAYOUT_RATES[betType];
  if (!payoutRate) {
    return NextResponse.json({ error: "ประเภทการแทงไม่ถูกต้อง" }, { status: 400 });
  }

  await dbConnect();

  // Get customer's dealerId
  const customer = await User.findById(session.user.id);
  if (!customer || !customer.dealerId) {
    return NextResponse.json({ error: "ไม่พบข้อมูลเจ้ามือ" }, { status: 400 });
  }

  const bet = await Bet.create({
    customerId: session.user.id,
    dealerId: customer.dealerId,
    period,
    number,
    betType,
    amount: Number(amount),
    payoutRate,
    status: "pending",
  });

  return NextResponse.json({ bet }, { status: 201 });
}
