"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { FiAward, FiClock, FiDollarSign, FiList } from "react-icons/fi";

interface Bet {
  _id: string;
  number: string;
  betType: string;
  amount: number;
  status: "won" | "lost" | "pending";
  period: string;
}

interface Summary {
  totalBets: number;
  totalAmount: number;
  totalWon: number;
  netResult: number;
}

interface Lottery {
  period: string;
  firstPrize: string;
  twoDigitSuffix: string;
}

export default function CustomerDashboard({ username }: { username: string }) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get("/api/bets"),
      axios.get("/api/summary"),
      axios.get("/api/lottery"),
    ]).then(([bRes, sRes, lRes]) => {
      setBets(bRes.data.bets.slice(0, 5));
      setSummary(sRes.data);
      setLottery(lRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fmt = (n: number) => `฿${n.toLocaleString("th-TH")}`;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-white">หน้าหลัก</h1>
        <p className="text-gray-400 text-sm mt-0.5">ยินดีต้อนรับ, <span className="text-primary-400">{username}</span></p>
      </div>

      {/* Lottery result */}
      {lottery && (
        <div className="glass-card p-4 border border-primary-700/30">
          <p className="text-xs text-gray-400 mb-2">ผลหวยล่าสุด - งวด {lottery.period}</p>
          <div className="flex gap-3">
            <div className="flex-1 bg-primary-950/60 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">รางวัลที่ 1</p>
              <p className="text-2xl font-bold text-primary-400 tracking-widest">{lottery.firstPrize}</p>
            </div>
            <div className="flex-1 bg-gray-900/60 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">2 ตัวท้าย</p>
              <p className="text-2xl font-bold text-white tracking-widest">{lottery.twoDigitSuffix}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/customer/bet"
          className="glass-card p-4 text-center hover:border-primary-600/50 border border-transparent transition-all group">
          <FiAward size={28} className="mx-auto text-primary-400 group-hover:scale-110 transition-transform mb-2" />
          <p className="font-semibold text-white">แทงเลข</p>
        </Link>
        <Link href="/customer/history"
          className="glass-card p-4 text-center hover:border-primary-600/50 border border-transparent transition-all group">
          <FiClock size={28} className="mx-auto text-gray-400 group-hover:scale-110 transition-transform mb-2" />
          <p className="font-semibold text-white">ประวัติ</p>
        </Link>
      </div>

      {/* Mini stats */}
      {!loading && summary && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="รายการแทง" value={summary.totalBets} icon={<FiList size={16} />} color="blue" />
          <StatCard label="ยอดแทงรวม" value={fmt(summary.totalAmount)} icon={<FiDollarSign size={16} />} color="yellow" />
        </div>
      )}

      {/* Recent bets */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">รายการล่าสุด</h2>
          <Link href="/customer/history" className="text-primary-400 text-sm hover:text-primary-300">ดูทั้งหมด →</Link>
        </div>
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
        ) : bets.length === 0 ? (
          <p className="text-gray-500 text-center py-4 text-sm">ยังไม่มีรายการแทง</p>
        ) : (
          <div className="space-y-2">
            {bets.map(bet => (
              <div key={bet._id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary-400 w-10">{bet.number}</span>
                  <span className="text-xs text-gray-400">{bet.period}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-300">฿{bet.amount}</span>
                  <span className={`badge text-xs ${bet.status === "won" ? "badge-green" : bet.status === "lost" ? "badge-red" : "badge-yellow"}`}>
                    {bet.status === "won" ? "ถูก" : bet.status === "lost" ? "ไม่ถูก" : "รอ"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
