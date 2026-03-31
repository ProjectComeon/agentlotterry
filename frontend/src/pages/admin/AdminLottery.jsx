import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiActivity, FiAward, FiDownload, FiEdit3, FiRefreshCw, FiSave } from 'react-icons/fi';
import Modal from '../../components/Modal';
import PageSkeleton from '../../components/PageSkeleton';
import { adminCopy } from '../../i18n/th/admin';
import { getBetTypeLabel } from '../../i18n/th/labels';
import {
  fetchLottery,
  getCatalogLotteries,
  getCatalogRounds,
  getLatestLottery,
  getLotteryResults,
  manualLottery,
  updateRoundClosedBetTypes
} from '../../services/api';

const copy = adminCopy.lottery;

const resultStatusBadge = (result) => {
  if (result?.isCalculated) return 'badge-success';
  return result?.firstPrize ? 'badge-warning' : 'badge-info';
};

const resultStatusLabel = (result) => {
  if (result?.isCalculated) return copy.settled;
  if (result?.firstPrize) return copy.resultSaved;
  return copy.waitingResult;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const AdminLottery = () => {
  const [latest, setLatest] = useState(null);
  const [results, setResults] = useState([]);
  const [lotteryOptions, setLotteryOptions] = useState([]);
  const [selectedLotteryId, setSelectedLotteryId] = useState('');
  const [roundOptions, setRoundOptions] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [closedBetTypesDraft, setClosedBetTypesDraft] = useState([]);
  const [savingClosedBetTypes, setSavingClosedBetTypes] = useState(false);
  const [loadingRounds, setLoadingRounds] = useState(false);
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

  useEffect(() => {
    if (!selectedLotteryId) {
      setRoundOptions([]);
      setSelectedRoundId('');
      setClosedBetTypesDraft([]);
      return undefined;
    }

    let isActive = true;

    const loadRounds = async () => {
      setLoadingRounds(true);
      try {
        const roundsRes = await getCatalogRounds(selectedLotteryId);
        if (!isActive) return;

        const nextRounds = roundsRes.data || [];
        setRoundOptions(nextRounds);
        setSelectedRoundId((current) => (
          current && nextRounds.some((round) => round.id === current)
            ? current
            : (nextRounds[0]?.id || '')
        ));
      } catch (error) {
        console.error(error);
        if (isActive) {
          toast.error(copy.saveClosedTypesError);
          setRoundOptions([]);
          setSelectedRoundId('');
        }
      } finally {
        if (isActive) {
          setLoadingRounds(false);
        }
      }
    };

    loadRounds();

    return () => {
      isActive = false;
    };
  }, [selectedLotteryId]);

  const loadData = async () => {
    try {
      const [latestRes, resultsRes, lotteriesRes] = await Promise.all([
        getLatestLottery(),
        getLotteryResults(),
        getCatalogLotteries()
      ]);
      setLatest(latestRes.data);
      setResults(resultsRes.data || []);
      const nextLotteries = lotteriesRes.data || [];
      setLotteryOptions(nextLotteries);
      setSelectedLotteryId((current) => (
        current && nextLotteries.some((lottery) => lottery.id === current)
          ? current
          : (nextLotteries[0]?.id || '')
      ));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectedLottery = useMemo(
    () => lotteryOptions.find((lottery) => lottery.id === selectedLotteryId) || null,
    [lotteryOptions, selectedLotteryId]
  );

  const selectedRound = useMemo(
    () => roundOptions.find((round) => round.id === selectedRoundId) || null,
    [roundOptions, selectedRoundId]
  );

  const supportedBetTypes = selectedLottery?.supportedBetTypes || [];
  const selectedRoundClosedKey = selectedRound?.closedBetTypes?.join('|') || '';

  useEffect(() => {
    setClosedBetTypesDraft(selectedRound?.closedBetTypes || []);
  }, [selectedRound?.id, selectedRoundClosedKey]);

  const overviewCards = useMemo(() => {
    const latestRound = latest?.roundDate || copy.noRound;
    const latestFirstPrize = latest?.firstPrize || '-';
    const latestTop = latest?.firstPrize?.slice(-3) || '-';
    const latestBottom = latest?.twoBottom || '-';

    return [
      {
        label: copy.overviewCards.latestRound.label,
        value: latestRound,
        hint: latest?.isCalculated ? copy.overviewCards.latestRound.settled : copy.overviewCards.latestRound.pending
      },
      {
        label: copy.overviewCards.firstPrize.label,
        value: latestFirstPrize,
        hint: copy.overviewCards.firstPrize.hint
      },
      {
        label: copy.overviewCards.top3.label,
        value: latestTop,
        hint: copy.overviewCards.top3.hint
      },
      {
        label: copy.overviewCards.bottom2.label,
        value: latestBottom,
        hint: copy.overviewCards.bottom2.hint(results.length)
      }
    ];
  }, [latest, results.length]);

  const toggleClosedBetType = (betType) => {
    setClosedBetTypesDraft((current) => (
      current.includes(betType)
        ? current.filter((item) => item !== betType)
        : [...current, betType]
    ));
  };

  const handleSaveClosedBetTypes = async () => {
    if (!selectedRound) {
      toast.error(copy.noRoundSelected);
      return;
    }

    const toastId = toast.loading(copy.saveClosedTypesLoading);
    setSavingClosedBetTypes(true);

    try {
      const response = await updateRoundClosedBetTypes(selectedRound.id, {
        closedBetTypes: closedBetTypesDraft
      });
      const roundsRes = await getCatalogRounds(selectedLotteryId);
      const nextRounds = roundsRes.data || [];
      setRoundOptions(nextRounds);
      setSelectedRoundId(response.data.id);
      setClosedBetTypesDraft(response.data.closedBetTypes || []);
      toast.success(copy.saveClosedTypesSuccess, { id: toastId });
    } catch (error) {
      toast.error(error.response?.data?.message || copy.saveClosedTypesError, { id: toastId });
    } finally {
      setSavingClosedBetTypes(false);
    }
  };

  const handleFetch = async () => {
    if (!fetchDate) {
      toast.error(copy.fetchErrorNoDate);
      return;
    }

    const toastId = toast.loading(copy.fetchingExternal);

    try {
      const res = await fetchLottery({ roundDate: fetchDate });
      const settlement = res.data?.settlement;
      if (settlement) {
        toast.success(copy.fetchAndSettleSuccess(settlement.wonCount, settlement.lostCount), { id: toastId });
      } else {
        toast.success(copy.fetchSuccess, { id: toastId });
      }
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || copy.fetchError, { id: toastId });
    }
  };

  const handleQuickSync = async () => {
    const targetDate = fetchDate || latest?.roundDate;
    if (!targetDate) {
      toast.error(copy.noRoundToSync);
      return;
    }

    setFetchDate(targetDate);
    const toastId = toast.loading(copy.quickSyncLoading(targetDate));

    try {
      const res = await fetchLottery({ roundDate: targetDate });
      const settlement = res.data?.settlement;
      if (settlement) {
        toast.success(copy.quickSyncSettled(targetDate), { id: toastId });
      } else {
        toast.success(copy.quickSyncSuccess(targetDate), { id: toastId });
      }
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || copy.quickSyncError(targetDate), { id: toastId });
    }
  };

  const handleManualSave = async (event) => {
    event.preventDefault();

    const toastId = toast.loading(copy.manualLoading);

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
        toast.success(copy.manualSettled(settlement.wonCount, settlement.lostCount), { id: toastId });
      } else {
        toast.success(copy.manualSuccess, { id: toastId });
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
      toast.error(error.response?.data?.message || copy.manualError, { id: toastId });
    }
  };

  if (loading) {
    return <PageSkeleton statCount={4} rows={5} sidebar={false} />;
  }

  return (
    <div className="ops-page animate-fade-in">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
        </div>

        <div className="ops-hero-side">
          <span>{copy.latestStatus}</span>
          <strong>{latest?.roundDate || copy.noRound}</strong>
          <small>{latest?.firstPrize ? `${copy.firstPrize} ${latest.firstPrize}` : copy.noSavedResult}</small>
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
              <div className="ui-eyebrow">{copy.externalEyebrow}</div>
              <h3 className="card-title">{copy.externalTitle}</h3>
            </div>
            <span className="ui-pill">{copy.autoSyncEnabled}</span>
          </div>

          <div className="ops-stack">
            <label className="form-label" htmlFor="lottery-round-date">{copy.roundDate}</label>
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
                {copy.fetchByDate}
              </button>
              <button className="btn btn-secondary" onClick={handleQuickSync}>
                <FiRefreshCw />
                {copy.fetchLatest}
              </button>
            </div>

            <p className="ops-table-note">{copy.externalHint}</p>
          </div>
        </section>

        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">{copy.fallbackEyebrow}</div>
              <h3 className="card-title">{copy.fallbackTitle}</h3>
            </div>
            <span className={`badge ${resultStatusBadge(latest)}`}>{resultStatusLabel(latest)}</span>
          </div>

          <div className="ops-stack">
            <div className="ops-feed-row">
              <div>
                <strong>{copy.latestFirstPrize}</strong>
                <div className="ops-feed-meta">{latest?.firstPrize || copy.noFirstPrize}</div>
              </div>
              <div className="ops-feed-right">
                <strong>{latest?.twoBottom || '-'}</strong>
                <span className="ops-feed-meta">{copy.bottom2Short}</span>
              </div>
            </div>

            <p className="ops-table-note">{copy.fallbackHint}</p>
            <button className="btn btn-secondary" onClick={() => setShowManual(true)}>
              <FiEdit3 />
              {copy.openManualForm}
            </button>
          </div>
        </section>
      </section>

      <section className="card ops-section">
        <div className="ui-panel-head">
          <div>
            <div className="ui-eyebrow">{copy.roundControlEyebrow}</div>
            <h3 className="card-title">{copy.roundControlTitle}</h3>
            <p className="ops-table-note">{copy.roundControlNote}</p>
          </div>
          <span className="ui-pill">{copy.closedTypesCount(closedBetTypesDraft.length)}</span>
        </div>

        <div className="ops-form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="closed-bet-lottery">{copy.lotteryLabel}</label>
            <select
              id="closed-bet-lottery"
              className="form-select"
              value={selectedLotteryId}
              onChange={(event) => setSelectedLotteryId(event.target.value)}
              disabled={!lotteryOptions.length}
            >
              {!lotteryOptions.length ? <option value="">{copy.noLotteryOptions}</option> : null}
              {lotteryOptions.map((lottery) => (
                <option key={lottery.id} value={lottery.id}>
                  {lottery.leagueName} • {lottery.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="closed-bet-round">{copy.roundLabel}</label>
            <select
              id="closed-bet-round"
              className="form-select"
              value={selectedRoundId}
              onChange={(event) => setSelectedRoundId(event.target.value)}
              disabled={loadingRounds || !roundOptions.length}
            >
              {loadingRounds ? <option value="">{copy.roundLoading}</option> : null}
              {!loadingRounds && !roundOptions.length ? <option value="">{copy.noRoundOptions}</option> : null}
              {!loadingRounds && roundOptions.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.title} • {round.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(selectedLottery || selectedRound) ? (
          <div className="ops-selected-summary">
            <div className="ops-stat-row">
              <div>
                <strong>{copy.lotteryLabel}</strong>
                <div className="ops-feed-meta">
                  {selectedLottery ? `${selectedLottery.leagueName} • ${selectedLottery.name}` : copy.noLotteryOptions}
                </div>
              </div>
            </div>

            <div className="ops-stat-row">
              <div>
                <strong>{copy.roundLabel}</strong>
                <div className="ops-feed-meta">
                  {selectedRound ? `${selectedRound.title} • ${selectedRound.label}` : copy.noRoundOptions}
                </div>
              </div>
            </div>

            <div className="ops-stat-row">
              <div>
                <strong>ปิดรับ</strong>
                <div className="ops-feed-meta">{formatDateTime(selectedRound?.closeAt)}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="ops-stack">
          {!supportedBetTypes.length ? (
            <div className="empty-state">
              <div className="empty-state-text">{copy.unsupportedBetTypes}</div>
            </div>
          ) : (
            <>
              <div className="ops-chip-grid">
                {supportedBetTypes.map((betType) => {
                  const isClosed = closedBetTypesDraft.includes(betType);
                  return (
                    <button
                      key={betType}
                      type="button"
                      className={`btn ${isClosed ? 'btn-danger' : 'btn-secondary'} btn-sm ops-chip-toggle`}
                      onClick={() => toggleClosedBetType(betType)}
                      disabled={!selectedRound}
                    >
                      {getBetTypeLabel(betType)} • {isClosed ? copy.closedForBetting : copy.openForBetting}
                    </button>
                  );
                })}
              </div>

              <div className="ops-feed-row">
                <div>
                  <strong>{copy.closedTypesCurrent}</strong>
                  <div className="ops-feed-meta">
                    {closedBetTypesDraft.length
                      ? closedBetTypesDraft.map((betType) => getBetTypeLabel(betType)).join(', ')
                      : copy.closedTypesEmpty}
                  </div>
                </div>
                <div className="ops-actions">
                  <span className={`badge ${selectedRound?.status === 'open' ? 'badge-success' : 'badge-warning'}`}>
                    {selectedRound?.label || copy.noRound}
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveClosedBetTypes}
                    disabled={!selectedRound || savingClosedBetTypes}
                  >
                    <FiSave />
                    {savingClosedBetTypes ? copy.saveClosedTypesLoading : copy.saveClosedTypes}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card ops-section">
        <div className="ops-table-head">
          <div>
            <div className="ui-eyebrow">{copy.historyEyebrow}</div>
            <h3 className="card-title">{copy.historyTitle}</h3>
            <p className="ops-table-note">{copy.historyNote}</p>
          </div>
          <div className="ops-actions">
            <span className="ui-pill"><FiActivity /> {copy.roundsCount(results.length)}</span>
            <span className={`badge ${resultStatusBadge(latest)}`}>{resultStatusLabel(latest)}</span>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{copy.roundDate}</th>
                <th>{copy.firstPrize}</th>
                <th>{copy.overviewCards.top3.label}</th>
                <th>{copy.bottom2Short}</th>
                <th>{copy.statusColumn}</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted table-empty-cell">{copy.noResults}</td>
                </tr>
              ) : (
                results.map((result) => (
                  <tr key={result._id}>
                    <td className="ops-history-cell-strong">{result.roundDate}</td>
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

      <Modal isOpen={showManual} onClose={() => setShowManual(false)} title={copy.manualTitle} size="lg">
        <form onSubmit={handleManualSave}>
          <div className="ops-form-grid">
            <div className="form-group">
              <label className="form-label">{copy.roundDate} *</label>
              <input
                type="date"
                className="form-input"
                value={manualForm.roundDate}
                onChange={(event) => setManualForm({ ...manualForm, roundDate: event.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{copy.firstPrize} *</label>
              <input
                className="form-input"
                value={manualForm.firstPrize}
                onChange={(event) => setManualForm({ ...manualForm, firstPrize: event.target.value })}
                maxLength={6}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{copy.bottom2Short}</label>
              <input
                className="form-input"
                value={manualForm.twoBottom}
                onChange={(event) => setManualForm({ ...manualForm, twoBottom: event.target.value })}
                maxLength={2}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{copy.threeTopList}</label>
              <input
                className="form-input"
                placeholder="123, 456"
                value={manualForm.threeTopList}
                onChange={(event) => setManualForm({ ...manualForm, threeTopList: event.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{copy.threeBottomList}</label>
              <input
                className="form-input"
                placeholder="321, 654"
                value={manualForm.threeBotList}
                onChange={(event) => setManualForm({ ...manualForm, threeBotList: event.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{copy.runTop}</label>
              <input
                className="form-input"
                placeholder="1, 2, 3"
                value={manualForm.runTop}
                onChange={(event) => setManualForm({ ...manualForm, runTop: event.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{copy.runBottom}</label>
              <input
                className="form-input"
                placeholder="4, 5, 6"
                value={manualForm.runBottom}
                onChange={(event) => setManualForm({ ...manualForm, runBottom: event.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowManual(false)}>{adminCopy.common.cancel}</button>
            <button type="submit" className="btn btn-primary">
              <FiAward />
              {copy.saveResult}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminLottery;
