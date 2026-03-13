"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatCard";
import { BET_TYPE_LABELS } from "@/lib/rbac";
import { FiDollarSign, FiTrendingUp, FiList, FiUsers } from "react-icons/fi";

interface Summary {
  totalBets: number;
  totalAmount: number;
  totalWon: number;
  totalLost: number;
  netResult: number;
  customerCount: number;
}
interface Bet {
  _id: string;
  number: string;
  betType: string;
  amount: number;
  payout: number;
  status: "won" | "lost" | "pending";
  period: string;
  customerId: { displayName: string };
}

export default function DealerSummaryPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([axios.get("/api/summary"), axios.get("/api/bets")]).then(([sRes, bRes]) => {
      setSummary(sRes.data);
      setBets(bRes.data.bets);
      setLoading(false);
    });
  }, []);

  const fmt = (n: number) => `฿${n.toLocaleString("th-TH")}`;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">สรุปยอดของฉัน</h1>
        <p className="text-gray-400 text-sm mt-0.5">สถิติและรายการทั้งหมด</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="ลูกค้า" value={summary.customerCount} icon={<FiUsers size={16} />} color="green" />
            <StatCard label="รายการแทง" value={summary.totalBets} icon={<FiList size={16} />} color="blue" />
            <StatCard label="ยอดแทงรวม" value={fmt(summary.totalAmount)} icon={<FiDollarSign size={16} />} color="yellow" />
            <StatCard label={summary.netResult >= 0 ? "กำไร" : "ขาดทุน"}
              value={fmt(Math.abs(summary.netResult))} icon={<FiTrendingUp size={16} />}
              color={summary.netResult >= 0 ? "green" : "red"} />
          </div>
          {/* Net result */}
          <div className={`glass-card p-4 text-center mb-6 border ${summary.netResult >= 0 ? "border-primary-700/40" : "border-red-700/40"}`}>
            <p className="text-gray-400 text-sm">ผลกำไร/ขาดทุนสุทธิ</p>
            <p className={`text-3xl font-bold ${summary.netResult >= 0 ? "text-primary-400" : "text-red-400"}`}>
              {summary.netResult >= 0 ? "+" : ""}{fmt(summary.netResult)}
            </p>
          </div>
        </>
      )}

      {/* All bets table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-gray-800/50"><h2 className="font-semibold text-white">รายการแทงทั้งหมด</h2></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ลูกค้า</th>
                <th>เลข</th>
                <th>ประเภท</th>
                <th>งวด</th>
                <th>แทง</th>
                <th>ได้รับ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">กำลังโหลด...</td></tr>
              ) : bets.map(b => (
                <tr key={b._id}>
                  <td className="text-gray-300 text-sm">{b.customerId?.displayName ?? "-"}</td>
                  <td className="font-bold text-primary-400 tracking-widest">{b.number}</td>
                  <td className="text-gray-400 text-xs">{BET_TYPE_LABELS[b.betType] ?? b.betType}</td>
                  <td className="text-gray-500 text-xs">{b.period}</td>
                  <td className="text-white">฿{b.amount}</td>
                  <td className={b.status === "won" ? "text-primary-400 font-bold" : "text-gray-500"}>
                    {b.status === "won" ? `฿${b.payout}` : "-"}
                  </td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
              {!loading && bets.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">ยังไม่มีรายการ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
