import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiActivity, FiAward, FiClock, FiDownload, FiEdit3, FiRefreshCw } from 'react-icons/fi';
import Modal from '../../components/Modal';
import PageSkeleton from '../../components/PageSkeleton';
import { fetchLottery, getLatestLottery, getLotteryResults, manualLottery } from '../../services/api';

const resultStatusBadge = (result) => {
  if (result?.isCalculated) return 'badge-success';
  return result?.firstPrize ? 'badge-warning' : 'badge-info';
};

const resultStatusLabel = (result) => {
  if (result?.isCalculated) return 'Settled';
  if (result?.firstPrize) return 'Saved';
  return 'Pending';
};

const AdminLottery = () => {
  const [latest, setLatest] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchDate, setFetchDate] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    roundDate: '',
    firstPrize: '',
    twoBottom: '',
    threeTopList: '',
    threeBotList: '',
    runTop: '',
    runBottom: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [latestRes, resultsRes] = await Promise.all([getLatestLottery(), getLotteryResults()]);
      setLatest(latestRes.data);
      setResults(resultsRes.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const overviewCards = useMemo(() => {
    const latestRound = latest?.roundDate || 'No round';
    const latestFirstPrize = latest?.firstPrize || '-';
    const latestTop = latest?.firstPrize?.slice(-3) || '-';
    const latestBottom = latest?.twoBottom || '-';

    return [
      {
        label: 'Latest round',
        value: latestRound,
        hint: latest?.isCalculated ? 'Fully settled' : 'Waiting for settlement'
      },
      {
        label: 'First prize',
        value: latestFirstPrize,
        hint: 'Primary winning number'
      },
      {
        label: '3 top',
        value: latestTop,
        hint: 'Derived from first prize'
      },
      {
        label: '2 bottom',
        value: latestBottom,
        hint: `${results.length} saved rounds`
      }
    ];
  }, [latest, results.length]);

  const handleFetch = async () => {
    if (!fetchDate) {
      toast.error('Please choose a round date first');
      return;
    }

    const toastId = toast.loading('Syncing result from external feed...');

    try {
      const res = await fetchLottery({ roundDate: fetchDate });
      const settlement = res.data?.settlement;
      if (settlement) {
        toast.success(`Result synced. Won ${settlement.wonCount}, lost ${settlement.lostCount}.`, { id: toastId });
      } else {
        toast.success('Result synced successfully.', { id: toastId });
      }
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to sync the result', { id: toastId });
    }
  };

  const handleQuickSync = async () => {
    const targetDate = fetchDate || latest?.roundDate;
    if (!targetDate) {
      toast.error('No round is available to sync yet');
      return;
    }

    setFetchDate(targetDate);
    const toastId = toast.loading(`Syncing round ${targetDate}...`);

    try {
      const res = await fetchLottery({ roundDate: targetDate });
      const settlement = res.data?.settlement;
      if (settlement) {
        toast.success(`Round ${targetDate} synced and settled.`, { id: toastId });
      } else {
        toast.success(`Round ${targetDate} synced.`, { id: toastId });
      }
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to sync round ${targetDate}`, { id: toastId });
    }
  };

  const handleManualSave = async (event) => {
    event.preventDefault();

    const toastId = toast.loading('Saving manual result...');

    try {
      const payload = {
        ...manualForm,
        threeTopList: manualForm.threeTopList ? manualForm.threeTopList.split(',').map((item) => item.trim()).filter(Boolean) : [],
        threeBotList: manualForm.threeBotList ? manualForm.threeBotList.split(',').map((item) => item.trim()).filter(Boolean) : [],
        runTop: manualForm.runTop ? manualForm.runTop.split(',').map((item) => item.trim()).filter(Boolean) : [],
        runBottom: manualForm.runBottom ? manualForm.runBottom.split(',').map((item) => item.trim()).filter(Boolean) : []
      };

      const res = await manualLottery(payload);
      const settlement = res.data?.settlement;
      if (settlement) {
        toast.success(`Manual result saved. Won ${settlement.wonCount}, lost ${settlement.lostCount}.`, { id: toastId });
      } else {
        toast.success('Manual result saved.', { id: toastId });
      }

      setShowManual(false);
      setManualForm({
        roundDate: '',
        firstPrize: '',
        twoBottom: '',
        threeTopList: '',
        threeBotList: '',
        runTop: '',
        runBottom: ''
      });
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save manual result', { id: toastId });
    }
  };

  if (loading) {
    return <PageSkeleton statCount={4} rows={5} sidebar={false} />;
  }

  return (
    <div className="ops-page animate-fade-in">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">Result control</span>
          <h1 className="page-title">Lottery Results</h1>
          <p className="page-subtitle">Sync official results, keep a clean result archive, and use manual entry only as a fallback when an external feed is delayed.</p>
        </div>

        <div className="ops-hero-side">
          <span>Current result state</span>
          <strong>{latest?.roundDate || 'No round'}</strong>
          <small>{latest?.firstPrize ? `First prize ${latest.firstPrize}` : 'No result stored yet'}</small>
        </div>
      </section>

      <section className="ops-overview-grid">
        {overviewCards.map((card) => (
          <article key={card.label} className="ops-overview-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="ops-grid">
        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">External feed</div>
              <h3 className="card-title">Sync by round</h3>
            </div>
            <span className="ui-pill">Auto sync active</span>
          </div>

          <div className="ops-stack">
            <label className="form-label" htmlFor="lottery-round-date">Round date</label>
            <input
              id="lottery-round-date"
              type="date"
              className="form-input"
              value={fetchDate}
              onChange={(event) => setFetchDate(event.target.value)}
            />

            <div className="ops-actions">
              <button className="btn btn-primary" onClick={handleFetch}>
                <FiDownload />
                Sync selected round
              </button>
              <button className="btn btn-secondary" onClick={handleQuickSync}>
                <FiRefreshCw />
                Sync latest round
              </button>
            </div>

            <p className="ops-table-note">Use a specific round date when you need to backfill or re-sync a result from the upstream feed.</p>
          </div>
        </section>

        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">Fallback entry</div>
              <h3 className="card-title">Manual save</h3>
            </div>
            <span className={`badge ${resultStatusBadge(latest)}`}>{resultStatusLabel(latest)}</span>
          </div>

          <div className="ops-stack">
            <div className="ops-feed-row">
              <div>
                <strong>Latest first prize</strong>
                <div className="ops-feed-meta">{latest?.firstPrize || 'No first prize stored yet'}</div>
              </div>
              <div className="ops-feed-right">
                <strong>{latest?.twoBottom || '-'}</strong>
                <span className="ops-feed-meta">2 bottom</span>
              </div>
            </div>

            <p className="ops-table-note">Manual entry is kept as a controlled fallback. Saving a result still triggers the same settlement flow used by automatic sync.</p>
            <button className="btn btn-secondary" onClick={() => setShowManual(true)}>
              <FiEdit3 />
              Open manual entry
            </button>
          </div>
        </section>
      </section>

      <section className="card ops-section">
        <div className="ops-table-head">
          <div>
            <div className="ui-eyebrow">Archive</div>
            <h3 className="card-title">Saved result history</h3>
            <p className="ops-table-note">Review all stored rounds and confirm whether each round has already been settled against the betting ledger.</p>
          </div>
          <div className="ops-actions">
            <span className="ui-pill"><FiActivity /> {results.length} rounds</span>
            <span className={`badge ${resultStatusBadge(latest)}`}>{resultStatusLabel(latest)}</span>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Round</th>
                <th>First prize</th>
                <th>3 top</th>
                <th>2 bottom</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: 40 }}>No stored results yet</td>
                </tr>
              ) : (
                results.map((result) => (
                  <tr key={result._id}>
                    <td style={{ fontWeight: 700 }}>{result.roundDate}</td>
                    <td>{result.firstPrize || '-'}</td>
                    <td>{result.firstPrize?.slice(-3) || '-'}</td>
                    <td>{result.twoBottom || '-'}</td>
                    <td>
                      <span className={`badge ${resultStatusBadge(result)}`}>
                        {resultStatusLabel(result)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={showManual} onClose={() => setShowManual(false)} title="Manual result entry" size="lg">
        <form onSubmit={handleManualSave}>
          <div className="ops-form-grid">
            <div className="form-group">
              <label className="form-label">Round date *</label>
              <input
                type="date"
                className="form-input"
                value={manualForm.roundDate}
                onChange={(event) => setManualForm({ ...manualForm, roundDate: event.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">First prize *</label>
              <input
                className="form-input"
                value={manualForm.firstPrize}
                onChange={(event) => setManualForm({ ...manualForm, firstPrize: event.target.value })}
                maxLength={6}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">2 bottom</label>
              <input
                className="form-input"
                value={manualForm.twoBottom}
                onChange={(event) => setManualForm({ ...manualForm, twoBottom: event.target.value })}
                maxLength={2}
              />
            </div>

            <div className="form-group">
              <label className="form-label">3 top list</label>
              <input
                className="form-input"
                placeholder="123, 456"
                value={manualForm.threeTopList}
                onChange={(event) => setManualForm({ ...manualForm, threeTopList: event.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">3 bottom list</label>
              <input
                className="form-input"
                placeholder="321, 654"
                value={manualForm.threeBotList}
                onChange={(event) => setManualForm({ ...manualForm, threeBotList: event.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Run top</label>
              <input
                className="form-input"
                placeholder="1, 2, 3"
                value={manualForm.runTop}
                onChange={(event) => setManualForm({ ...manualForm, runTop: event.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Run bottom</label>
              <input
                className="form-input"
                placeholder="4, 5, 6"
                value={manualForm.runBottom}
                onChange={(event) => setManualForm({ ...manualForm, runBottom: event.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowManual(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              <FiAward />
              Save result
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminLottery;
