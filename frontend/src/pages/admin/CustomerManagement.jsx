import { useState, useEffect } from 'react';
import { getAdminCustomers, getAgents, createAdminCustomer, updateAdminCustomer, deleteAdminCustomer } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiFilter } from 'react-icons/fi';

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '', agentId: '' });

  useEffect(() => { loadData(); }, [filterAgent]);

  const loadData = async () => {
    try {
      const [custRes, agentRes] = await Promise.all([
        getAdminCustomers(filterAgent),
        getAgents()
      ]);
      setCustomers(custRes.data);
      setAgents(agentRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editCustomer) {
        const updateData = { name: form.name, phone: form.phone, agentId: form.agentId };
        if (form.password) updateData.password = form.password;
        await updateAdminCustomer(editCustomer._id, updateData);
        toast.success('อัปเดตลูกค้าสำเร็จ');
      } else {
        await createAdminCustomer(form);
        toast.success('สร้างลูกค้าสำเร็จ');
      }
      closeModal();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (customer) => {
    if (!confirm(`ต้องการปิดการใช้งาน "${customer.name}" ?`)) return;
    try {
      await deleteAdminCustomer(customer._id);
      toast.success('ปิดการใช้งานสำเร็จ');
      loadData();
    } catch (err) { toast.error('เกิดข้อผิดพลาด'); }
  };

  const openEdit = (customer) => {
    setEditCustomer(customer);
    setForm({ 
      username: customer.username, password: '', 
      name: customer.name, phone: customer.phone,
      agentId: customer.agentId?._id || customer.agentId || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditCustomer(null);
    setForm({ username: '', password: '', name: '', phone: '', agentId: '' });
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading-container"><div className="spinner"></div><span>กำลังโหลด...</span></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 จัดการลูกค้า</h1>
          <p className="page-subtitle">ลูกค้าทั้งหมด ({customers.length} คน)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> เพิ่มลูกค้า
        </button>
      </div>

      <div className="card mb-lg">
        <div className="flex gap-md mb-md" style={{ flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
            <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" placeholder="ค้นหาลูกค้า..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
          </div>
          <select className="form-select" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} style={{ width: 220 }}>
            <option value="">เจ้ามือทั้งหมด</option>
            {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>Username</th>
                <th>เจ้ามือ</th>
                <th>เบอร์โทร</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="text-center text-muted" style={{ padding: 40 }}>ไม่พบข้อมูล</td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.username}</td>
                    <td><span className="badge badge-info">{c.agentId?.name || '-'}</span></td>
                    <td>{c.phone || '-'}</td>
                    <td>
                      <span className={`badge ${c.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {c.isActive ? 'ใช้งาน' : 'ปิด'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-sm">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}><FiEdit2 /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editCustomer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}>
        <form onSubmit={handleSubmit}>
          {!editCustomer && (
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input className="form-input" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{editCustomer ? 'รหัสผ่านใหม่ (เว้นว่างไม่เปลี่ยน)' : 'รหัสผ่าน *'}</label>
            <input className="form-input" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required={!editCustomer} />
          </div>
          <div className="form-group">
            <label className="form-label">ชื่อ *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">เบอร์โทร</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">เจ้ามือ *</label>
            <select className="form-select" value={form.agentId} onChange={(e) => setForm({...form, agentId: e.target.value})} required>
              <option value="">เลือกเจ้ามือ</option>
              {agents.filter(a => a.isActive).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">{editCustomer ? 'อัปเดต' : 'สร้าง'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CustomerManagement;
