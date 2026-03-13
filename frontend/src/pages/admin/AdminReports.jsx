import { useState, useEffect } from 'react';
import { getAdminReports } from '../../services/api';
import { FiFileText, FiDownload } from 'react-icons/fi';

const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');

  useEffect(() => { loadReports(); }, [roundDate]);

  const loadReports = async () => {
    try {
      const params = {};
      if (roundDate) params.roundDate = roundDate;
      const res = await getAdminReports(params);
      setReports(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const totalAmount = reports.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const totalWon = reports.reduce((sum, r) => sum + (r.totalWon || 0), 0);
  const totalBets = reports.reduce((sum, r) => sum + (r.betCount || 0), 0);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 รายงานสรุปยอด</h1>
          <p className="page-subtitle">สรุปยอดแทงแยกตามเจ้ามือ/งวด</p>
        </div>
      </div>

      <div className="card mb-lg">
        <div className="flex gap-md items-center mb-md" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">กรองตามงวด</label>
            <input type="text" className="form-input" placeholder="เช่น 2024-12-16" value={roundDate} onChange={(e) => setRoundDate(e.target.value)} style={{ width: 200 }} />
          </div>
        </div>
      </div>

      <div className="grid grid-3 mb-lg">
        <div className="stat-card">
          <div className="stat-value">{totalBets.toLocaleString()}</div>
          <div className="stat-label">จำนวน Bets รวม</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalAmount.toLocaleString()} ฿</div>
          <div className="stat-label">ยอดแทงรวม</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: (totalAmount - totalWon) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {(totalAmount - totalWon).toLocaleString()} ฿
          </div>
          <div className="stat-label">กำไรสุทธิ</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title"><FiFileText style={{ marginRight: 8 }} />รายงานแยกเจ้ามือ</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>งวด</th>
                <th>เจ้ามือ</th>
                <th>จำนวน Bets</th>
                <th>ยอดแทง</th>
                <th>ยอดจ่าย</th>
                <th>กำไร</th>
                <th>ถูก/ไม่ถูก/รอ</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: 40 }}>ไม่มีข้อมูล</td></tr>
              ) : (
                reports.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.roundDate}</td>
                    <td>{r.agentName || '-'}</td>
                    <td>{r.betCount}</td>
                    <td>{(r.totalAmount || 0).toLocaleString()} ฿</td>
                    <td style={{ color: 'var(--danger)' }}>{(r.totalWon || 0).toLocaleString()} ฿</td>
                    <td style={{ fontWeight: 700, color: (r.netProfit || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {(r.netProfit || 0).toLocaleString()} ฿
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ marginRight: 4 }}>{r.wonCount}</span>
                      <span className="badge badge-danger" style={{ marginRight: 4 }}>{r.lostCount}</span>
                      <span className="badge badge-warning">{r.pendingCount}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
