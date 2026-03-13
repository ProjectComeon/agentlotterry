"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { BET_TYPE_LABELS } from "@/lib/rbac";
import { StatusBadge } from "@/components/ui/StatCard";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface Bet {
  _id: string;
  number: string;
  betType: string;
  amount: number;
  payout: number;
  status: "won" | "lost" | "pending";
  period: string;
  createdAt: string;
}

export default function CustomerHistoryPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState("");
  const [periods, setPeriods] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    const q = filterPeriod ? `?period=${filterPeriod}` : "";
    const r = await axios.get(`/api/bets${q}`);
    setBets(r.data.bets);
    const allPeriods = [...new Set(r.data.bets.map((b: Bet) => b.period))] as string[];
    if (!filterPeriod) setPeriods(allPeriods);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filterPeriod]);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">ประวัติการแทง</h1>
          <p className="text-gray-400 text-sm mt-0.5">{bets.length} รายการ</p>
        </div>
        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
          className="input-field w-36 text-sm">
          <option value="">ทุกงวด</option>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : bets.length === 0 ? (
        <div className="glass-card p-12 text-center text-gray-500">ยังไม่มีรายการแทง</div>
      ) : (
        <div className="space-y-2">
          {bets.map(bet => (
            <div key={bet._id} className="glass-card p-4 flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-950/60 border border-primary-800/40 rounded-xl flex items-center justify-center">
                  <span className="text-xl font-bold text-primary-400 tracking-widest">{bet.number}</span>
                </div>
                <div>
                  <p className="font-medium text-white text-sm">{BET_TYPE_LABELS[bet.betType] ?? bet.betType}</p>
                  <p className="text-xs text-gray-400">งวด {bet.period}</p>
                  <p className="text-xs text-gray-500">{format(new Date(bet.createdAt), "d MMM yy HH:mm", { locale: th })}</p>
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={bet.status} />
                <p className="text-sm text-gray-300 mt-1">แทง ฿{bet.amount.toLocaleString()}</p>
                {bet.status === "won" && (
                  <p className="text-sm text-primary-400 font-bold">ได้ ฿{bet.payout.toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
