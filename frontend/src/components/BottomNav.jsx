import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiDollarSign, FiList, FiAward, FiFileText, FiUsers } from 'react-icons/fi';

const navItems = {
  customer: [
    { path: '/customer', label: 'แทงหวย', icon: <FiDollarSign /> },
    { path: '/customer/history', label: 'ประวัติ', icon: <FiList /> },
    { path: '/customer/lottery', label: 'ผลหวย', icon: <FiAward /> },
    { path: '/customer/summary', label: 'สรุป', icon: <FiFileText /> },
  ],
  agent: [
    { path: '/agent', label: 'หน้าแรก', icon: <FiHome /> },
    { path: '/agent/customers', label: 'ลูกค้า', icon: <FiUsers /> },
    { path: '/agent/bets', label: 'โพย', icon: <FiList /> },
    { path: '/agent/reports', label: 'รายงาน', icon: <FiFileText /> },
  ]
};

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const items = navItems[user?.role];

  if (!items) return null;

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item ${isActive ? 'bottom-nav-active' : ''}`}
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
