import React, { useEffect, useState } from 'react';
import { api, setToken, getToken, money } from './api.js';

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@arrowstack.in');
  const [password, setPassword] = useState('Admin@123');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } }); setToken(token); onLogin(user); }
    catch (ex) { setErr(ex.message); }
  };
  return (
    <div className="card narrow">
      <h1>Subscription Analytics</h1><p className="muted">SaaS control plane</p>
      <form onSubmit={submit}>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <div className="error">{err}</div>}
        <button type="submit">Sign in</button>
      </form>
      <p className="muted small">admin@ / analyst@ / customer@arrowstack.in</p>
    </div>
  );
}

function Bars({ data, valueFormat = (v) => v }) {
  const entries = Object.entries(data || {});
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bars">
      {entries.map(([k, v]) => (
        <div className="bar-row" key={k}>
          <span className="bar-label">{k}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="bar-value">{valueFormat(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Overview() {
  const [o, setO] = useState(null);
  const [usage, setUsage] = useState(null);
  const [top, setTop] = useState([]);
  useEffect(() => {
    api('/analytics/overview').then(setO).catch(() => {});
    api('/analytics/usage').then(setUsage).catch(() => {});
    api('/analytics/top-accounts').then(setTop).catch(() => {});
  }, []);
  if (!o) return <p className="muted">Loading analytics…</p>;
  return (
    <div>
      <h2>Business overview</h2>
      <div className="stats">
        <div className="stat"><span>{money(o.mrr)}</span><label>MRR</label></div>
        <div className="stat"><span>{money(o.arr)}</span><label>ARR</label></div>
        <div className="stat"><span>{money(o.arpa)}</span><label>ARPA</label></div>
        <div className="stat"><span>{o.churnRate}%</span><label>Churn</label></div>
      </div>
      <div className="stats">
        <div className="stat"><span>{o.active}</span><label>Active accounts</label></div>
        <div className="stat"><span>{o.cancelled}</span><label>Cancelled</label></div>
        <div className="stat"><span>{money(o.collected)}</span><label>Collected</label></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Usage by metric</h3>{usage && <Bars data={usage.byMetric} />}</div>
        <div className="card"><h3>Top accounts by usage</h3>
          <table><thead><tr><th>Account</th><th>Status</th><th>Units</th></tr></thead>
            <tbody>{top.map((t) => <tr key={t.account}><td>{t.account}</td><td>{t.status}</td><td>{t.units.toLocaleString('en-IN')}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Accounts({ role }) {
  const [accounts, setAccounts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ name: '', plan_id: '' });
  const load = () => { api('/accounts').then(setAccounts).catch(() => {}); api('/plans').then(setPlans).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try { await api('/accounts', { method: 'POST', body: form }); setForm({ name: '', plan_id: '' }); setMsg('Account created'); load(); }
    catch (ex) { setMsg(ex.message); }
  };
  const setStatus = async (id, status) => { await api(`/accounts/${id}`, { method: 'PATCH', body: { status } }); load(); };
  return (
    <div>
      <h2>Customer accounts</h2>
      {msg && <div className="notice">{msg}</div>}
      <table>
        <thead><tr><th>Account</th><th>Plan</th><th>MRR</th><th>Status</th>{role === 'admin' && <th></th>}</tr></thead>
        <tbody>{accounts.map((a) => (
          <tr key={a.id}><td>{a.name}</td><td>{a.plan_name}</td><td>{money(a.price_monthly)}</td>
            <td><span className={`badge ${a.status}`}>{a.status}</span></td>
            {role === 'admin' && <td><button onClick={() => setStatus(a.id, a.status === 'active' ? 'cancelled' : 'active')}>{a.status === 'active' ? 'Cancel' : 'Reactivate'}</button></td>}
          </tr>))}
        </tbody>
      </table>
      {role === 'admin' && (
        <form className="inline" onSubmit={create}>
          <input placeholder="Account name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>
            <option value="">Plan…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price_monthly)}</option>)}
          </select>
          <button type="submit">Add account</button>
        </form>
      )}
    </div>
  );
}

function Billing() {
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState('');
  const load = () => api('/billing/events').then(setEvents).catch(() => {});
  useEffect(() => { load(); }, []);
  const run = async () => {
    try { const r = await api('/billing/run', { method: 'POST', body: {} }); setMsg(`Billing run for ${r.period}: ${r.invoicesCreated} invoices`); load(); }
    catch (ex) { setMsg(ex.message); }
  };
  return (
    <div>
      <h2>Billing</h2>
      {msg && <div className="notice">{msg}</div>}
      <button onClick={run}>Run billing for current period</button>
      <table>
        <thead><tr><th>Period</th><th>Type</th><th>Amount</th><th>Description</th><th>When</th></tr></thead>
        <tbody>{events.map((e) => (
          <tr key={e.id}><td>{e.period}</td><td>{e.event_type}</td><td>{money(e.amount)}</td><td>{e.description}</td><td>{new Date(e.created_at).toLocaleString()}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function MyAccount() {
  const [me, setMe] = useState(null);
  const [acct, setAcct] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api('/auth/me').then((u) => { setMe(u); if (u.account_id) api(`/accounts/${u.account_id}`).then(setAcct).catch(() => {}); });
  }, []);
  const recordUsage = async () => {
    try { await api('/usage', { method: 'POST', body: { metric: 'api_calls', quantity: 1000 } }); setMsg('Recorded 1000 api_calls'); api(`/accounts/${me.account_id}`).then(setAcct); }
    catch (ex) { setMsg(ex.message); }
  };
  if (!acct) return <p className="muted">No account linked to your login.</p>;
  return (
    <div>
      <h2>{acct.name}</h2>
      <p className="muted">Plan {acct.plan_name} · {money(acct.price_monthly)}/month · <span className={`badge ${acct.status}`}>{acct.status}</span></p>
      {msg && <div className="notice">{msg}</div>}
      <button onClick={recordUsage}>Simulate usage (+1000 api_calls)</button>
      <h3>Recent usage</h3>
      <table><thead><tr><th>Metric</th><th>Qty</th><th>When</th></tr></thead>
        <tbody>{acct.usage.slice(0, 8).map((u) => <tr key={u.id}><td>{u.metric}</td><td>{u.quantity.toLocaleString('en-IN')}</td><td>{new Date(u.recorded_at).toLocaleString()}</td></tr>)}</tbody></table>
      <h3>Invoices</h3>
      <table><thead><tr><th>Period</th><th>Amount</th><th>Description</th></tr></thead>
        <tbody>{acct.invoices.map((i) => <tr key={i.id}><td>{i.period}</td><td>{money(i.amount)}</td><td>{i.description}</td></tr>)}</tbody></table>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('overview');
  useEffect(() => { if (getToken()) api('/auth/me').then(setUser).catch(() => setToken(null)); }, []);
  if (!user) return <Login onLogin={setUser} />;

  const isStaff = user.role === 'admin' || user.role === 'analyst';
  const tabs = isStaff ? ['overview', 'accounts', 'billing'] : ['account'];

  return (
    <div className="app">
      <header>
        <div className="brand">Arrowstack <span>Subscription Analytics</span></div>
        <nav>{tabs.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
        <div className="user">{user.name} · <strong>{user.role}</strong><button onClick={() => { setToken(null); setUser(null); }}>Log out</button></div>
      </header>
      <main>
        {tab === 'overview' && <Overview />}
        {tab === 'accounts' && <Accounts role={user.role} />}
        {tab === 'billing' && <Billing />}
        {tab === 'account' && <MyAccount />}
      </main>
    </div>
  );
}
