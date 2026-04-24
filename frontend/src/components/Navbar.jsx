import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { preloadAppRouteForPath } from '../utils/appPreload';
import {
  FiAward,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiList,
  FiLogOut,
  FiMenu,
  FiUser,
  FiUsers,
  FiX
} from 'react-icons/fi';

const menuItems = {
  admin: [
    { path: '/admin', label: 'แดชบอร์ด', icon: <FiHome /> },
    { path: '/admin/betting', label: 'ซื้อแทน', icon: <FiDollarSign /> },
    { path: '/admin/agents', label: 'เอเย่นต์', icon: <FiUsers /> },
    { path: '/admin/customers', label: 'สมาชิก', icon: <FiUser /> },
    { path: '/admin/bets', label: 'โพย', icon: <FiList /> },
    { path: '/admin/lottery', label: 'ผลรางวัล', icon: <FiAward /> },
    { path: '/admin/reports', label: 'รายงาน', icon: <FiFileText /> }
  ],
  agent: [
    { path: '/agent', label: 'แดชบอร์ด', icon: <FiHome /> },
    { path: '/agent/betting', label: 'ซื้อแทน', icon: <FiDollarSign /> },
    { path: '/agent/customers', label: 'สมาชิก', icon: <FiUsers /> },
    { path: '/agent/bets', label: 'โพย', icon: <FiList /> },
    { path: '/agent/reports', label: 'รายงาน', icon: <FiFileText /> }
  ]
};

const roleLabels = {
  admin: 'ผู้ดูแลระบบ',
  agent: 'เอเย่นต์'
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = menuItems[user?.role] || [];
  const visibleItems = user?.role === 'agent'
    ? [
      ...items.slice(0, 4),
      { path: '/agent/lottery', label: 'ผลรางวัล', icon: <FiAward /> },
      ...items.slice(4)
    ]
    : items;
  const roleLabel = user?.displayRole || roleLabels[user?.role] || '-';

  const isItemActive = (path) =>
    location.pathname === path || (path !== `/${user?.role}` && location.pathname.startsWith(`${path}/`));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const preloadItem = (path) => {
    preloadAppRouteForPath(path, user?.role);
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <button className="navbar-toggle" onClick={() => setMobileOpen((value) => !value)}>
            {mobileOpen ? <FiX /> : <FiMenu />}
          </button>

          <Link to={`/${user?.role}`} className="navbar-brand">
            <div className="navbar-logo">L</div>
            <span className="navbar-brand-text">หวยเอเย่นต์</span>
          </Link>
        </div>

        <div className="navbar-center">
          {visibleItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`navbar-link ${isItemActive(item.path) ? 'active' : ''}`}
              onFocus={() => preloadItem(item.path)}
              onMouseEnter={() => preloadItem(item.path)}
              onTouchStart={() => preloadItem(item.path)}
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
              <div className="navbar-user-role">{roleLabel}</div>
            </div>
          </div>

          <button className="navbar-logout" onClick={handleLogout} title="ออกจากระบบ">
            <FiLogOut />
          </button>
        </div>
      </nav>

      {mobileOpen ? (
        <div className="mobile-menu-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-menu" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-menu-header">
              <div className="navbar-user">
                <div className="navbar-user-avatar">{user?.name?.charAt(0) || 'U'}</div>
                <div className="navbar-user-info">
                  <div className="navbar-user-name">{user?.name}</div>
                  <div className="navbar-user-role">{roleLabel}</div>
                </div>
              </div>
            </div>

            {visibleItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`mobile-menu-link ${isItemActive(item.path) ? 'active' : ''}`}
                onFocus={() => preloadItem(item.path)}
                onMouseEnter={() => preloadItem(item.path)}
                onTouchStart={() => preloadItem(item.path)}
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
      ) : null}

      <style>{`
        .navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 20px;
          height: 64px;
          background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,248,248,0.94));
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(12px);
          box-shadow: 0 10px 28px rgba(185, 28, 28, 0.06);
        }

        .navbar-left,
        .navbar-right,
        .navbar-user {
          display: flex;
          align-items: center;
        }

        .navbar-left,
        .navbar-right {
          gap: 14px;
        }

        .navbar-toggle {
          display: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 1.35rem;
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
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          font-weight: 800;
          font-size: 1.05rem;
          box-shadow: 0 12px 20px rgba(220, 38, 38, 0.18);
        }

        .navbar-brand-text {
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--primary-dark);
        }

        .navbar-center {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .navbar-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.84rem;
          font-weight: 600;
          transition: var(--transition-fast);
          border: 1px solid transparent;
        }

        .navbar-link:hover {
          color: var(--text-primary);
          background: var(--bg-surface-hover);
        }

        .navbar-link.active {
          color: var(--primary-dark);
          background: var(--primary-subtle);
          border-color: rgba(220, 38, 38, 0.12);
          box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.02);
        }

        .navbar-user {
          gap: 10px;
        }

        .navbar-user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          font-weight: 700;
          font-size: 0.88rem;
        }

        .navbar-user-info {
          display: flex;
          flex-direction: column;
        }

        .navbar-user-name {
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.1;
        }

        .navbar-user-role {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .navbar-logout {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          background: var(--bg-surface-hover);
          color: var(--text-secondary);
          transition: var(--transition-fast);
        }

        .navbar-logout:hover {
          background: var(--danger);
          border-color: var(--danger);
          color: white;
        }

        .mobile-menu-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(47, 15, 15, 0.34);
          z-index: 200;
          animation: fadeIn 0.2s ease;
        }

        .mobile-menu {
          position: absolute;
          top: 0;
          left: 0;
          width: 280px;
          height: 100%;
          padding: 20px;
          overflow-y: auto;
          background: linear-gradient(180deg, #fffdfd 0%, #fff4f4 100%);
          box-shadow: 24px 0 48px rgba(127, 29, 29, 0.12);
          animation: slideRight 0.3s ease;
        }

        .mobile-menu-header {
          padding-bottom: 18px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .mobile-menu-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.92rem;
          font-weight: 600;
          transition: var(--transition-fast);
          margin-bottom: 4px;
        }

        .mobile-menu-link:hover,
        .mobile-menu-link.active {
          color: var(--primary-dark);
          background: var(--primary-subtle);
        }

        .mobile-menu-logout {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          margin-top: 16px;
          padding: 18px 14px 0;
          border-top: 1px solid var(--border);
          background: transparent;
          color: var(--danger);
          font-size: 0.92rem;
          font-weight: 700;
        }

        .mobile-menu-logout:hover {
          background: var(--primary-subtle);
        }

        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }

        @media (max-width: 920px) {
          .navbar-center {
            display: none;
          }

          .navbar-user-info {
            display: none;
          }

          .navbar-toggle {
            display: flex;
          }

          .mobile-menu-overlay {
            display: block;
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;
