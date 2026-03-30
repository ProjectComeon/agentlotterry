import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiDollarSign, FiEdit2, FiPlus, FiSearch, FiShield, FiTrash2, FiUsers } from 'react-icons/fi';
import Modal from '../../components/Modal';
import PageSkeleton from '../../components/PageSkeleton';
import { adjustWalletCredit, createAgent, deleteAgent, getAgents, updateAgent } from '../../services/api';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

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

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const res = await getAgents();
      setAgents(res.data || []);
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
      await loadAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleDelete = async (agent) => {
    if (!window.confirm(`Deactivate agent "${agent.name}"?`)) return;
    try {
      await deleteAgent(agent._id);
      toast.success('Agent deactivated');
      await loadAgents();
    } catch (err) {
      toast.error('Something went wrong');
    }
  };

  const handleToggleActive = async (agent) => {
    try {
      await updateAgent(agent._id, { isActive: !agent.isActive });
      toast.success(agent.isActive ? 'Agent disabled' : 'Agent enabled');
      await loadAgents();
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
      await loadAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update credit');
    }
  };

  const openEdit = (agent) => {
    setEditAgent(agent);
    setForm({
      username: agent.username,
      password: '',
      name: agent.name,
      phone: agent.phone || ''
    });
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

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return agents;
    return agents.filter((agent) =>
      agent.name?.toLowerCase().includes(keyword) ||
      agent.username?.toLowerCase().includes(keyword) ||
      agent.phone?.toLowerCase().includes(keyword)
    );
  }, [agents, search]);

  const overviewCards = useMemo(() => {
    const activeCount = agents.filter((agent) => agent.isActive).length;
    const totalMembers = agents.reduce((sum, agent) => sum + Number(agent.customerCount || 0), 0);
    const totalCredit = agents.reduce((sum, agent) => sum + Number(agent.creditBalance || 0), 0);
    const totalSales = agents.reduce((sum, agent) => sum + Number(agent.totalAmount || 0), 0);

    return [
      { label: 'Total agents', value: agents.length, hint: `${activeCount} active` },
      { label: 'Managed members', value: money(totalMembers), hint: 'Members assigned across all agents' },
      { label: 'Agent credit', value: `${money(totalCredit)} THB`, hint: 'Current wallet balance under admin control' },
      { label: 'Sales volume', value: `${money(totalSales)} THB`, hint: 'Accepted stake across all agent accounts' }
    ];
  }, [agents]);

  if (loading) {
    return <PageSkeleton statCount={4} rows={6} sidebar={false} />;
  }

  return (
    <div className="ops-page animate-fade-in">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">Admin operations</span>
          <h1 className="page-title">Agent Management</h1>
          <p className="page-subtitle">Create agent accounts, keep wallet balances healthy, and control account availability from a single admin surface.</p>
        </div>

        <div className="ops-hero-side">
          <span>Visible after filters</span>
          <strong>{filteredAgents.length}</strong>
          <small>{agents.filter((agent) => agent.isActive).length} currently active</small>
        </div>
      </section>

      <section className="ops-overview-grid">
        {overviewCards.map((card) => (
          <article key={card.label} className="ops-overview-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="card ops-section">
        <div className="ops-table-head">
          <div>
            <div className="ui-eyebrow">Directory</div>
            <h3 className="card-title">Agent accounts</h3>
            <p className="ops-table-note">Search by name, username, or phone before opening account-level actions.</p>
          </div>
          <div className="ops-actions">
            <button className="btn btn-secondary" onClick={loadAgents}>Refresh</button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <FiPlus />
              Add agent
            </button>
          </div>
        </div>

        <div className="ops-toolbar mb-md">
          <div className="ops-search">
            <FiSearch />
            <input
              type="text"
              className="form-input"
              placeholder="Search agents by name, username, or phone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
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
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted" style={{ padding: 40 }}>No agents match the current search</td>
                </tr>
              ) : (
                filteredAgents.map((agent) => (
                  <tr key={agent._id}>
                    <td style={{ fontWeight: 700 }}>{agent.name}</td>
                    <td>{agent.username}</td>
                    <td>{agent.phone || '-'}</td>
                    <td>{money(agent.customerCount || 0)}</td>
                    <td>{money(agent.creditBalance || 0)} THB</td>
                    <td>{money(agent.totalAmount || 0)} THB</td>
                    <td>
                      <button
                        type="button"
                        className={`badge ${agent.isActive ? 'badge-success' : 'badge-danger'} agent-status-toggle`}
                        onClick={() => handleToggleActive(agent)}
                      >
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="ops-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => openCreditModal(agent)}>
                          <FiDollarSign />
                          Credit
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(agent)}>
                          <FiEdit2 />
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(agent)}>
                          <FiTrash2 />
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ops-grid">
        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">Coverage</div>
              <h3 className="card-title">Operational notes</h3>
            </div>
          </div>

          <div className="ops-stack">
            <div className="ops-stat-row">
              <span><FiShield style={{ marginRight: 8 }} />Account control</span>
              <strong>Enable or disable access in one click</strong>
            </div>
            <div className="ops-stat-row">
              <span><FiUsers style={{ marginRight: 8 }} />Member load</span>
              <strong>{money(agents.reduce((sum, agent) => sum + Number(agent.customerCount || 0), 0))} members assigned</strong>
            </div>
          </div>
        </section>

        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">Wallets</div>
              <h3 className="card-title">Credit reminder</h3>
            </div>
          </div>

          <div className="ops-stack">
            <div className="ops-feed-row">
              <div>
                <strong>Total agent credit</strong>
                <div className="ops-feed-meta">Tracked by the wallet ledger</div>
              </div>
              <div className="ops-feed-right">
                <strong>{money(agents.reduce((sum, agent) => sum + Number(agent.creditBalance || 0), 0))} THB</strong>
                <span className="ops-feed-meta">Current balance</span>
              </div>
            </div>
            <p className="ops-table-note">Use the credit action on any row when you need to top up or deduct an agent wallet without editing profile data.</p>
          </div>
        </section>
      </section>

      <Modal isOpen={showModal} onClose={closeModal} title={editAgent ? 'Edit agent' : 'Create agent'}>
        <form onSubmit={handleSubmit}>
          {!editAgent ? (
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input
                className="form-input"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                required
              />
            </div>
          ) : null}

          <div className="form-group">
            <label className="form-label">{editAgent ? 'New password (optional)' : 'Password *'}</label>
            <input
              className="form-input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required={!editAgent}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Display name *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              className="form-input"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editAgent ? 'Save changes' : 'Create agent'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showCreditModal} onClose={closeCreditModal} title={`Adjust credit${creditTarget ? `: ${creditTarget.name}` : ''}`}>
        <form onSubmit={handleAdjustCredit}>
          <div className="form-group">
            <label className="form-label">Current balance</label>
            <input className="form-input" value={`${money(creditTarget?.creditBalance || 0)} THB`} disabled />
          </div>

          <div className="form-group">
            <label className="form-label">Adjustment amount</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={creditForm.amount}
              onChange={(event) => setCreditForm({ ...creditForm, amount: event.target.value })}
              placeholder="Use negative value to deduct"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea
              className="form-input"
              rows="4"
              value={creditForm.note}
              onChange={(event) => setCreditForm({ ...creditForm, note: event.target.value })}
              placeholder="Optional ledger note"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeCreditModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save adjustment</button>
          </div>
        </form>
      </Modal>

      <style>{`
        .agent-status-toggle{border:none;cursor:pointer}
      `}</style>
    </div>
  );
};

export default AgentManagement;
