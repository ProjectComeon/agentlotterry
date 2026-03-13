"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  FiGrid, FiUsers, FiUser, FiBarChart2, FiLogOut, FiAward, FiClock
} from "react-icons/fi";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  role: "admin" | "dealer" | "customer";
  displayName: string;
}

const navMap: Record<string, NavItem[]> = {
  admin: [
    { href: "/admin/dashboard", label: "ภาพรวม", icon: <FiGrid size={20} /> },
    { href: "/admin/dealers", label: "เจ้ามือ", icon: <FiUsers size={20} /> },
    { href: "/admin/customers", label: "ลูกค้า", icon: <FiUser size={20} /> },
    { href: "/admin/lottery", label: "ผลหวย", icon: <FiAward size={20} /> },
  ],
  dealer: [
    { href: "/dealer/dashboard", label: "ภาพรวม", icon: <FiGrid size={20} /> },
    { href: "/dealer/customers", label: "ลูกค้า", icon: <FiUsers size={20} /> },
    { href: "/dealer/summary", label: "สรุปยอด", icon: <FiBarChart2 size={20} /> },
  ],
  customer: [
    { href: "/customer/dashboard", label: "หน้าหลัก", icon: <FiGrid size={20} /> },
    { href: "/customer/bet", label: "แทงเลข", icon: <FiAward size={20} /> },
    { href: "/customer/history", label: "ประวัติ", icon: <FiClock size={20} /> },
    { href: "/customer/summary", label: "ได้/เสีย", icon: <FiBarChart2 size={20} /> },
  ],
};

const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  dealer: "เจ้ามือ",
  customer: "ลูกค้า",
};

export function Sidebar({ role, displayName }: SidebarProps) {
  const pathname = usePathname();
  const items = navMap[role] ?? [];

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-gray-950/80 border-r border-primary-900/30 fixed left-0 top-0 bottom-0 z-40">
      {/* Logo */}
      <div className="p-5 border-b border-primary-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-900/60 border border-primary-700/50 flex items-center justify-center text-xl">
            🍀
          </div>
          <div>
            <p className="font-bold text-white text-sm">หวยออนไลน์</p>
            <p className="text-primary-400 text-xs">{roleLabels[role]}</p>
          </div>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-3 border-b border-primary-900/20">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-primary-950/50">
          <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white font-bold text-sm">
            {displayName[0]?.toUpperCase()}
          </div>
          <p className="text-gray-200 text-sm font-medium truncate">{displayName}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-primary-700/30 text-primary-300 border border-primary-700/40"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              <span className={active ? "text-primary-400" : ""}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-primary-900/30">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-950/30 w-full transition-all duration-200"
        >
          <FiLogOut size={18} />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}

// Mobile bottom nav
export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = navMap[role] ?? [];

  return (
    <nav className="bottom-nav lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 py-2 px-3 min-w-0 flex-1 transition-all duration-200 ${
              active ? "text-primary-400" : "text-gray-500"
            }`}
          >
            <span className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}>
              {item.icon}
            </span>
            <span className="text-xs font-medium truncate">{item.label}</span>
            {active && <span className="absolute bottom-0 w-6 h-0.5 bg-primary-500 rounded-full" />}
          </Link>
        );
      })}
    </nav>
  );
}
