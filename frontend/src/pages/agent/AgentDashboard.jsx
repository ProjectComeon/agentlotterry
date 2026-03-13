import { useState, useEffect } from 'react';
import { getAgentDashboard } from '../../services/api';
import { FiUsers, FiDollarSign, FiTrendingUp, FiClock } from 'react-icons/fi';

const betTypeLabels = { '3top': '3 ตัวบน', '3tod': '3 ตัวโต๊ด', '2top': '2 ตัวบน', '2bottom': '2 ตัวล่าง', 'run_top': 'วิ่งบน', 'run_bottom': 'วิ่งล่าง' };

const AgentDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAgentDashboard();
        setData(res.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const stats = data?.stats || {};

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 แดชบอร์ดเจ้ามือ</h1>
          <p className="page-subtitle">ภาพรวมลูกค้าและยอดแทง</p>
        </div>
      </div>

      <div className="grid grid-4 mb-lg">
        <div className="stat-card">
          <div className="stat-icon"><FiUsers /></div>
          <div className="stat-value">{stats.totalCustomers || 0}</div>
          <div className="stat-label">ลูกค้าทั้งหมด ({stats.activeCustomers || 0} ใช้งาน)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}><FiClock /></div>
          <div className="stat-value">{stats.pendingBets || 0}</div>
          <div className="stat-label">รอผล</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}><FiDollarSign /></div>
          <div className="stat-value">{(stats.totalAmount || 0).toLocaleString()}</div>
          <div className="stat-label">ยอดแทงรวม (บาท)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}><FiTrendingUp /></div>
          <div className="stat-value" style={{ color: (stats.netProfit || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {(stats.netProfit || 0).toLocaleString()}
          </div>
          <div className="stat-label">กำไรสุทธิ (บาท)</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title"><FiClock style={{ marginRight: 8 }} />รายการแทงล่าสุด</h3>
        </div>
        {data?.recentBets?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.recentBets.map((bet, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bet.customerId?.name || 'N/A'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {betTypeLabels[bet.betType]} #{bet.number} • งวด {bet.roundDate}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{bet.amount.toLocaleString()} ฿</div>
                  <span className={`badge badge-${bet.result === 'won' ? 'success' : bet.result === 'lost' ? 'danger' : 'warning'}`}>
                    {bet.result === 'won' ? 'ถูก' : bet.result === 'lost' ? 'ไม่ถูก' : 'รอผล'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">ยังไม่มีรายการ</div></div>
        )}
      </div>
    </div>
  );
};

export default AgentDashboard;
