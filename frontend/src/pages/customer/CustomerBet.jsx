import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiAlertCircle, FiClock, FiLayers, FiRefreshCw, FiRotateCcw, FiSave, FiSend, FiShuffle, FiStar } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { memberCopy } from '../../i18n/th/member';
import { getBetTypeLabel, getRoundStatusLabel, getSourceFlagLabel } from '../../i18n/th/labels';
import { createMemberSlip, getCatalogRounds, parseMemberSlip } from '../../services/api';
import { useCatalog } from '../../context/CatalogContext';
import { formatMoney as money } from '../../utils/formatters';

const quickAmountOptions = ['10', '20', '50', '100'];
const hiddenRoundStatuses = new Set(['closed', 'resulted']);
const LAO_SET_BET_TYPE = 'lao_set4';
const LAO_SET_AMOUNT = '120';

const CustomerBet = () => {
  const copy = memberCopy.bet;
  const {
    loading,
    flatLotteries,
    catalogLoaded,
    selectedLottery,
    selectedRound,
    selectedRateProfile,
    ensureCatalogLoaded,
    setSelectedLottery,
    setSelectedRound,
    setSelectedRateProfile
  } = useCatalog();
  const [rounds, setRounds] = useState([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [activeBetType, setActiveBetType] = useState('3top');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [memo, setMemo] = useState('');
  const [reverse, setReverse] = useState(false);
  const [includeDoubleSet, setIncludeDoubleSet] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ensureCatalogLoaded?.();
  }, [ensureCatalogLoaded]);

  useEffect(() => {
    if (!selectedLottery?.supportedBetTypes?.length) return;
    if (!selectedLottery.supportedBetTypes.includes(activeBetType)) {
      setActiveBetType(selectedLottery.supportedBetTypes[0]);
    }
  }, [selectedLottery, activeBetType]);

  useEffect(() => {
    const loadRounds = async () => {
      if (!selectedLottery?.id) {
        setRounds([]);
        return;
      }

      setLoadingRounds(true);
      try {
        const res = await getCatalogRounds(selectedLottery.id);
        const nextRounds = res.data || [];
        setRounds(nextRounds);
        const preferredRounds = nextRounds.filter((round) => !hiddenRoundStatuses.has(round.status));
        const visibleRounds = preferredRounds.length ? preferredRounds : nextRounds;
        if (visibleRounds.length && !visibleRounds.some((round) => round.id === selectedRound?.id)) {
          setSelectedRound(visibleRounds[0].id);
        }
      } catch (error) {
        console.error(error);
        toast.error(copy.loadRoundsError);
      } finally {
        setLoadingRounds(false);
      }
    };

    loadRounds();
  }, [selectedLottery?.id]);

  useEffect(() => {
    setPreview(null);
  }, [selectedLottery?.id, selectedRound?.id, selectedRateProfile?.id, activeBetType, defaultAmount, rawInput, reverse, includeDoubleSet]);

  useEffect(() => {
    if (activeBetType !== LAO_SET_BET_TYPE) return;
    setDefaultAmount(LAO_SET_AMOUNT);
    setReverse(false);
    setIncludeDoubleSet(false);
  }, [activeBetType]);

  const selectedRoundMeta = useMemo(
    () => rounds.find((round) => round.id === selectedRound?.id) || selectedRound || null,
    [rounds, selectedRound]
  );

  const selectableRounds = useMemo(() => {
    const preferredRounds = rounds.filter((round) => !hiddenRoundStatuses.has(round.status));
    return preferredRounds.length ? preferredRounds : rounds;
  }, [rounds]);

  const helperLabel = useMemo(() => {
    if (includeDoubleSet) {
      return activeBetType.startsWith('3')
        ? copy.helperDoubleSet3
        : activeBetType.startsWith('2')
          ? copy.helperDoubleSet2
          : copy.helperExtra;
    }
    return copy.helperDefault;
  }, [includeDoubleSet, activeBetType, copy.helperDefault, copy.helperDoubleSet2, copy.helperDoubleSet3, copy.helperExtra]);

  const buildPayload = () => ({
    lotteryId: selectedLottery?.id,
    roundId: selectedRoundMeta?.id,
    rateProfileId: selectedRateProfile?.id,
    betType: activeBetType,
    defaultAmount: Number(activeBetType === LAO_SET_BET_TYPE ? LAO_SET_AMOUNT : defaultAmount || 0),
    rawInput,
    reverse,
    includeDoubleSet,
    memo
  });

  const handlePreview = async () => {
    if (!selectedLottery?.id || !selectedRoundMeta?.id) {
      toast.error(copy.selectLotteryAndRound);
      return;
    }

    setPreviewing(true);
    try {
      const res = await parseMemberSlip(buildPayload());
      setPreview(res.data);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || copy.previewError);
    } finally {
      setPreviewing(false);
    }
  };

  const handleCreateSlip = async (action) => {
    if (!preview) {
      await handlePreview();
      return;
    }

    const setLoadingState = action === 'draft' ? setSavingDraft : setSubmitting;
    setLoadingState(true);
    try {
      const res = await createMemberSlip({ ...buildPayload(), action });
      toast.success(action === 'draft' ? copy.draftSaved(res.data.slipNumber) : copy.submitted(res.data.slipNumber));
      setRawInput('');
      setMemo('');
      setDefaultAmount(activeBetType === LAO_SET_BET_TYPE ? LAO_SET_AMOUNT : '');
      setReverse(false);
      setIncludeDoubleSet(false);
      setPreview(null);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || copy.createSlipError);
    } finally {
      setLoadingState(false);
    }
  };

  const clearComposer = () => {
    setRawInput('');
    setMemo('');
    setDefaultAmount(activeBetType === LAO_SET_BET_TYPE ? LAO_SET_AMOUNT : '');
    setReverse(false);
    setIncludeDoubleSet(false);
    setPreview(null);
  };

  const applyQuickAmount = (amount) => setDefaultAmount(amount);

  const canSubmit = selectedRoundMeta?.status === 'open';
  const previewSummary = preview?.summary || {};

  if (loading || !catalogLoaded) return <PageSkeleton statCount={4} rows={6} sidebar compactSidebar />;

  return (
    <div className="animate-fade-in customer-bet-page">
      <section className="bet-shell">
        <section className="card bet-composer-panel">
          <div className="bet-panel-head">
            <div>
              <div className="panel-eyebrow">{copy.heroEyebrow}</div>
              <h1 className="page-title">{copy.heroTitle}</h1>
              <p className="page-subtitle">{copy.heroSubtitle}</p>
            </div>
          </div>

          <div className="bet-market-grid">
            <label className="bet-field">
              <span>{copy.lotteryField}</span>
              <select value={selectedLottery?.id || ''} onChange={(event) => setSelectedLottery(event.target.value)} disabled={!flatLotteries.length}>
                {flatLotteries.map((lottery) => (
                  <option key={lottery.id} value={lottery.id}>{lottery.leagueName} • {lottery.name}</option>
                ))}
              </select>
            </label>

            <label className="bet-field">
              <span>{copy.roundField}</span>
              <select value={selectedRoundMeta?.id || ''} onChange={(event) => setSelectedRound(event.target.value)} disabled={loadingRounds || !selectableRounds.length}>
                {selectableRounds.map((round) => (
                  <option key={round.id} value={round.id}>{round.title} • {getRoundStatusLabel(round.status)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="bet-context-row">
            <span><FiLayers /> {selectedLottery?.name || '-'}</span>
            <span><FiClock /> {selectedRoundMeta?.title || '-'}</span>
            <span>{getRoundStatusLabel(selectedRoundMeta?.status)}</span>
            <span>{copy.rateChip(selectedRateProfile?.name)}</span>
          </div>

          <div className="catalog-rate-chips">
            {(selectedLottery?.rateProfiles || []).map((profile) => (
              <button key={profile.id} type="button" className={`catalog-chip ${selectedRateProfile?.id === profile.id ? 'catalog-chip-active' : ''}`} onClick={() => setSelectedRateProfile(profile.id)}>
                {profile.name}
              </button>
            ))}
          </div>

          <div className="bet-type-tabs">
            {(selectedLottery?.supportedBetTypes || []).map((betType) => (
              <button key={betType} type="button" className={`bet-type-tab ${activeBetType === betType ? 'active' : ''}`} onClick={() => setActiveBetType(betType)}>
                <span className="bet-type-tab-label">{getBetTypeLabel(betType)}</span>
                <span className="bet-type-tab-rate">x{selectedRateProfile?.rates?.[betType] || (betType === LAO_SET_BET_TYPE ? 1 : 0)}</span>
              </button>
            ))}
          </div>

          <div className="bet-form-grid">
            <label className="bet-field">
              <span>{copy.defaultAmount}</span>
              <input type="number" min="1" placeholder="เช่น 10" value={defaultAmount} onChange={(event) => setDefaultAmount(event.target.value)} />
            </label>

            <label className="bet-field">
              <span>{copy.memoField}</span>
              <input type="text" placeholder={copy.memoPlaceholder} value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          {activeBetType !== LAO_SET_BET_TYPE ? (
            <div className="bet-amount-presets">
              {quickAmountOptions.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={`preset-chip ${defaultAmount === amount ? 'active' : ''}`}
                  onClick={() => applyQuickAmount(amount)}
                >
                  {amount} {copy.presetsSuffix}
                </button>
              ))}
            </div>
          ) : null}

          <div className="bet-helper-row">
            {activeBetType !== LAO_SET_BET_TYPE ? (
              <>
                <button type="button" className={`helper-btn ${reverse ? 'active' : ''}`} onClick={() => setReverse((value) => !value)}>
                  <FiShuffle /> {copy.reverse}
                </button>
                <button type="button" className={`helper-btn ${includeDoubleSet ? 'active' : ''}`} onClick={() => setIncludeDoubleSet((value) => !value)}>
                  <FiStar /> {helperLabel}
                </button>
              </>
            ) : null}
            <button type="button" className="helper-btn" onClick={clearComposer}>
              <FiRotateCcw /> {copy.clearAll}
            </button>
          </div>

          <label className="bet-field">
            <span>{copy.fastInput}</span>
            <textarea
              rows="14"
              placeholder={'พิมพ์ 1 บรรทัดต่อ 1 รายการ\n123 10\n456=20\n789'}
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
            />
          </label>

          <div className="bet-note">
            <FiAlertCircle />
            <span>{copy.helperNote}</span>
          </div>
        </section>

        <aside className="card bet-preview-panel">
          <div className="bet-panel-head">
            <div>
              <div className="panel-eyebrow">{copy.previewEyebrow}</div>
              <h3 className="card-title">{copy.previewTitle}</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handlePreview} disabled={previewing || !selectedLottery}>
              {previewing ? <FiRefreshCw className="spin-animation" /> : <FiLayers />}
              {copy.previewButton}
            </button>
          </div>

          {!preview ? (
            <div className="preview-empty">
              <div className="empty-state">
                <div className="empty-state-icon"><FiLayers /></div>
                <div className="empty-state-text">{copy.previewEmpty}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="preview-summary-grid">
                <div className="preview-stat"><span>{copy.previewStats.itemCount}</span><strong>{previewSummary.itemCount || 0}</strong></div>
                <div className="preview-stat"><span>{copy.previewStats.totalAmount}</span><strong>{money(previewSummary.totalAmount)} บาท</strong></div>
                <div className="preview-stat"><span>{copy.previewStats.potentialPayout}</span><strong>{money(previewSummary.potentialPayout)} บาท</strong></div>
                <div className="preview-stat"><span>{copy.previewStats.roundStatus}</span><strong>{getRoundStatusLabel(preview.roundStatus?.status)}</strong></div>
              </div>

              <div className="preview-items">
                {preview.items.slice(0, 12).map((item, index) => (
                  <div key={`${item.number}-${index}`} className="preview-item-row">
                    <div>
                      <strong>{item.number}</strong>
                      <div className="preview-item-meta">
                        {item.sourceFlags.fromDoubleSet
                          ? getSourceFlagLabel('doubleSet')
                          : item.sourceFlags.fromReverse
                            ? getSourceFlagLabel('reverse')
                            : getSourceFlagLabel('manual')}
                      </div>
                    </div>
                    <div className="preview-item-right">
                      <strong>{money(item.amount)} บาท</strong>
                      <span>x{item.payRate}</span>
                    </div>
                  </div>
                ))}
              </div>

              {preview.items.length > 12 ? (
                <div className="bet-note compact">
                  <FiAlertCircle />
                  <span>{copy.previewLimitNotice(preview.items.length)}</span>
                </div>
              ) : null}
            </>
          )}

          <div className="preview-action-stack">
            <button className="btn btn-secondary" onClick={() => handleCreateSlip('draft')} disabled={previewing || savingDraft || submitting || !preview}>
              <FiSave /> {savingDraft ? copy.savingDraft : copy.saveDraft}
            </button>
            <button className="btn btn-primary" onClick={() => handleCreateSlip('submit')} disabled={previewing || savingDraft || submitting || !preview || !canSubmit}>
              <FiSend /> {submitting ? copy.submitting : copy.submit}
            </button>
            {!canSubmit ? <div className="submit-warning">{copy.submitWarning}</div> : null}
          </div>
        </aside>
      </section>

      <style>{`
        .customer-bet-page{display:flex;flex-direction:column;gap:16px;position:relative;isolation:isolate}
        .customer-bet-page::before{content:'';position:absolute;inset:-48px 0 auto;height:220px;background:radial-gradient(circle at top left,rgba(16,185,129,.14),transparent 62%);pointer-events:none;z-index:-1}
        .bet-shell{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:16px;align-items:start}
        .bet-composer-panel,.bet-preview-panel{padding:20px}
        .bet-preview-panel{position:sticky;top:88px}
        .bet-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
        .panel-eyebrow{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--primary-light);font-weight:700}
        .bet-composer-panel .page-title{margin:6px 0 0;font-size:clamp(2rem,4vw,3rem);line-height:.96;letter-spacing:-.04em}
        .bet-composer-panel .page-subtitle{margin:10px 0 0;max-width:56ch}
        .bet-market-grid,.bet-form-grid,.preview-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .bet-field{display:flex;flex-direction:column;gap:8px}
        .bet-field span,.preview-stat span{font-size:.78rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.08em;font-weight:700}
        .bet-field input,.bet-field select,.bet-field textarea{width:100%;min-height:52px;padding:14px 16px;border-radius:16px;border:1px solid rgba(148,163,184,.16);background:rgba(9,16,30,.92);color:var(--text-primary)}
        .bet-field textarea{min-height:300px;resize:vertical;line-height:1.55;font-family:inherit}
        .bet-field input:focus,.bet-field select:focus,.bet-field textarea:focus{outline:none;border-color:rgba(52,211,153,.42);box-shadow:0 0 0 4px rgba(16,185,129,.08)}
        .bet-context-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
        .bet-context-row span{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:rgba(9,16,30,.78);border:1px solid rgba(148,163,184,.14);color:var(--text-secondary);font-size:.82rem}
        .catalog-rate-chips,.bet-type-tabs,.bet-helper-row,.bet-amount-presets{display:flex;gap:8px;flex-wrap:wrap}
        .catalog-rate-chips{margin-bottom:16px}
        .catalog-chip,.helper-btn,.bet-type-tab,.preset-chip{border:1px solid rgba(148,163,184,.16);background:rgba(9,16,30,.76);color:var(--text-secondary)}
        .catalog-chip,.helper-btn,.preset-chip{padding:8px 14px;border-radius:999px;font-size:.82rem;font-weight:700}
        .catalog-chip-active,.helper-btn.active,.preset-chip.active{background:rgba(16,185,129,.12);border-color:rgba(52,211,153,.2);color:var(--primary-light)}
        .bet-type-tab{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 16px;border-radius:16px;min-width:108px}
        .bet-type-tab.active{color:#fff;border-color:var(--primary);background:linear-gradient(135deg,var(--primary),var(--primary-dark))}
        .bet-type-tab-label{font-size:.8rem;font-weight:700}
        .bet-type-tab-rate{font-size:.72rem;opacity:.85}
        .bet-note{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.18);border-radius:16px;color:var(--text-secondary);font-size:.84rem;line-height:1.5}
        .bet-note.compact{margin-top:14px}
        .preview-empty{min-height:220px;display:flex;align-items:center}
        .preview-summary-grid{margin-bottom:16px}
        .preview-stat{padding:16px;border-radius:16px;border:1px solid rgba(148,163,184,.14);background:rgba(20,30,49,.94)}
        .preview-stat strong{display:block;margin-top:8px;font-size:1.08rem}
        .preview-items{display:flex;flex-direction:column;gap:10px;max-height:420px;overflow:auto;padding-right:4px}
        .preview-item-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-radius:16px;border:1px solid rgba(148,163,184,.14);background:rgba(20,30,49,.94)}
        .preview-item-meta,.preview-item-right span,.submit-warning{color:var(--text-muted);font-size:.8rem}
        .preview-item-right{text-align:right;display:flex;flex-direction:column;gap:4px}
        .preview-action-stack{display:flex;flex-direction:column;gap:10px;margin-top:16px}
        .submit-warning{padding:10px 12px;border-radius:14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.16)}
        @media (max-width:1100px){.bet-shell{grid-template-columns:1fr}.bet-preview-panel{position:static}}
        @media (max-width:760px){
          .bet-market-grid,.bet-form-grid,.preview-summary-grid{grid-template-columns:1fr}
          .bet-panel-head{flex-direction:column;align-items:stretch}
          .bet-type-tab{min-width:unset;flex:1}
          .preview-action-stack{position:sticky;bottom:0;padding-top:12px;background:linear-gradient(180deg,rgba(22,32,49,0),rgba(22,32,49,.96) 28%)}
        }
      `}</style>
    </div>
  );
};

export default CustomerBet;
