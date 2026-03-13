import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../services/api';
import toast from 'react-hot-toast';
import { FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('กรุณากรอก Username และ Password');
      return;
    }

    setLoading(true);
    try {
      const res = await loginApi({ username, password });
      loginUser(res.data.token, res.data.user);
      toast.success(`ยินดีต้อนรับ ${res.data.user.name}`);
      navigate(`/${res.data.user.role}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-pattern"></div>
      <div className="login-container animate-slide-up">
        <div className="login-logo">
          <div className="login-logo-icon">L</div>
          <h1 className="login-title">Agent Lottery</h1>
          <p className="login-subtitle">ระบบจัดการหวยออนไลน์</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-group">
            <FiUser className="login-input-icon" />
            <input
              id="login-username"
              type="text"
              placeholder="ชื่อผู้ใช้"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              autoComplete="username"
            />
          </div>

          <div className="login-input-group">
            <FiLock className="login-input-icon" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="login-eye-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? (
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
            ) : (
              'เข้าสู่ระบบ'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>© 2024 Agent Lottery System</p>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
          background: radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 60%),
                      var(--bg-primary);
        }

        .login-bg-pattern {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 50%);
          animation: pulse 4s ease-in-out infinite;
        }

        .login-container {
          width: 100%;
          max-width: 420px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 48px 40px;
          box-shadow: var(--shadow-lg), var(--shadow-glow);
          position: relative;
          z-index: 1;
        }

        .login-logo {
          text-align: center;
          margin-bottom: 36px;
        }

        .login-logo-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 1.8rem;
          margin-bottom: 16px;
          box-shadow: 0 4px 20px var(--primary-glow);
        }

        .login-title {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--text-primary);
          background: linear-gradient(135deg, var(--primary-light), var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 4px;
        }

        .login-subtitle {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .login-input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .login-input-icon {
          position: absolute;
          left: 16px;
          color: var(--text-muted);
          font-size: 1.1rem;
          z-index: 1;
        }

        .login-input {
          width: 100%;
          padding: 14px 16px 14px 48px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.95rem;
          transition: var(--transition);
        }

        .login-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-subtle);
        }

        .login-eye-btn {
          position: absolute;
          right: 12px;
          background: none;
          color: var(--text-muted);
          font-size: 1.1rem;
          padding: 4px;
          display: flex;
          z-index: 1;
        }

        .login-eye-btn:hover {
          color: var(--text-secondary);
        }

        .login-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 8px;
          box-shadow: 0 4px 16px var(--primary-glow);
        }

        .login-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, var(--primary-light), var(--primary));
          transform: translateY(-2px);
          box-shadow: 0 6px 24px var(--primary-glow);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-footer {
          text-align: center;
          margin-top: 32px;
          color: var(--text-muted);
          font-size: 0.8rem;
        }

        @media (max-width: 480px) {
          .login-container {
            padding: 32px 24px;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
