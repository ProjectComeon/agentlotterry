"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiToggleLeft, FiToggleRight, FiSearch } from "react-icons/fi";

interface Customer {
  _id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  dealerId: { _id: string; displayName: string; username: string } | null;
  createdAt: string;
}

interface Dealer { _id: string; displayName: string; username: string; }

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [search, setSearch] = useState("");
  const [filterDealer, setFilterDealer] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", dealerId: "" });

  async function load() {
    setLoading(true);
    const [cRes, dRes] = await Promise.all([axios.get("/api/customers"), axios.get("/api/dealers")]);
    setCustomers(cRes.data.customers);
    setFiltered(cRes.data.customers);
    setDealers(dRes.data.dealers.filter((d: any) => d.isActive));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    let f = customers;
    if (search) f = f.filter(c => c.username.includes(search.toLowerCase()) || c.displayName.includes(search.toLowerCase()));
    if (filterDealer) f = f.filter(c => c.dealerId?._id === filterDealer);
    setFiltered(f);
  }, [search, filterDealer, customers]);

  function openCreate() { setEditing(null); setForm({ username: "", password: "", displayName: "", dealerId: dealers[0]?._id ?? "" }); setShowModal(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ username: "", password: "", displayName: c.displayName, dealerId: "" }); setShowModal(true); }

  async function save() {
    try {
      if (editing) {
        await axios.put(`/api/customers/${editing._id}`, { displayName: form.displayName, password: form.password || undefined });
        toast.success("แก้ไขสำเร็จ");
      } else {
        await axios.post("/api/customers", form);
        toast.success("เพิ่มลูกค้าสำเร็จ");
      }
      setShowModal(false); load();
    } catch (e: any) { toast.error(e.response?.data?.error ?? "เกิดข้อผิดพลาด"); }
  }

  async function toggleStatus(c: Customer) {
    await axios.put(`/api/customers/${c._id}`, { isActive: !c.isActive });
    toast.success(`${c.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}สำเร็จ`);
    load();
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">จัดการลูกค้า</h1>
          <p className="text-gray-400 text-sm mt-0.5">ลูกค้าทั้งหมดในระบบ</p>
        </div>
        <button id="add-customer-btn" onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <FiPlus size={16} /> เพิ่มลูกค้า
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="ค้นหาลูกค้า..." value={search}
            onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
        </div>
        <select value={filterDealer} onChange={e => setFilterDealer(e.target.value)}
          className="input-field w-40">
          <option value="">เจ้ามือทั้งหมด</option>
          {dealers.map(d => <option key={d._id} value={d._id}>{d.displayName}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อ</th>
                <th>Username</th>
                <th>เจ้ามือ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">กำลังโหลด...</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c._id}>
                  <td className="text-gray-500 text-xs">{i + 1}</td>
                  <td className="font-medium text-white">{c.displayName}</td>
                  <td className="text-gray-400">@{c.username}</td>
                  <td className="text-gray-400 text-sm">{c.dealerId?.displayName ?? "-"}</td>
                  <td>
                    <span className={c.isActive ? "badge-green" : "badge-gray"}>{c.isActive ? "ใช้งาน" : "ปิด"}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-primary-900/50 text-primary-400 transition-colors"><FiEdit2 size={15} /></button>
                      <button onClick={() => toggleStatus(c)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
                        {c.isActive ? <FiToggleRight size={18} className="text-primary-500" /> : <FiToggleLeft size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-500 py-8">ไม่พบข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-sm animate-fadeIn">
            <h2 className="text-lg font-bold text-white mb-4">{editing ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า"}</h2>
            <div className="space-y-3">
              {!editing && <>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Username" className="input-field" id="cust-username" />
                <select value={form.dealerId} onChange={e => setForm(f => ({ ...f, dealerId: e.target.value }))} className="input-field">
                  {dealers.map(d => <option key={d._id} value={d._id}>{d.displayName}</option>)}
                </select>
              </>}
              <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="ชื่อที่แสดง" className="input-field" id="cust-displayname" />
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? "รหัสผ่านใหม่ (ว่างคือไม่เปลี่ยน)" : "รหัสผ่าน"} className="input-field" id="cust-password" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={save} className="btn-primary flex-1" id="cust-save-btn">บันทึก</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
