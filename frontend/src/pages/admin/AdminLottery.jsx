import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiAward, FiDownload, FiEdit3 } from 'react-icons/fi';
import Modal from '../../components/Modal';
import { fetchLottery, getLatestLottery, getLotteryResults, manualLottery } from '../../services/api';

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
      setResults(resultsRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    if (!fetchDate) return toast.error('กรุณาระบุวันที่งวด');

    try {
      toast.loading('กำลังดึงผลหวย...');
      const res = await fetchLottery({ roundDate: fetchDate });
      toast.dismiss();
      const settlement = res.data?.settlement;
      if (settlement) {
        toast.success(`บันทึกผลและสรุปโพยแล้ว: ถูก ${settlement.wonCount}, ไม่ถูก ${settlement.lostCount}`);
      } else {
        toast.success('ดึงผลหวยสำเร็จ');
      }
      loadData();
    } catch (error) {
      toast.dismiss();
      toast.error(error.response?.data?.message || 'ดึงผลหวยไม่สำเร็จ');
    }
  };

  const handleManualSave = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        ...manualForm,
        threeTopList: manualForm.threeTopList ? manualForm.threeTopList.split(',').map((item) => item.trim()) : [],
        threeBotList: manualForm.threeBotList ? manualForm.threeBotList.split(',').map((item) => item.trim()) : [],
        runTop: manualForm.runTop ? manualForm.runTop.split(',').map((item) => item.trim()) : [],
        runBottom: manualForm.runBottom ? manualForm.runBottom.split(',').map((item) => item.trim()) : []
      };

      const res = await manualLottery(payload);
      const settlement = res.data?.settlement;
      if (settlement) {
        toast.success(`บันทึกผลและสรุปโพยแล้ว: ถูก ${settlement.wonCount}, ไม่ถูก ${settlement.lostCount}`);
      } else {
        toast.success('บันทึกผลหวยสำเร็จ');
      }
      setShowManual(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">ผลหวย</h1>
          <p className="page-subtitle">ดึงผลหรือกรอกผล แล้วระบบจะสรุปโพยให้อัตโนมัติ</p>
        </div>
      </div>

      {latest && latest.firstPrize ? (
        <div className="card mb-lg" style={{ borderColor: 'var(--border-accent)', boxShadow: 'var(--shadow-glow)' }}>
          <div className="card-header">
            <h3 className="card-title"><FiAward style={{ marginRight: 8, color: 'var(--primary)' }} />ผลล่าสุด - งวด {latest.roundDate}</h3>
            <span className={`badge ${latest.isCalculated ? 'badge-success' : 'badge-warning'}`}>
              {latest.isCalculated ? 'สรุปโพยแล้ว' : 'รอสรุปโพย'}
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
      ) : null}

      <div className="grid grid-2 mb-lg">
        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 600 }}><FiDownload style={{ marginRight: 6 }} />ดึงผลจาก API</h4>
          <div className="form-group">
            <input className="form-input" placeholder="YYYY-MM-DD" value={fetchDate} onChange={(event) => setFetchDate(event.target.value)} />
          </div>
          <button className="btn btn-primary w-full" onClick={handleFetch}><FiDownload /> ดึงผล</button>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 600 }}><FiEdit3 style={{ marginRight: 6 }} />กรอกผลเอง</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>ใช้เมื่อ API ภายนอกยังไม่พร้อม แล้วระบบจะสรุปโพยให้อัตโนมัติหลังบันทึก</p>
          <button className="btn btn-secondary w-full" onClick={() => setShowManual(true)}><FiEdit3 /> กรอกผล</button>
        </div>
      </div>

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
                results.map((result) => (
                  <tr key={result._id}>
                    <td style={{ fontWeight: 600 }}>{result.roundDate}</td>
                    <td style={{ color: 'var(--primary-light)', fontWeight: 700, fontSize: '1.1rem' }}>{result.firstPrize}</td>
                    <td>{result.firstPrize?.slice(-3)}</td>
                    <td>{result.twoBottom}</td>
                    <td>
                      <span className={`badge ${result.isCalculated ? 'badge-success' : 'badge-warning'}`}>
                        {result.isCalculated ? 'สรุปโพยแล้ว' : 'รอสรุปโพย'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showManual} onClose={() => setShowManual(false)} title="กรอกผลหวย" size="lg">
        <form onSubmit={handleManualSave}>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">วันที่งวด (YYYY-MM-DD) *</label>
              <input className="form-input" value={manualForm.roundDate} onChange={(event) => setManualForm({ ...manualForm, roundDate: event.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">รางวัลที่ 1 (6 หลัก) *</label>
              <input className="form-input" value={manualForm.firstPrize} onChange={(event) => setManualForm({ ...manualForm, firstPrize: event.target.value })} required maxLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">2 ตัวล่าง</label>
              <input className="form-input" value={manualForm.twoBottom} onChange={(event) => setManualForm({ ...manualForm, twoBottom: event.target.value })} maxLength={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowManual(false)}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">บันทึกผล</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminLottery;
