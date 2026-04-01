import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAppRouteForRole } from '../utils/roleRoutes';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <span>กำลังโหลด...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getAppRouteForRole(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
