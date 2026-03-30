import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiUserCheck, FiUsers } from 'react-icons/fi';
import Modal from '../../components/Modal';
import PageSkeleton from '../../components/PageSkeleton';
import {
  createAdminCustomer,
  deleteAdminCustomer,
  getAdminCustomers,
  getAgents,
  updateAdminCustomer
} from '../../services/api';

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '', agentId: '' });

  useEffect(() => {
    loadData();
  }, [filterAgent]);

  const loadData = async () => {
    try {
      const [customerRes, agentRes] = await Promise.all([
        getAdminCustomers(filterAgent),
        getAgents()
      ]);
      setCustomers(customerRes.data || []);
      setAgents(agentRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editCustomer) {
        const updateData = { name: form.name, phone: form.phone, agentId: form.agentId };
        if (form.password) updateData.password = form.password;
        await updateAdminCustomer(editCustomer._id, updateData);
        toast.success('Member updated');
      } else {
        await createAdminCustomer(form);
        toast.success('Member created');
      }
      closeModal();
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Deactivate member "${customer.name}"?`)) return;
    try {
      await deleteAdminCustomer(customer._id);
      toast.success('Member deactivated');
      await loadData();
    } catch (err) {
      toast.error('Something went wrong');
    }
  };

  const openEdit = (customer) => {
    setEditCustomer(customer);
    setForm({
      username: customer.username,
      password: '',
      name: customer.name,
      phone: customer.phone || '',
      agentId: customer.agentId?._id || customer.agentId || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditCustomer(null);
    setForm({ username: '', password: '', name: '', phone: '', agentId: '' });
  };

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((customer) =>
      customer.name?.toLowerCase().includes(keyword) ||
      customer.username?.toLowerCase().includes(keyword) ||
      customer.phone?.toLowerCase().includes(keyword) ||
      customer.agentId?.name?.toLowerCase().includes(keyword)
    );
  }, [customers, search]);

  const overviewCards = useMemo(() => {
    const activeCount = customers.filter((customer) => customer.isActive).length;
    const assignedAgentCount = new Set(customers.map((customer) => customer.agentId?._id || customer.agentId).filter(Boolean)).size;
    const unassignedCount = customers.filter((customer) => !customer.agentId).length;

    return [
      { label: 'Total members', value: customers.length, hint: `${activeCount} active accounts` },
      { label: 'Assigned agents', value: assignedAgentCount, hint: 'Distinct agents with linked members' },
      { label: 'Visible rows', value: filteredCustomers.length, hint: 'After search and agent filter' },
      { label: 'Needs assignment', value: unassignedCount, hint: 'Members without an active owner agent' }
    ];
  }, [customers, filteredCustomers.length]);

  if (loading) {
    return <PageSkeleton statCount={4} rows={6} sidebar={false} />;
  }

  return (
    <div className="ops-page animate-fade-in">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">Admin directory</span>
          <h1 className="page-title">Member Management</h1>
          <p className="page-subtitle">Oversee member accounts across the platform, reassign ownership, and keep account access clean before those members reach the agent layer.</p>
        </div>

        <div className="ops-hero-side">
          <span>Current filter</span>
          <strong>{filterAgent ? 'Agent scope' : 'All agents'}</strong>
          <small>{filteredCustomers.length} member rows visible</small>
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
            <h3 className="card-title">Member accounts</h3>
            <p className="ops-table-note">Filter by owner agent, then search for individual members before editing or deactivating access.</p>
          </div>
          <div className="ops-actions">
            <button className="btn btn-secondary" onClick={loadData}>Refresh</button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <FiPlus />
              Add member
            </button>
          </div>
        </div>

        <div className="ops-toolbar mb-md">
          <div className="ops-search">
            <FiSearch />
            <input
              className="form-input"
              placeholder="Search by member, username, phone, or agent"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select className="form-select" value={filterAgent} onChange={(event) => setFilterAgent(event.target.value)} style={{ width: 240 }}>
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent._id} value={agent._id}>{agent.name}</option>
            ))}
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Username</th>
                <th>Owner agent</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted" style={{ padding: 40 }}>No members match the current filters</td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer._id}>
                    <td style={{ fontWeight: 700 }}>{customer.name}</td>
                    <td>{customer.username}</td>
                    <td>{customer.agentId?.name || '-'}</td>
                    <td>{customer.phone || '-'}</td>
                    <td>
                      <span className={`badge ${customer.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="ops-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(customer)}>
                          <FiEdit2 />
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(customer)}>
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
              <div className="ui-eyebrow">Assignment</div>
              <h3 className="card-title">Ownership coverage</h3>
            </div>
          </div>

          <div className="ops-stack">
            <div className="ops-stat-row">
              <span><FiUsers style={{ marginRight: 8 }} />Assigned agents</span>
              <strong>{new Set(customers.map((customer) => customer.agentId?._id || customer.agentId).filter(Boolean)).size}</strong>
            </div>
            <div className="ops-stat-row">
              <span><FiUserCheck style={{ marginRight: 8 }} />Active members</span>
              <strong>{customers.filter((customer) => customer.isActive).length}</strong>
            </div>
          </div>
        </section>

        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">Admin note</div>
              <h3 className="card-title">Profile edits</h3>
            </div>
          </div>

          <div className="ops-stack">
            <div className="ops-feed-row">
              <div>
                <strong>Ownership changes</strong>
                <div className="ops-feed-meta">Reassigning a member here updates the admin-side owner link.</div>
              </div>
            </div>
            <p className="ops-table-note">Passwords remain optional during edits so you can fix profile data without forcing a credential reset.</p>
          </div>
        </section>
      </section>

      <Modal isOpen={showModal} onClose={closeModal} title={editCustomer ? 'Edit member' : 'Create member'}>
        <form onSubmit={handleSubmit}>
          {!editCustomer ? (
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
            <label className="form-label">{editCustomer ? 'New password (optional)' : 'Password *'}</label>
            <input
              className="form-input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required={!editCustomer}
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

          <div className="form-group">
            <label className="form-label">Owner agent *</label>
            <select
              className="form-select"
              value={form.agentId}
              onChange={(event) => setForm({ ...form, agentId: event.target.value })}
              required
            >
              <option value="">Select agent</option>
              {agents.filter((agent) => agent.isActive).map((agent) => (
                <option key={agent._id} value={agent._id}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editCustomer ? 'Save changes' : 'Create member'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CustomerManagement;
