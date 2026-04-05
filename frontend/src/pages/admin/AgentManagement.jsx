import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiDollarSign, FiEdit2, FiPlus, FiSearch, FiShield, FiTrash2, FiUsers } from 'react-icons/fi';
import Modal from '../../components/Modal';
import PageSkeleton from '../../components/PageSkeleton';
import { adminCopy } from '../../i18n/th/admin';
import { getUserStatusLabel } from '../../i18n/th/labels';
import { adjustWalletCredit, createAgent, deleteAgent, getAgents, updateAgent } from '../../services/api';
import { formatMoney as money } from '../../utils/formatters';

const copy = adminCopy.agents;
const agentStatusOptions = ['active', 'inactive', 'suspended'];
const emptyForm = {
  username: '',
  password: '',
  name: '',
  phone: '',
  status: 'active',
  stockPercent: '0',
  ownerPercent: '0',
  keepPercent: '0',
  commissionRate: '0',
  notes: ''
};

const getAgentStatus = (agent) => agent.status || (agent.isActive ? 'active' : 'inactive');

const AgentManagement = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
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

  const updateFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setEditAgent(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (agent) => {
    setEditAgent(agent);
    setForm({
      username: agent.username || '',
      password: '',
      name: agent.name || '',
      phone: agent.phone || '',
      status: getAgentStatus(agent),
      stockPercent: String(agent.stockPercent ?? 0),
      ownerPercent: String(agent.ownerPercent ?? 0),
      keepPercent: String(agent.keepPercent ?? 0),
      commissionRate: String(agent.commissionRate ?? 0),
      notes: agent.notes || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditAgent(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        status: form.status,
        stockPercent: form.stockPercent === '' ? 0 : form.stockPercent,
        ownerPercent: form.ownerPercent === '' ? 0 : form.ownerPercent,
        keepPercent: form.keepPercent === '' ? 0 : form.keepPercent,
        commissionRate: form.commissionRate === '' ? 0 : form.commissionRate,
        notes: form.notes.trim()
      };

      if (editAgent) {
        if (form.password) payload.password = form.password;
        await updateAgent(editAgent._id, payload);
        toast.success('อัปเดตข้อมูลเจ้ามือแล้ว');
      } else {
        await createAgent({
          username: form.username.trim(),
          password: form.password,
          ...payload
        });
        toast.success('สร้างเจ้ามือแล้ว');
      }

      closeModal();
      await loadAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (agent) => {
    if (!window.confirm(`ต้องการปิดการใช้งานเจ้ามือ "${agent.name}" ใช่หรือไม่`)) return;

    try {
      await deleteAgent(agent._id);
      toast.success('ปิดการใช้งานเจ้ามือแล้ว');
      await loadAgents();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleToggleActive = async (agent) => {
    try {
      await updateAgent(agent._id, { isActive: !agent.isActive });
      toast.success(agent.isActive ? 'ปิดการใช้งานเจ้ามือแล้ว' : 'เปิดการใช้งานเจ้ามือแล้ว');
      await loadAgents();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด');
    }
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

  const handleAdjustCredit = async (event) => {
    event.preventDefault();

    const amount = Number(creditForm.amount || 0);
    if (!amount) {
      toast.error('กรุณาระบุจำนวนเครดิต');
      return;
    }

    try {
      await adjustWalletCredit({
        targetUserId: creditTarget._id,
        amount,
        note: creditForm.note,
        reasonCode: amount >= 0 ? 'agent_topup' : 'agent_deduction'
      });
      toast.success('อัปเดตเครดิตเจ้ามือแล้ว');
      closeCreditModal();
      await loadAgents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'อัปเดตเครดิตไม่สำเร็จ');
    }
  };

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return agents;

    return agents.filter((agent) =>
      agent.name?.toLowerCase().includes(keyword) ||
      agent.username?.toLowerCase().includes(keyword) ||
      agent.phone?.toLowerCase().includes(keyword) ||
      agent.notes?.toLowerCase().includes(keyword)
    );
  }, [agents, search]);

  const overviewCards = useMemo(() => {
    const activeCount = agents.filter((agent) => agent.isActive).length;
    const totalMembers = agents.reduce((sum, agent) => sum + Number(agent.customerCount || 0), 0);
    const totalCredit = agents.reduce((sum, agent) => sum + Number(agent.creditBalance || 0), 0);
    const totalSales = agents.reduce((sum, agent) => sum + Number(agent.totalAmount || 0), 0);

    return [
      { label: copy.overviewCards.totalAgents.label, value: agents.length, hint: copy.overviewCards.totalAgents.hint(activeCount) },
      { label: copy.overviewCards.totalMembers.label, value: money(totalMembers), hint: copy.overviewCards.totalMembers.hint },
      { label: copy.overviewCards.totalCredit.label, value: `${money(totalCredit)} บาท`, hint: copy.overviewCards.totalCredit.hint },
      { label: copy.overviewCards.totalSales.label, value: `${money(totalSales)} บาท`, hint: copy.overviewCards.totalSales.hint }
    ];
  }, [agents]);

  if (loading) {
    return <PageSkeleton statCount={4} rows={6} sidebar={false} />;
  }

  return (
    <div className="ops-page animate-fade-in">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
        </div>

        <div className="ops-hero-side">
          <span>{copy.filteredCount}</span>
          <strong>{filteredAgents.length}</strong>
          <small>{copy.activeCount(agents.filter((agent) => agent.isActive).length)}</small>
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
            <div className="ui-eyebrow">{copy.listEyebrow}</div>
            <h3 className="card-title">{copy.listTitle}</h3>
            <p className="ops-table-note">{copy.listNote}</p>
          </div>
          <div className="ops-actions">
            <button className="btn btn-secondary" onClick={loadAgents}>{adminCopy.common.refresh}</button>
            <button className="btn btn-primary" onClick={openCreate}>
              <FiPlus />
              {copy.add}
            </button>
          </div>
        </div>

        <div className="ops-toolbar mb-md">
          <div className="ops-search">
            <FiSearch />
            <input
              type="text"
              className="form-input"
              placeholder={copy.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{copy.columns.name}</th>
                <th>{copy.columns.username}</th>
                <th>{copy.columns.phone}</th>
                <th>{copy.columns.members}</th>
                <th>{copy.columns.credit}</th>
                <th>{copy.columns.sales}</th>
                <th>{copy.columns.status}</th>
                <th>{copy.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted" style={{ padding: 40 }}>{copy.empty}</td>
                </tr>
              ) : (
                filteredAgents.map((agent) => {
                  const agentStatus = getAgentStatus(agent);
                  const badgeClass = agentStatus === 'active'
                    ? 'badge-success'
                    : agentStatus === 'inactive'
                      ? 'badge-danger'
                      : 'badge-warning';

                  return (
                    <tr key={agent._id}>
                      <td style={{ fontWeight: 700 }}>{agent.name}</td>
                      <td>{agent.username}</td>
                      <td>{agent.phone || '-'}</td>
                      <td>{money(agent.customerCount || 0)}</td>
                      <td>{money(agent.creditBalance || 0)} บาท</td>
                      <td>{money(agent.totalAmount || 0)} บาท</td>
                      <td>
                        <button
                          type="button"
                          className={`badge ${badgeClass} agent-status-toggle`}
                          onClick={() => handleToggleActive(agent)}
                        >
                          {getUserStatusLabel(agentStatus)}
                        </button>
                      </td>
                      <td>
                        <div className="ops-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => openCreditModal(agent)}>
                            <FiDollarSign />
                            {copy.credit}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(agent)}>
                            <FiEdit2 />
                            {copy.edit}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(agent)}>
                            <FiTrash2 />
                            {copy.deactivate}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ops-grid">
        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">{copy.operationsEyebrow}</div>
              <h3 className="card-title">{copy.operationsTitle}</h3>
            </div>
          </div>

          <div className="ops-stack">
            <div className="ops-stat-row">
              <span><FiShield style={{ marginRight: 8 }} />{copy.controlAccounts}</span>
              <strong>{copy.controlAccountsHint}</strong>
            </div>
            <div className="ops-stat-row">
              <span><FiUsers style={{ marginRight: 8 }} />{copy.memberLoad}</span>
              <strong>{copy.memberLoadHint(money(agents.reduce((sum, agent) => sum + Number(agent.customerCount || 0), 0)))}</strong>
            </div>
          </div>
        </section>

        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">{copy.walletEyebrow}</div>
              <h3 className="card-title">{copy.walletTitle}</h3>
            </div>
          </div>

          <div className="ops-stack">
            <div className="ops-feed-row">
              <div>
                <strong>{copy.walletTotal}</strong>
                <div className="ops-feed-meta">{copy.walletSource}</div>
              </div>
              <div className="ops-feed-right">
                <strong>{money(agents.reduce((sum, agent) => sum + Number(agent.creditBalance || 0), 0))} บาท</strong>
                <span className="ops-feed-meta">{copy.walletBalance}</span>
              </div>
            </div>
            <p className="ops-table-note">{copy.walletHint}</p>
          </div>
        </section>
      </section>

      <Modal isOpen={showModal} onClose={closeModal} title={editAgent ? copy.editTitle : copy.createTitle} size="lg">
        <form onSubmit={handleSubmit} className="agent-form">
          <section className="agent-form-section">
            <div className="agent-form-section-head">
              <strong>{copy.accountSection}</strong>
              <span>{copy.accountHint}</span>
            </div>

            <div className="agent-form-grid">
              <label>
                <span>{editAgent ? copy.usernameReadonly : copy.username}</span>
                <input
                  className="form-input"
                  value={form.username}
                  onChange={(event) => updateFormField('username', event.target.value)}
                  disabled={Boolean(editAgent)}
                  required={!editAgent}
                />
              </label>

              <label>
                <span>{editAgent ? copy.passwordOptional : copy.passwordRequired}</span>
                <input
                  className="form-input"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateFormField('password', event.target.value)}
                  required={!editAgent}
                />
              </label>

              <label>
                <span>{copy.displayName}</span>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(event) => updateFormField('name', event.target.value)}
                  required
                />
              </label>

              <label>
                <span>{copy.phoneLabel}</span>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={(event) => updateFormField('phone', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="agent-form-section">
            <div className="agent-form-section-head">
              <strong>{copy.profileSection}</strong>
              <span>{copy.profileHint}</span>
            </div>

            <div className="agent-form-grid">
              <label>
                <span>{copy.statusLabel}</span>
                <select className="form-input" value={form.status} onChange={(event) => updateFormField('status', event.target.value)}>
                  {agentStatusOptions.map((status) => (
                    <option key={status} value={status}>{getUserStatusLabel(status)}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>{copy.stockPercentLabel}</span>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="100"
                  value={form.stockPercent}
                  onChange={(event) => updateFormField('stockPercent', event.target.value)}
                />
              </label>

              <label>
                <span>{copy.ownerPercentLabel}</span>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="100"
                  value={form.ownerPercent}
                  onChange={(event) => updateFormField('ownerPercent', event.target.value)}
                />
              </label>

              <label>
                <span>{copy.keepPercentLabel}</span>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="100"
                  value={form.keepPercent}
                  onChange={(event) => updateFormField('keepPercent', event.target.value)}
                />
              </label>

              <label>
                <span>{copy.commissionRateLabel}</span>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="100"
                  value={form.commissionRate}
                  onChange={(event) => updateFormField('commissionRate', event.target.value)}
                />
              </label>

              <label className="full">
                <span>{copy.notesLabel}</span>
                <textarea
                  className="form-input"
                  rows="4"
                  value={form.notes}
                  onChange={(event) => updateFormField('notes', event.target.value)}
                  placeholder={copy.notesPlaceholder}
                />
              </label>
            </div>

            <div className="form-hint">{copy.percentHint}</div>
          </section>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>{adminCopy.common.cancel}</button>
            <button type="submit" className="btn btn-primary">{editAgent ? adminCopy.common.saveChanges : copy.createSubmit}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showCreditModal} onClose={closeCreditModal} title={copy.creditModalTitle(creditTarget?.name)}>
        <form onSubmit={handleAdjustCredit}>
          <div className="form-group">
            <label className="form-label">{copy.currentBalance}</label>
            <input className="form-input" value={`${money(creditTarget?.creditBalance || 0)} บาท`} disabled />
          </div>

          <div className="form-group">
            <label className="form-label">{copy.adjustAmount}</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={creditForm.amount}
              onChange={(event) => setCreditForm({ ...creditForm, amount: event.target.value })}
              placeholder={copy.adjustPlaceholder}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{copy.noteLabel}</label>
            <textarea
              className="form-input"
              rows="4"
              value={creditForm.note}
              onChange={(event) => setCreditForm({ ...creditForm, note: event.target.value })}
              placeholder={copy.notePlaceholder}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeCreditModal}>{adminCopy.common.cancel}</button>
            <button type="submit" className="btn btn-primary">{copy.saveCredit}</button>
          </div>
        </form>
      </Modal>

      <style>{`
        .agent-status-toggle{border:none;cursor:pointer}
        .badge-warning{
          background: rgba(245, 158, 11, 0.16);
          color: #b45309;
        }
        .agent-form{
          display:flex;
          flex-direction:column;
          gap:18px;
        }
        .agent-form-section{
          border:1px solid rgba(222, 115, 102, 0.16);
          border-radius:24px;
          padding:20px;
          background: rgba(255, 250, 249, 0.72);
        }
        .agent-form-section-head{
          display:flex;
          flex-direction:column;
          gap:4px;
          margin-bottom:14px;
        }
        .agent-form-section-head strong{
          font-size:1rem;
          color: var(--text-strong);
        }
        .agent-form-section-head span{
          color: var(--text-soft);
          font-size:0.94rem;
        }
        .agent-form-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:14px;
        }
        .agent-form-grid label{
          display:flex;
          flex-direction:column;
          gap:8px;
        }
        .agent-form-grid label span{
          font-size:0.94rem;
          color: var(--text-soft);
          font-weight:600;
        }
        .agent-form-grid .full{
          grid-column:1 / -1;
        }
        .agent-form-grid textarea{
          resize:vertical;
          min-height:104px;
        }
        .agent-form-grid input:disabled{
          background: rgba(31, 42, 68, 0.06);
          color: rgba(31, 42, 68, 0.72);
          cursor:not-allowed;
        }
        @media (max-width: 768px){
          .agent-form-grid{
            grid-template-columns:1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentManagement;
