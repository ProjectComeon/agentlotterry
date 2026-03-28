import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiAlertCircle,
  FiClock,
  FiLayers,
  FiRefreshCw,
  FiRotateCcw,
  FiSave,
  FiSend,
  FiShuffle,
  FiStar
} from 'react-icons/fi';
import { getCatalogRounds, createMemberSlip, parseMemberSlip } from '../../services/api';
import { useCatalog } from '../../context/CatalogContext';

const betTypeLabels = {
  '3top': '3 ตัวบน',
  '3tod': '3 ตัวโต๊ด',
  '2top': '2 ตัวบน',
  '2bottom': '2 ตัวล่าง',
  'run_top': 'วิ่งบน',
  'run_bottom': 'วิ่งล่าง'
};

const roundStatusLabels = {
  open: 'เปิดรับ',
  upcoming: 'กำลังจะเปิด',
  closed: 'ปิดรับ',
  resulted: 'ประกาศผล',
  missing: 'ไม่มีงวด'
};

const CustomerBet = () => {
  const {
    loading,
    selectedLottery,
    selectedRound,
    selectedRateProfile,
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
        if (nextRounds.length && !nextRounds.some((round) => round.id === selectedRound?.id)) {
          setSelectedRound(nextRounds[0].id);
        }
      } catch (error) {
        console.error(error);
        toast.error('โหลดงวดหวยไม่สำเร็จ');
      } finally {
        setLoadingRounds(false);
      }
    };

    loadRounds();
  }, [selectedLottery?.id]);

  useEffect(() => {
    setPreview(null);
  }, [selectedLottery?.id, selectedRound?.id, selectedRateProfile?.id, activeBetType, defaultAmount, rawInput, reverse, includeDoubleSet]);

  const selectedRoundMeta = useMemo(
    () => rounds.find((round) => round.id === selectedRound?.id) || selectedRound || null,
    [rounds, selectedRound]
  );

  const helperLabel = useMemo(() => {
    if (includeDoubleSet) {
      return activeBetType.startsWith('3') ? 'เลขเบิ้ล 3 หลัก' : activeBetType.startsWith('2') ? 'เลขเบิ้ล 2 หลัก' : 'ชุดเลขช่วย';
    }
    return 'เปิด helper';
  }, [includeDoubleSet, activeBetType]);

  const buildPayload = () => ({
    lotteryId: selectedLottery?.id,
    roundId: selectedRoundMeta?.id,
    rateProfileId: selectedRateProfile?.id,
    betType: activeBetType,
    defaultAmount: Number(defaultAmount || 0),
    rawInput,
    reverse,
    includeDoubleSet,
    memo
  });

  const handlePreview = async () => {
    if (!selectedLottery?.id || !selectedRoundMeta?.id) {
      toast.error('กรุณาเลือกตลาดและงวดก่อน');
      return;
    }

    setPreviewing(true);
    try {
      const res = await parseMemberSlip(buildPayload());
      setPreview(res.data);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'สร้าง preview ไม่สำเร็จ');
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
      const res = await createMemberSlip({
        ...buildPayload(),
        action
      });

      toast.success(
        action === 'draft'
          ? `บันทึกโพย ${res.data.slipNumber} แล้ว`
          : `ส่งรายการซื้อ ${res.data.slipNumber} สำเร็จ`
      );

      setRawInput('');
      setMemo('');
      setDefaultAmount('');
      setReverse(false);
      setIncludeDoubleSet(false);
      setPreview(null);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'สร้าง slip ไม่สำเร็จ');
    } finally {
      setLoadingState(false);
    }
  };

  const clearComposer = () => {
    setRawInput('');
    setMemo('');
    setDefaultAmount('');
    setReverse(false);
    setIncludeDoubleSet(false);
    setPreview(null);
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div></div>;
  }

  return (
    <div className="animate-fade-in slip-console-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">betting console</h1>
          <p className="page-subtitle">แทงแบบ fast input, preview รายการ, บันทึกโพย และส่งรายการซื้อเป็น slip</p>
        </div>
        <button className="btn btn-secondary" onClick={handlePreview} disabled={previewing || !selectedLottery}>
          {previewing ? <FiRefreshCw className="spin-animation" /> : <FiLayers />}
          รีวิวโพย
        </button>
      </div>

      <section className="card slip-console-hero">
        <div className="slip-console-hero-main">
          <div className="market-provider-pill"><FiLayers /> {selectedLottery?.name || '-'}</div>
          <h2>{selectedLottery?.description || 'ตลาดที่เลือกไว้จาก catalog'}</h2>
          <div className="market-hero-meta">
            <span><FiClock /> {selectedRoundMeta?.title || '-'}</span>
            <span>{roundStatusLabels[selectedRoundMeta?.status] || '-'}</span>
            <span>{selectedRateProfile?.name || '-'}</span>
          </div>
        </div>
        <div className="slip-console-hero-side">
          <label className="slip-field">
            <span>งวด</span>
            <select
              value={selectedRoundMeta?.id || ''}
              onChange={(event) => setSelectedRound(event.target.value)}
              disabled={loadingRounds || !rounds.length}
            >
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.title} • {roundStatusLabels[round.status] || round.status}
                </option>
              ))}
            </select>
          </label>
          <div className="catalog-rate-chips">
            {(selectedLottery?.rateProfiles || []).map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`catalog-chip ${selectedRateProfile?.id === profile.id ? 'catalog-chip-active' : ''}`}
                onClick={() => setSelectedRateProfile(profile.id)}
              >
                {profile.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3 className="card-title">ตัวควบคุมของโพย</h3>
        </div>

        <div className="bet-type-tabs">
          {(selectedLottery?.supportedBetTypes || []).map((betType) => (
            <button
              key={betType}
              className={`bet-type-tab ${activeBetType === betType ? 'active' : ''}`}
              onClick={() => setActiveBetType(betType)}
            >
              <span className="bet-type-tab-label">{betTypeLabels[betType]}</span>
              <span className="bet-type-tab-rate">x{selectedRateProfile?.rates?.[betType] || 0}</span>
            </button>
          ))}
        </div>

        <div className="slip-grid mt-md">
          <label className="slip-field">
            <span>จำนวนมาตรฐาน</span>
            <input
              type="number"
              min="1"
              placeholder="เช่น 10"
              value={defaultAmount}
              onChange={(event) => setDefaultAmount(event.target.value)}
            />
          </label>

          <label className="slip-field">
            <span>บันทึกช่วยจำ</span>
            <input
              type="text"
              placeholder="ตั้งชื่อโพยหรือจดสั้นๆ"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </label>
        </div>

        <div className="slip-helper-row">
          <button
            type="button"
            className={`helper-btn ${reverse ? 'active' : ''}`}
            onClick={() => setReverse((value) => !value)}
          >
            <FiShuffle /> กลับเลข
          </button>
          <button
            type="button"
            className={`helper-btn ${includeDoubleSet ? 'active' : ''}`}
            onClick={() => setIncludeDoubleSet((value) => !value)}
          >
            <FiStar /> {helperLabel}
          </button>
          <button type="button" className="helper-btn" onClick={clearComposer}>
            <FiRotateCcw /> เคลียร์
          </button>
        </div>

        <label className="slip-field mt-md">
          <span>fast bet input</span>
          <textarea
            rows="10"
            placeholder={'กรอก 1 รายการต่อ 1 บรรทัด\n123 10\n456=20\n789'}
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
          />
        </label>

        <div className="slip-note">
          <FiAlertCircle />
          <span>รูปแบบที่รองรับ: `123 10`, `123=10`, `123/10` หรือกรอกเฉพาะเลขแล้วใช้จำนวนมาตรฐาน</span>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3 className="card-title">preview slip</h3>
        </div>

        {!preview ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiLayers /></div>
            <div className="empty-state-text">กด “รีวิวโพย” เพื่อสร้างรายการก่อนส่งจริง</div>
          </div>
        ) : (
          <>
            <div className="preview-summary-grid">
              <div className="preview-stat">
                <span className="preview-stat-label">จำนวนรายการ</span>
                <strong>{preview.summary.itemCount}</strong>
              </div>
              <div className="preview-stat">
                <span className="preview-stat-label">ยอดแทงรวม</span>
                <strong>{preview.summary.totalAmount.toLocaleString()} ฿</strong>
              </div>
              <div className="preview-stat">
                <span className="preview-stat-label">จ่ายสูงสุด</span>
                <strong>{preview.summary.potentialPayout.toLocaleString()} ฿</strong>
              </div>
              <div className="preview-stat">
                <span className="preview-stat-label">สถานะงวด</span>
                <strong>{roundStatusLabels[preview.roundStatus?.status] || '-'}</strong>
              </div>
            </div>

            <div className="table-container mt-md">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>เลข</th>
                    <th>จำนวน</th>
                    <th>เรท</th>
                    <th>ที่มา</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.slice(0, 30).map((item, index) => (
                    <tr key={`${item.number}-${index}`}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: 700, letterSpacing: '0.08em' }}>{item.number}</td>
                      <td>{item.amount.toLocaleString()} ฿</td>
                      <td>x{item.payRate}</td>
                      <td>
                        {item.sourceFlags.fromDoubleSet ? 'double set' : item.sourceFlags.fromReverse ? 'reverse' : 'manual'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.items.length > 30 && (
              <div className="slip-note">
                <FiAlertCircle />
                <span>แสดง 30 รายการแรกจากทั้งหมด {preview.items.length} รายการ</span>
              </div>
            )}
          </>
        )}
      </section>

      <div className="slip-action-bar">
        <button
          className="btn btn-secondary"
          onClick={() => handleCreateSlip('draft')}
          disabled={savingDraft || submitting || !preview}
        >
          <FiSave /> บันทึกโพย
        </button>
        <button
          className="btn btn-primary"
          onClick={() => handleCreateSlip('submit')}
          disabled={savingDraft || submitting || !preview || selectedRoundMeta?.status !== 'open'}
        >
          <FiSend /> ส่งรายการซื้อ
        </button>
      </div>

      <style>{`
        .slip-console-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-bottom: 96px;
        }

        .slip-console-hero {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 20px;
        }

        .slip-console-hero-main h2 {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 10px 0 8px;
        }

        .slip-console-hero-side {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .slip-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .slip-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slip-field span {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .slip-field input,
        .slip-field select,
        .slip-field textarea {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          padding: 12px 14px;
          transition: var(--transition-fast);
        }

        .slip-field textarea {
          resize: vertical;
          min-height: 220px;
          font-family: inherit;
          line-height: 1.55;
        }

        .slip-field input:focus,
        .slip-field select:focus,
        .slip-field textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-subtle);
        }

        .slip-helper-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .helper-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 0.84rem;
          font-weight: 700;
          transition: var(--transition-fast);
        }

        .helper-btn.active {
          background: var(--primary-subtle);
          border-color: var(--border-accent);
          color: var(--primary-light);
        }

        .slip-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 12px;
          padding: 12px 14px;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.18);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 0.84rem;
          line-height: 1.5;
        }

        .preview-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .preview-stat {
          padding: 16px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .preview-stat-label {
          display: block;
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .preview-stat strong {
          font-size: 1.1rem;
          color: var(--text-primary);
        }

        .slip-action-bar {
          position: sticky;
          bottom: 16px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(15, 23, 42, 0.82);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          backdrop-filter: blur(12px);
        }

        .catalog-rate-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .catalog-chip {
          padding: 8px 14px;
          border-radius: 999px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
          transition: var(--transition-fast);
        }

        .catalog-chip-active {
          background: var(--primary-subtle);
          border-color: var(--border-accent);
          color: var(--primary-light);
        }

        .bet-type-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: none;
        }

        .bet-type-tabs::-webkit-scrollbar {
          display: none;
        }

        .bet-type-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          min-width: 92px;
          transition: var(--transition-fast);
        }

        .bet-type-tab.active {
          color: white;
          border-color: var(--primary);
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
        }

        .bet-type-tab-label {
          font-size: 0.8rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .bet-type-tab-rate {
          font-size: 0.72rem;
          opacity: 0.85;
        }

        @media (max-width: 920px) {
          .slip-console-hero,
          .slip-grid,
          .preview-summary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .slip-action-bar {
            flex-direction: column;
          }

          .slip-action-bar .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomerBet;
