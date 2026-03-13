import { useState } from 'react';
import { placeBets } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiSend } from 'react-icons/fi';

const betTypes = [
  { value: '3top', label: '3 ตัวบน', digits: 3, rate: 500 },
  { value: '3tod', label: '3 ตัวโต๊ด', digits: 3, rate: 100 },
  { value: '2top', label: '2 ตัวบน', digits: 2, rate: 70 },
  { value: '2bottom', label: '2 ตัวล่าง', digits: 2, rate: 70 },
  { value: 'run_top', label: 'วิ่งบน', digits: 1, rate: 3 },
  { value: 'run_bottom', label: 'วิ่งล่าง', digits: 1, rate: 2 },
];

const CustomerBet = () => {
  const [bets, setBets] = useState([{ betType: '3top', number: '', amount: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const addBet = () => {
    setBets([...bets, { betType: '3top', number: '', amount: '' }]);
  };

  const removeBet = (index) => {
    if (bets.length <= 1) return;
    setBets(bets.filter((_, i) => i !== index));
  };

  const updateBet = (index, field, value) => {
    const updated = [...bets];
    updated[index] = { ...updated[index], [field]: value };
    setBets(updated);
  };

  const getDigits = (betType) => betTypes.find(b => b.value === betType)?.digits || 3;
  const getRate = (betType) => betTypes.find(b => b.value === betType)?.rate || 0;

  const totalAmount = bets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const handleSubmit = async () => {
    const validBets = bets.filter(b => b.number && b.amount);
    if (validBets.length === 0) {
      return toast.error('กรุณากรอกข้อมูลอย่างน้อย 1 รายการ');
    }

    for (const bet of validBets) {
      const digits = getDigits(bet.betType);
      if (bet.number.length !== digits) {
        return toast.error(`${betTypes.find(b => b.value === bet.betType)?.label} ต้องกรอก ${digits} หลัก`);
      }
      if (!/^\d+$/.test(bet.number)) {
        return toast.error('เลขที่แทงต้องเป็นตัวเลขเท่านั้น');
      }
      if (Number(bet.amount) < 1) {
        return toast.error('จำนวนเงินต้องอย่างน้อย 1 บาท');
      }
    }

    setSubmitting(true);
    try {
      const res = await placeBets({
        bets: validBets.map(b => ({
          betType: b.betType,
          number: b.number,
          amount: Number(b.amount)
        }))
      });
      toast.success(res.data.message);
      setBets([{ betType: '3top', number: '', amount: '' }]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'แทงไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 แทงหวย</h1>
          <p className="page-subtitle">เลือกประเภท กรอกเลข และจำนวนเงิน</p>
        </div>
      </div>

      <div className="card mb-lg">
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 1fr auto', gap: 8, marginBottom: 8, padding: '0 4px' }}>
            <span className="form-label" style={{ marginBottom: 0 }}>ประเภท</span>
            <span className="form-label" style={{ marginBottom: 0 }}>เลข</span>
            <span className="form-label" style={{ marginBottom: 0 }}>จำนวน (฿)</span>
            <span className="form-label" style={{ marginBottom: 0 }}>อัตราจ่าย</span>
            <span></span>
          </div>
          
          {bets.map((bet, index) => (
            <div key={index} style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 1fr auto', gap: 8, 
              marginBottom: 8, padding: 12, background: 'var(--bg-surface)', 
              borderRadius: 'var(--radius-sm)', alignItems: 'center'
            }}>
              <select
                className="form-select"
                value={bet.betType}
                onChange={(e) => {
                  updateBet(index, 'betType', e.target.value);
                  updateBet(index, 'number', '');
                }}
              >
                {betTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              <input
                className="form-input"
                type="text"
                placeholder={`${getDigits(bet.betType)} หลัก`}
                value={bet.number}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, getDigits(bet.betType));
                  updateBet(index, 'number', val);
                }}
                maxLength={getDigits(bet.betType)}
                style={{ fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', letterSpacing: '0.15em' }}
              />

              <input
                className="form-input"
                type="number"
                placeholder="จำนวน"
                value={bet.amount}
                onChange={(e) => updateBet(index, 'amount', e.target.value)}
                min="1"
              />

              <div style={{ textAlign: 'center', color: 'var(--primary-light)', fontWeight: 600 }}>
                x{getRate(bet.betType)}
              </div>

              <button
                className="btn btn-danger btn-sm"
                onClick={() => removeBet(index)}
                disabled={bets.length <= 1}
                style={{ width: 36, padding: 6 }}
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <button className="btn btn-secondary" onClick={addBet}><FiPlus /> เพิ่มรายการ</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              รวม: <span style={{ color: 'var(--primary-light)' }}>{totalAmount.toLocaleString()} ฿</span>
            </div>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div> : <><FiSend /> ส่ง</>}
            </button>
          </div>
        </div>
      </div>

      {/* Pay rate reference */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📌 อัตราจ่าย</h3>
        </div>
        <div className="grid grid-3">
          {betTypes.map(t => (
            <div key={t.value} style={{ 
              padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary-light)' }}>x{t.rate}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.digits} หลัก</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomerBet;
