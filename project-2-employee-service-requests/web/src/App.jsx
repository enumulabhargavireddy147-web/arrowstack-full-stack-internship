import React, { useEffect, useState } from 'react';
import { api, setToken, getToken } from './api.js';

const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

function Login({ onLogin }) {
  const [email, setEmail] = useState('employee@arrowstack.in');
  const [password, setPassword] = useState('Employee@123');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } }); setToken(token); onLogin(user); }
    catch (ex) { setErr(ex.message); }
  };
  return (
    <div className="card narrow">
      <h1>Service Desk</h1><p className="muted">Employee Service Requests</p>
      <form onSubmit={submit}>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <div className="error">{err}</div>}
        <button type="submit">Sign in</button>
      </form>
      <p className="muted small">employee@ / agent.it@ / admin@arrowstack.in</p>
    </div>
  );
}

function Raise({ categories, onDone }) {
  const [form, setForm] = useState({ title: '', description: '', category_id: '', priority: 'medium' });
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { await api('/requests', { method: 'POST', body: form }); setMsg('Request submitted'); setForm({ title: '', description: '', category_id: '', priority: 'medium' }); onDone(); }
    catch (ex) { setMsg(ex.message); }
  };
  return (
    <div className="card">
      <h2>Raise a request</h2>
      {msg && <div className="notice">{msg}</div>}
      <form onSubmit={submit}>
        <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Category
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name} (SLA {c.default_sla_hours}h)</option>)}
          </select>
        </label>
        <label>Priority
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['low', 'medium', 'high'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>Description<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <button type="submit">Submit request</button>
      </form>
    </div>
  );
}

function RequestList({ role, refreshKey, onOpen }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/requests').then(setRows).catch(() => {}); }, [refreshKey]);
  return (
    <div>
      <h2>{role === 'employee' ? 'My requests' : 'Request queue'}</h2>
      <table>
        <thead><tr><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>SLA</th><th>Assignee</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.id)} style={{ cursor: 'pointer' }}>
              <td>{r.title}</td><td>{r.category}</td><td>{r.priority}</td>
              <td><span className={`badge ${r.status}`}>{r.status}</span></td>
              <td className={r.overdue ? 'out' : ''}>{r.overdue ? 'OVERDUE' : new Date(r.sla_due_at).toLocaleString()}</td>
              <td>{r.assignee || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestDetail({ id, role, onBack, onChanged }) {
  const [req, setReq] = useState(null);
  const [agents, setAgents] = useState([]);
  const [comment, setComment] = useState('');
  const load = () => api(`/requests/${id}`).then(setReq).catch(() => {});
  useEffect(() => { load(); if (role === 'admin') api('/agents').then(setAgents).catch(() => {}); }, [id]);

  if (!req) return <p className="muted">Loading…</p>;
  const update = async (patch) => { await api(`/requests/${id}`, { method: 'PATCH', body: patch }); load(); onChanged(); };
  const addComment = async (e) => { e.preventDefault(); await api(`/requests/${id}/comments`, { method: 'POST', body: { body: comment } }); setComment(''); load(); };

  return (
    <div className="card">
      <button onClick={onBack}>← Back</button>
      <h2>{req.title}</h2>
      <p>{req.description}</p>
      <p className="muted">Category {req.category} · Priority {req.priority} · Requester {req.requester} · SLA {new Date(req.sla_due_at).toLocaleString()} {req.overdue && <span className="out">(overdue)</span>}</p>
      {role !== 'employee' && (
        <div className="inline">
          <select defaultValue="" onChange={(e) => e.target.value && update({ status: e.target.value })}>
            <option value="">Set status…</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {role === 'admin' && (
            <select defaultValue="" onChange={(e) => e.target.value && update({ assignee_id: e.target.value })}>
              <option value="">Assign agent…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      )}
      <h3>Comments</h3>
      <ul className="comments">{(req.comments || []).map((c) => <li key={c.id}>{c.body} <span className="muted small">· {new Date(c.created_at).toLocaleString()}</span></li>)}</ul>
      <form className="inline" onSubmit={addComment}>
        <input placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        <button type="submit">Post</button>
      </form>
    </div>
  );
}

function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/dashboard').then(setD).catch(() => {}); }, []);
  if (!d) return <p className="muted">Loading…</p>;
  return (
    <div>
      <h2>Service dashboard</h2>
      <div className="stats">
        <div className="stat"><span>{d.total}</span><label>Total</label></div>
        <div className="stat"><span>{d.open}</span><label>Open</label></div>
        <div className="stat"><span className={d.overdue ? 'out' : ''}>{d.overdue}</span><label>Overdue</label></div>
      </div>
      <div className="stats">
        {Object.entries(d.byCategory).map(([k, v]) => <div className="stat" key={k}><span>{v}</span><label>{k}</label></div>)}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('list');
  const [openId, setOpenId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  useEffect(() => { if (getToken()) api('/auth/me').then(setUser).catch(() => setToken(null)); }, []);
  useEffect(() => { if (user) api('/categories').then(setCategories).catch(() => {}); }, [user]);

  if (!user) return <Login onLogin={setUser} />;
  const tabs = user.role === 'employee' ? ['list', 'raise'] : ['list', 'dashboard'];
  const open = (id) => { setOpenId(id); setTab('detail'); };

  return (
    <div className="app">
      <header>
        <div className="brand">Arrowstack <span>Service Desk</span></div>
        <nav>
          {tabs.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </nav>
        <div className="user">{user.name} · <strong>{user.role}</strong><button onClick={() => { setToken(null); setUser(null); }}>Log out</button></div>
      </header>
      <main>
        {tab === 'list' && <RequestList role={user.role} refreshKey={refreshKey} onOpen={open} />}
        {tab === 'raise' && <Raise categories={categories} onDone={() => { bump(); setTab('list'); }} />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'detail' && openId && <RequestDetail id={openId} role={user.role} onBack={() => setTab('list')} onChanged={bump} />}
      </main>
    </div>
  );
}
