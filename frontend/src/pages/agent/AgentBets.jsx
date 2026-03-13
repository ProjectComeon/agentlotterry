import { useState, useEffect } from 'react';
import { getAgentBets, getAgentReports } from '../../services/api';
import { FiFileText } from 'react-icons/fi';

const betTypeLabels = { '3top': '3 ตัวบน', '3tod': '3 ตัวโต๊ด', '2top': '2 ตัวบน', '2bottom': '2 ตัวล่าง', 'run_top': 'วิ่งบน', 'run_bottom': 'วิ่งล่าง' };

const AgentBets = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');

  useEffect(() => { load(); }, [roundDate]);

  const load = async () => {
    try {
      const params = {};
      if (roundDate) params.roundDate = roundDate;
      const res = await getAgentBets(params);
      setBets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 รายการแทง</h1>
          <p className="page-subtitle">รายการแทงของลูกค้า ({bets.length} รายการ)</p>
        </div>
      </div>

      <div className="card mb-lg">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">กรองตามงวด</label>
          <input className="form-input" placeholder="เช่น 2024-12-16" value={roundDate} onChange={(e) => setRoundDate(e.target.value)} style={{ maxWidth: 250 }} />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>ลูกค้า</th><th>ประเภท</th><th>เลข</th><th>ยอด</th><th>อัตราจ่าย</th><th>งวด</th><th>ผล</th><th>ได้</th></tr></thead>
            <tbody>
              {bets.length === 0 ? (
                <tr><td colSpan="8" className="text-center text-muted" style={{ padding: 40 }}>ไม่มีข้อมูล</td></tr>
              ) : bets.map(b => (
                <tr key={b._id}>
                  <td style={{ fontWeight: 600 }}>{b.customerId?.name || 'N/A'}</td>
                  <td>{betTypeLabels[b.betType]}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary-light)', fontSize: '1.05rem' }}>{b.number}</td>
                  <td>{b.amount.toLocaleString()} ฿</td>
                  <td>x{b.payRate}</td>
                  <td>{b.roundDate}</td>
                  <td>
                    <span className={`badge badge-${b.result === 'won' ? 'success' : b.result === 'lost' ? 'danger' : 'warning'}`}>
                      {b.result === 'won' ? 'ถูก' : b.result === 'lost' ? 'ไม่ถูก' : 'รอผล'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: b.wonAmount > 0 ? 'var(--success)' : '' }}>
                    {b.wonAmount > 0 ? `${b.wonAmount.toLocaleString()} ฿` : '-'}
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

export default AgentBets;
