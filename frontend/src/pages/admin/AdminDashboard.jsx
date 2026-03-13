import { useState, useEffect } from 'react';
import { getAdminDashboard } from '../../services/api';
import { FiUsers, FiUser, FiDollarSign, FiTrendingUp, FiActivity, FiClock } from 'react-icons/fi';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await getAdminDashboard();
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div><span>กำลังโหลด...</span></div>;
  }

  const stats = data?.stats || {};
  const betTypeLabels = { '3top': '3 ตัวบน', '3tod': '3 ตัวโต๊ด', '2top': '2 ตัวบน', '2bottom': '2 ตัวล่าง', 'run_top': 'วิ่งบน', 'run_bottom': 'วิ่งล่าง' };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 แดชบอร์ดผู้ดูแลระบบ</h1>
          <p className="page-subtitle">ภาพรวมข้อมูลทั้งระบบ</p>
        </div>
      </div>

      <div className="grid grid-4 mb-lg">
        <div className="stat-card">
          <div className="stat-icon"><FiUsers /></div>
          <div className="stat-value">{stats.totalAgents || 0}</div>
          <div className="stat-label">เจ้ามือทั้งหมด (ใช้งาน: {stats.activeAgents || 0})</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}><FiUser /></div>
          <div className="stat-value">{stats.totalCustomers || 0}</div>
          <div className="stat-label">ลูกค้าทั้งหมด (ใช้งาน: {stats.activeCustomers || 0})</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}><FiDollarSign /></div>
          <div className="stat-value">{(stats.totalAmount || 0).toLocaleString()}</div>
          <div className="stat-label">ยอดแทงรวม (บาท)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}><FiTrendingUp /></div>
          <div className="stat-value">{(stats.netProfit || 0).toLocaleString()}</div>
          <div className="stat-label">กำไรสุทธิ (บาท)</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><FiActivity style={{ marginRight: 8 }} />สถิติการแทง</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>จำนวน Bets ทั้งหมด</span>
              <span style={{ fontWeight: 600 }}>{stats.totalBets || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>รอผล</span>
              <span className="badge badge-warning">{stats.pendingBets || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ยอดจ่ายรวม</span>
              <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{(stats.totalWon || 0).toLocaleString()} บาท</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>กำไร</span>
              <span style={{ fontWeight: 700, color: stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {(stats.netProfit || 0).toLocaleString()} บาท
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><FiClock style={{ marginRight: 8 }} />รายการแทงล่าสุด</h3>
          </div>
          {data?.recentBets?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.recentBets.slice(0, 6).map((bet, i) => (
                <div key={i} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {bet.customerId?.name || 'N/A'} - {betTypeLabels[bet.betType]} #{bet.number}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      งวด {bet.roundDate}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bet.amount.toLocaleString()} ฿</div>
                    <span className={`badge badge-${bet.result === 'won' ? 'success' : bet.result === 'lost' ? 'danger' : 'warning'}`}>
                      {bet.result === 'won' ? 'ถูก' : bet.result === 'lost' ? 'ไม่ถูก' : 'รอผล'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">ยังไม่มีรายการแทง</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
