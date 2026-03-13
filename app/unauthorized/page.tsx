"use client";

import Link from "next/link";
import { FiLock } from "react-icons/fi";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center animate-fadeIn">
        <div className="w-20 h-20 rounded-2xl bg-red-950/50 border border-red-800/50 flex items-center justify-center mx-auto mb-4">
          <FiLock size={36} className="text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="text-gray-400 mb-6">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <Link href="/" className="btn-primary inline-flex">กลับหน้าหลัก</Link>
      </div>
    </div>
  );
}
