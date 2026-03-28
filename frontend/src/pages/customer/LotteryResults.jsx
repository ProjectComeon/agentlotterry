import { useMemo } from 'react';
import { FiActivity, FiAward, FiExternalLink } from 'react-icons/fi';
import { useCatalog } from '../../context/CatalogContext';

const LotteryResults = () => {
  const { recentResults, loading } = useCatalog();

  const latest = recentResults[0] || null;
  const grouped = useMemo(() => {
    return recentResults.reduce((acc, item) => {
      const key = item.lotteryCode || 'general';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [recentResults]);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in market-section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">ผลรางวัลหลายตลาด</h1>
          <p className="page-subtitle">แสดงผลรางวัลล่าสุดจาก catalog foundation และ legacy result feed</p>
        </div>
      </div>

      {latest ? (
        <div className="card mb-lg" style={{ borderColor: 'var(--border-accent)', boxShadow: 'var(--shadow-glow)' }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              <FiAward style={{ marginRight: 6 }} />
              {latest.lotteryName} • {latest.roundCode}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              ผลล่าสุดที่พร้อมใช้งาน
            </div>
            <div style={{
              fontSize: '3.5rem', fontWeight: 800, letterSpacing: '0.2em',
              color: 'var(--primary-light)',
              textShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
              marginBottom: 24
            }}>
              {latest.headline || '-'}
            </div>
            <div className="grid grid-3" style={{ maxWidth: 600, margin: '0 auto', gap: 16 }}>
              <div style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>3 ตัวบน</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{latest.threeTop || '-'}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>2 ตัวล่าง</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{latest.twoBottom || '-'}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>แหล่งที่มา</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase' }}>{latest.sourceType || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-lg">
          <div className="empty-state">
            <div className="empty-state-icon">🎰</div>
            <div className="empty-state-text">ยังไม่มีผลรางวัลในระบบใหม่</div>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([key, items]) => (
        <div key={key} className="card">
          <div className="card-header">
            <h3 className="card-title"><FiActivity style={{ marginRight: 8 }} />{items[0]?.lotteryName || key}</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>งวด</th>
                  <th>ผลหลัก</th>
                  <th>3 ตัวบน</th>
                  <th>2 ตัวล่าง</th>
                  <th>แหล่งที่มา</th>
                </tr>
              </thead>
              <tbody>
                {items.map((result) => (
                  <tr key={result.id}>
                    <td style={{ fontWeight: 600 }}>{result.roundCode}</td>
                    <td style={{ color: 'var(--primary-light)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.08em' }}>
                      {result.headline || '-'}
                    </td>
                    <td>{result.threeTop || '-'}</td>
                    <td>{result.twoBottom || '-'}</td>
                    <td>
                      <span className="badge badge-info" style={{ gap: 6 }}>
                        {result.sourceType || '-'}
                        {result.sourceUrl ? <FiExternalLink /> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LotteryResults;
