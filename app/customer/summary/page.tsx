"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { StatCard } from "@/components/ui/StatCard";
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiList } from "react-icons/fi";

interface Summary {
  totalBets: number;
  totalAmount: number;
  totalWon: number;
  totalLost: number;
  netResult: number;
}

export default function CustomerSummaryPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/summary").then(r => { setSummary(r.data); setLoading(false); });
  }, []);

  const fmt = (n: number) => `฿${n.toLocaleString("th-TH")}`;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">สรุปผลได้เสีย</h1>
        <p className="text-gray-400 text-sm mt-0.5">ผลสรุปของฉันทั้งหมด</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : summary && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="รายการแทงทั้งหมด" value={summary.totalBets} icon={<FiList size={18} />} color="blue" />
            <StatCard label="ยอดแทงรวม" value={fmt(summary.totalAmount)} icon={<FiDollarSign size={18} />} color="yellow" />
            <StatCard label="ยอดถูกรวม" value={fmt(summary.totalWon)} icon={<FiTrendingUp size={18} />} color="green" />
            <StatCard label="ยอดเสียรวม" value={fmt(summary.totalLost)} icon={<FiTrendingDown size={18} />} color="red" />
          </div>

          {/* Net result banner */}
          <div className={`glass-card p-6 text-center mt-4 border ${summary.netResult >= 0 ? "border-primary-700/40" : "border-red-700/40"}`}>
            <p className="text-gray-400 text-sm mb-2">ผลสุทธิ</p>
            <p className={`text-4xl font-bold ${summary.netResult >= 0 ? "text-primary-400" : "text-red-400"}`}>
              {summary.netResult >= 0 ? "+" : ""}{fmt(summary.netResult)}
            </p>
            <p className={`text-sm mt-2 ${summary.netResult >= 0 ? "text-primary-500" : "text-red-500"}`}>
              {summary.netResult >= 0 ? "🎉 คุณกำไร!" : "📉 คุณขาดทุน"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
