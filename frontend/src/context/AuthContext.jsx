import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, sendPresenceHeartbeat } from '../services/api';
import { getValidAppRole } from '../utils/roleRoutes';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const normalizeUser = (userData) => {
    const role = getValidAppRole(userData?.role);
    return role ? { ...userData, role } : null;
  };

  useEffect(() => {
    checkAuth();
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

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
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
