import { useState, useEffect } from 'react';
import { getLatestLottery, getLotteryResults, fetchLottery, manualLottery, calculateLottery } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { FiDownload, FiPlay, FiEdit3, FiAward } from 'react-icons/fi';

const AdminLottery = () => {
  const [latest, setLatest] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchDate, setFetchDate] = useState('');
  const [calcDate, setCalcDate] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    roundDate: '', firstPrize: '', twoBottom: '',
    threeTopList: '', threeBotList: '', runTop: '', runBottom: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [latestRes, resultsRes] = await Promise.all([getLatestLottery(), getLotteryResults()]);
      setLatest(latestRes.data);
      setResults(resultsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleFetch = async () => {
    if (!fetchDate) return toast.error('กรุณาระบุวันที่งวด');
    try {
      toast.loading('กำลังดึงผลหวย...');
      await fetchLottery({ roundDate: fetchDate });
      toast.dismiss();
      toast.success('ดึงผลหวยสำเร็จ');
      loadData();
    } catch (err) {
      toast.dismiss();
      toast.error(err.response?.data?.message || 'ดึงผลหวยไม่สำเร็จ');
    }
  };

  const handleCalculate = async () => {
    if (!calcDate) return toast.error('กรุณาระบุวันที่งวด');
    if (!confirm(`ยืนยันคำนวณผลงวด ${calcDate} ? (Bets จะถูกล็อค)`)) return;
    try {
      const res = await calculateLottery({ roundDate: calcDate });
      toast.success(`คำนวณเสร็จ! ถูก: ${res.data.wonCount}, ไม่ถูก: ${res.data.lostCount}`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'คำนวณไม่สำเร็จ');
    }
  };

  const handleManualSave = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...manualForm,
        threeTopList: manualForm.threeTopList ? manualForm.threeTopList.split(',').map(s => s.trim()) : [],
        threeBotList: manualForm.threeBotList ? manualForm.threeBotList.split(',').map(s => s.trim()) : [],
        runTop: manualForm.runTop ? manualForm.runTop.split(',').map(s => s.trim()) : [],
        runBottom: manualForm.runBottom ? manualForm.runBottom.split(',').map(s => s.trim()) : [],
      };
      await manualLottery(data);
      toast.success('บันทึกผลหวยสำเร็จ');
      setShowManual(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🎰 ผลหวย / คำนวณ</h1>
          <p className="page-subtitle">ดึงผลหวย, กรอกเอง, คำนวณแพ้ชนะ</p>
        </div>
      </div>

      {/* Latest Result */}
      {latest && latest.firstPrize && (
        <div className="card mb-lg" style={{ borderColor: 'var(--border-accent)', boxShadow: 'var(--shadow-glow)' }}>
          <div className="card-header">
            <h3 className="card-title"><FiAward style={{ marginRight: 8, color: 'var(--primary)' }} />ผลหวยล่าสุด - งวด {latest.roundDate}</h3>
            <span className={`badge ${latest.isCalculated ? 'badge-success' : 'badge-warning'}`}>
              {latest.isCalculated ? 'คำนวณแล้ว' : 'ยังไม่คำนวณ'}
            </span>
          </div>
          <div className="grid grid-3" style={{ gap: 16 }}>
            <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>รางวัลที่ 1</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-light)', letterSpacing: '0.1em' }}>{latest.firstPrize}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>3 ตัวบน</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{latest.firstPrize?.slice(-3)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>2 ตัวล่าง</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{latest.twoBottom}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-3 mb-lg">
        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 600 }}><FiDownload style={{ marginRight: 6 }} />ดึงผลจาก API</h4>
          <div className="form-group">
            <input className="form-input" placeholder="YYYY-MM-DD" value={fetchDate} onChange={(e) => setFetchDate(e.target.value)} />
          </div>
          <button className="btn btn-primary w-full" onClick={handleFetch}><FiDownload /> ดึงผล</button>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 600 }}><FiPlay style={{ marginRight: 6 }} />คำนวณผล</h4>
          <div className="form-group">
            <input className="form-input" placeholder="YYYY-MM-DD" value={calcDate} onChange={(e) => setCalcDate(e.target.value)} />
          </div>
          <button className="btn btn-primary w-full" onClick={handleCalculate}><FiPlay /> คำนวณ</button>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 600 }}><FiEdit3 style={{ marginRight: 6 }} />กรอกผลเอง</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>กรอกผลหวยเองในกรณี API ไม่ทำงาน</p>
          <button className="btn btn-secondary w-full" onClick={() => setShowManual(true)}><FiEdit3 /> กรอกผล</button>
        </div>
      </div>

      {/* Results History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">ประวัติผลหวย</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>งวด</th>
                <th>รางวัลที่ 1</th>
                <th>3 ตัวบน</th>
                <th>2 ตัวล่าง</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan="5" className="text-center text-muted" style={{ padding: 40 }}>ไม่มีข้อมูล</td></tr>
              ) : (
                results.map(r => (
                  <tr key={r._id}>
                    <td style={{ fontWeight: 600 }}>{r.roundDate}</td>
                    <td style={{ color: 'var(--primary-light)', fontWeight: 700, fontSize: '1.1rem' }}>{r.firstPrize}</td>
                    <td>{r.firstPrize?.slice(-3)}</td>
                    <td>{r.twoBottom}</td>
                    <td>
                      <span className={`badge ${r.isCalculated ? 'badge-success' : 'badge-warning'}`}>
                        {r.isCalculated ? 'คำนวณแล้ว' : 'รอคำนวณ'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      <Modal isOpen={showManual} onClose={() => setShowManual(false)} title="กรอกผลหวย" size="lg">
        <form onSubmit={handleManualSave}>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">วันที่งวด (YYYY-MM-DD) *</label>
              <input className="form-input" value={manualForm.roundDate} onChange={(e) => setManualForm({...manualForm, roundDate: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">รางวัลที่ 1 (6 หลัก) *</label>
              <input className="form-input" value={manualForm.firstPrize} onChange={(e) => setManualForm({...manualForm, firstPrize: e.target.value})} required maxLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">2 ตัวล่าง</label>
              <input className="form-input" value={manualForm.twoBottom} onChange={(e) => setManualForm({...manualForm, twoBottom: e.target.value})} maxLength={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowManual(false)}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">บันทึก</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminLottery;
