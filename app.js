/* ============================================================
   研倍 · 材料贸易工作台 —— 交互逻辑
   ============================================================ */
const App = (function () {
  const D = window.WB;
  const LS = 'yanbei_wb_v1';

  const USERS = {
    lily: { id: 'lily', name: 'Lily', role: '老板 · 主账户', av: 'LY', perms: { cost: 1, sell: 1, profit: 1, edit: 1, all: 1 } },
    xiaowang: { id: 'xiaowang', name: '王子涵', role: '业务员', av: '王', perms: { cost: 1, sell: 1, profit: 0, edit: 1, own: 1 } },
    caiwu: { id: 'caiwu', name: '财务', role: '财务 · 只读', av: '财', perms: { cost: 1, sell: 1, profit: 1, edit: 0 } }
  };

  const state = { user: null, route: 'dash', f: {}, pc: { q: '', pid: '' } };

  /* ---------------- 工具 ---------------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '¥' + (Math.abs(n) >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.round(n).toLocaleString('zh-CN'));
  const yuan = n => '¥' + Math.round(n).toLocaleString('zh-CN');
  const num = n => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const pct = n => (n * 100).toFixed(1) + '%';
  const P = id => D.PRODUCTS.find(x => x.id === id) || {};
  const C = id => D.CUSTOMERS.find(x => x.id === id) || { name: '—' };
  const S = id => D.SUPPLIERS.find(x => x.id === id) || { name: '—' };
  const can = k => !!(state.user && state.user.perms[k]);
  const today = () => D.meta.today;
  const dBefore = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - n); const m = x.getMonth() + 1, dd = x.getDate(); return x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2200);
  }

  const ROLE_PERMS = {
    owner: { cost: 1, sell: 1, profit: 1, edit: 1, all: 1 },
    sales: { cost: 1, sell: 1, profit: 0, edit: 1, own: 1 },
    finance: { cost: 1, sell: 1, profit: 1, edit: 0 }
  };
  const ROLE_LABEL = { owner: '老板 · 主账户', sales: '业务员', finance: '财务 · 只读' };

  /* ---------------- 云服务 ---------------- */
  const CLOUD = window.CloudStore || null;
  const CLOUD_MODE = !!(CLOUD && CLOUD.ready);

  function payload() {
    return {
      PRODUCTS: D.PRODUCTS, SUPPLIERS: D.SUPPLIERS, CUSTOMERS: D.CUSTOMERS,
      sales: D.sales, stockFlows: D.stockFlows, quotes: D.quotes,
      inquiries: D.inquiries, initStock: D.initStock
    };
  }

  function applyCloud(d) {
    if (d.products && d.products.length) D.PRODUCTS = d.products;
    if (d.suppliers && d.suppliers.length) D.SUPPLIERS = d.suppliers;
    if (d.customers && d.customers.length) D.CUSTOMERS = d.customers;
    D.sales = d.sales || [];
    D.stockFlows = d.stockFlows || [];
    D.quotes = d.quotes || [];
    D.inquiries = d.inquiries || [];
    const base = {};
    D.PRODUCTS.forEach(p => { base[p.id] = (d.initStock && d.initStock[p.id]) || { qty: 0, cost: 0 }; });
    D.initStock = base;
    recomputeStock();
  }

  function save() {
    try { localStorage.setItem(LS, JSON.stringify(payload())); } catch (e) { }
  }
  function load() {
    try {
      const c = JSON.parse(localStorage.getItem(LS) || 'null');
      if (c && c.PRODUCTS) {
        D.PRODUCTS = c.PRODUCTS; D.SUPPLIERS = c.SUPPLIERS || D.SUPPLIERS;
        D.CUSTOMERS = c.CUSTOMERS || D.CUSTOMERS; D.sales = c.sales || D.sales;
        D.stockFlows = c.stockFlows || D.stockFlows; D.quotes = c.quotes || D.quotes;
        D.inquiries = c.inquiries || D.inquiries; D.initStock = c.initStock || D.initStock;
      }
    } catch (e) { }
    recomputeStock();
  }

  function updateBadge(s) {
    const el = document.getElementById('syncBadge');
    if (!el) return;
    const map = {
      local: ['本机演示', '#f1f5f9', '#6b7a8d'],
      syncing: ['写入中…', '#fdf4e3', '#b07d2b'],
      online: ['已连接云端', '#e6f4ee', '#1a7a58'],
      offline: ['未登录', '#f1f5f9', '#6b7a8d'],
      error: ['云端异常', '#fbecea', '#bf3b2b']
    };
    const m = map[s] || map.local;
    el.textContent = m[0];
    el.style.background = m[1];
    el.style.color = m[2];
  }

  function reset() { localStorage.removeItem(LS); location.reload(); }

  function recomputeStock() {
    const st = {};
    D.PRODUCTS.forEach(p => {
      const b = D.initStock[p.id] || { qty: 0, cost: 0 };
      st[p.id] = { qty: Number(b.qty) || 0, cost: Number(b.cost) || 0 };
    });
    D.stockFlows.slice().sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : (a.date < b.date ? -1 : 1))).forEach(f => {
      const t = st[f.pid]; if (!t) return;
      const q = Number(f.qty) || 0, pr = Number(f.price) || 0;
      if (f.type === '入库') { t.cost = (t.qty * t.cost + q * pr) / Math.max(1, t.qty + q); t.qty += q; }
      else { t.qty -= q; }
    });
    D.stock = D.PRODUCTS.map(p => ({
      pid: p.id, qty: st[p.id].qty, cost: Math.round(st[p.id].cost * 100) / 100,
      amount: Math.round(st[p.id].qty * st[p.id].cost)
    }));
  }
  const stk = pid => D.stock.find(s => s.pid === pid) || { qty: 0, cost: 0, amount: 0 };

  function nextId(prefix) {
    return prefix + String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 900) + 100);
  }

  /* ---------------- 登录 ---------------- */
  function enterApp() {
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderNav();
    go('dash');
  }

  function userFromRole(name, role) {
    return {
      id: name, name: name, roleKey: role,
      role: ROLE_LABEL[role] || role,
      av: String(name || '?').slice(0, 1),
      perms: ROLE_PERMS[role] || ROLE_PERMS.sales
    };
  }

  let otpChallenge = null;
  const lgErr = msg => { const el = $('#lgErr'); if (el) el.textContent = msg || ''; };
  const clearErr = () => lgErr('');

  async function sendCode() {
    if (!CLOUD_MODE) { toast('演示模式无需验证码'); return; }
    const phone = (($('#lgPhone') || {}).value || '').trim();
    if (!/^1\d{10}$/.test(phone)) { lgErr('请输入正确的 11 位手机号'); return; }
    lgErr('');
    const btn = $('#lgSend');
    if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }
    try {
      const d = await CLOUD.sendOtp(phone);
      otpChallenge = { phone, verificationId: d.verificationId, isExistingUser: d.isExistingUser };
      toast('验证码已发送');
      let n = 60;
      const timer = setInterval(() => {
        if (!btn) { clearInterval(timer); return; }
        n -= 1;
        if (n <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = '获取验证码'; }
        else { btn.textContent = n + ' 秒后重发'; }
      }, 1000);
    } catch (e) {
      lgErr(e.message || '验证码发送失败');
      if (btn) { btn.disabled = false; btn.textContent = '获取验证码'; }
    }
  }

  async function loginPhone() {
    if (!CLOUD_MODE) { return loginDemo(); }
    const phone = (($('#lgPhone') || {}).value || '').trim();
    const code = (($('#lgCode') || {}).value || '').trim();
    if (!/^1\d{10}$/.test(phone)) { lgErr('请输入正确的 11 位手机号'); return; }
    if (!code) { lgErr('请输入验证码'); return; }
    if (!otpChallenge || otpChallenge.phone !== phone) { lgErr('请先获取该手机号的验证码'); return; }
    lgErr('');
    updateBadge('syncing');
    try {
      await CLOUD.verifyOtp(phone, otpChallenge.verificationId, otpChallenge.isExistingUser, code);
      otpChallenge = null;
      await afterLogin();
    } catch (e) { updateBadge('error'); lgErr(e.message || '登录失败'); }
  }

  async function loginWorkBuddy() {
    if (!CLOUD_MODE) { toast('演示模式不支持该登录方式'); return; }
    lgErr('');
    try { await CLOUD.signInWithWorkBuddy(); }
    catch (e) { lgErr(e.message || 'WorkBuddy 登录发起失败'); }
  }

  async function afterLogin() {
    const sess = await CLOUD.getSession();
    const u = CLOUD.sessionUser(sess);
    const displayName = (u && (u.name || u.nickname || u.email)) || '未命名';
    const staff = await CLOUD.ensureStaff(displayName);
    state.user = userFromRole(staff.name || displayName, staff.role);
    const seeded = await CLOUD.seedIfEmpty(payload());
    applyCloud(await CLOUD.loadAll());
    updateBadge('online');
    enterApp();
    toast(seeded.seeded ? '云端空库，已写入演示数据' : ('已连接云端 · 身份：' + state.user.role));
  }

  function loginDemo() {
    const u = (($('#lgUser') || {}).value || '').trim().toLowerCase();
    if (!USERS[u]) { toast('账号不存在，请用演示账号 lily / xiaowang / caiwu'); return; }
    state.user = USERS[u];
    enterApp();
  }

  async function logout() {
    if (CLOUD_MODE) await CLOUD.signOut();
    state.user = null;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    updateBadge(CLOUD_MODE ? 'offline' : 'local');
  }

  async function tryAutoLogin() {
    if (!CLOUD_MODE) return;
    try {
      const sess = await CLOUD.getSession();
      if (!CLOUD.sessionUser(sess)) { updateBadge('offline'); return; }
      await afterLogin();
      toast('已恢复上次登录');
    } catch (e) { updateBadge('offline'); }
  }

  /* ---------------- 导航 ---------------- */
  const NAV = [
    { g: '业务', items: [{ k: 'dash', t: '数据看板', ic: '▤' }, { k: 'price', t: '智能查价', ic: '⌕' }] },
    { g: '台账', items: [{ k: 'stock', t: '库存管理', ic: '▦' }, { k: 'sales', t: '销售管理', ic: '◫' }, { k: 'purchase', t: '采购价格', ic: '◈' }] },
    { g: '客户', items: [{ k: 'customers', t: '客户档案', ic: '◉' }, { k: 'inquiry', t: '询价记录', ic: '✎' }] },
    { g: '系统', items: [{ k: 'settings', t: '权限与数据导入', ic: '⚙' }] }
  ];
  const TITLES = { dash: '数据看板', price: '智能查价', stock: '库存管理', sales: '销售管理', purchase: '采购价格', customers: '客户档案', inquiry: '询价记录', settings: '权限与数据导入' };

  function renderNav() {
    const lowN = D.stock.filter(s => s.qty < P(s.pid).safety).length;
    const folN = followUps().length;
    $('#nav').innerHTML = NAV.map(grp => `
      <div class="nav-group">${grp.g}</div>
      ${grp.items.map(it => {
        let cnt = '';
        if (it.k === 'stock' && lowN) cnt = `<span class="cnt">${lowN}</span>`;
        if (it.k === 'inquiry' && folN) cnt = `<span class="cnt">${folN}</span>`;
        return `<a class="${state.route === it.k ? 'active' : ''}" onclick="App.go('${it.k}')"><span class="ic">${it.ic}</span>${it.t}${cnt}</a>`;
      }).join('')}`).join('');
    $('#sideUser').innerHTML = `
      <div class="avatar">${state.user.av}</div>
      <div style="flex:1;min-width:0">
        <div class="nm">${state.user.name}</div>
        <div class="rl">${state.user.role}</div>
      </div>
      <span style="font-size:11px;color:#77869a;cursor:pointer" onclick="App.logout()">退出</span>`;
  }

  function go(k) {
    state.route = k;
    $('#pageTitle').textContent = TITLES[k] || '';
    $('#pageCrumb').textContent = '上海研倍 / ' + (TITLES[k] || '');
    renderNav();
    const v = $('#view');
    const map = { dash: viewDash, price: viewPrice, stock: viewStock, sales: viewSales, purchase: viewPurchase, customers: viewCustomers, inquiry: viewInquiry, settings: viewSettings };
    v.innerHTML = (map[k] || viewDash)();
    window.scrollTo(0, 0);
  }

  /* ---------------- 权限视角的数据 ---------------- */
  function mySales() {
    return can('all') || can('profit') ? D.sales : D.sales.filter(s => s.owner === state.user.name);
  }
  function followUps() {
    const t = today();
    return D.inquiries.filter(i => i.followUp && i.followUp <= t && (i.result === '跟进中' || i.result === '待报价'));
  }

  /* ---------------- 图表 ---------------- */
  function svgBars(data, opt) {
    opt = opt || {};
    const H = opt.h || 160, W = 560, pad = 26;
    const max = Math.max.apply(null, data.map(d => d.v).concat([1]));
    const gap = (W - pad * 2) / Math.max(1, data.length);
    const bw = Math.min(34, gap * 0.54);
    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
    s += `<line x1="${pad}" y1="${H - 26}" x2="${W - pad}" y2="${H - 26}" stroke="#e6ecf3"/>`;
    data.forEach((d, i) => {
      const bh = Math.max(2, (H - 52) * d.v / max);
      const x = pad + i * gap + (gap - bw) / 2, y = H - 26 - bh;
      s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="${opt.color || '#1a6ea8'}" opacity="${i === data.length - 1 ? 1 : .62}"><title>${esc(d.l)}：${esc(d.t || d.v)}</title></rect>`;
      s += `<text x="${x + bw / 2}" y="${H - 10}" font-size="10" fill="#8b98a8" text-anchor="middle">${esc(d.l)}</text>`;
      if (d.v > 0) s += `<text x="${x + bw / 2}" y="${y - 5}" font-size="9.5" fill="#6b7a8d" text-anchor="middle">${esc(d.t || '')}</text>`;
    });
    s += '</svg>';
    return s;
  }

  function svgLine(data, opt) {
    opt = opt || {};
    const H = 130, W = 520, pad = 30;
    const vs = data.map(d => d.v);
    const max = Math.max.apply(null, vs), min = Math.min.apply(null, vs);
    const rg = Math.max(1, max - min);
    const step = (W - pad * 2) / Math.max(1, data.length - 1);
    const pts = data.map((d, i) => [pad + i * step, H - 26 - (H - 46) * (d.v - min) / rg]);
    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
    s += `<polyline points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="#1a6ea8" stroke-width="2" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => {
      s += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#fff" stroke="#1a6ea8" stroke-width="2"><title>${esc(data[i].l)}：${esc(data[i].t)}</title></circle>`;
      s += `<text x="${p[0]}" y="${H - 8}" font-size="9.5" fill="#8b98a8" text-anchor="middle">${esc(data[i].l)}</text>`;
    });
    s += '</svg>';
    return s;
  }

  /* ================= 1. 数据看板 ================= */
  function viewDash() {
    const t = today(), m0 = t.slice(0, 8) + '01';
    const ms = mySales();
    const monthSales = ms.filter(s => s.date >= m0);
    const amt = monthSales.reduce((a, s) => a + s.amount, 0);
    const cost = monthSales.reduce((a, s) => a + s.qty * s.cost, 0);
    const profit = amt - cost;
    const stockAmt = D.stock.reduce((a, s) => a + s.amount, 0);
    const low = D.stock.filter(s => s.qty < P(s.pid).safety);
    const mInq = D.inquiries.filter(i => i.date >= m0);
    const won = mInq.filter(i => i.result === '已成交').length;

    // 近 8 周销售
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const end = dBefore(t, i * 7), start = dBefore(t, i * 7 + 6);
      const sum = ms.filter(s => s.date >= start && s.date <= end).reduce((a, s) => a + s.amount, 0);
      weeks.push({ l: (i === 0 ? '本周' : '-' + i + '周'), v: sum, t: (sum / 10000).toFixed(0) + '万' });
    }

    // 库存 TOP5
    const top = D.stock.slice().sort((a, b) => b.amount - a.amount).slice(0, 5);
    const topMax = Math.max.apply(null, top.map(x => x.amount).concat([1]));

    // 价格异动：同产品近两笔报价对比
    const moves = [];
    D.PRODUCTS.forEach(p => {
      const qs = D.quotes.filter(q => q.pid === p.id).sort((a, b) => (a.date < b.date ? 1 : -1));
      if (qs.length >= 2 && qs[0].date >= dBefore(t, 21)) {
        const ch = (qs[0].price - qs[1].price) / qs[1].price;
        if (Math.abs(ch) > 0.015) moves.push({ p, last: qs[0], prev: qs[1], ch });
      }
    });
    moves.sort((a, b) => Math.abs(b.ch) - Math.abs(a.ch));

    return `
    <div class="page-head">
      <div><h1>数据看板</h1><p>${t} · ${state.user.name} 视角${can('all') ? '' : '（按权限过滤）'}</p></div>
      <div class="actions"><button class="btn ghost sm" onclick="App.go('price')">⌕ 查个价格</button></div>
    </div>

    <div class="grid g4" style="margin-bottom:14px">
      <div class="kpi">
        <div class="lb">库存总值</div>
        <div class="vl">${money(stockAmt)}<small>/ ${D.PRODUCTS.length} 个SKU</small></div>
        <div class="ft">${low.length ? `<span class="chip bad">${low.length} 个低于安全库存</span>` : '<span class="chip good">库存水位正常</span>'}</div>
      </div>
      <div class="kpi gold">
        <div class="lb">本月销售额</div>
        <div class="vl">${money(amt)}<small>${monthSales.length} 单</small></div>
        <div class="ft">均价 ${amt && monthSales.length ? yuan(amt / monthSales.length) : '—'} / 单</div>
      </div>
      <div class="kpi good">
        <div class="lb">本月毛利</div>
        <div class="vl">${money(profit)}<small>${amt ? pct(profit / amt) : '—'}</small></div>
        <div class="ft"><span class="chip good">成本 ${money(cost)}</span></div>
      </div>
      <div class="kpi bad">
        <div class="lb">本月询价 / 成交率</div>
        <div class="vl">${mInq.length}<small>单询价</small></div>
        <div class="ft">${mInq.length ? `成交 ${won} 单 · ${pct(won / mInq.length)}` : '本月暂无询价'}　${followUps().length ? `<span class="chip warn">${followUps().length} 条待跟进</span>` : ''}</div>
      </div>
    </div>

    <div class="grid g-2-1" style="margin-bottom:14px">
      <div class="card">
        <div class="card-h"><h3>近 8 周销售趋势</h3><span class="tag">${can('profit') ? '含全部业务员' : '仅我的客户'}</span>
          <span class="more" onclick="App.go('sales')">销售明细 →</span></div>
        <div class="card-b">${svgBars(weeks, { h: 170 })}</div>
      </div>
      <div class="card">
        <div class="card-h"><h3>库存金额 TOP5</h3><span class="more" onclick="App.go('stock')">库存 →</span></div>
        <div class="card-b">
          ${top.map(x => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
              <div style="width:104px;font-size:12.5px;line-height:1.3">
                <div style="font-weight:500">${esc(P(x.pid).name)}</div>
                <div class="sub-txt">${esc(P(x.pid).spec)}</div>
              </div>
              <div class="bar" style="flex:1"><i style="width:${Math.max(4, x.amount / topMax * 100)}%"></i></div>
              <div style="width:74px;text-align:right;font-size:12.5px;font-weight:500">${money(x.amount)}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="grid g3">
      <div class="card">
        <div class="card-h"><h3>低库存预警</h3><span class="tag">${low.length} 项</span></div>
        <div class="card-b" style="padding-top:6px">
          ${low.length ? low.slice(0, 4).map(s => {
            const p = P(s.pid);
            return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eef2f6;font-size:12.5px">
              <span>${esc(p.name)} <span class="muted">${esc(p.spec)}</span></span>
              <span class="chip bad">剩 ${num(s.qty)} 吨</span></div>`;
          }).join('') : '<div class="blank" style="padding:24px 0">库存水位正常</div>'}
          ${low.length > 4 ? `<div style="padding-top:9px;font-size:12px;color:#1a6ea8;cursor:pointer" onclick="App.go('stock')">查看全部 ${low.length} 项 →</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>待跟进询价</h3><span class="tag">到期待跟进</span><span class="more" onclick="App.go('inquiry')">全部 →</span></div>
        <div class="card-b" style="padding-top:6px">
          ${followUps().length ? followUps().slice(0, 4).map(i => `
            <div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px dashed #eef2f6;font-size:12.5px">
              <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(C(i.cid).name)} · ${esc(P(i.pid).name)}</span>
              <span class="chip warn" style="flex:none">${esc(i.followUp)}</span></div>`).join('')
        : '<div class="blank" style="padding:24px 0">暂无到期跟进</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>供应商报价异动</h3><span class="tag">近 3 周</span></div>
        <div class="card-b" style="padding-top:6px">
          ${moves.length ? moves.slice(0, 4).map(m => `
            <div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px dashed #eef2f6;font-size:12.5px">
              <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.p.name)} <span class="muted">${esc(S(m.last.sid).name)}</span></span>
              <span class="${m.ch > 0 ? 'up' : 'down'}" style="flex:none;font-weight:600">${m.ch > 0 ? '↑' : '↓'}${Math.abs(m.ch * 100).toFixed(1)}%</span>
            </div>`).join('') : '<div class="blank" style="padding:24px 0">近期报价平稳</div>'}
        </div>
      </div>
    </div>`;
  }

  /* ================= 2. 智能查价 ================= */
  function viewPrice(current) {
    const q = state.pc.q || '';
    return `
    <div class="pc-hero">
      <h3>问一句，把价格说出来</h3>
      <p>输入产品名称或关键词，直接得到：成本价 · 历史成交价 · 各供应商最新报价 · 建议报价区间</p>
      <div class="pc-input">
        <input id="pcQ" placeholder="例如：铁粉多少钱 / 钛白粉 / 硫酸钡" value="${esc(q)}"
               onkeydown="if(event.key==='Enter')App.doPrice(this.value)">
        <button onclick="App.doPrice(document.getElementById('pcQ').value)">查价</button>
      </div>
      <div class="pc-tips">
        ${['铁粉', '钛白粉', '氧化铁红', '硫酸钡', '锌粉', '碳酸钙'].map(k => `<span onclick="App.doPrice('${k}')">${k}</span>`).join('')}
      </div>
    </div>
    <div class="pc-result">${current || (q ? priceResult(q) : priceEmpty())}</div>`;
  }

  function priceEmpty() {
    const recent = D.quotes.slice(0, 6);
    return `<div class="card" style="margin-top:14px">
      <div class="card-h"><h3>最近收到的报价</h3><span class="tag">来自微信群 / 电话 / 邮件</span>
        <span class="more" onclick="App.go('purchase')">采购价格 →</span></div>
      <div class="card-b" style="padding-top:8px">
        <ul class="timeline">${recent.map(q => `<li>
          <span class="d">${esc(q.date)}</span>
          <span style="flex:1">${esc(P(q.pid).name)} ${esc(P(q.pid).spec)} <span class="muted">· ${esc(S(q.sid).name)}</span></span>
          <span class="p">${yuan(q.price)}<span class="muted" style="font-weight:400">/吨</span></span>
        </li>`).join('')}</ul>
      </div></div>`;
  }

  function matchProducts(q) {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return D.PRODUCTS.filter(p =>
      (p.name + p.spec + p.cat + p.code).toLowerCase().indexOf(s) >= 0 ||
      (s === '铁粉' && p.cat === '铁粉')
    );
  }

  function priceResult(q) {
    const list = matchProducts(q);
    if (!list.length) {
      return `<div class="card" style="margin-top:14px"><div class="blank"><span class="big">⌕</span>
        没找到「${esc(q)}」对应的产品<br><span class="sub-txt">可试：铁粉、钛白粉、氧化铁红、硫酸钡、锌粉、碳酸钙</span></div></div>`;
    }
    if (list.length > 1) {
      return `<div class="card" style="margin-top:14px">
        <div class="card-h"><h3>「${esc(q)}」匹配到 ${list.length} 个产品</h3></div>
        <div class="card-b" style="padding-top:8px">
          ${list.map(p => `<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px dashed #eef2f6">
            <div style="flex:1">
              <div style="font-weight:500">${esc(p.name)} <span class="muted">${esc(p.spec)}</span></div>
              <div class="sub-txt">${esc(p.code)} · ${esc(p.cat)} · 库存 ${num(stk(p.id).qty)} 吨</div>
            </div>
            <div style="text-align:right;margin-right:8px">
              <div class="sub-txt">加权成本</div>
              <div style="font-weight:600">${yuan(stk(p.id).cost)}</div>
            </div>
            <button class="btn sm ghost" onclick="App.doPrice('${esc(p.name)}')">看价格</button>
          </div>`).join('')}
        </div></div>`;
    }
    return priceCard(list[0]);
  }

  function priceCard(p) {
    const s = stk(p.id);
    const qs = D.quotes.filter(x => x.pid === p.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    const valid = qs.filter(x => new Date(x.date + 'T00:00:00') >= new Date(dBefore(today(), 45) + 'T00:00:00'));
    const px = valid.length ? valid : qs.slice(0, 6);
    const lowQuote = px.slice().sort((a, b) => a.price - b.price)[0];
    const mySalesP = mySales().filter(x => x.pid === p.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    const avg30 = mySalesP.filter(x => x.date >= dBefore(today(), 30));
    const avgPrice = avg30.length ? avg30.reduce((a, x) => a + x.amount, 0) / avg30.reduce((a, x) => a + x.qty, 0) : 0;
    const sellLow = 1.2, sellHigh = 1.3;
    const custFocus = {};
    mySalesP.slice(0, 20).forEach(x => { custFocus[x.cid] = custFocus[x.cid] || { n: 0, amt: 0, last: x }; custFocus[x.cid].n++; custFocus[x.cid].amt += x.amount; });

    return `<div class="card" style="margin-top:14px">
      <div class="card-h"><h3>${esc(p.name)} <span class="muted" style="font-weight:400">${esc(p.spec)}</span></h3>
        <span class="chip brand">${esc(p.code)}</span>
        <span class="more" onclick="App.go('purchase')">全部报价 →</span></div>
      <div class="card-b">
        <div class="price-hero">
          <div>
            <div class="it">当前加权成本</div>
            <div class="big">${s.cost ? yuan(s.cost) : '暂无'}<small>/吨</small></div>
          </div>
          <div class="it">最近成交均价 <b>${avgPrice ? yuan(avgPrice) : '近30天无成交'}</b></div>
          <div class="it">库存 <b>${num(s.qty)} 吨</b></div>
          <div class="it">安全库存 <b>${P(p.id).safety} 吨</b></div>
          <div class="it">供应商最低报价 <b>${lowQuote ? yuan(lowQuote.price) : '—'}</b></div>
        </div>

        <div class="suggest-box">
          <div>
            <div class="t">建议报价区间（成本 × 1.20 ~ 1.30）</div>
            <div style="display:flex;gap:14px;align-items:baseline">
              <div class="v">${s.cost ? yuan(s.cost * sellLow) : '—'} ~ ${s.cost ? yuan(s.cost * sellHigh) : '—'}</div>
              <span class="sub-txt">/ 吨</span>
            </div>
          </div>
          <div style="border-left:1px solid #cfe3f1;padding-left:20px">
            <div class="t">若按最低供应商报价进货</div>
            <div class="v" style="font-size:16px">${lowQuote ? '毛利空间 ' + pct((s.cost - lowQuote.price) / s.cost) : '—'}</div>
          </div>
        </div>

        <div class="grid g2" style="margin-top:18px">
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:8px">供应商最新报价</div>
            <div class="tbl-wrap"><table>
              <thead><tr><th>供应商</th><th class="r">报价</th><th class="r">起订</th><th>日期</th><th>来源</th></tr></thead>
              <tbody>${px.slice(0, 6).map(x => `
                <tr><td>${esc(S(x.sid).name)} ${x.price === (lowQuote && lowQuote.price) ? '<span class="chip good">最低</span>' : ''}</td>
                <td class="r strong">${yuan(x.price)}</td><td class="r">${x.moq} 吨</td>
                <td class="muted">${esc(x.date)}</td><td class="muted">${esc(x.source)}</td></tr>`).join('')}
              </tbody></table></div>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:8px">成交历史 ${can('sell') ? '' : '<span class="chip">无权限</span>'}</div>
            ${can('sell') ? (mySalesP.length ? `<div class="tbl-wrap"><table>
              <thead><tr><th>日期</th><th>客户</th><th class="r">数量</th><th class="r">成交价</th>${can('profit') ? '<th class="r">毛利率</th>' : ''}</tr></thead>
              <tbody>${mySalesP.slice(0, 6).map(x => `<tr>
                <td class="muted">${esc(x.date)}</td><td>${esc(C(x.cid).name)}</td>
                <td class="r">${num(x.qty)} 吨</td><td class="r strong">${yuan(x.price)}</td>
                ${can('profit') ? `<td class="r"><span class="chip ${(x.price - x.cost) / x.price > .2 ? 'good' : ''}">${pct((x.price - x.cost) / x.price)}</span></td>` : ''}
              </tr>`).join('')}</tbody></table></div>`
              : `<div class="blank" style="padding:30px 0">该产品暂无成交记录</div>`)
        : `<div class="blank" style="padding:30px 0">当前角色不可查看销售价</div>`}
          </div>
        </div>

        ${px.length >= 3 ? `<div style="margin-top:18px">
          <div style="font-size:13px;font-weight:600;margin-bottom:4px">供应商报价走势 <span class="sub-txt">（按日期，¥/吨）</span></div>
          ${svgLine(px.slice(0, 7).reverse().map(x => ({ l: x.date.slice(5), v: x.price, t: yuan(x.price) })))}
        </div>` : ''}
      </div>
    </div>`;
  }

  function doPrice(q) {
    state.pc.q = q;
    $('#view').innerHTML = viewPrice(priceResult(q));
  }
  function globalSearch(q) {
    if (!q || !q.trim()) return;
    state.pc.q = q; state.route = 'price';
    $('#pageTitle').textContent = TITLES.price;
    $('#pageCrumb').textContent = '上海研倍 / 智能查价';
    renderNav();
    $('#view').innerHTML = viewPrice(priceResult(q));
  }

  /* ================= 3. 库存管理 ================= */
  function viewStock() {
    const kw = (state.f.stockKw || '').trim();
    const cat = state.f.stockCat || '';
    let rows = D.stock.map(s => ({ ...s, p: P(s.pid) }));
    if (cat) rows = rows.filter(r => r.p.cat === cat);
    if (kw) rows = rows.filter(r => (r.p.name + r.p.spec + r.p.code).indexOf(kw) >= 0);
    const totalAmt = D.stock.reduce((a, s) => a + s.amount, 0);
    const totalQty = D.stock.reduce((a, s) => a + s.qty, 0);
    const low = D.stock.filter(s => s.qty < P(s.pid).safety);
    const cats = [...new Set(D.PRODUCTS.map(p => p.cat))];
    const flows = D.stockFlows.slice().reverse().slice(0, 12);

    return `
    <div class="page-head">
      <div><h1>库存管理</h1><p>今天进多少、出多少、还剩多少，全部从流水自动汇总</p></div>
      <div class="actions">
        ${can('edit') ? `<button class="btn ghost sm" onclick="App.modalFlow('入库')">＋ 入库</button>
        <button class="btn ghost sm" onclick="App.modalFlow('出库')">－ 出库</button>` : '<span class="chip">只读账号</span>'}
        <button class="btn sm" onclick="App.modalSale()">＋ 销售出库</button>
      </div>
    </div>

    <div class="grid g4" style="margin-bottom:14px">
      <div class="kpi"><div class="lb">库存总值</div><div class="vl">${money(totalAmt)}</div><div class="ft">${D.PRODUCTS.length} 个 SKU</div></div>
      <div class="kpi"><div class="lb">库存总量</div><div class="vl">${num(Math.round(totalQty))}<small>吨</small></div><div class="ft">跨 ${cats.length} 个品类</div></div>
      <div class="kpi ${low.length ? 'bad' : 'good'}"><div class="lb">低于安全库存</div><div class="vl">${low.length}<small>项</small></div><div class="ft">${low.length ? '建议本周补货' : '水位正常'}</div></div>
      <div class="kpi gold"><div class="lb">本月出入库笔数</div><div class="vl">${D.stockFlows.filter(f => f.date >= today().slice(0, 8) + '01').length}<small>笔</small></div><div class="ft">流水可追溯</div></div>
    </div>

    <div class="filters">
      <input class="grow" id="kwStock" placeholder="搜索产品名称 / 编码" value="${esc(kw)}" oninput="App.fStock(this.value)">
      <select onchange="App.fStockCat(this.value)">
        <option value="">全部品类</option>
        ${cats.map(c => `<option value="${esc(c)}" ${c === cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <span class="sub-txt">共 ${rows.length} 条</span>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="tbl-wrap"><table>
        <thead><tr>
          <th>产品</th><th>品类</th><th class="r">库存量</th><th>水位</th>
          <th class="r">加权成本</th><th class="r">库存金额</th><th class="r">安全库存</th><th class="c">状态</th>
        </tr></thead>
        <tbody>${rows.length ? rows.map(r => {
          const ratio = Math.min(1, r.qty / Math.max(1, r.p.safety * 2));
          const cls = r.qty < r.p.safety ? 'low' : (r.qty < r.p.safety * 1.3 ? 'mid' : '');
          const txt = r.qty < r.p.safety ? '低于安全线' : (r.qty < r.p.safety * 1.3 ? '偏低' : '充足');
          return `<tr>
            <td><div class="strong">${esc(r.p.name)}</div><div class="sub-txt">${esc(r.p.code)} · ${esc(r.p.spec)}</div></td>
            <td class="muted">${esc(r.p.cat)}</td>
            <td class="r strong">${num(r.qty)} <span class="muted" style="font-weight:400">吨</span></td>
            <td><div class="bar ${cls}"><i style="width:${Math.max(3, ratio * 100)}%"></i></div></td>
            <td class="r">${yuan(r.cost)}</td>
            <td class="r strong">${money(r.amount)}</td>
            <td class="r muted">${r.p.safety}</td>
            <td class="c"><span class="chip ${r.qty < r.p.safety ? 'bad' : (r.qty < r.p.safety * 1.3 ? 'warn' : 'good')}">${txt}</span></td>
          </tr>`;
        }).join('') : '<tr><td colspan="8" class="blank">没有匹配的产品</td></tr>'}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-h"><h3>最近出入库流水</h3><span class="tag">每笔都可追溯到单据号与经手人</span>
        <span class="more" onclick="App.go('stock')">刷新</span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>日期</th><th>类型</th><th>产品</th><th class="r">数量</th><th class="r">单价</th><th>往来单位</th><th>单据号</th><th>经手</th></tr></thead>
        <tbody>${flows.map(f => `<tr>
          <td class="muted">${esc(f.date)}</td>
          <td><span class="chip ${f.type === '入库' ? 'brand' : 'warn'}">${esc(f.type)}</span></td>
          <td>${esc(P(f.pid).name)} <span class="muted">${esc(P(f.pid).spec)}</span></td>
          <td class="r ${f.type === '入库' ? '' : 'strong'}">${f.type === '入库' ? '+' : '−'}${num(f.qty)} 吨</td>
          <td class="r">${yuan(f.price)}</td>
          <td class="muted">${esc(f.partner)}</td>
          <td class="mono">${esc(f.ref)}</td>
          <td class="muted">${esc(f.operator)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }
  function refocus(id) {
    const el = document.getElementById(id);
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { } }
  }
  function fStock(v) { state.f.stockKw = v; go('stock'); refocus('kwStock'); }
  function fStockCat(v) { state.f.stockCat = v; go('stock'); }

  /* ================= 4. 销售管理 ================= */
  function viewSales() {
    const days = state.f.saleDays === undefined ? 30 : state.f.saleDays;
    const from = days === 0 ? '2000-01-01' : dBefore(today(), days);
    const kw = (state.f.saleKw || '').trim();
    let rows = mySales().filter(s => s.date >= from);
    if (kw) rows = rows.filter(s => (C(s.cid).name + P(s.pid).name).indexOf(kw) >= 0);
    const amt = rows.reduce((a, s) => a + s.amount, 0);
    const cost = rows.reduce((a, s) => a + s.qty * s.cost, 0);
    const profit = amt - cost;
    const showProfit = can('profit');

    return `
    <div class="page-head">
      <div><h1>销售管理</h1><p>${can('all') ? '全部业务员' : '仅显示我录入的销售单'} · 成本按出库时加权平均自动带出</p></div>
      <div class="actions"><button class="btn sm" onclick="App.modalSale()">＋ 登记销售</button></div>
    </div>

    ${!can('profit') ? `<div class="notice">🔒 当前身份为业务员，销售价与毛利不对其他业务员公开；仅可查看本人在此录入的销售单。</div>` : ''}

    <div class="grid g4" style="margin-bottom:14px">
      <div class="kpi"><div class="lb">销售额</div><div class="vl">${money(amt)}</div><div class="ft">${rows.length} 单</div></div>
      <div class="kpi gold"><div class="lb">成本合计</div><div class="vl">${money(cost)}</div><div class="ft">按加权平均成本</div></div>
      ${showProfit ? `<div class="kpi good"><div class="lb">毛利</div><div class="vl">${money(profit)}</div><div class="ft">毛利率 ${amt ? pct(profit / amt) : '—'}</div></div>` : `<div class="kpi"><div class="lb">毛利</div><div class="vl">***</div><div class="ft">无查看权限</div></div>`}
      <div class="kpi"><div class="lb">客单价</div><div class="vl">${rows.length ? money(amt / rows.length) : '—'}</div><div class="ft">平均 ${rows.length ? (rows.reduce((a, s) => a + s.qty, 0) / rows.length).toFixed(1) : 0} 吨/单</div></div>
    </div>

    <div class="filters">
      <input class="grow" id="kwSale" placeholder="搜索客户 / 产品" value="${esc(kw)}" oninput="App.fSale(this.value)">
      <select onchange="App.fSaleDays(this.value)">
        ${[[7, '近 7 天'], [30, '近 30 天'], [90, '近 90 天'], [0, '全部']].map(o => `<option value="${o[0]}" ${o[0] === days ? 'selected' : ''}>${o[1]}</option>`).join('')}
      </select>
      <span class="sub-txt">剔除低价单后毛利率参考 ${showProfit && amt ? pct(profit / amt) : '—'}</span>
    </div>

    <div class="card">
      <div class="tbl-wrap"><table>
        <thead><tr><th>日期</th><th>单号</th><th>客户</th><th>产品</th><th class="r">数量</th><th class="r">成交单价</th><th class="r">金额</th>
        ${showProfit ? '<th class="r">成本单价</th><th class="r">毛利</th><th class="r">毛利率</th>' : ''}<th>收款</th><th>业务员</th></tr></thead>
        <tbody>${rows.length ? rows.slice(0, 60).map(s => `<tr>
          <td class="muted">${esc(s.date)}</td>
          <td class="mono">${esc(s.ref)}</td>
          <td>${esc(C(s.cid).name)}</td>
          <td>${esc(P(s.pid).name)} <span class="muted">${esc(P(s.pid).spec)}</span></td>
          <td class="r">${num(s.qty)} 吨</td>
          <td class="r strong">${yuan(s.price)}</td>
          <td class="r strong">${yuan(s.amount)}</td>
          ${showProfit ? `<td class="r muted">${yuan(s.cost)}</td>
          <td class="r ${s.amount - s.qty * s.cost >= 0 ? '' : 'down'}">${yuan(s.amount - s.qty * s.cost)}</td>
          <td class="r"><span class="chip ${(s.price - s.cost) / s.price > .2 ? 'good' : ((s.price - s.cost) / s.price > .1 ? '' : 'bad')}">${pct((s.price - s.cost) / s.price)}</span></td>` : ''}
          <td>${s.pay === '已收款' ? '<span class="chip good">已收款</span>' : `<span class="chip ${s.pay === '月结' ? 'warn' : ''}">${esc(s.pay)}</span>`}</td>
          <td class="muted">${esc(s.owner)}</td>
        </tr>`).join('') : '<tr><td colspan="12" class="blank">该时间段没有销售记录</td></tr>'}</tbody>
      </table></div>
      ${rows.length > 60 ? `<div class="card-b sub-txt" style="text-align:center">仅显示最近 60 单，导出台账可看全量</div>` : ''}
    </div>`;
  }
  function fSale(v) { state.f.saleKw = v; go('sales'); refocus('kwSale'); }
  function fSaleDays(v) { state.f.saleDays = Number(v); go('sales'); }

  /* ================= 5. 采购价格 ================= */
  function viewPurchase() {
    const pid = state.f.purPid || D.PRODUCTS[0].id;
    const p = P(pid);
    const qs = D.quotes.filter(q => q.pid === pid).sort((a, b) => (a.date < b.date ? 1 : -1));
    // 每个供应商取最新一条
    const bySup = {};
    qs.forEach(q => { if (!bySup[q.sid] || bySup[q.sid].date < q.date) bySup[q.sid] = q; });
    const latest = Object.values(bySup).sort((a, b) => a.price - b.price);
    const lowest = latest[0];

    return `
    <div class="page-head">
      <div><h1>采购价格</h1><p>二三十家供应商的报价不再靠翻群，按产品一屏比完</p></div>
      <div class="actions">${can('edit') ? `<button class="btn sm" onclick="App.modalQuote()">＋ 登记报价</button>` : ''}</div>
    </div>

    <div class="grid g-1-3" style="margin-bottom:14px">
      <div class="card">
        <div class="card-h"><h3>选择产品</h3></div>
        <div class="card-b" style="padding:10px">
          ${D.PRODUCTS.map(x => {
            const q0 = D.quotes.filter(q => q.pid === x.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
            return `<div onclick="App.pickPur('${x.id}')" style="padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:2px;${x.id === pid ? 'background:#e8f1f8' : ''}">
              <div style="display:flex;justify-content:space-between;gap:8px">
                <span style="font-size:13px;${x.id === pid ? 'font-weight:600;color:#12496f' : ''}">${esc(x.name)}<span class="muted" style="font-size:11px"> ${esc(x.spec)}</span></span>
                <span style="font-size:12px;color:#77869a">${q0 ? money(q0.price) : '—'}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-h"><h3>${esc(p.name)} ${esc(p.spec)} · 供应商比价</h3>
            <span class="tag">最新报价，${latest.length} 家</span>
            ${lowest ? `<span class="chip good">最低 ${yuan(lowest.price)} · ${esc(S(lowest.sid).name)}</span>` : ''}
          </div>
          <div class="tbl-wrap"><table>
            <thead><tr><th>供应商</th><th>等级</th><th class="r">最新报价</th><th class="r">较最低</th><th class="r">起订量</th><th>报价日期</th><th>有效期</th><th>结算</th><th class="c">操作</th></tr></thead>
            <tbody>${latest.length ? latest.map(q => `<tr>
              <td><div class="strong">${esc(S(q.sid).name)}</div><div class="sub-txt">${esc(S(q.sid).contact)} · ${esc(S(q.sid).city)}</div></td>
              <td><span class="chip ${S(q.sid).rating === 'A' ? 'good' : (S(q.sid).rating === 'B' ? '' : 'warn')}">${esc(S(q.sid).rating)}</span></td>
              <td class="r strong">${yuan(q.price)}</td>
              <td class="r ${q.price === lowest.price ? 'down' : 'muted'}">${q.price === lowest.price ? '最低' : '+' + pct((q.price - lowest.price) / lowest.price)}</td>
              <td class="r">${q.moq} 吨</td>
              <td class="muted">${esc(q.date)}</td>
              <td class="muted">${esc(q.validUntil)}</td>
              <td class="muted">${esc(S(q.sid).settle)}</td>
              <td class="c"><button class="btn sm ghost" onclick="App.useQuote('${q.sid}','${pid}')">按此价入库</button></td>
            </tr>`).join('') : '<tr><td colspan="9" class="blank">该产品还没有报价记录</td></tr>'}</tbody>
          </table></div>
        </div>

        <div class="grid g2">
          <div class="card">
            <div class="card-h"><h3>报价走势</h3><span class="tag">¥/吨</span></div>
            <div class="card-b">${qs.length >= 2 ? svgLine(qs.slice(0, 8).reverse().map(q => ({ l: q.date.slice(5), v: q.price, t: yuan(q.price) + ' · ' + S(q.sid).name }))) : '<div class="blank">报价记录不足</div>'}</div>
          </div>
          <div class="card">
            <div class="card-h"><h3>报价明细</h3><span class="tag">含未成交</span></div>
            <div class="card-b" style="max-height:230px;overflow:auto;padding-top:8px">
              ${qs.slice(0, 10).map(q => `<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed #eef2f6;font-size:12.5px">
                <span class="muted" style="width:72px;flex:none">${esc(q.date)}</span>
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S(q.sid).name)}</span>
                <span style="width:74px;text-align:right;font-weight:600">${yuan(q.price)}</span>
                <span class="chip" style="flex:none">${esc(q.status)}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }
  function pickPur(id) { state.f.purPid = id; go('purchase'); }

  /* ================= 6. 客户档案 ================= */
  function viewCustomers() {
    const kw = (state.f.custKw || '').trim();
    let rows = D.CUSTOMERS.map(c => {
      const ss = mySales().filter(s => s.cid === c.id);
      const inq = D.inquiries.filter(i => i.cid === c.id);
      const last = ss.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      return { c, amt: ss.reduce((a, s) => a + s.amount, 0), n: ss.length, inq: inq.length, last };
    });
    if (kw) rows = rows.filter(r => (r.c.name + r.c.contact + (r.c.need || '')).indexOf(kw) >= 0);
    rows.sort((a, b) => b.amt - a.amt);

    return `
    <div class="page-head">
      <div><h1>客户档案</h1><p>每个客户问过什么、买过什么、多久没下单，一栏看清</p></div>
      <div class="actions">${can('edit') ? `<button class="btn sm" onclick="App.modalCustomer()">＋ 新增客户</button>` : ''}</div>
    </div>

    <div class="filters">
      <input class="grow" id="kwCust" placeholder="搜索客户名称 / 联系人 / 需求" value="${esc(kw)}" oninput="App.fCust(this.value)">
      <span class="sub-txt">${rows.length} 家客户</span>
    </div>

    <div class="card">
      <div class="tbl-wrap"><table>
        <thead><tr><th>客户</th><th>地区</th><th>等级</th><th>主营需求</th><th class="r">累计成交</th><th class="r">单数</th><th class="r">询价次数</th><th>最近下单</th><th class="c">操作</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><div class="strong">${esc(r.c.name)}</div><div class="sub-txt">${esc(r.c.contact)} · ${esc(r.c.phone)}</div></td>
          <td class="muted">${esc(r.c.city)}</td>
          <td><span class="chip ${r.c.level === 'A' ? 'good' : (r.c.level === 'B' ? 'brand' : '')}">${esc(r.c.level)}</span></td>
          <td class="muted" style="max-width:200px">${esc(r.c.need || '')}</td>
          <td class="r strong">${r.amt ? money(r.amt) : '—'}</td>
          <td class="r">${r.n}</td>
          <td class="r">${r.inq}</td>
          <td class="muted">${r.last ? esc(r.last.date) : '<span class="chip warn">未成交</span>'}</td>
          <td class="c"><button class="btn sm ghost" onclick="App.custDetail('${r.c.id}')">查看</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }
  function fCust(v) { state.f.custKw = v; go('customers'); refocus('kwCust'); }

  function custDetail(cid) {
    const c = C(cid);
    const ss = mySales().filter(s => s.cid === cid).sort((a, b) => (a.date < b.date ? 1 : -1));
    const inq = D.inquiries.filter(i => i.cid === cid).sort((a, b) => (a.date < b.date ? 1 : -1));
    openModal(`${c.name}`, `
      <div class="grid g3" style="margin-bottom:14px">
        <div class="kpi" style="padding:11px 13px"><div class="lb">累计成交</div><div class="vl" style="font-size:19px">${money(ss.reduce((a, s) => a + s.amount, 0))}</div></div>
        <div class="kpi" style="padding:11px 13px"><div class="lb">成交单数</div><div class="vl" style="font-size:19px">${ss.length}</div></div>
        <div class="kpi" style="padding:11px 13px"><div class="lb">询价次数</div><div class="vl" style="font-size:19px">${inq.length}</div></div>
      </div>
      <div class="sub-txt" style="margin-bottom:10px">${esc(c.contact)} · ${esc(c.phone)} · ${esc(c.city)} · ${esc(c.note || '')}</div>
      <div style="font-size:13px;font-weight:600;margin:12px 0 6px">询价与成交记录</div>
      <div style="max-height:300px;overflow:auto">
        <table><thead><tr><th>日期</th><th>产品</th><th class="r">数量</th><th class="r">价格</th><th>结果</th></tr></thead>
        <tbody>${inq.map(i => `<tr><td class="muted">${esc(i.date)}</td><td>${esc(P(i.pid).name)}</td><td class="r">${i.qty} 吨</td>
          <td class="r">${yuan(i.ourPrice)}</td><td><span class="chip ${i.result === '已成交' ? 'good' : (i.result === '未成交' ? 'bad' : 'warn')}">${esc(i.result)}</span></td></tr>`).join('')
        || '<tr><td colspan="5" class="blank">暂无记录</td></tr>'}</tbody></table>
      </div>`,
      `<button class="btn ghost" onclick="App.closeModal()">关闭</button>`);
  }

  /* ================= 7. 询价记录 ================= */
  function viewInquiry() {
    const kw = (state.f.inqKw || '').trim();
    let rows = D.inquiries.slice();
    if (kw) rows = rows.filter(i => (C(i.cid).name + P(i.pid).name).indexOf(kw) >= 0);
    const fu = followUps();
    const t = today();

    return `
    <div class="page-head">
      <div><h1>询价记录</h1><p>问过价没成交的客户也是资产，到期自动提醒</p></div>
      <div class="actions">${can('edit') ? `<button class="btn sm" onclick="App.modalInquiry()">＋ 登记询价</button>` : ''}</div>
    </div>

    ${fu.length ? `<div class="notice">⏰ 有 ${fu.length} 条询价到了跟进日期，建议今天联系：${fu.slice(0, 3).map(i => esc(C(i.cid).name)).join('、')}${fu.length > 3 ? ' 等' : ''}</div>` : ''}

    <div class="filters">
      <input class="grow" id="kwInq" placeholder="搜索客户 / 产品" value="${esc(kw)}" oninput="App.fInq(this.value)">
      <span class="sub-txt">共 ${rows.length} 条 · 成交 ${D.inquiries.filter(i => i.result === '已成交').length} 条</span>
    </div>

    <div class="card">
      <div class="tbl-wrap"><table>
        <thead><tr><th>日期</th><th>客户</th><th>产品</th><th class="r">数量</th><th class="r">我方报价</th><th>结果</th><th>下次跟进</th><th>负责人</th><th>备注</th></tr></thead>
        <tbody>${rows.length ? rows.map(i => `<tr>
          <td class="muted">${esc(i.date)}</td>
          <td class="strong">${esc(C(i.cid).name)}</td>
          <td>${esc(P(i.pid).name)} <span class="muted">${esc(P(i.pid).spec)}</span></td>
          <td class="r">${i.qty} 吨</td>
          <td class="r strong">${yuan(i.ourPrice)}</td>
          <td><span class="chip ${i.result === '已成交' ? 'good' : (i.result === '未成交' ? 'bad' : 'warn')}">${esc(i.result)}</span></td>
          <td>${i.followUp ? (i.followUp <= t ? `<span class="chip bad">${esc(i.followUp)}</span>` : `<span class="muted">${esc(i.followUp)}</span>`) : '—'}</td>
          <td class="muted">${esc(i.owner)}</td>
          <td class="muted" style="max-width:160px">${esc(i.note)}</td>
        </tr>`).join('') : '<tr><td colspan="9" class="blank">没有匹配的询价记录</td></tr>'}</tbody>
      </table></div>
    </div>`;
  }
  function fInq(v) { state.f.inqKw = v; go('inquiry'); refocus('kwInq'); }

  /* ================= 8. 权限与数据导入 ================= */
  function viewSettings() {
    return `
    <div class="page-head"><div><h1>权限与数据导入</h1><p>谁能看什么、数据从哪来</p></div></div>

    <div class="grid g2" style="margin-bottom:14px">
      <div class="card">
        <div class="card-h"><h3>角色权限矩阵</h3><span class="tag">与 Lily 确认的口径</span></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>角色</th><th class="c">库存</th><th class="c">采购价</th><th class="c">销售价</th><th class="c">毛利</th><th class="c">录入</th></tr></thead>
          <tbody>
            <tr><td class="strong">老板 / 主账户</td><td class="c"><span class="chip good">全部</span></td><td class="c"><span class="chip good">全部</span></td><td class="c"><span class="chip good">全部</span></td><td class="c"><span class="chip good">可见</span></td><td class="c"><span class="chip good">可改</span></td></tr>
            <tr><td class="strong">业务员</td><td class="c"><span class="chip good">公开</span></td><td class="c"><span class="chip good">公开</span></td><td class="c"><span class="chip warn">仅本人</span></td><td class="c"><span class="chip bad">不可见</span></td><td class="c"><span class="chip good">可录入</span></td></tr>
            <tr><td class="strong">财务</td><td class="c"><span class="chip">只读</span></td><td class="c"><span class="chip good">全部</span></td><td class="c"><span class="chip good">全部</span></td><td class="c"><span class="chip good">可见</span></td><td class="c"><span class="chip bad">不可改</span></td></tr>
          </tbody>
        </table></div>
        <div class="card-b sub-txt">
          说明：库存与采购价对内公开；销售成交价、毛利率按角色隔离。这是演示环境的权限口径，上线时按实际人员调整。
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>数据从哪来</h3></div>
        <div class="card-b">
          <div style="font-size:13px;line-height:1.9">
            <div><b>① 金蝶 ERP</b> — 导出销售明细、采购明细（Excel），按月增量导入，历史成交价一次补齐</div>
            <div><b>② 现有库存表</b> — 作为期初库存导入一次，之后靠工作台流水维护</div>
            <div><b>③ 微信群报价</b> — 截图/复制后批量录入，或用「登记报价」逐条进；重点是让报价带日期和供应商</div>
          </div>
          <div class="notice brand" style="margin-top:14px;margin-bottom:0">
            📌 数据只进一次，之后每天只记「今天进了多少、卖了多少」，汇总由工作台自动算。
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-h"><h3>导入模板</h3><span class="tag">按模板填好即可导入，字段以贵司实际数据为准</span></div>
      <div class="card-b" style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn ghost sm" onclick="App.tpl('stock')">↓ 库存期初模板</button>
        <button class="btn ghost sm" onclick="App.tpl('sale')">↓ 销售明细模板</button>
        <button class="btn ghost sm" onclick="App.tpl('quote')">↓ 供应商报价模板</button>
        <button class="btn ghost sm" onclick="App.tpl('cust')">↓ 客户档案模板</button>
        <button class="btn ghost sm" onclick="App.tpl('inq')">↓ 询价记录模板</button>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h3>演示数据</h3></div>
      <div class="card-b" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <span class="sub-txt">当前数据为按材料贸易结构生成的演示数据（${D.PRODUCTS.length} 个产品 / ${D.SUPPLIERS.length} 家供应商 / ${D.CUSTOMERS.length} 家客户 / ${D.sales.length} 张销售单）。新增的记录会保存在本机浏览器里。</span>
        <button class="btn ghost sm" style="margin-left:auto" onclick="if(confirm('将清空本机新增记录，恢复初始演示数据，确认？'))App.reset()">重置演示数据</button>
      </div>
    </div>`;
  }

  /* ---------------- 弹窗 ---------------- */
  function openModal(title, body, foot) {
    $('#modalRoot').innerHTML = `<div class="mask" onclick="if(event.target===this)App.closeModal()">
      <div class="dialog">
        <h3>${esc(title)}<span class="x" onclick="App.closeModal()">×</span></h3>
        <div class="body">${body}</div>
        <div class="foot">${foot || ''}</div>
      </div></div>`;
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }

  function prodOptions(sel) {
    return D.PRODUCTS.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)} ${esc(p.spec)}（库存 ${num(stk(p.id).qty)} 吨）</option>`).join('');
  }
  function custOptions() {
    return D.CUSTOMERS.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }
  function supOptions(sel) {
    return D.SUPPLIERS.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  }

  function modalSale(prePid) {
    openModal('登记销售出库', `
      <div class="form-grid">
        <div class="field"><label>日期</label><input type="date" id="f_date" value="${today()}"></div>
        <div class="field"><label>客户</label><select id="f_cid">${custOptions()}</select></div>
        <div class="field full"><label>产品</label><select id="f_pid" onchange="App.fillSuggest(true)">${prodOptions(prePid)}</select></div>
        <div class="field"><label>数量（吨）</label><input type="number" id="f_qty" step="0.5" min="0.5" value="5" oninput="App.fillSuggest()"></div>
        <div class="field"><label>成交单价（元/吨）</label><input type="number" id="f_price" step="10" oninput="App.fillSuggest()"></div>
        <div class="field"><label>收款方式</label><select id="f_pay"><option>已收款</option><option>月结</option><option>预付</option></select></div>
        <div class="field"><label>业务员</label><select id="f_owner"><option>${esc(state.user.name)}</option><option>林小雨</option><option>王子涵</option></select></div>
      </div>
      <div class="calc-line" id="calcLine"></div>
      <div class="hint">提示：单价默认按成本 ×1.25 带出，可改。提交后库存自动扣减，成本按加权平均计算。</div>`,
      `<button class="btn ghost" onclick="App.closeModal()">取消</button>
       <button class="btn" onclick="App.submitSale()">确认出库</button>`);
    setTimeout(fillSuggest, 30);
  }

  function fillSuggest(reset) {
    const pid = $('#f_pid') && $('#f_pid').value;
    if (!pid) return;
    const s = stk(pid);
    const pi = P(pid);
    const priceEl = $('#f_price');
    if (priceEl && (reset || !priceEl.value)) priceEl.value = Math.round(s.cost * 1.25);
    const qty = Number($('#f_qty') ? $('#f_qty').value : 0) || 0;
    const price = Number(priceEl ? priceEl.value : 0) || 0;
    const line = $('#calcLine');
    if (!line) return;
    const amt = qty * price, cost = qty * s.cost, profit = amt - cost;
    line.innerHTML = `<span>成本 ${yuan(s.cost)}/吨 · 库存 ${num(s.qty)} 吨</span>
      <span>金额 <b>${yuan(amt)}</b> ｜ 毛利 <b>${yuan(profit)}</b> ｜ ${amt ? pct(profit / amt) : '—'}</span>`;
    if (qty > s.qty) line.innerHTML += `<span style="color:#bf3b2b">⚠ 出库量超过库存</span>`;
  }

  async function submitSale() {
    const pid = $('#f_pid').value, cid = $('#f_cid').value;
    const qty = Number($('#f_qty').value), price = Number($('#f_price').value);
    const s = stk(pid);
    if (!qty || !price) { toast('请填写数量与单价'); return; }
    if (qty > s.qty) { toast('库存不足，当前仅 ' + num(s.qty) + ' 吨'); return; }
    const date = $('#f_date').value || today();
    const ref = 'XS' + date.replace(/-/g, '') + String(D.sales.length + 1).padStart(2, '0');
    const owner = $('#f_owner').value;
    const sale = {
      id: nextId('S'), ref, date, pid, cid, qty, price,
      cost: s.cost, amount: Math.round(qty * price), owner, pay: $('#f_pay').value, note: ''
    };
    const flow = {
      id: nextId('F'), date, pid, type: '出库', qty, price,
      partner: C(cid).name, ref, operator: owner, note: '销售出库'
    };
    if (CLOUD_MODE) {
      try {
        await CLOUD.insertRow('sales', sale);
        await CLOUD.insertRow('stock_flows', flow);
      } catch (e) { toast('写入云端失败：' + e.message); return; }
    }
    D.sales.unshift(sale);
    D.stockFlows.push(flow);
    recomputeStock(); save(); closeModal();
    toast('已出库 ' + qty + ' 吨，库存与看板已同步');
    go(state.route);
  }

  function modalFlow(type) {
    openModal((type === '入库' ? '登记入库' : '登记其他出库'), `
      <div class="form-grid">
        <div class="field"><label>日期</label><input type="date" id="f_date" value="${today()}"></div>
        <div class="field"><label>${type === '入库' ? '供应商' : '出库去向'}</label>
          ${type === '入库' ? `<select id="f_sid">${supOptions()}</select>` : `<input id="f_partner" placeholder="如：样品寄出 / 退货 / 调拨" value="样品寄出">`}
        </div>
        <div class="field full"><label>产品</label><select id="f_pid" onchange="App.fillFlow(true)">${prodOptions()}</select></div>
        <div class="field"><label>数量（吨）</label><input type="number" id="f_qty" step="0.5" min="0.5" value="${type === '入库' ? 20 : 1}" oninput="App.fillFlow()"></div>
        <div class="field"><label>单价（元/吨）</label><input type="number" id="f_price" step="10" oninput="App.fillFlow()"></div>
        <div class="field full"><label>备注</label><input id="f_note" placeholder="选填"></div>
      </div>
      <div class="calc-line" id="calcLine"></div>`,
      `<button class="btn ghost" onclick="App.closeModal()">取消</button>
       <button class="btn" onclick="App.submitFlow('${type}')">确认${type}</button>`);
    setTimeout(fillFlow, 30);
  }

  function fillFlow(reset) {
    const pid = $('#f_pid') && $('#f_pid').value; if (!pid) return;
    const s = stk(pid);
    const pe = $('#f_price');
    if (pe && (reset || !pe.value) && s.cost) pe.value = Math.round(s.cost);
    const qty = Number($('#f_qty') ? $('#f_qty').value : 0) || 0;
    const price = Number(pe ? pe.value : 0) || 0;
    const line = $('#calcLine');
    if (!line) return;
    line.innerHTML = `<span>当前库存 ${num(s.qty)} 吨 · 加权成本 ${yuan(s.cost)}</span>
      <span>本次金额 <b>${yuan(qty * price)}</b></span>`;
  }

  async function submitFlow(type) {
    const pid = $('#f_pid').value, qty = Number($('#f_qty').value), price = Number($('#f_price').value);
    if (!qty || !price) { toast('请填写数量与单价'); return; }
    const date = $('#f_date').value || today();
    const s = stk(pid);
    if (type === '出库' && qty > s.qty) { toast('库存不足'); return; }
    const partner = type === '入库' ? S($('#f_sid').value).name : ($('#f_partner').value || '其他');
    const flow = {
      id: nextId('F'), date, pid, type, qty, price, partner,
      ref: (type === '入库' ? 'CG' : 'QT') + date.replace(/-/g, '') + String(Math.floor(Math.random() * 90) + 10),
      operator: state.user.name, note: $('#f_note') ? $('#f_note').value : ''
    };
    if (CLOUD_MODE) {
      try { await CLOUD.insertRow('stock_flows', flow); }
      catch (e) { toast('写入云端失败：' + e.message); return; }
    }
    D.stockFlows.push(flow);
    recomputeStock(); save(); closeModal();
    toast(type + '已登记，库存已更新');
    go(state.route);
  }

  function modalQuote() {
    openModal('登记供应商报价', `
      <div class="form-grid">
        <div class="field"><label>日期</label><input type="date" id="f_date" value="${today()}"></div>
        <div class="field"><label>供应商</label><select id="f_sid">${supOptions()}</select></div>
        <div class="field full"><label>产品</label><select id="f_pid">${prodOptions()}</select></div>
        <div class="field"><label>报价（元/吨）</label><input type="number" id="f_price" step="10" placeholder="填写供应商报的价"></div>
        <div class="field"><label>起订量（吨）</label><input type="number" id="f_moq" step="1" value="10"></div>
        <div class="field"><label>有效期至</label><input type="date" id="f_valid"></div>
        <div class="field"><label>报价来源</label><select id="f_source"><option>微信群</option><option>微信私聊</option><option>电话</option><option>邮件</option><option>报价单</option></select></div>
        <div class="field full"><label>备注</label><input id="f_note" placeholder="如：量大可再谈"></div>
      </div>
      <div class="hint">报价不必等成交就可以记——没成交的报价就是下次谈判的底牌。</div>`,
      `<button class="btn ghost" onclick="App.closeModal()">取消</button>
       <button class="btn" onclick="App.submitQuote()">保存报价</button>`);
  }
  async function submitQuote() {
    const price = Number($('#f_price').value);
    if (!price) { toast('请填写报价'); return; }
    const date = $('#f_date').value || today();
    const q = {
      id: nextId('Q'), date, sid: $('#f_sid').value, pid: $('#f_pid').value,
      price, moq: Number($('#f_moq').value) || 10,
      validUntil: $('#f_valid').value || '', source: $('#f_source').value, status: '有效',
      note: $('#f_note').value || ''
    };
    if (CLOUD_MODE) {
      try { await CLOUD.insertRow('quotes', q); }
      catch (e) { toast('写入云端失败：' + e.message); return; }
    }
    D.quotes.unshift(q);
    save(); closeModal(); toast('报价已记录'); go(state.route);
  }

  function useQuote(sid, pid) {
    // 从比价表直接转入库
    modalFlow('入库');
    setTimeout(() => {
      if ($('#f_sid')) $('#f_sid').value = sid;
      if ($('#f_pid')) { $('#f_pid').value = pid; }
      const q = D.quotes.filter(x => x.sid === sid && x.pid === pid).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      if (q && $('#f_price')) $('#f_price').value = q.price;
      fillFlow();
    }, 40);
  }

  function modalInquiry() {
    openModal('登记客户询价', `
      <div class="form-grid">
        <div class="field"><label>日期</label><input type="date" id="f_date" value="${today()}"></div>
        <div class="field"><label>客户</label><select id="f_cid">${custOptions()}</select></div>
        <div class="field full"><label>产品</label><select id="f_pid" onchange="App.fillInq()">${prodOptions()}</select></div>
        <div class="field"><label>询价数量（吨）</label><input type="number" id="f_qty" step="1" value="5"></div>
        <div class="field"><label>我方报价（元/吨）</label><input type="number" id="f_price" step="10"></div>
        <div class="field"><label>结果</label><select id="f_result"><option>待报价</option><option>跟进中</option><option>已成交</option><option>未成交</option></select></div>
        <div class="field"><label>下次跟进</label><input type="date" id="f_follow"></div>
        <div class="field full"><label>备注</label><input id="f_note" placeholder="如：客户对比中 / 嫌价高 / 等样品"></div>
      </div>
      <div class="calc-line" id="calcLine"></div>`,
      `<button class="btn ghost" onclick="App.closeModal()">取消</button>
       <button class="btn" onclick="App.submitInquiry()">保存</button>`);
    setTimeout(fillInq, 30);
  }
  function fillInq() {
    const pid = $('#f_pid') && $('#f_pid').value; if (!pid) return;
    const s = stk(pid);
    if ($('#f_price') && !$('#f_price').value) $('#f_price').value = Math.round(s.cost * 1.25);
    const line = $('#calcLine');
    if (line) line.innerHTML = `<span>成本 ${yuan(s.cost)}/吨</span><span>建议区间 <b>${yuan(s.cost * 1.2)} ~ ${yuan(s.cost * 1.3)}</b></span>`;
  }
  async function submitInquiry() {
    const qty = Number($('#f_qty').value), price = Number($('#f_price').value);
    if (!qty || !price) { toast('请填写数量与报价'); return; }
    const rec = {
      id: nextId('I'), date: $('#f_date').value || today(),
      cid: $('#f_cid').value, pid: $('#f_pid').value, qty, ourPrice: price,
      result: $('#f_result').value, followUp: $('#f_follow').value || '',
      owner: state.user.name, note: $('#f_note').value || ''
    };
    if (CLOUD_MODE) {
      try { await CLOUD.insertRow('inquiries', rec); }
      catch (e) { toast('写入云端失败：' + e.message); return; }
    }
    D.inquiries.unshift(rec);
    save(); closeModal(); toast('询价已记录，到期会提醒跟进'); go(state.route);
  }

  function modalCustomer() {
    openModal('新增客户', `
      <div class="form-grid">
        <div class="field full"><label>客户名称</label><input id="f_name" placeholder="公司全称"></div>
        <div class="field"><label>联系人</label><input id="f_contact"></div>
        <div class="field"><label>电话</label><input id="f_phone"></div>
        <div class="field"><label>地区</label><input id="f_city"></div>
        <div class="field"><label>等级</label><select id="f_level"><option>A</option><option>B</option><option selected>C</option></select></div>
        <div class="field full"><label>主营需求</label><input id="f_need" placeholder="如：还原铁粉、钛白粉"></div>
        <div class="field full"><label>备注</label><textarea id="f_note" rows="2"></textarea></div>
      </div>`,
      `<button class="btn ghost" onclick="App.closeModal()">取消</button>
       <button class="btn" onclick="App.submitCustomer()">保存</button>`);
  }
  async function submitCustomer() {
    const name = $('#f_name').value.trim();
    if (!name) { toast('请填写客户名称'); return; }
    const c = {
      id: nextId('C'), name, contact: $('#f_contact').value, phone: $('#f_phone').value,
      city: $('#f_city').value, level: $('#f_level').value, need: $('#f_need').value, note: $('#f_note').value
    };
    if (CLOUD_MODE) {
      try { await CLOUD.insertRow('customers', c); }
      catch (e) { toast('写入云端失败：' + e.message); return; }
    }
    D.CUSTOMERS.push(c);
    save(); closeModal(); toast('客户已新增'); go(state.route);
  }

  /* ---------------- 模板下载 ---------------- */
  function tpl(kind) {
    const map = {
      stock: ['产品编码', '产品名称', '规格', '数量', '单位', '加权成本', '库位', '盘点日期'],
      sale: ['单据号', '日期', '客户名称', '产品名称', '规格', '数量', '单位', '单价', '金额', '业务员', '收款方式'],
      quote: ['日期', '供应商', '产品名称', '规格', '报价', '币种', '起订量', '有效期至', '来源', '备注'],
      cust: ['客户名称', '联系人', '电话', '地区', '等级', '主营需求', '结算方式', '备注'],
      inq: ['日期', '客户名称', '产品名称', '数量', '我方报价', '结果', '下次跟进', '负责人', '备注']
    };
    const sample = {
      stock: ['YB-FE100', '还原铁粉', '100目', 160, '吨', 4800, 'A-01', '2026-11-24'],
      sale: ['XS2026112401', '2026-11-24', '上海鑫磁电子材料', '还原铁粉', '100目', 8, '吨', 6100, 48800, '林小雨', '月结'],
      quote: ['2026-11-20', '河北津冀铁粉厂', '还原铁粉', '100目', 4750, 'CNY', 20, '2026-12-05', '微信群', '量大可谈'],
      cust: ['上海鑫磁电子材料', '徐工', '13800000000', '上海嘉定', 'A', '还原铁粉、雾化铁粉', '月结30天', '磁性材料'],
      inq: ['2026-11-20', '上海鑫磁电子材料', '还原铁粉', 5, 6100, '跟进中', '2026-11-27', '王子涵', '客户对比中']
    };
    const rows = [map[kind], sample[kind]];
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '研倍_' + { stock: '库存期初', sale: '销售明细', quote: '供应商报价', cust: '客户档案', inq: '询价记录' }[kind] + '_模板.csv';
    a.click();
    toast('模板已下载，用 Excel 打开填写');
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    load();
    const boxCloud = document.getElementById('cloudLogin');
    const boxDemo = document.getElementById('demoLogin');
    if (CLOUD_MODE) {
      updateBadge('offline');
      if (boxCloud) boxCloud.classList.remove('hidden');
      if (boxDemo) boxDemo.classList.add('hidden');
    } else {
      updateBadge('local');
      if (boxCloud) boxCloud.classList.add('hidden');
      if (boxDemo) boxDemo.classList.remove('hidden');
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    bootAuth();
  }

  async function bootAuth() {
    if (!CLOUD_MODE) return;
    try {
      const r = await CLOUD.handleOAuthCallback();
      if (r.handled) {
        if (r.error) { lgErr(r.error.message); updateBadge('offline'); return; }
        await afterLogin();
        toast('登录成功');
        return;
      }
    } catch (e) { lgErr(e.message || '授权回调处理失败'); }
    tryAutoLogin();
  }

  return {
    init, logout, go, reset, loginDemo,
    sendCode, loginPhone, loginWorkBuddy, clearErr,
    doPrice, globalSearch, priceResult,
    fStock, fStockCat, fSale, fSaleDays, fCust, fInq, pickPur,
    custDetail, openModal, closeModal,
    modalSale, submitSale, fillSuggest,
    modalFlow, submitFlow, fillFlow,
    modalQuote, submitQuote, useQuote,
    modalInquiry, submitInquiry, fillInq,
    modalCustomer, submitCustomer, tpl
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
