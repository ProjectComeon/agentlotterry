import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { preloadAppRouteForPath } from '../utils/appPreload';
import {
  FiAward,
  FiBell,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiList,
  FiUsers
} from 'react-icons/fi';

const navItems = {
  agent: [
    { path: '/agent', label: 'หน้าหลัก', icon: <FiHome /> },
    { path: '/agent/customers', label: 'สมาชิก', icon: <FiUsers /> },
    { path: '/agent/betting', label: 'ซื้อแทน', icon: <FiDollarSign /> },
    { path: '/agent/bets', label: 'โพย', icon: <FiList /> },
    { path: '/agent/reports', label: 'รายงาน', icon: <FiFileText /> }
  ],
  customer: [
    { path: '/member', label: 'หน้าหลัก', icon: <FiHome /> },
    { path: '/member/buy', label: 'ซื้อหวย', icon: <FiDollarSign /> },
    { path: '/member/slips', label: 'โพย', icon: <FiList /> },
    { path: '/member/wallet', label: 'เครดิต', icon: <FiCreditCard /> },
    { path: '/member/pending-payouts', label: 'รางวัล', icon: <FiBell /> }
  ]
};

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const items = navItems[user?.role] || null;
  const visibleItems = user?.role === 'agent' && items
    ? [
      ...items.slice(0, 4),
      { path: '/agent/lottery', label: 'ผลรางวัล', icon: <FiAward /> },
      ...items.slice(4)
    ]
    : items;

  const isActivePath = (path) => {
    const roleRoot = user?.role === 'customer' ? '/member' : `/${user?.role}`;
    return location.pathname === path || (path !== roleRoot && location.pathname.startsWith(`${path}/`));
  };

  const preloadItem = (path) => {
    preloadAppRouteForPath(path, user?.role);
  };

  if (!visibleItems) return null;

  return (
    <nav className="bottom-nav">
      {visibleItems.map((item) => {
        const isActive = isActivePath(item.path);

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item ${isActive ? 'bottom-nav-active' : ''}`}
            onFocus={() => preloadItem(item.path)}
            onMouseEnter={() => preloadItem(item.path)}
            onTouchStart={() => preloadItem(item.path)}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
