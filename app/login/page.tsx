"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FiUser, FiLock, FiLoader } from "react-icons/fi";
import { GiLotus } from "react-icons/gi";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error("กรุณากรอก Username และ Password");
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      toast.error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } else {
      toast.success("เข้าสู่ระบบสำเร็จ");
      router.push("/");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-900/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-primary-800/5 blur-3xl" />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-primary-700/5 blur-3xl" />
        {/* Grid lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at center, rgba(22,163,74,0.05) 0%, transparent 70%),
            linear-gradient(rgba(22,163,74,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,163,74,0.03) 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 60px 60px, 60px 60px",
        }} />
      </div>

      <div className="w-full max-w-sm animate-fadeIn relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-900/50 border border-primary-700/50 mb-4"
            style={{ boxShadow: "0 0 40px rgba(22,163,74,0.3)" }}>
            <span className="text-4xl">🍀</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">หวยออนไลน์</h1>
          <p className="text-gray-400 text-sm mt-1">ระบบบริหารจัดการหวย</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-5">เข้าสู่ระบบ</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">ชื่อผู้ใช้</label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอก Username"
                  className="input-field !pl-10"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">รหัสผ่าน</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="input-field !pl-10"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              id="login-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2 py-3 text-base"
            >
              {loading ? (
                <><FiLoader className="animate-spin" /> กำลังเข้าสู่ระบบ...</>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          สงวนลิขสิทธิ์ © 2025 AdminAgent Lottery
        </p>
      </div>
    </div>
  );
}
