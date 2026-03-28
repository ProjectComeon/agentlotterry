import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiAward,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiLayers,
  FiList,
  FiUsers
} from 'react-icons/fi';

const navItems = {
  customer: [
    { path: '/customer', label: 'Market', icon: <FiLayers /> },
    { path: '/customer/bet', label: 'Bet', icon: <FiDollarSign /> },
    { path: '/customer/history', label: 'History', icon: <FiList /> },
    { path: '/customer/lottery', label: 'Result', icon: <FiAward /> },
    { path: '/customer/summary', label: 'Summary', icon: <FiFileText /> },
    { path: '/customer/wallet', label: 'Wallet', icon: <FiDollarSign /> }
  ],
  agent: [
    { path: '/agent', label: 'Home', icon: <FiHome /> },
    { path: '/agent/customers', label: 'Members', icon: <FiUsers /> },
    { path: '/agent/bets', label: 'Slips', icon: <FiList /> },
    { path: '/agent/reports', label: 'Reports', icon: <FiFileText /> }
  ]
};

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const items = navItems[user?.role];
  const isActivePath = (path) => location.pathname === path || (path !== `/${user?.role}` && location.pathname.startsWith(`${path}/`));

  if (!items) return null;

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const isActive = isActivePath(item.path);
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
