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
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 จัดการลูกค้า</h1>
          <p className="page-subtitle">ลูกค้าของคุณ ({customers.length} คน)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><FiPlus /> เพิ่มลูกค้า</button>
      </div>

      <div className="card">
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="ค้นหาลูกค้า..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>ชื่อ</th><th>Username</th><th>เบอร์โทร</th><th>Bets</th><th>ยอดแทง</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: 40 }}>ไม่พบข้อมูล</td></tr>
              ) : filtered.map(c => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.username}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.totalBets || 0}</td>
                  <td>{(c.totalAmount || 0).toLocaleString()} ฿</td>
                  <td><span className={`badge ${c.isActive ? 'badge-success' : 'badge-danger'}`}>{c.isActive ? 'ใช้งาน' : 'ปิด'}</span></td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}><FiEdit2 /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  );
};

export default AgentCustomers;
