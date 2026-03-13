"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { StatCard } from "@/components/ui/StatCard";
import { FiUsers, FiDollarSign, FiTrendingUp, FiRefreshCw } from "react-icons/fi";
import Link from "next/link";

interface Summary {
  totalBets: number;
  totalAmount: number;
  totalWon: number;
  totalLost: number;
  netResult: number;
  customerCount: number;
}

interface Customer {
  _id: string;
  username: string;
  displayName: string;
  isActive: boolean;
}

export default function DealerDashboard({ username }: { username: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [sRes, cRes] = await Promise.all([axios.get("/api/summary"), axios.get("/api/customers")]);
    setSummary(sRes.data);
    setCustomers(cRes.data.customers);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  const fmt = (n: number) => n.toLocaleString("th-TH");

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard เจ้ามือ</h1>
          <p className="text-gray-400 text-sm mt-0.5">ยินดีต้อนรับ, <span className="text-primary-400">{username}</span></p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="ลูกค้าของฉัน" value={summary.customerCount} icon={<FiUsers size={18} />} color="green" />
          <StatCard label="รายการแทงทั้งหมด" value={summary.totalBets} icon={<FiDollarSign size={18} />} color="blue" />
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

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">ลูกค้าของฉัน</h2>
          <Link href="/dealer/customers" className="text-primary-400 text-sm hover:text-primary-300 transition-colors">
            จัดการทั้งหมด →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อ</th>
                <th>Username</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {customers.slice(0, 5).map((c, i) => (
                <tr key={c._id}>
                  <td className="text-gray-500 text-xs">{i + 1}</td>
                  <td className="font-medium text-white">{c.displayName}</td>
                  <td className="text-gray-400">@{c.username}</td>
                  <td><span className={c.isActive ? "badge-green" : "badge-gray"}>{c.isActive ? "ใช้งาน" : "ปิด"}</span></td>
                </tr>
              ))}
              {customers.length === 0 && !loading && (
                <tr><td colSpan={4} className="text-center text-gray-500 py-6">ยังไม่มีลูกค้า</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
