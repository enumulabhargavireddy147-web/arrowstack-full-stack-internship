import React, { useEffect, useState } from 'react';
import { api, setToken, getToken, money } from './api.js';

function Login({ onLogin }) {
  const [email, setEmail] = useState('buyer@arrowstack.in');
  const [password, setPassword] = useState('Buyer@123');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      onLogin(user);
    } catch (ex) { setErr(ex.message); }
  };
  return (
    <div className="card narrow">
      <h1>Arrowstack B2B Ordering</h1>
      <p className="muted">Sign in to continue</p>
      <form onSubmit={submit}>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <div className="error">{err}</div>}
        <button type="submit">Sign in</button>
      </form>
      <p className="muted small">Demo: buyer@ / seller@ / admin@arrowstack.in</p>
    </div>
  );
}

function Catalogue({ role, onChanged }) {
  const [products, setProducts] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ sku: '', name: '', unit_price: '', stock_qty: '' });
  const load = () => api('/products').then(setProducts).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const addToCart = async (p) => {
    try { await api('/cart/items', { method: 'POST', body: { product_id: p.id, quantity: 1 } }); setMsg(`Added ${p.name}`); onChanged(); }
    catch (e) { setMsg(e.message); }
  };
  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/products', { method: 'POST', body: { ...form, unit_price: Number(form.unit_price), stock_qty: Number(form.stock_qty) } });
      setForm({ sku: '', name: '', unit_price: '', stock_qty: '' });
      setMsg('Product created'); load();
    } catch (e) { setMsg(e.message); }
  };
  return (
    <div>
      <h2>Catalogue</h2>
      {msg && <div className="notice">{msg}</div>}
      <table>
        <thead><tr><th>SKU</th><th>Name</th><th>Price</th><th>Stock</th><th></th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.sku}</td><td>{p.name}</td><td>{money(p.unit_price)}</td>
              <td className={p.stock_qty === 0 ? 'out' : ''}>{p.stock_qty}</td>
              <td>{role === 'buyer' && <button disabled={p.stock_qty === 0} onClick={() => addToCart(p)}>Add to cart</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {role !== 'buyer' && (
        <form className="inline" onSubmit={create}>
          <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Price" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          <input placeholder="Stock" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
          <button type="submit">Add product</button>
        </form>
      )}
    </div>
  );
}

function Cart({ onChanged }) {
  const [cart, setCart] = useState({ items: [], subtotal: 0 });
  const [msg, setMsg] = useState('');
  const load = () => api('/cart').then(setCart).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const remove = async (id) => { await api(`/cart/items/${id}`, { method: 'DELETE' }); load(); onChanged(); };
  const checkout = async () => {
    try { const o = await api('/orders', { method: 'POST' }); setMsg(`Order placed — invoice ${o.invoice.number}`); load(); onChanged(); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <div>
      <h2>Cart</h2>
      {msg && <div className="notice">{msg}</div>}
      {cart.items.length === 0 ? <p className="muted">Cart is empty.</p> : (
        <>
          <table>
            <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Line</th><th></th></tr></thead>
            <tbody>
              {cart.items.map((i) => (
                <tr key={i.id}><td>{i.product_name}</td><td>{i.quantity}</td><td>{money(i.unit_price)}</td><td>{money(i.line_amount)}</td>
                  <td><button onClick={() => remove(i.id)}>Remove</button></td></tr>
              ))}
            </tbody>
          </table>
          <p><strong>Subtotal:</strong> {money(cart.subtotal)} · <strong>GST 18%:</strong> {money(cart.subtotal * 0.18)}</p>
          <button onClick={checkout}>Place order</button>
        </>
      )}
    </div>
  );
}

function Orders({ role }) {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api('/orders').then(setOrders); }, []);
  const setStatus = async (id, status) => { await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } }); api('/orders').then(setOrders); };
  return (
    <div>
      <h2>Orders</h2>
      <table>
        <thead><tr><th>Order</th><th>Status</th><th>Subtotal</th><th>GST</th><th>Total</th>{role !== 'buyer' && <th>Actions</th>}</tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id.slice(0, 8)}</td><td><span className={`badge ${o.status}`}>{o.status}</span></td>
              <td>{money(o.subtotal)}</td><td>{money(o.tax)}</td><td>{money(o.amount)}</td>
              {role !== 'buyer' && (
                <td>
                  <select defaultValue="" onChange={(e) => e.target.value && setStatus(o.id, e.target.value)}>
                    <option value="">Change…</option>
                    {['confirmed', 'shipped', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Admin() {
  const [stats, setStats] = useState(null);
  const [audit, setAudit] = useState([]);
  useEffect(() => { api('/admin/stats').then(setStats).catch(() => {}); api('/admin/audit').then(setAudit).catch(() => {}); }, []);
  return (
    <div>
      <h2>Admin dashboard</h2>
      {stats && (
        <div className="stats">
          <div className="stat"><span>{stats.orderCount}</span><label>Orders</label></div>
          <div className="stat"><span>{money(stats.revenue)}</span><label>Revenue</label></div>
          <div className="stat"><span>{stats.lowStock.length}</span><label>Low stock SKUs</label></div>
        </div>
      )}
      <h3>Recent activity</h3>
      <table>
        <thead><tr><th>When</th><th>Role</th><th>Action</th><th>Entity</th></tr></thead>
        <tbody>{audit.slice(0, 12).map((a) => (
          <tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.actor_role}</td><td>{a.action}</td><td>{a.entity}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('catalogue');
  const [cartCount, setCartCount] = useState(0);
  const refreshCart = () => { if (user?.role === 'buyer') api('/cart').then((c) => setCartCount(c.items.length)).catch(() => {}); };

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me').then(setUser).catch(() => setToken(null));
  }, []);
  useEffect(() => { refreshCart(); }, [user]);

  if (!user) return <Login onLogin={setUser} />;

  const tabs = user.role === 'buyer' ? ['catalogue', 'cart', 'orders']
    : user.role === 'seller' ? ['catalogue', 'orders']
      : ['catalogue', 'orders', 'admin'];

  return (
    <div className="app">
      <header>
        <div className="brand">Arrowstack <span>B2B Ordering</span></div>
        <nav>
          {tabs.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}{t === 'cart' && cartCount ? ` (${cartCount})` : ''}
            </button>
          ))}
        </nav>
        <div className="user">
          {user.name} · <strong>{user.role}</strong>
          <button onClick={() => { setToken(null); setUser(null); }}>Log out</button>
        </div>
      </header>
      <main>
        {tab === 'catalogue' && <Catalogue role={user.role} onChanged={refreshCart} />}
        {tab === 'cart' && <Cart onChanged={refreshCart} />}
        {tab === 'orders' && <Orders role={user.role} />}
        {tab === 'admin' && <Admin />}
      </main>
    </div>
  );
}
