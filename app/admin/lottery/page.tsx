"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

interface LotteryData {
  period: string;
  firstPrize: string;
  twoDigitSuffix: string;
  threeDigitFront: string[];
  threeDigitSuffix: string[];
}

export default function AdminLotteryPage() {
  const [lottery, setLottery] = useState<LotteryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await axios.get("/api/lottery");
      setLottery(r.data);
    } catch { toast.error("ไม่สามารถดึงข้อมูลได้"); }
    setLoading(false);
  }

  async function handleCalculate() {
    if (!lottery) return;
    if (!confirm(`ยืนยันการคำนวณผลงวด ${lottery.period}? ไม่สามารถย้อนกลับได้`)) return;
    setCalculating(true);
    try {
      const r = await axios.post("/api/lottery", lottery);
      toast.success(`✅ คำนวณสำเร็จ! ถูก ${r.data.won} | ไม่ถูก ${r.data.lost} รายการ`);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "เกิดข้อผิดพลาด");
    }
    setCalculating(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">ผลหวยไทย</h1>
        <p className="text-gray-400 text-sm mt-0.5">ข้อมูลเรียลไทม์จาก API</p>
      </div>

      {loading ? (
        <div className="skeleton h-48 rounded-2xl" />
      ) : lottery ? (
        <div className="space-y-4">
          <div className="glass-card p-6 border border-primary-700/30">
            <div className="flex items-center justify-between mb-5">
              <p className="text-primary-300 font-semibold text-lg">งวด {lottery.period}</p>
              <button
                id="calc-result-btn"
                onClick={handleCalculate}
                disabled={calculating}
                className="btn-primary text-sm py-2"
              >
                {calculating ? "กำลังคำนวณ..." : "🎯 คำนวณผล + ล็อกข้อมูล"}
              </button>
            </div>

            {/* Main prizes */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-primary-950/60 border border-primary-800/40 rounded-2xl p-5 text-center">
                <p className="text-xs text-gray-400 mb-2">🏆 รางวัลที่ 1</p>
                <p className="text-4xl font-bold text-primary-400 tracking-widest">{lottery.firstPrize}</p>
              </div>
              <div className="bg-gray-900/60 border border-gray-700/40 rounded-2xl p-5 text-center">
                <p className="text-xs text-gray-400 mb-2">2 ตัวสุดท้าย</p>
                <p className="text-4xl font-bold text-white tracking-widest">{lottery.twoDigitSuffix}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900/40 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-2">3 ตัวหน้า</p>
                <div className="flex flex-wrap gap-2">
                  {lottery.threeDigitFront.map((n, i) => (
                    <span key={i} className="badge-green px-3 py-1 text-base font-bold">{n}</span>
                  ))}
                  {lottery.threeDigitFront.length === 0 && <span className="text-gray-500">-</span>}
                </div>
              </div>
              <div className="bg-gray-900/40 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-2">3 ตัวท้าย</p>
                <div className="flex flex-wrap gap-2">
                  {lottery.threeDigitSuffix.map((n, i) => (
                    <span key={i} className="badge-yellow px-3 py-1 text-base font-bold">{n}</span>
                  ))}
                  {lottery.threeDigitSuffix.length === 0 && <span className="text-gray-500">-</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 border border-yellow-800/30">
            <p className="text-yellow-400 text-sm">⚠️ การคำนวณผลจะล็อกรายการทั้งหมดของงวดนี้ไม่ให้แก้ไขได้อีก</p>
          </div>
        </div>
      ) : (
        <div className="glass-card p-12 text-center text-gray-500">ไม่พบข้อมูลผลหวย</div>
      )}
    </div>
  );
}
