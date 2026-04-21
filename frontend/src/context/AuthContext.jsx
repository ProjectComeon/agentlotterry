import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, sendPresenceHeartbeat } from '../services/api';
import { getValidAppRole } from '../utils/roleRoutes';
import { buildInitialAuthState } from '../utils/authBootstrap';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const normalizeUser = (userData) => {
    const role = getValidAppRole(userData?.role);
    return role ? { ...userData, role } : null;
  };

  const [initialAuthState] = useState(() =>
    buildInitialAuthState({
      token: localStorage.getItem('token') || '',
      storedUser: localStorage.getItem('user') || '',
      normalizeUser
    })
  );
  const [user, setUser] = useState(initialAuthState.user);
  const [loading, setLoading] = useState(initialAuthState.loading);

  useEffect(() => {
    if (initialAuthState.shouldRevalidate) {
      checkAuth({ background: Boolean(initialAuthState.user) });
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let cancelled = false;
    const beat = async () => {
      try {
        await sendPresenceHeartbeat();
      } catch (error) {
        if (!cancelled) {
          console.error('Presence heartbeat failed', error);
        }
      }
    };

    beat();
    const intervalId = window.setInterval(beat, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user?.id]);

  const checkAuth = async ({ background = false } = {}) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (!background) {
      setLoading(true);
    }

    try {
      const res = await getMe();
      const normalizedUser = normalizeUser(res.data);
      if (!normalizedUser) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } else {
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        setUser(normalizedUser);
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loginUser = (token, userData) => {
    const normalizedUser = normalizeUser(userData);
    if (!normalizedUser) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      return;
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
