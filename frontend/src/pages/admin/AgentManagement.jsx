import { useState, useEffect } from 'react';
import {
  adjustWalletCredit,
  createAgent,
  deleteAgent,
  getAgents,
  updateAgent
} from '../../services/api';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';
import { FiDollarSign, FiEdit2, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';

const AgentManagement = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '' });
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditTarget, setCreditTarget] = useState(null);
  const [creditForm, setCreditForm] = useState({ amount: '', note: '' });

  useEffect(() => { loadAgents(); }, []);

  const loadAgents = async () => {
    try {
      const res = await getAgents();
      setAgents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editAgent) {
        const updateData = { name: form.name, phone: form.phone };
        if (form.password) updateData.password = form.password;
        await updateAgent(editAgent._id, updateData);
        toast.success('Agent updated');
      } else {
        await createAgent(form);
        toast.success('Agent created');
      }
      closeModal();
      loadAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleDelete = async (agent) => {
    if (!window.confirm(`Deactivate agent "${agent.name}"?`)) return;
    try {
      await deleteAgent(agent._id);
      toast.success('Agent deactivated');
      loadAgents();
    } catch (err) {
      toast.error('Something went wrong');
    }
  };

  const handleToggleActive = async (agent) => {
    try {
      await updateAgent(agent._id, { isActive: !agent.isActive });
      toast.success(agent.isActive ? 'Agent disabled' : 'Agent enabled');
      loadAgents();
    } catch (err) {
      toast.error('Something went wrong');
    }
  };

  const handleAdjustCredit = async (event) => {
    event.preventDefault();

    const amount = Number(creditForm.amount || 0);
    if (!amount) {
      toast.error('Amount is required');
      return;
    }

    try {
      await adjustWalletCredit({
        targetUserId: creditTarget._id,
        amount,
        note: creditForm.note,
        reasonCode: amount >= 0 ? 'agent_topup' : 'agent_deduction'
      });
      toast.success('Agent credit updated');
      closeCreditModal();
      loadAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update credit');
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

  const openCreditModal = (agent) => {
    setCreditTarget(agent);
    setCreditForm({ amount: '', note: '' });
    setShowCreditModal(true);
  };

  const closeCreditModal = () => {
    setCreditTarget(null);
    setCreditForm({ amount: '', note: '' });
    setShowCreditModal(false);
  };

  const filtered = agents.filter((agent) =>
    agent.name.toLowerCase().includes(search.toLowerCase()) ||
    agent.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div><span>Loading...</span></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent Management</h1>
          <p className="page-subtitle">Manage accounts and wallet balances for agents.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Add agent
        </button>
      </div>

      <div className="card mb-lg">
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search agents..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Phone</th>
                <th>Members</th>
                <th>Credit</th>
                <th>Sales</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" className="text-center text-muted" style={{ padding: 40 }}>No data found</td></tr>
              ) : (
                filtered.map((agent) => (
                  <tr key={agent._id}>
                    <td style={{ fontWeight: 600 }}>{agent.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{agent.username}</td>
                    <td>{agent.phone || '-'}</td>
                    <td><span className="badge badge-info">{agent.customerCount || 0}</span></td>
                    <td>{(agent.creditBalance || 0).toLocaleString()} THB</td>
                    <td>{(agent.totalAmount || 0).toLocaleString()} THB</td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(agent)}
                        className={`badge ${agent.isActive ? 'badge-success' : 'badge-danger'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-sm">
                        <button className="btn btn-secondary btn-sm" onClick={() => openCreditModal(agent)}><FiDollarSign /></button>
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

      <Modal isOpen={showModal} onClose={closeModal} title={editAgent ? 'Edit Agent' : 'New Agent'}>
        <form onSubmit={handleSubmit}>
          {!editAgent && (
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input className="form-input" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{editAgent ? 'New password (leave empty to keep current)' : 'Password *'}</label>
            <input className="form-input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editAgent} />
          </div>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editAgent ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showCreditModal} onClose={closeCreditModal} title={`Adjust Credit: ${creditTarget?.name || ''}`}>
        <form onSubmit={handleAdjustCredit}>
          <div className="form-group">
            <label className="form-label">Current balance</label>
            <input className="form-input" value={`${(creditTarget?.creditBalance || 0).toLocaleString()} THB`} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Adjustment amount</label>
            <input className="form-input" type="number" step="0.01" value={creditForm.amount} onChange={(event) => setCreditForm({ ...creditForm, amount: event.target.value })} placeholder="Use negative value to deduct" required />
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea className="form-input" rows="4" value={creditForm.note} onChange={(event) => setCreditForm({ ...creditForm, note: event.target.value })} placeholder="Optional ledger note" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeCreditModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AgentManagement;
