import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiUser, FiHome, FiUsers, FiFileText, FiDollarSign, FiAward, FiList } from 'react-icons/fi';

const menuItems = {
  admin: [
    { path: '/admin', label: 'แดชบอร์ด', icon: <FiHome /> },
    { path: '/admin/agents', label: 'จัดการเจ้ามือ', icon: <FiUsers /> },
    { path: '/admin/customers', label: 'จัดการลูกค้า', icon: <FiUser /> },
    { path: '/admin/lottery', label: 'ผลหวย / คำนวณ', icon: <FiAward /> },
    { path: '/admin/reports', label: 'รายงาน', icon: <FiFileText /> },
  ],
  agent: [
    { path: '/agent', label: 'แดชบอร์ด', icon: <FiHome /> },
    { path: '/agent/customers', label: 'จัดการลูกค้า', icon: <FiUsers /> },
    { path: '/agent/bets', label: 'รายการแทง', icon: <FiList /> },
    { path: '/agent/reports', label: 'สรุปยอด', icon: <FiFileText /> },
  ],
  customer: [
    { path: '/customer', label: 'แทงหวย', icon: <FiDollarSign /> },
    { path: '/customer/history', label: 'ประวัติ', icon: <FiList /> },
    { path: '/customer/summary', label: 'สรุปได้เสีย', icon: <FiFileText /> },
    { path: '/customer/lottery', label: 'ผลหวย', icon: <FiAward /> },
  ]
};

const roleLabels = {
  admin: 'ผู้ดูแลระบบ',
  agent: 'เจ้ามือ',
  customer: 'ลูกค้า'
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = menuItems[user?.role] || [];

  return (
    <>
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="navbar-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <FiX /> : <FiMenu />}
          </button>
          <Link to={`/${user?.role}`} className="navbar-brand">
            <div className="navbar-logo">L</div>
            <span className="navbar-brand-text">Agent Lottery</span>
          </Link>
        </div>

        <div className="navbar-center">
          {items.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`navbar-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="navbar-right">
          <div className="navbar-user">
            <div className="navbar-user-avatar">{user?.name?.charAt(0) || 'U'}</div>
            <div className="navbar-user-info">
              <div className="navbar-user-name">{user?.name}</div>
              <div className="navbar-user-role">{roleLabels[user?.role]}</div>
            </div>
          </div>
          <button className="navbar-logout" onClick={handleLogout} title="ออกจากระบบ">
            <FiLogOut />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div className="navbar-user">
                <div className="navbar-user-avatar">{user?.name?.charAt(0) || 'U'}</div>
                <div className="navbar-user-info">
                  <div className="navbar-user-name">{user?.name}</div>
                  <div className="navbar-user-role">{roleLabels[user?.role]}</div>
                </div>
              </div>
            </div>
            {items.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`mobile-menu-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
            <button className="mobile-menu-logout" onClick={handleLogout}>
              <FiLogOut />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        .navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          height: 64px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(12px);
        }

        .navbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .navbar-toggle {
          display: none;
          background: none;
          color: var(--text-primary);
          font-size: 1.4rem;
          padding: 4px;
        }

        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .navbar-logo {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 1.1rem;
        }

        .navbar-brand-text {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          background: linear-gradient(135deg, var(--primary-light), var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .navbar-center {
          display: flex;
          gap: 4px;
        }

        .navbar-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          transition: var(--transition-fast);
        }

        .navbar-link:hover {
          color: var(--text-primary);
          background: var(--bg-surface-hover);
        }

        .navbar-link.active {
          color: var(--primary-light);
          background: var(--primary-subtle);
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .navbar-user {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .navbar-user-avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .navbar-user-info {
          display: flex;
          flex-direction: column;
        }

        .navbar-user-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .navbar-user-role {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .navbar-logout {
          background: var(--bg-surface-hover);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          transition: var(--transition);
        }

        .navbar-logout:hover {
          background: var(--danger);
          border-color: var(--danger);
          color: white;
        }

        /* Mobile */
        .mobile-menu-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 200;
          animation: fadeIn 0.2s ease;
        }

        .mobile-menu {
          position: absolute;
          top: 0;
          left: 0;
          width: 280px;
          height: 100%;
          background: var(--bg-card);
          padding: 20px;
          animation: slideRight 0.3s ease;
          overflow-y: auto;
        }

        .mobile-menu-header {
          padding-bottom: 20px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .mobile-menu-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.95rem;
          font-weight: 500;
          transition: var(--transition-fast);
          margin-bottom: 4px;
        }

        .mobile-menu-link:hover,
        .mobile-menu-link.active {
          color: var(--primary-light);
          background: var(--primary-subtle);
        }

        .mobile-menu-logout {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius-sm);
          color: var(--danger);
          font-size: 0.95rem;
          font-weight: 500;
          width: 100%;
          background: none;
          margin-top: 16px;
          border-top: 1px solid var(--border);
          padding-top: 20px;
        }

        .mobile-menu-logout:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }

        @media (max-width: 768px) {
          .navbar-center { display: none; }
          .navbar-user-info { display: none; }
          .navbar-toggle { display: flex; }
          .mobile-menu-overlay { display: block; }
        }
      `}</style>
    </>
  );
};

export default Navbar;
