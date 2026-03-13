import { useState, useEffect } from 'react';
import { getLatestLottery, getLotteryResults } from '../../services/api';
import { FiAward } from 'react-icons/fi';

const LotteryResults = () => {
  const [latest, setLatest] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [latestRes, resultsRes] = await Promise.all([getLatestLottery(), getLotteryResults()]);
        setLatest(latestRes.data);
        setResults(resultsRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🎰 ผลหวยไทย</h1>
          <p className="page-subtitle">ผลรางวัลสลากกินแบ่งรัฐบาล</p>
        </div>
      </div>

      {latest && latest.firstPrize ? (
        <div className="card mb-lg" style={{ borderColor: 'var(--border-accent)', boxShadow: 'var(--shadow-glow)' }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              <FiAward style={{ marginRight: 6 }} />ผลหวยงวด {latest.roundDate}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>รางวัลที่ 1</div>
            <div style={{
              fontSize: '3.5rem', fontWeight: 800, letterSpacing: '0.2em',
              color: 'var(--primary-light)',
              textShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
              marginBottom: 24
            }}>
              {latest.firstPrize}
            </div>
            <div className="grid grid-3" style={{ maxWidth: 500, margin: '0 auto', gap: 16 }}>
              <div style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>3 ตัวบน</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{latest.firstPrize?.slice(-3)}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>2 ตัวล่าง</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{latest.twoBottom || '-'}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>2 ตัวบน</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{latest.firstPrize?.slice(-2)}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-lg">
          <div className="empty-state">
            <div className="empty-state-icon">🎰</div>
            <div className="empty-state-text">ยังไม่มีผลหวย</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">ประวัติผลหวย</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>งวด</th><th>รางวัลที่ 1</th><th>3 ตัวบน</th><th>2 ตัวล่าง</th></tr></thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan="4" className="text-center text-muted" style={{ padding: 40 }}>ไม่มีข้อมูล</td></tr>
              ) : results.map(r => (
                <tr key={r._id}>
                  <td style={{ fontWeight: 600 }}>{r.roundDate}</td>
                  <td style={{ color: 'var(--primary-light)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em' }}>{r.firstPrize}</td>
                  <td>{r.firstPrize?.slice(-3)}</td>
                  <td>{r.twoBottom || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LotteryResults;
