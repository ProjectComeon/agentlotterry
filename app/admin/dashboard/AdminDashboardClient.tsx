"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { StatCard } from "@/components/ui/StatCard";
import { FiUsers, FiDollarSign, FiTrendingUp, FiAward, FiRefreshCw } from "react-icons/fi";
import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface Summary {
  totalBets: number;
  totalAmount: number;
  totalWon: number;
  totalLost: number;
  netResult: number;
  customerCount: number;
  dealerCount: number;
}

interface Dealer {
  _id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
}

interface LotteryData {
  period: string;
  firstPrize: string;
  twoDigitSuffix: string;
  threeDigitFront: string[];
  threeDigitSuffix: string[];
}

export default function AdminDashboardClient({ username }: { username: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [lottery, setLottery] = useState<LotteryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [sRes, dRes, lRes] = await Promise.all([
        axios.get("/api/summary"),
        axios.get("/api/dealers"),
        axios.get("/api/lottery"),
      ]);
      setSummary(sRes.data);
      setDealers(dRes.data.dealers);
      setLottery(lRes.data);
    } catch { }
    setLoading(false);
  }

  async function handleCalculate() {
    if (!lottery) return;
    setCalculating(true);
    try {
      await axios.post("/api/lottery", lottery);
      alert("✅ คำนวณผลสำเร็จ! ลูกค้าทุกคนได้รับผลแล้ว");
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.error ?? "เกิดข้อผิดพลาด");
    }
    setCalculating(false);
  }

  useEffect(() => { loadData(); }, []);

  const fmt = (n: number) => n.toLocaleString("th-TH");

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ภาพรวมระบบ</h1>
          <p className="text-gray-400 text-sm mt-0.5">ยินดีต้อนรับ, <span className="text-primary-400">{username}</span></p>
        </div>
        <button id="refresh-btn" onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          รีเฟรช
        </button>
      </div>

      {/* Lottery result widget */}
      {lottery && (
        <div className="glass-card p-4 border border-primary-700/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-400">ผลหวยล่าสุด</p>
              <p className="text-primary-300 font-semibold">งวด {lottery.period}</p>
            </div>
            <button
              id="calculate-btn"
              onClick={handleCalculate}
              disabled={calculating}
              className="btn-primary text-sm py-2"
            >
              {calculating ? "กำลังคำนวณ..." : "คำนวณผล"}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-primary-950/50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">รางวัลที่ 1</p>
              <p className="text-2xl font-bold text-primary-400 tracking-widest">{lottery.firstPrize}</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">2 ตัวท้าย</p>
              <p className="text-2xl font-bold text-white tracking-widest">{lottery.twoDigitSuffix}</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">3 ตัวหน้า</p>
              <p className="text-lg font-bold text-white">{lottery.threeDigitFront.join(", ") || "-"}</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">3 ตัวท้าย</p>
              <p className="text-lg font-bold text-white">{lottery.threeDigitSuffix.join(", ") || "-"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="เจ้ามือทั้งหมด" value={summary.dealerCount} icon={<FiUsers size={18} />} color="green" />
          <StatCard label="ลูกค้าทั้งหมด" value={summary.customerCount} icon={<FiUsers size={18} />} color="blue" />
          <StatCard label="ยอดแทงรวม" value={`฿${fmt(summary.totalAmount)}`} icon={<FiDollarSign size={18} />} color="yellow" />
          <StatCard
            label="กำไร/ขาดทุน"
            value={`฿${fmt(Math.abs(summary.netResult))}`}
            icon={<FiTrendingUp size={18} />}
            color={summary.netResult >= 0 ? "green" : "red"}
            sub={summary.netResult >= 0 ? "กำไร" : "ขาดทุน"}
          />
        </div>
      )}

      {/* Dealers table */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">รายชื่อเจ้ามือ</h2>
          <Link href="/admin/dealers" className="text-primary-400 text-sm hover:text-primary-300 transition-colors">
            จัดการทั้งหมด →
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>Username</th>
                  <th>สถานะ</th>
                  <th>สร้างเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {dealers.slice(0, 5).map((d) => (
                  <tr key={d._id}>
                    <td className="font-medium text-white">{d.displayName}</td>
                    <td className="text-gray-400">@{d.username}</td>
                    <td>
                      <span className={d.isActive ? "badge-green" : "badge-gray"}>
                        {d.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td className="text-gray-500 text-xs">
                      {format(new Date(d.createdAt), "d MMM yy", { locale: th })}
                    </td>
                  </tr>
                ))}
                {dealers.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-500 py-6">ยังไม่มีเจ้ามือ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
