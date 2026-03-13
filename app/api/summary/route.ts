import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Bet from "@/models/Bet";
import User from "@/models/User";

// GET /api/summary – returns summary stats scoped by role
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  const filter: any = { status: { $ne: "pending" } };
  if (period) filter.period = period;

  if (session.user.role === "customer") {
    filter.customerId = session.user.id;
  } else if (session.user.role === "dealer") {
    filter.dealerId = session.user.id;
  }

  const bets = await Bet.find(filter);
  const totalBets = bets.length;
  const totalAmount = bets.reduce((s, b) => s + b.amount, 0);
  const totalWon = bets.filter((b) => b.status === "won").reduce((s, b) => s + b.payout, 0);
  const totalLost = bets.filter((b) => b.status === "lost").reduce((s, b) => s + b.amount, 0);
  const netResult = totalWon - totalLost;

  // Dealer/Admin: count customers
  let customerCount = 0;
  if (session.user.role === "dealer") {
    customerCount = await User.countDocuments({ role: "customer", dealerId: session.user.id, isActive: true });
  } else if (session.user.role === "admin") {
    customerCount = await User.countDocuments({ role: "customer", isActive: true });
    const dealerCount = await User.countDocuments({ role: "dealer", isActive: true });
    return NextResponse.json({ totalBets, totalAmount, totalWon, totalLost, netResult, customerCount, dealerCount });
  }

  return NextResponse.json({ totalBets, totalAmount, totalWon, totalLost, netResult, customerCount });
}
