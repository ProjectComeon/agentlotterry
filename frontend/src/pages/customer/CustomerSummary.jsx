import { useState, useEffect } from 'react';
import { getCustomerSummary } from '../../services/api';
import { FiDollarSign, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

const CustomerSummary = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try { const res = await getCustomerSummary({}); setData(res.data); }
      catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const overall = data?.overall || { totalAmount: 0, totalWon: 0, netResult: 0, totalBets: 0 };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">💰 สรุปได้เสีย</h1>
          <p className="page-subtitle">ยอดรวมทั้งหมดของคุณ</p>
        </div>
      </div>

      <div className="grid grid-4 mb-lg">
        <div className="stat-card">
          <div className="stat-icon"><FiDollarSign /></div>
          <div className="stat-value">{overall.totalBets}</div>
          <div className="stat-label">แทงทั้งหมด (ครั้ง)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}><FiTrendingDown /></div>
          <div className="stat-value">{overall.totalAmount.toLocaleString()}</div>
          <div className="stat-label">ยอดแทงรวม (฿)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}><FiTrendingUp /></div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{overall.totalWon.toLocaleString()}</div>
          <div className="stat-label">ยอดถูกรวม (฿)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: overall.netResult >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.8rem' }}>
            {overall.netResult >= 0 ? '+' : ''}{overall.netResult.toLocaleString()}
          </div>
          <div className="stat-label">ผลได้เสียรวม (฿)</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📅 สรุปรายงวด</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>งวด</th><th>แทง</th><th>ยอดแทง</th><th>ยอดถูก</th><th>ผลได้เสีย</th><th>ถูก/ไม่ถูก/รอ</th></tr></thead>
            <tbody>
              {(!data?.rounds || data.rounds.length === 0) ? (
                <tr><td colSpan="6" className="text-center text-muted" style={{ padding: 40 }}>ไม่มีข้อมูล</td></tr>
              ) : data.rounds.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.roundDate}</td>
                  <td>{r.betCount} ครั้ง</td>
                  <td>{(r.totalAmount || 0).toLocaleString()} ฿</td>
                  <td style={{ color: 'var(--success)' }}>{(r.totalWon || 0).toLocaleString()} ฿</td>
                  <td style={{ fontWeight: 700, color: (r.netResult || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {(r.netResult || 0) >= 0 ? '+' : ''}{(r.netResult || 0).toLocaleString()} ฿
                  </td>
                  <td>
                    <span className="badge badge-success" style={{ marginRight: 4 }}>{r.wonCount}</span>
                    <span className="badge badge-danger" style={{ marginRight: 4 }}>{r.lostCount}</span>
                    <span className="badge badge-warning">{r.pendingCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerSummary;
