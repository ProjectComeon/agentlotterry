import { useState, useEffect } from 'react';
import { getCustomerBets } from '../../services/api';
import { FiSearch } from 'react-icons/fi';

const betTypeLabels = { '3top': '3 ตัวบน', '3tod': '3 ตัวโต๊ด', '2top': '2 ตัวบน', '2bottom': '2 ตัวล่าง', 'run_top': 'วิ่งบน', 'run_bottom': 'วิ่งล่าง' };

const BetHistory = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');
  const [resultFilter, setResultFilter] = useState('');

  useEffect(() => { load(); }, [roundDate, resultFilter]);

  const load = async () => {
    try {
      const params = {};
      if (roundDate) params.roundDate = roundDate;
      if (resultFilter) params.result = resultFilter;
      const res = await getCustomerBets(params);
      setBets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 ประวัติการแทง</h1>
          <p className="page-subtitle">รายการแทงทั้งหมดของคุณ ({bets.length} รายการ)</p>
        </div>
      </div>

      <div className="card mb-lg">
        <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">งวด</label>
            <input className="form-input" placeholder="เช่น 2024-12-16" value={roundDate} onChange={(e) => setRoundDate(e.target.value)} style={{ width: 200 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">ผล</label>
            <select className="form-select" value={resultFilter} onChange={(e) => setResultFilter(e.target.value)} style={{ width: 150 }}>
              <option value="">ทั้งหมด</option>
              <option value="pending">รอผล</option>
              <option value="won">ถูก</option>
              <option value="lost">ไม่ถูก</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>ประเภท</th><th>เลข</th><th>ยอด</th><th>อัตราจ่าย</th><th>งวด</th><th>ผล</th><th>ได้</th></tr></thead>
            <tbody>
              {bets.length === 0 ? (
                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: 40 }}>ไม่มีข้อมูล</td></tr>
              ) : bets.map(b => (
                <tr key={b._id}>
                  <td>{betTypeLabels[b.betType]}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary-light)', fontSize: '1.1rem', letterSpacing: '0.1em' }}>{b.number}</td>
                  <td>{b.amount.toLocaleString()} ฿</td>
                  <td>x{b.payRate}</td>
                  <td>{b.roundDate}</td>
                  <td>
                    <span className={`badge badge-${b.result === 'won' ? 'success' : b.result === 'lost' ? 'danger' : 'warning'}`}>
                      {b.result === 'won' ? '🎉 ถูก' : b.result === 'lost' ? 'ไม่ถูก' : '⏳ รอผล'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: b.wonAmount > 0 ? 'var(--success)' : '' }}>
                    {b.wonAmount > 0 ? `+${b.wonAmount.toLocaleString()} ฿` : '-'}
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

export default BetHistory;
