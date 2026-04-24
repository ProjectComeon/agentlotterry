import { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiAward, FiExternalLink } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PageSkeleton from '../../components/PageSkeleton';
import { memberCopy } from '../../i18n/th/member';
import { getResultSourceTypeLabel } from '../../i18n/th/labels';
import { getRecentMarketResults } from '../../services/api';

const LotteryResults = () => {
  const copy = memberCopy.results;
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await getRecentMarketResults({ limit: 50 });
        if (active) {
          setRecentResults(response.data || []);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setRecentResults([]);
          toast.error(error.response?.data?.message || 'โหลดผลรางวัลไม่สำเร็จ');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const latest = recentResults[0] || null;
  const grouped = useMemo(() => recentResults.reduce((acc, item) => {
    const key = item.lotteryCode || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {}), [recentResults]);

  if (loading) return <PageSkeleton statCount={3} rows={5} sidebar={false} />;

  return (
    <div className="animate-fade-in results-page">
      <section className="results-hero card">
        <div className="results-hero-copy">
          <span className="section-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
        </div>
      </section>

      {latest ? (
        <section className="card featured-result">
          <div className="featured-result-topline"><FiAward /> {latest.lotteryName} • {latest.roundCode}</div>
          <div className="featured-result-headline">{latest.headline || '-'}</div>
          <div className="featured-result-grid">
            <div className="featured-result-card"><span>{copy.featured.threeTop}</span><strong>{latest.threeTop || '-'}</strong></div>
            <div className="featured-result-card"><span>{copy.featured.twoBottom}</span><strong>{latest.twoBottom || '-'}</strong></div>
            <div className="featured-result-card"><span>{copy.featured.source}</span><strong>{getResultSourceTypeLabel(latest.sourceType)}</strong></div>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><FiAward /></div>
            <div className="empty-state-text">{copy.empty}</div>
          </div>
        </section>
      )}

      {Object.entries(grouped).map(([key, items]) => (
        <section key={key} className="card results-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">{copy.panelEyebrow}</div>
              <h3 className="card-title"><FiActivity style={{ marginRight: 8 }} />{items[0]?.lotteryName || key}</h3>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.table.round}</th>
                  <th>{copy.table.headline}</th>
                  <th>{copy.table.threeTop}</th>
                  <th>{copy.table.twoBottom}</th>
                  <th>{copy.table.source}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((result) => (
                  <tr key={result.id}>
                    <td>{result.roundCode}</td>
                    <td className="result-headline-cell">{result.headline || '-'}</td>
                    <td>{result.threeTop || '-'}</td>
                    <td>{result.twoBottom || '-'}</td>
                    <td>
                      <span className="badge badge-info source-pill">
                        {getResultSourceTypeLabel(result.sourceType)}
                        {result.sourceUrl ? <FiExternalLink /> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <style>{`
        .results-page{display:flex;flex-direction:column;gap:16px;position:relative;isolation:isolate}
        .results-page::before{content:'';position:absolute;inset:-48px 0 auto;height:220px;background:radial-gradient(circle at top left,rgba(16,185,129,.14),transparent 62%);pointer-events:none;z-index:-1}
        .results-hero{padding:28px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(17,24,39,.9)),radial-gradient(circle at top right,rgba(16,185,129,.12),transparent 38%);border-color:rgba(52,211,153,.18);box-shadow:0 24px 60px rgba(15,23,42,.34)}
        .results-hero-copy{display:flex;flex-direction:column;gap:12px}
        .section-eyebrow,.panel-eyebrow{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--primary-light);font-weight:700}
        .results-hero .page-title{margin:0;font-size:clamp(2rem,4vw,3rem);line-height:.96;letter-spacing:-.04em}
        .results-hero .page-subtitle{margin:0;max-width:56ch}
        .featured-result,.results-panel{padding:20px}
        .featured-result{border-color:var(--border-accent);box-shadow:var(--shadow-glow)}
        .featured-result-topline{display:inline-flex;align-items:center;gap:8px;font-size:.88rem;color:var(--text-muted);margin-bottom:10px}
        .featured-result-headline{font-size:clamp(2rem,5vw,3.5rem);font-weight:800;letter-spacing:.14em;color:var(--primary-light);text-shadow:0 0 30px rgba(16,185,129,.25);margin-bottom:18px}
        .featured-result-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .featured-result-card{padding:16px;background:var(--bg-surface);border-radius:16px;border:1px solid var(--border)}
        .featured-result-card span{display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:4px}
        .featured-result-card strong{font-size:1.4rem}
        .panel-head{margin-bottom:16px}
        .panel-head .card-title{margin:6px 0 0;font-size:1.15rem}
        .result-headline-cell{color:var(--primary-light);font-weight:700;letter-spacing:.08em}
        .source-pill{gap:6px}
        @media (max-width:900px){.featured-result-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
};

export default LotteryResults;
