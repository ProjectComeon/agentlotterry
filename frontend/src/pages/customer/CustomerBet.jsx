import { useEffect, useMemo, useState } from 'react';
import { getMarketOverview, placeBets } from '../../services/api';
import toast from 'react-hot-toast';
import { FiChevronDown, FiChevronUp, FiPlus, FiRefreshCw, FiSend, FiTrash2, FiX } from 'react-icons/fi';

const betTypes = [
  { value: '3top', label: '3 ตัวบน', digits: 3, rate: 500 },
  { value: '3tod', label: '3 ตัวโต๊ด', digits: 3, rate: 100 },
  { value: '2top', label: '2 ตัวบน', digits: 2, rate: 70 },
  { value: '2bottom', label: '2 ตัวล่าง', digits: 2, rate: 70 },
  { value: 'run_top', label: 'วิ่งบน', digits: 1, rate: 3 },
  { value: 'run_bottom', label: 'วิ่งล่าง', digits: 1, rate: 2 }
];

const disabledStatuses = new Set(['unsupported']);

const CustomerBet = () => {
  const [overview, setOverview] = useState(null);
  const [selectedMarketId, setSelectedMarketId] = useState('thai-government');
  const [bets, setBets] = useState([{ betType: '3top', number: '', amount: '' }]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [reloadingMarkets, setReloadingMarkets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeBetType, setActiveBetType] = useState('3top');
  const [showMarketPicker, setShowMarketPicker] = useState(false);

  const loadMarkets = async (showReload = false) => {
    if (showReload) setReloadingMarkets(true);
    else setLoadingMarkets(true);

    try {
      const res = await getMarketOverview();
      setOverview(res.data);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'โหลดตลาดไม่สำเร็จ');
    } finally {
      setLoadingMarkets(false);
      setReloadingMarkets(false);
    }
  };

  useEffect(() => { loadMarkets(); }, []);

  const marketSections = useMemo(() => {
    if (!overview?.sections) return [];
    return overview.sections
      .map((s) => ({
        ...s,
        markets: s.markets.filter((m) => {
          if (disabledStatuses.has(m.status)) return false;
          if (m.provider !== 'manycai') return true;
          return overview.provider?.configured;
        })
      }))
      .filter((s) => s.markets.length > 0);
  }, [overview]);

  const allMarkets = useMemo(
    () => marketSections.flatMap((s) => s.markets.map((m) => ({ ...m, sectionTitle: s.title }))),
    [marketSections]
  );

  useEffect(() => {
    if (!allMarkets.length) return;
    if (!allMarkets.some((m) => m.id === selectedMarketId)) {
      setSelectedMarketId(allMarkets[0].id);
    }
  }, [allMarkets, selectedMarketId]);

  const selectedMarket = allMarkets.find((m) => m.id === selectedMarketId) || null;

  const addBet = () => setBets([...bets, { betType: activeBetType, number: '', amount: '' }]);

  const removeBet = (index) => {
    if (bets.length <= 1) return;
    setBets(bets.filter((_, i) => i !== index));
  };

  const updateBet = (index, field, value) => {
    const updated = [...bets];
    updated[index] = { ...updated[index], [field]: value };
    setBets(updated);
  };

  const getDigits = (betType) => betTypes.find((b) => b.value === betType)?.digits || 3;
  const getRate = (betType) => betTypes.find((b) => b.value === betType)?.rate || 0;
  const totalAmount = bets.reduce((sum, bet) => sum + (Number(bet.amount) || 0), 0);
  const validBetCount = bets.filter((b) => b.number && b.amount).length;

  const handleSubmit = async () => {
    if (!selectedMarket) return toast.error('กรุณาเลือกตลาดก่อนส่งโพย');

    const validBets = bets.filter((b) => b.number && b.amount);
    if (!validBets.length) return toast.error('กรุณากรอกข้อมูลอย่างน้อย 1 รายการ');

    for (const bet of validBets) {
      const digits = getDigits(bet.betType);
      if (bet.number.length !== digits) return toast.error(`${betTypes.find((t) => t.value === bet.betType)?.label} ต้องกรอก ${digits} หลัก`);
      if (!/^\d+$/.test(bet.number)) return toast.error('เลขที่แทงต้องเป็นตัวเลขเท่านั้น');
      if (Number(bet.amount) < 1) return toast.error('จำนวนเงินต้องอย่างน้อย 1 บาท');
    }

    setSubmitting(true);
    try {
      const res = await placeBets({
        marketId: selectedMarket.id,
        bets: validBets.map((b) => ({ betType: b.betType, number: b.number, amount: Number(b.amount) }))
      });
      toast.success(`ส่งโพย ${res.data.market?.name || selectedMarket.name} สำเร็จ`);
      setBets([{ betType: activeBetType, number: '', amount: '' }]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'แทงไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMarkets) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="bet-page animate-fade-in">
      {/* Market Selector Bar */}
      <div className="bet-market-bar">
        <button
          className="bet-market-selector"
          onClick={() => setShowMarketPicker(!showMarketPicker)}
        >
          <div className="bet-market-selector-info">
            <span className="bet-market-selector-label">ตลาด</span>
            <span className="bet-market-selector-name">{selectedMarket?.name || 'เลือกตลาด'}</span>
          </div>
          <div className="bet-market-selector-right">
            {selectedMarket?.headline && (
              <span className="bet-market-selector-headline">{selectedMarket.headline}</span>
            )}
            {showMarketPicker ? <FiChevronUp /> : <FiChevronDown />}
          </div>
        </button>
        <button
          className="bet-market-refresh"
          onClick={() => loadMarkets(true)}
          disabled={reloadingMarkets}
          title="รีเฟรช"
        >
          <FiRefreshCw className={reloadingMarkets ? 'spin-animation' : ''} />
        </button>
      </div>

      {/* Market Picker Dropdown */}
      {showMarketPicker && (
        <div className="bet-market-dropdown">
          {marketSections.map((section) => (
            <div key={section.id} className="bet-market-dropdown-section">
              <div className="bet-market-dropdown-title">{section.title}</div>
              <div className="bet-market-dropdown-list">
                {section.markets.map((market) => (
                  <button
                    key={market.id}
                    className={`bet-market-dropdown-item ${selectedMarketId === market.id ? 'active' : ''}`}
                    onClick={() => { setSelectedMarketId(market.id); setShowMarketPicker(false); }}
                  >
                    <span className="bet-market-dropdown-item-name">{market.name}</span>
                    <span className="bet-market-dropdown-item-result">{market.headline || '--'}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bet Type Tabs */}
      <div className="bet-type-tabs">
        {betTypes.map((type) => (
          <button
            key={type.value}
            className={`bet-type-tab ${activeBetType === type.value ? 'active' : ''}`}
            onClick={() => setActiveBetType(type.value)}
          >
            <span className="bet-type-tab-label">{type.label}</span>
            <span className="bet-type-tab-rate">x{type.rate}</span>
          </button>
        ))}
      </div>

      {/* Bet Entry Cards */}
      <div className="bet-entries">
        {bets.map((bet, index) => (
          <div key={index} className="bet-entry-card">
            <div className="bet-entry-top">
              <select
                className="bet-entry-type"
                value={bet.betType}
                onChange={(e) => { updateBet(index, 'betType', e.target.value); updateBet(index, 'number', ''); }}
              >
                {betTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {bets.length > 1 && (
                <button className="bet-entry-remove" onClick={() => removeBet(index)}>
                  <FiX />
                </button>
              )}
            </div>
            <div className="bet-entry-inputs">
              <div className="bet-entry-number-wrap">
                <input
                  className="bet-entry-number"
                  type="text"
                  inputMode="numeric"
                  placeholder={`เลข ${getDigits(bet.betType)} หลัก`}
                  value={bet.number}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, getDigits(bet.betType));
                    updateBet(index, 'number', v);
                  }}
                  maxLength={getDigits(bet.betType)}
                />
              </div>
              <div className="bet-entry-amount-wrap">
                <input
                  className="bet-entry-amount"
                  type="number"
                  inputMode="numeric"
                  placeholder="จำนวนเงิน"
                  value={bet.amount}
                  onChange={(e) => updateBet(index, 'amount', e.target.value)}
                  min="1"
                />
                <span className="bet-entry-currency">฿</span>
              </div>
            </div>
            {bet.number && bet.amount && (
              <div className="bet-entry-preview">
                เลข <strong>{bet.number}</strong> • {betTypes.find((t) => t.value === bet.betType)?.label} • <strong>{Number(bet.amount).toLocaleString()} ฿</strong> → ถูกได้ <span className="text-accent">{(Number(bet.amount) * getRate(bet.betType)).toLocaleString()} ฿</span>
              </div>
            )}
          </div>
        ))}

        <button className="bet-add-btn" onClick={addBet}>
          <FiPlus /> เพิ่มรายการ
        </button>
      </div>

      {/* Floating Submit Bar */}
      <div className="bet-submit-bar">
        <div className="bet-submit-info">
          <span className="bet-submit-count">{validBetCount} รายการ</span>
          <span className="bet-submit-total">{totalAmount.toLocaleString()} ฿</span>
        </div>
        <button
          className="bet-submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !selectedMarket || validBetCount === 0}
        >
          {submitting ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> : <><FiSend /> ส่งโพย</>}
        </button>
      </div>

      <style>{`
        .bet-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-bottom: 80px;
        }

        /* Market Selector */
        .bet-market-bar {
          display: flex;
          gap: 8px;
        }

        .bet-market-selector {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .bet-market-selector:hover {
          border-color: var(--border-accent);
        }

        .bet-market-selector-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .bet-market-selector-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .bet-market-selector-name {
          font-size: 1rem;
          font-weight: 700;
        }

        .bet-market-selector-right {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
        }

        .bet-market-selector-headline {
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--primary-light);
          letter-spacing: 0.06em;
        }

        .bet-market-refresh {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 1.1rem;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .bet-market-refresh:hover {
          border-color: var(--border-accent);
          color: var(--primary-light);
        }

        .spin-animation {
          animation: spin 0.8s linear infinite;
        }

        /* Market Dropdown */
        .bet-market-dropdown {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 8px;
          max-height: 340px;
          overflow-y: auto;
        }

        .bet-market-dropdown-section {
          margin-bottom: 8px;
        }

        .bet-market-dropdown-section:last-child {
          margin-bottom: 0;
        }

        .bet-market-dropdown-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 8px 10px 4px;
        }

        .bet-market-dropdown-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 4px;
        }

        .bet-market-dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          background: none;
          border: 1px solid transparent;
          color: var(--text-primary);
          cursor: pointer;
          transition: var(--transition-fast);
          font-size: 0.85rem;
          text-align: left;
        }

        .bet-market-dropdown-item:hover {
          background: var(--bg-surface-hover);
        }

        .bet-market-dropdown-item.active {
          background: var(--primary-subtle);
          border-color: var(--border-accent);
          color: var(--primary-light);
        }

        .bet-market-dropdown-item-name {
          font-weight: 600;
        }

        .bet-market-dropdown-item-result {
          font-weight: 700;
          color: var(--text-muted);
          font-size: 0.8rem;
          letter-spacing: 0.04em;
        }

        .bet-market-dropdown-item.active .bet-market-dropdown-item-result {
          color: var(--primary-light);
        }

        /* Bet Type Tabs */
        .bet-type-tabs {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 2px 0;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .bet-type-tabs::-webkit-scrollbar {
          display: none;
        }

        .bet-type-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition-fast);
          white-space: nowrap;
          min-width: 80px;
        }

        .bet-type-tab:hover {
          border-color: var(--border-accent);
        }

        .bet-type-tab.active {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          border-color: var(--primary);
          color: white;
        }

        .bet-type-tab-label {
          font-size: 0.8rem;
          font-weight: 600;
        }

        .bet-type-tab-rate {
          font-size: 0.7rem;
          opacity: 0.7;
        }

        /* Bet Entry Cards */
        .bet-entries {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bet-entry-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
        }

        .bet-entry-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .bet-entry-type {
          padding: 6px 12px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.82rem;
          font-weight: 600;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }

        .bet-entry-remove {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.1);
          border: none;
          color: var(--danger);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 0.9rem;
          transition: var(--transition-fast);
        }

        .bet-entry-remove:hover {
          background: var(--danger);
          color: white;
        }

        .bet-entry-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .bet-entry-number-wrap,
        .bet-entry-amount-wrap {
          position: relative;
        }

        .bet-entry-number {
          width: 100%;
          padding: 14px 12px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 1.4rem;
          font-weight: 800;
          text-align: center;
          letter-spacing: 0.2em;
          transition: var(--transition-fast);
        }

        .bet-entry-number:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-subtle);
        }

        .bet-entry-number::placeholder {
          font-size: 0.85rem;
          font-weight: 400;
          letter-spacing: 0;
          color: var(--text-muted);
        }

        .bet-entry-amount {
          width: 100%;
          padding: 14px 30px 14px 12px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 1.1rem;
          font-weight: 700;
          transition: var(--transition-fast);
        }

        .bet-entry-amount:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-subtle);
        }

        .bet-entry-amount::placeholder {
          font-size: 0.85rem;
          font-weight: 400;
          color: var(--text-muted);
        }

        .bet-entry-currency {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.85rem;
          pointer-events: none;
        }

        .bet-entry-preview {
          margin-top: 8px;
          padding: 8px 10px;
          background: var(--bg-surface);
          border-radius: var(--radius-sm);
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .bet-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px;
          border-radius: var(--radius-md);
          border: 2px dashed var(--border);
          background: none;
          color: var(--text-muted);
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .bet-add-btn:hover {
          border-color: var(--primary);
          color: var(--primary-light);
          background: var(--primary-subtle);
        }

        /* Submit Bar */
        .bet-submit-bar {
          position: fixed;
          bottom: 64px;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border);
          z-index: 90;
          backdrop-filter: blur(12px);
        }

        .bet-submit-info {
          display: flex;
          flex-direction: column;
        }

        .bet-submit-count {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .bet-submit-total {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--primary-light);
        }

        .bet-submit-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: 0 4px 16px var(--primary-glow);
        }

        .bet-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, var(--primary-light), var(--primary));
          transform: translateY(-1px);
        }

        .bet-submit-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
        }

        @media (min-width: 769px) {
          .bet-submit-bar {
            bottom: 0;
          }

          .bet-market-dropdown-list {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          }
        }

        @media (max-width: 480px) {
          .bet-entry-inputs {
            grid-template-columns: 1fr;
          }

          .bet-type-tab {
            min-width: 70px;
            padding: 8px 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomerBet;
