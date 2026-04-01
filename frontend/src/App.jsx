import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import ProtectedRoute from './components/ProtectedRoute';
import { getAppRouteForRole } from './utils/roleRoutes';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AgentManagement from './pages/admin/AgentManagement';
import CustomerManagement from './pages/admin/CustomerManagement';
import AdminReports from './pages/admin/AdminReports';
import AdminLottery from './pages/admin/AdminLottery';
import AgentDashboard from './pages/agent/AgentDashboard';
import AgentCustomers from './pages/agent/AgentCustomers';
import AgentMemberDetail from './pages/agent/AgentMemberDetail';
import AgentBets from './pages/agent/AgentBets';
import AgentReports from './pages/agent/AgentReports';
import OperatorBetting from './pages/shared/OperatorBetting';

const AppLayout = ({ children }) => {
  const { user } = useAuth();
  const showBottomNav = user?.role === 'agent';

  return (
    <div className="app-layout">
      <div className="main-content">
        <Navbar />
        <div className={`page-content ${showBottomNav ? 'has-bottom-nav' : ''}`}>
          {children}
        </div>
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  );
};

const HomeRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  return <Navigate to={getAppRouteForRole(user.role)} replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <CatalogProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a2332',
                color: '#f0f4f8',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: '12px',
                fontSize: '0.9rem',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#f0f4f8' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#f0f4f8' } },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<HomeRedirect />} />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['admin']}>
                <AppLayout><AdminDashboard /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/agents" element={
              <ProtectedRoute roles={['admin']}>
                <AppLayout><AgentManagement /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/customers" element={
              <ProtectedRoute roles={['admin']}>
                <AppLayout><CustomerManagement /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/lottery" element={
              <ProtectedRoute roles={['admin']}>
                <AppLayout><AdminLottery /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute roles={['admin']}>
                <AppLayout><AdminReports /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/betting" element={
              <ProtectedRoute roles={['admin']}>
                <AppLayout><OperatorBetting /></AppLayout>
              </ProtectedRoute>
            } />

            {/* Agent Routes */}
            <Route path="/agent" element={
              <ProtectedRoute roles={['agent']}>
                <AppLayout><AgentDashboard /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/agent/customers" element={
              <ProtectedRoute roles={['agent']}>
                <AppLayout><AgentCustomers /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/agent/customers/:memberId" element={
              <ProtectedRoute roles={['agent']}>
                <AppLayout><AgentMemberDetail /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/agent/bets" element={
              <ProtectedRoute roles={['agent']}>
                <AppLayout><AgentBets /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/agent/betting" element={
              <ProtectedRoute roles={['agent']}>
                <AppLayout><OperatorBetting /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/agent/reports" element={
              <ProtectedRoute roles={['agent']}>
                <AppLayout><AgentReports /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/customer/*" element={<Navigate to="/login" replace />} />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </CatalogProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
