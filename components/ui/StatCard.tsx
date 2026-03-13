interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "green" | "red" | "yellow" | "blue";
  sub?: string;
}

const colorMap = {
  green: "border-primary-700/40 bg-primary-950/40 text-primary-400",
  red: "border-red-800/40 bg-red-950/40 text-red-400",
  yellow: "border-yellow-700/40 bg-yellow-950/40 text-yellow-400",
  blue: "border-blue-700/40 bg-blue-950/40 text-blue-400",
};

export function StatCard({ label, value, icon, color = "green", sub }: StatCardProps) {
  return (
    <div className={`glass-card p-5 border ${colorMap[color]} animate-fadeIn`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-sm font-medium">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

interface BadgeProps {
  status: "won" | "lost" | "pending";
}
const badgeMap = {
  won: "badge-green",
  lost: "badge-red",
  pending: "badge-yellow",
};
const labelMap = {
  won: "ถูกรางวัล",
  lost: "ไม่ถูก",
  pending: "รอผล",
};
export function StatusBadge({ status }: BadgeProps) {
  return <span className={badgeMap[status]}>{labelMap[status]}</span>;
}
