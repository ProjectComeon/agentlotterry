import { useState, useEffect } from 'react';
import { getAgents, createAgent, updateAgent, deleteAgent } from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiPhone, FiUser } from 'react-icons/fi';

const AgentManagement = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '' });

  useEffect(() => { loadAgents(); }, []);

  const loadAgents = async () => {
    try {
      const res = await getAgents();
      setAgents(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editAgent) {
        const updateData = { name: form.name, phone: form.phone };
        if (form.password) updateData.password = form.password;
        await updateAgent(editAgent._id, updateData);
        toast.success('อัปเดตเจ้ามือสำเร็จ');
      } else {
        await createAgent(form);
        toast.success('สร้างเจ้ามือสำเร็จ');
      }
      closeModal();
      loadAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (agent) => {
    if (!confirm(`ต้องการปิดการใช้งานเจ้ามือ "${agent.name}" ?`)) return;
    try {
      await deleteAgent(agent._id);
      toast.success('ปิดการใช้งานสำเร็จ');
      loadAgents();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleToggleActive = async (agent) => {
    try {
      await updateAgent(agent._id, { isActive: !agent.isActive });
      toast.success(agent.isActive ? 'ปิดการใช้งานแล้ว' : 'เปิดการใช้งานแล้ว');
      loadAgents();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const openEdit = (agent) => {
    setEditAgent(agent);
    setForm({ username: agent.username, password: '', name: agent.name, phone: agent.phone });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditAgent(null);
    setForm({ username: '', password: '', name: '', phone: '' });
  };

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading-container"><div className="spinner"></div><span>กำลังโหลด...</span></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 จัดการเจ้ามือ</h1>
          <p className="page-subtitle">เพิ่ม แก้ไข จัดการเจ้ามือ ({agents.length} คน)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> เพิ่มเจ้ามือ
        </button>
      </div>

      <div className="card mb-lg">
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="ค้นหาเจ้ามือ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>Username</th>
                <th>เบอร์โทร</th>
                <th>ลูกค้า</th>
                <th>ยอดแทง</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="text-center text-muted" style={{ padding: 40 }}>ไม่พบข้อมูล</td></tr>
              ) : (
                filtered.map(agent => (
                  <tr key={agent._id}>
                    <td style={{ fontWeight: 600 }}>{agent.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{agent.username}</td>
                    <td>{agent.phone || '-'}</td>
                    <td><span className="badge badge-info">{agent.customerCount || 0} คน</span></td>
                    <td>{(agent.totalAmount || 0).toLocaleString()} ฿</td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(agent)}
                        className={`badge ${agent.isActive ? 'badge-success' : 'badge-danger'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {agent.isActive ? 'ใช้งาน' : 'ปิด'}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-sm">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(agent)}><FiEdit2 /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(agent)}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editAgent ? 'แก้ไขเจ้ามือ' : 'เพิ่มเจ้ามือใหม่'}>
        <form onSubmit={handleSubmit}>
          {!editAgent && (
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input className="form-input" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{editAgent ? 'รหัสผ่านใหม่ (เว้นว่างไม่เปลี่ยน)' : 'รหัสผ่าน *'}</label>
            <input className="form-input" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required={!editAgent} />
          </div>
          <div className="form-group">
            <label className="form-label">ชื่อ *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">เบอร์โทร</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">{editAgent ? 'อัปเดต' : 'สร้าง'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AgentManagement;
