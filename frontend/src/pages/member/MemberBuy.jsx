import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAlertCircle, FiCheckCircle, FiClock, FiCreditCard, FiLayers, FiRefreshCw, FiRotateCcw, FiSave, FiSend, FiShuffle } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { useCatalog } from '../../context/CatalogContext';
import { createMemberDraftSlip, getMemberRounds, getMemberWallet, submitMemberSlip } from '../../services/api';
import { getBetTypeLabel } from '../../i18n/th/labels';
import {
  createClientRequestId,
  flattenLotteries,
  formatBaht,
  formatWhen,
  getBetDisplay,
  getRoundDisplay,
  getRoundStatusDisplay,
  statusBadgeClass
} from './memberUtils';

const quickAmounts = ['10', '20', '50', '100'];
const unsafeRoundStatuses = new Set(['closed', 'resulted']);
const getRoundTimeValue = (round = {}, keys = []) => keys.map((key) => round?.[key]).find(Boolean) || '';
const getRoundOpenTime = (round = {}) => getRoundTimeValue(round, ['openAt', 'displayOpenAt', 'startAt', 'roundDate']);
const getRoundCloseTime = (round = {}) => getRoundTimeValue(round, ['closeAt', 'displayCloseAt', 'endAt']);

const findLotteryByRequestedRound = async (lotteries = [], requestedRoundId = '') => {
  if (!requestedRoundId) return null;

  const results = await Promise.all(lotteries.map((lottery) => getMemberRounds(lottery.id)
    .then((response) => ({ lottery, rounds: response.data || [] }))
    .catch(() => ({ lottery, rounds: [] }))));

  return results.find(({ rounds }) => rounds.some((round) => round.id === requestedRoundId)) || null;
};

const MemberBuy = () => {
  const { ensureCatalogLoaded } = useCatalog();
  const [searchParams] = useSearchParams();
  const requestedLotteryId = searchParams.get('lotteryId') || '';
  const requestedRoundId = searchParams.get('roundId') || '';
  const [lotteries, setLotteries] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [selectedLotteryKey, setSelectedLotteryKey] = useState('');
  const [selectedRoundKey, setSelectedRoundKey] = useState('');
  const [selectedRateKey, setSelectedRateKey] = useState('');
  const [betType, setBetType] = useState('3top');
  const [defaultAmount, setDefaultAmount] = useState('10');
  const [rawInput, setRawInput] = useState('');
  const [memo, setMemo] = useState('');
  const [reverse, setReverse] = useState(false);
  const [includeDoubleSet, setIncludeDoubleSet] = useState(false);
  const [draftSlip, setDraftSlip] = useState(null);
  const [submittedSlip, setSubmittedSlip] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const draftRequestRef = useRef('');
  const submitRequestRef = useRef('');

  const selectedLottery = useMemo(
    () => lotteries.find((lottery) => lottery.id === selectedLotteryKey) || null,
    [lotteries, selectedLotteryKey]
  );
  const selectedRound = useMemo(
    () => rounds.find((round) => round.id === selectedRoundKey) || null,
    [rounds, selectedRoundKey]
  );
  const selectedRate = useMemo(
    () => selectedLottery?.rateProfiles?.find((profile) => profile.id === selectedRateKey) || selectedLottery?.rateProfiles?.[0] || null,
    [selectedLottery, selectedRateKey]
  );
  const supportedBetTypes = selectedLottery?.supportedBetTypes || [];
  const canSubmitRound = selectedRound?.status === 'open';
  const canCompose = Boolean(selectedLotteryKey && selectedRoundKey && selectedRate?.id && rawInput.trim() && Number(defaultAmount) > 0);
  const submittedSlipId = submittedSlip?.id || submittedSlip?._id || '';

  const resetDraftState = useCallback(() => {
    setDraftSlip(null);
    setSubmittedSlip(null);
    setSubmitError('');
    draftRequestRef.current = '';
    submitRequestRef.current = '';
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, walletResponse] = await Promise.all([
        ensureCatalogLoaded?.({ force: true }),
        getMemberWallet()
      ]);
      const nextLotteries = flattenLotteries(catalog?.leagues || []).filter((lottery) => lottery.activeRound || lottery.status === 'open');
      setLotteries(nextLotteries);
      setWallet(walletResponse.data || null);

      const requestedLottery = requestedLotteryId ? nextLotteries.find((lottery) => lottery.id === requestedLotteryId) : null;
      const roundMatch = requestedLottery ? null : await findLotteryByRequestedRound(nextLotteries, requestedRoundId);
      const firstLottery = requestedLottery || roundMatch?.lottery || nextLotteries.find((lottery) => lottery.status === 'open') || nextLotteries[0] || null;

      if (roundMatch?.rounds?.length) {
        setRounds(roundMatch.rounds);
        setSelectedRoundKey(requestedRoundId);
      }

      if (firstLottery) {
        setSelectedLotteryKey(firstLottery.id);
        setSelectedRateKey(firstLottery.defaultRateProfileId || firstLottery.rateProfiles?.[0]?.id || '');
        const firstBetType = (firstLottery.supportedBetTypes || []).includes('3top') ? '3top' : firstLottery.supportedBetTypes?.[0] || '3top';
        setBetType(firstBetType);
      }
    } catch (error) {
      console.error(error);
      toast.error('โหลดข้อมูลซื้อหวยไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [ensureCatalogLoaded, requestedLotteryId, requestedRoundId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!selectedLotteryKey) {
      setRounds([]);
      setSelectedRoundKey('');
      return undefined;
    }

    let active = true;
    const loadRounds = async () => {
      setLoadingRounds(true);
      try {
        const response = await getMemberRounds(selectedLotteryKey);
        if (!active) return;
        const nextRounds = response.data || [];
        setRounds(nextRounds);
        const requestedRound = requestedRoundId ? nextRounds.find((round) => round.id === requestedRoundId) : null;
        const firstRound = requestedRound || nextRounds.find((round) => round.status === 'open') || nextRounds.find((round) => !unsafeRoundStatuses.has(round.status)) || nextRounds[0] || null;
        setSelectedRoundKey(firstRound?.id || '');
      } catch (error) {
        if (active) {
          console.error(error);
          toast.error('โหลดรอบหวยไม่สำเร็จ');
          setRounds([]);
          setSelectedRoundKey('');
        }
      } finally {
        if (active) setLoadingRounds(false);
      }
    };

    loadRounds();
    return () => {
      active = false;
    };
  }, [selectedLotteryKey, requestedRoundId]);

  useEffect(() => {
    if (!selectedLottery) return;
    if (!selectedLottery.rateProfiles?.some((profile) => profile.id === selectedRateKey)) {
      setSelectedRateKey(selectedLottery.defaultRateProfileId || selectedLottery.rateProfiles?.[0]?.id || '');
    }
    if (selectedLottery.supportedBetTypes?.length && !selectedLottery.supportedBetTypes.includes(betType)) {
      setBetType(selectedLottery.supportedBetTypes[0]);
    }
  }, [selectedLottery, selectedRateKey, betType]);

  useEffect(() => {
    resetDraftState();
  }, [selectedLotteryKey, selectedRoundKey, selectedRateKey, betType, defaultAmount, rawInput, memo, reverse, includeDoubleSet, resetDraftState]);

  const buildPayload = () => ({
    lotteryId: selectedLotteryKey,
    roundId: selectedRoundKey,
    rateProfileId: selectedRate?.id || '',
    betType,
    defaultAmount: Number(defaultAmount || 0),
    rawInput,
    reverse,
    includeDoubleSet,
    memo
  });

  const ensureDraftRequest = () => {
    if (!draftRequestRef.current) draftRequestRef.current = createClientRequestId('member-draft');
    return draftRequestRef.current;
  };

  const ensureSubmitRequest = () => {
    if (!submitRequestRef.current) submitRequestRef.current = createClientRequestId('member-submit');
    return submitRequestRef.current;
  };

  const refreshWallet = async () => {
    const response = await getMemberWallet();
    setWallet(response.data || null);
  };

  const handlePreviewDraft = async () => {
    if (!canCompose) {
      toast.error('กรุณาเลือกรอบ กรอกเลข และราคาให้ครบ');
      return;
    }

    setDrafting(true);
    setSubmitError('');
    try {
      const response = await createMemberDraftSlip({
        ...buildPayload(),
        clientRequestId: ensureDraftRequest()
      });
      setDraftSlip(response.data);
      toast.success('สร้างแบบร่างเพื่อดูตัวอย่างแล้ว');
      await refreshWallet();
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message || 'สร้างแบบร่างไม่สำเร็จ';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setDrafting(false);
    }
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (!draftSlip) {
      toast.error('กรุณาสร้างแบบร่างเพื่อตรวจยอดก่อนยืนยันซื้อ');
      return;
    }
    if (!canSubmitRound) {
      toast.error('รอบนี้ยังไม่เปิดรับซื้อ');
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await submitMemberSlip({
        ...buildPayload(),
        clientRequestId: ensureSubmitRequest()
      });
      const nextSlip = response.data || {};
      toast.success(`ซื้อสำเร็จ: ${nextSlip.slipNumber || '-'}`);
      resetDraftState();
      setSubmittedSlip(nextSlip);
      await refreshWallet();
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message || 'ยืนยันซื้อไม่สำเร็จ';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const clearComposer = () => {
    setRawInput('');
    setMemo('');
    setDefaultAmount('10');
    setReverse(false);
    setIncludeDoubleSet(false);
    resetDraftState();
  };

  if (loading) return <PageSkeleton statCount={3} rows={6} sidebar={false} />;

  const account = wallet?.account || {};
  const draftItems = draftSlip?.items || [];

  return (
    <div className="ops-page member-page member-buy-page animate-fade-in">
      <section className="ops-hero member-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">MEMBER BUY</span>
          <h1 className="page-title">ซื้อเอง</h1>
          <p className="page-subtitle">เลือกหวยและรอบที่เปิดขาย กรอกเลขเหมือนหน้าซื้อแทน ตรวจโพยก่อนยืนยัน แล้วระบบจะหักเครดิตจากบัญชีของคุณทันทีเมื่อสำเร็จ</p>
        </div>
        <div className="ops-hero-side">
          <span>ยอดเครดิตของฉัน</span>
          <strong>{formatBaht(account.creditBalance)}</strong>
          <small>ใช้บัญชีสมาชิกที่ login อยู่เท่านั้น</small>
        </div>
      </section>

      <section className="member-buy-context-grid">
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiCreditCard /></div>
          <strong>{formatBaht(account.creditBalance)}</strong>
          <span>เครดิตพร้อมซื้อ</span>
          <small>แบบร่างไม่หักเครดิต</small>
        </article>
        <article className="member-note member-self-only-notice">
          <FiAlertCircle />
          <span>หน้านี้ซื้อได้เฉพาะบัญชีของฉัน ไม่มีช่องเลือกสมาชิกอื่น และระบบเลือกสายงานจาก session ฝั่ง server</span>
        </article>
        <article className="card member-buy-selected-round">
          <div>
            <span>รายการที่เลือก</span>
            <strong>{selectedLottery ? `${selectedLottery.leagueName || ''} ${selectedLottery.name || ''}`.trim() : '-'}</strong>
            <small>{selectedRound ? `${getRoundDisplay(selectedRound)} · ${getRoundStatusDisplay(selectedRound.status)}` : '-'}</small>
          </div>
          <span className={`badge ${statusBadgeClass(selectedRound?.status)}`}>{getRoundStatusDisplay(selectedRound?.status)}</span>
        </article>
      </section>

      <section className="member-buy-grid">
        <div className="card member-panel member-buy-form">
          <div className="member-panel-head">
            <div>
              <div className="ui-eyebrow">COMPOSER</div>
              <h3>เลือกรอบและกรอกเลข</h3>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearComposer}><FiRotateCcw /> ล้าง</button>
          </div>

          <div className="member-form-grid">
            <label className="member-field">
              <span>หวย</span>
              <select value={selectedLotteryKey} onChange={(event) => setSelectedLotteryKey(event.target.value)}>
                {lotteries.map((lottery) => (
                  <option key={lottery.id} value={lottery.id}>{lottery.leagueName} · {lottery.name}</option>
                ))}
              </select>
            </label>
            <label className="member-field">
              <span>งวด</span>
              <select value={selectedRoundKey} onChange={(event) => setSelectedRoundKey(event.target.value)} disabled={loadingRounds || !rounds.length}>
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>{getRoundDisplay(round)} · {getRoundStatusDisplay(round.status)}</option>
                ))}
              </select>
            </label>
            <label className="member-field">
              <span>เรต</span>
              <select value={selectedRate?.id || ''} onChange={(event) => setSelectedRateKey(event.target.value)}>
                {(selectedLottery?.rateProfiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </label>
            <label className="member-field">
              <span>ประเภท</span>
              <select value={betType} onChange={(event) => setBetType(event.target.value)}>
                {supportedBetTypes.map((type) => <option key={type} value={type}>{getBetTypeLabel(type)}</option>)}
              </select>
            </label>
            <label className="member-field">
              <span>ราคาเริ่มต้น</span>
              <input type="number" min="1" value={defaultAmount} onChange={(event) => setDefaultAmount(event.target.value)} />
            </label>
            <label className="member-field">
              <span>หมายเหตุ</span>
              <input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="ไม่บังคับ" />
            </label>
          </div>

          <div className="member-chip-row">
            {quickAmounts.map((amount) => (
              <button key={amount} type="button" className={`member-chip ${defaultAmount === amount ? 'is-active' : ''}`} onClick={() => setDefaultAmount(amount)}>{amount} บาท</button>
            ))}
            <button type="button" className={`member-chip ${reverse ? 'is-active' : ''}`} onClick={() => setReverse((value) => !value)}><FiShuffle /> กลับเลข</button>
            <button type="button" className={`member-chip ${includeDoubleSet ? 'is-active' : ''}`} onClick={() => setIncludeDoubleSet((value) => !value)}>เลขเบิ้ล</button>
          </div>

          <label className="member-field">
            <span>เลขที่ต้องการซื้อ</span>
            <textarea rows="12" value={rawInput} onChange={(event) => setRawInput(event.target.value)} placeholder={'ตัวอย่าง\n123 10\n456=20\n789'} />
          </label>

          <div className="member-note"><FiAlertCircle /> ตรวจโพยก่อนยืนยัน ระบบจะไม่หักเครดิตจากแบบร่าง และจะยืนยันซื้อด้วย clientRequestId เดิมเพื่อกันกดซ้ำ</div>
        </div>

        <aside className="card member-panel member-preview-panel">
          <div className="member-panel-head">
            <div>
              <div className="ui-eyebrow">DRAFT PREVIEW</div>
              <h3>ตรวจโพยก่อนยืนยัน</h3>
            </div>
            <span className={`badge ${statusBadgeClass(selectedRound?.status)}`}>{getRoundStatusDisplay(selectedRound?.status)}</span>
          </div>

          <div className="member-preview-stats">
            <div><span>จำนวนรายการ</span><strong>{draftSlip?.itemCount || 0}</strong></div>
            <div><span>ยอดรวม</span><strong>{formatBaht(draftSlip?.totalAmount || 0)}</strong></div>
            <div><span>จ่ายสูงสุด</span><strong>{formatBaht(draftSlip?.potentialPayout || 0)}</strong></div>
          </div>

          <div className="member-selected-round-meta">
            <span><FiClock /> เปิดรับ: {formatWhen(getRoundOpenTime(selectedRound))}</span>
            <span>ปิดรับ: {formatWhen(getRoundCloseTime(selectedRound))}</span>
          </div>

          {draftItems.length ? (
            <div className="member-preview-list">
              {draftItems.slice(0, 16).map((item) => (
                <div key={item.id || `${item.sequence}-${item.number}`} className="member-preview-row">
                  <div>
                    <strong>{item.number}</strong>
                    <span>{getBetDisplay(item)}</span>
                  </div>
                  <div><strong>{formatBaht(item.amount)}</strong><span>เรต {item.payRate || '-'}</span></div>
                </div>
              ))}
              {draftItems.length > 16 ? <div className="member-note compact">แสดง 16 รายการแรก จากทั้งหมด {draftItems.length} รายการ</div> : null}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-icon"><FiLayers /></div><div className="empty-state-text">ยังไม่มีแบบร่าง</div></div>
          )}

          {submitError ? <div className="member-note member-error-note"><FiAlertCircle /> {submitError}</div> : null}
          {submittedSlip ? (
            <div className="member-submit-success">
              <FiCheckCircle />
              <div>
                <strong>ยืนยันการซื้อสำเร็จ</strong>
                <span>{submittedSlip.slipNumber || '-'}</span>
              </div>
              {submittedSlipId ? <Link className="btn btn-secondary btn-sm" to={`/member/slips/${submittedSlipId}`}>ดูโพย</Link> : null}
            </div>
          ) : null}

          <div className="member-action-stack">
            <button type="button" className="btn btn-secondary" onClick={handlePreviewDraft} disabled={drafting || submitting || !canCompose}>
              {drafting ? <FiRefreshCw /> : <FiSave />} ตรวจโพยก่อนยืนยัน
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={drafting || submitting || !draftSlip || !canSubmitRound}>
              {submitting ? <FiRefreshCw /> : <FiSend />} ยืนยันการซื้อ
            </button>
            {draftSlip ? <div className="member-note compact"><FiCheckCircle /> ตรวจแล้วค่อยยืนยันซื้อ หากกดซ้ำระบบจะใช้ clientRequestId เดิมเพื่อกันหักซ้ำ</div> : null}
            {!canSubmitRound ? <div className="member-note compact"><FiClock /> งวดนี้ยังไม่เปิดรับซื้อ</div> : null}
            <Link to="/member/slips" className="btn btn-secondary">ดูโพยของฉัน</Link>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default MemberBuy;
