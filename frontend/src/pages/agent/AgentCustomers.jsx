import { useState, useEffect } from 'react';
import { getAgentCustomers, createCustomer, updateCustomer, deleteCustomer } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi';

const AgentCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '' });

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try { const res = await getAgentCustomers(); setCustomers(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editCustomer) {
        const data = { name: form.name, phone: form.phone };
        if (form.password) data.password = form.password;
        await updateCustomer(editCustomer._id, data);
        toast.success('อัปเดตลูกค้าสำเร็จ');
      } else {
        await createCustomer(form);
        toast.success('สร้างลูกค้าสำเร็จ');
      }
      closeModal(); loadCustomers();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const handleDelete = async (c) => {
    if (!confirm(`ปิดการใช้งาน "${c.name}" ?`)) return;
    try { await deleteCustomer(c._id); toast.success('ปิดการใช้งานแล้ว'); loadCustomers(); }
    catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const openEdit = (c) => {
    setEditCustomer(c);
    setForm({ username: c.username, password: '', name: c.name, phone: c.phone });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditCustomer(null); setForm({ username: '', password: '', name: '', phone: '' }); };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.username.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="ag-cust animate-fade-in">
      <div className="ag-cust-header">
        <div>
          <h1 className="ag-cust-title">ลูกค้า</h1>
          <span className="ag-cust-count">{customers.length} คน</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><FiPlus /> เพิ่ม</button>
      </div>

      <div className="ag-cust-search">
        <FiSearch />
        <input placeholder="ค้นหาลูกค้า..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="ag-cust-list">
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-text">ไม่พบข้อมูล</div></div>
        ) : filtered.map((c) => (
          <div key={c._id} className="ag-cust-card">
            <div className="ag-cust-card-left">
              <div className="ag-cust-avatar">{c.name?.charAt(0) || 'U'}</div>
              <div className="ag-cust-info">
                <div className="ag-cust-name">{c.name}</div>
                <div className="ag-cust-username">@{c.username}</div>
              </div>
            </div>
            <div className="ag-cust-card-right">
              <span className={`ag-cust-status ${c.isActive ? 'active' : ''}`}>{c.isActive ? 'ใช้งาน' : 'ปิด'}</span>
            </div>
            <div className="ag-cust-card-stats">
              <span>{c.totalBets || 0} bets</span>
              <span>{(c.totalAmount || 0).toLocaleString()} ฿</span>
              <span>{c.phone || '-'}</span>
            </div>
            <div className="ag-cust-card-actions">
              <button className="ag-cust-btn" onClick={() => openEdit(c)}><FiEdit2 /> แก้ไข</button>
              <button className="ag-cust-btn ag-cust-btn-danger" onClick={() => handleDelete(c)}><FiTrash2 /> ปิด</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editCustomer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}>
        <form onSubmit={handleSubmit}>
          {!editCustomer && <div className="form-group"><label className="form-label">Username *</label><input className="form-input" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} required /></div>}
          <div className="form-group"><label className="form-label">{editCustomer ? 'รหัสผ่านใหม่' : 'รหัสผ่าน *'}</label><input className="form-input" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required={!editCustomer} /></div>
          <div className="form-group"><label className="form-label">ชื่อ *</label><input className="form-input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></div>
          <div className="form-group"><label className="form-label">เบอร์โทร</label><input className="form-input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">{editCustomer ? 'อัปเดต' : 'สร้าง'}</button>
          </div>
        </form>
      </Modal>

      <style>{`
        .ag-cust {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ag-cust-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ag-cust-header > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ag-cust-title {
          font-size: 1.3rem;
          font-weight: 800;
        }

        .ag-cust-count {
          font-size: 0.78rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          padding: 3px 10px;
          border-radius: 16px;
        }

        .ag-cust-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-muted);
        }

        .ag-cust-search input {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 0.85rem;
          flex: 1;
          min-width: 0;
        }

        .ag-cust-search input::placeholder { color: var(--text-muted); }

        .ag-cust-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ag-cust-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
        }

        .ag-cust-card-left {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .ag-cust-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
        }

        .ag-cust-info {
          flex: 1;
          min-width: 0;
        }

        .ag-cust-name {
          font-size: 0.95rem;
          font-weight: 700;
        }

        .ag-cust-username {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .ag-cust-card-right {
          position: absolute;
          top: 14px;
          right: 14px;
        }

        .ag-cust-card {
          position: relative;
        }

        .ag-cust-status {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .ag-cust-status.active {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }

        .ag-cust-card-stats {
          display: flex;
          gap: 16px;
          padding: 8px 0;
          border-top: 1px solid var(--border-light);
          border-bottom: 1px solid var(--border-light);
          margin-bottom: 10px;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .ag-cust-card-actions {
          display: flex;
          gap: 8px;
        }

        .ag-cust-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 14px;
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .ag-cust-btn:hover {
          border-color: var(--border-accent);
          color: var(--primary-light);
        }

        .ag-cust-btn-danger:hover {
          border-color: var(--danger);
          color: var(--danger);
        }
      `}</style>
    </div>
  );
};

export default AgentCustomers;
