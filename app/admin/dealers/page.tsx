"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiToggleLeft, FiToggleRight, FiSearch } from "react-icons/fi";

interface Dealer {
  _id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminDealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [filtered, setFiltered] = useState<Dealer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Dealer | null>(null);
  const [form, setForm] = useState({ username: "", password: "", displayName: "" });

  async function load() {
    setLoading(true);
    const r = await axios.get("/api/dealers");
    setDealers(r.data.dealers);
    setFiltered(r.data.dealers);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(dealers.filter(d => d.username.includes(q) || d.displayName.includes(q)));
  }, [search, dealers]);

  function openCreate() { setEditing(null); setForm({ username: "", password: "", displayName: "" }); setShowModal(true); }
  function openEdit(d: Dealer) { setEditing(d); setForm({ username: "", password: "", displayName: d.displayName }); setShowModal(true); }

  async function save() {
    try {
      if (editing) {
        await axios.put(`/api/dealers/${editing._id}`, { displayName: form.displayName, password: form.password || undefined });
        toast.success("แก้ไขสำเร็จ");
      } else {
        await axios.post("/api/dealers", form);
        toast.success("เพิ่มเจ้ามือสำเร็จ");
      }
      setShowModal(false);
      load();
    } catch (e: any) { toast.error(e.response?.data?.error ?? "เกิดข้อผิดพลาด"); }
  }

  async function toggleStatus(d: Dealer) {
    await axios.put(`/api/dealers/${d._id}`, { isActive: !d.isActive });
    toast.success(`${d.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}สำเร็จ`);
    load();
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">จัดการเจ้ามือ</h1>
          <p className="text-gray-400 text-sm mt-0.5">รายชื่อเจ้ามือทั้งหมดในระบบ</p>
        </div>
        <button id="add-dealer-btn" onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <FiPlus size={16} /> เพิ่มเจ้ามือ
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="ค้นหาเจ้ามือ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อ</th>
                <th>Username</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8"><div className="skeleton h-4 w-32 mx-auto rounded" /></td></tr>
              ) : filtered.map((d, i) => (
                <tr key={d._id}>
                  <td className="text-gray-500 text-xs">{i + 1}</td>
                  <td className="font-medium text-white">{d.displayName}</td>
                  <td className="text-gray-400">@{d.username}</td>
                  <td>
                    <span className={d.isActive ? "badge-green" : "badge-gray"}>
                      {d.isActive ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-primary-900/50 text-primary-400 transition-colors" title="แก้ไข">
                        <FiEdit2 size={15} />
                      </button>
                      <button onClick={() => toggleStatus(d)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors" title={d.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                        {d.isActive ? <FiToggleRight size={18} className="text-primary-500" /> : <FiToggleLeft size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-8">ไม่พบข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-sm animate-fadeIn">
            <h2 className="text-lg font-bold text-white mb-4">{editing ? "แก้ไขเจ้ามือ" : "เพิ่มเจ้ามือ"}</h2>
            <div className="space-y-3">
              {!editing && (
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Username" className="input-field" id="dealer-username" />
              )}
              <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="ชื่อที่แสดง" className="input-field" id="dealer-displayname" />
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? "รหัสผ่านใหม่ (ว่างคือไม่เปลี่ยน)" : "รหัสผ่าน"} className="input-field" id="dealer-password" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={save} className="btn-primary flex-1" id="dealer-save-btn">บันทึก</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
