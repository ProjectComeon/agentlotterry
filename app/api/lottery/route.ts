import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import LotteryResult from "@/models/LotteryResult";
import Bet from "@/models/Bet";
import axios from "axios";

const LOTTERY_API = "https://lotto.api.rayriffy.com";

// GET /api/lottery – fetch latest or specific period
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");

  try {
    const url = period ? `${LOTTERY_API}/${period}` : `${LOTTERY_API}/latest`;
    const res = await axios.get(url, { timeout: 10000 });
    const data = res.data;

    if (data.status !== "ok") {
      return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลหวยได้" }, { status: 502 });
    }

    // Parse prizes
    const prizes = data.response.prizes as any[];
    const firstPrize = prizes.find((p: any) => p.id === "first")?.number?.[0] ?? "";
    const twoDigit = prizes.find((p: any) => p.id === "last2")?.number?.[0] ?? "";
    const threeFront = prizes.find((p: any) => p.id === "front3")?.number ?? [];
    const threeSuffix = prizes.find((p: any) => p.id === "last3")?.number ?? [];
    const drawDate = data.response.date as string;

    return NextResponse.json({
      period: drawDate,
      firstPrize,
      twoDigitSuffix: twoDigit,
      threeDigitFront: threeFront,
      threeDigitSuffix: threeSuffix,
    });
  } catch (err) {
    return NextResponse.json({ error: "ดึงข้อมูล API หวยไม่ได้" }, { status: 502 });
  }
}

// POST /api/lottery/calculate – Admin triggers result calculation
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { period, firstPrize, twoDigitSuffix, threeDigitFront, threeDigitSuffix } = body;

  if (!period || !firstPrize || !twoDigitSuffix) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  await dbConnect();

  // Save result
  await LotteryResult.findOneAndUpdate(
    { period },
    { period, firstPrize, twoDigitSuffix, threeDigitFront, threeDigitSuffix, fetchedAt: new Date() },
    { upsert: true, new: true }
  );

  // Calculate pending bets for this period
  const bets = await Bet.find({ period, status: "pending" });

  let wonCount = 0;
  let lostCount = 0;

  for (const bet of bets) {
    let won = false;
    const n = bet.number;

    switch (bet.betType) {
      case "2_top":
        won = firstPrize.slice(-2) === n;
        break;
      case "2_bottom":
        won = twoDigitSuffix === n;
        break;
      case "3_top":
        won = firstPrize.slice(-3) === n;
        break;
      case "3_tote":
        won = firstPrize.slice(-3).split("").sort().join("") === n.split("").sort().join("");
        break;
      case "run_top":
        won = firstPrize.includes(n);
        break;
      case "run_bottom":
        won = twoDigitSuffix.includes(n);
        break;
    }

    const payout = won ? bet.amount * bet.payoutRate : 0;
    await Bet.findByIdAndUpdate(bet._id, {
      status: won ? "won" : "lost",
      payout,
      isLocked: true,
    });

    won ? wonCount++ : lostCount++;
  }

  // Lock result
  await LotteryResult.findOneAndUpdate({ period }, { isProcessed: true });

  return NextResponse.json({
    success: true,
    processed: bets.length,
    won: wonCount,
    lost: lostCount,
  });
}
