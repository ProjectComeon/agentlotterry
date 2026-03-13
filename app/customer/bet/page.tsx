"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { BET_TYPE_LABELS, PAYOUT_RATES } from "@/lib/rbac";
import { FiAward, FiLoader } from "react-icons/fi";

type BetType = keyof typeof BET_TYPE_LABELS;

export default function CustomerBetPage() {
  const [number, setNumber] = useState("");
  const [betType, setBetType] = useState<BetType>("2_top");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [lottery, setLottery] = useState<{ period: string } | null>(null);

  useEffect(() => {
    axios.get("/api/lottery").then(r => {
      setLottery(r.data);
      setPeriod(r.data.period ?? "");
    }).catch(() => {});
  }, []);

  const maxLen: Record<BetType, number> = {
    "2_top": 2, "2_bottom": 2, "3_top": 3, "3_tote": 3, "run_top": 1, "run_bottom": 1,
  };

  function handleNumberChange(v: string) {
    const digits = v.replace(/\D/g, "");
    setNumber(digits.slice(0, maxLen[betType]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!number || number.length !== maxLen[betType]) {
      toast.error(`กรุณากรอกเลข ${maxLen[betType]} หลัก`);
      return;
    }
    if (!amount || Number(amount) < 1) {
      toast.error("กรุณากรอกยอดแทงที่ถูกต้อง");
      return;
    }
    if (!period) {
      toast.error("ไม่พบงวดหวย");
      return;
    }
    setLoading(true);
    try {
      await axios.post("/api/bets", { number, betType, amount: Number(amount), period });
      toast.success(`✅ แทง ${BET_TYPE_LABELS[betType]} "${number}" ยอด ฿${amount} สำเร็จ`);
      setNumber("");
      setAmount("");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "เกิดข้อผิดพลาด");
    }
    setLoading(false);
  }

  const payout = amount && PAYOUT_RATES[betType] ? Number(amount) * PAYOUT_RATES[betType] : 0;

  return (
    <div className="p-4 lg:p-6 max-w-md mx-auto animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">แทงเลข</h1>
        {lottery && <p className="text-primary-400 text-sm mt-0.5">งวด {lottery.period}</p>}
      </div>

      {/* Bet type selector */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {(Object.keys(BET_TYPE_LABELS) as BetType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setBetType(t); setNumber(""); }}
            className={`py-2.5 px-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              betType === t
                ? "bg-primary-700 text-white border border-primary-500 shadow-lg"
                : "bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-600"
            }`}
          >
            {BET_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Number input */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block text-center">
            กรอกเลข {maxLen[betType]} หลัก
          </label>
          <input
            id="bet-number"
            type="tel"
            inputMode="numeric"
            value={number}
            onChange={e => handleNumberChange(e.target.value)}
            placeholder={"_".repeat(maxLen[betType])}
            className="lottery-input"
            maxLength={maxLen[betType]}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">ยอดแทง (บาท)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">฿</span>
            <input
              id="bet-amount"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              min="1"
              className="input-field pl-8 text-lg font-bold"
            />
          </div>
          {/* Quick amounts */}
          <div className="flex gap-2 mt-2">
            {[10, 20, 50, 100].map(n => (
              <button key={n} type="button" onClick={() => setAmount(String(n))}
                className="flex-1 py-1.5 text-xs rounded-lg bg-gray-900 border border-gray-800 hover:border-primary-700 hover:text-primary-400 text-gray-400 transition-all">
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Payout preview */}
        {payout > 0 && (
          <div className="glass-card p-4 border border-primary-700/30 text-center animate-fadeIn">
            <p className="text-gray-400 text-sm">ถ้าถูกรางวัล จะได้รับ</p>
            <p className="text-3xl font-bold text-primary-400 mt-1">฿{payout.toLocaleString("th-TH")}</p>
            <p className="text-xs text-gray-500 mt-1">อัตราจ่าย x{PAYOUT_RATES[betType]}</p>
          </div>
        )}

        <button
          id="submit-bet-btn"
          type="submit"
          disabled={loading || !number || !amount}
          className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <FiLoader className="animate-spin" /> : <FiAward />}
          {loading ? "กำลังส่ง..." : "ยืนยันการแทง"}
        </button>
      </form>
    </div>
  );
}
