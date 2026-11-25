/* ============================================================
   研倍 · 云服务接入层（WorkBuddy Cloud Service）
   ------------------------------------------------------------
   职责：
   1. 初始化 SDK（endpoint / publishableKey / oauthRelayBaseUrl 均来自云端下发的 publicConfig）
   2. 手机号验证码登录、WorkBuddy 账号登录、会话恢复与登出
   3. 云端表的字段映射与读写（前端字段名 <-> 数据库列名）
   4. 首次空库时把种子数据写入云端
   ============================================================ */
window.CloudStore = (function () {
  const CFG = window.WB_CLOUD_CONFIG || {};
  const SDK = window.WorkBuddyCloud;
  const ready = !!(CFG.endpoint && CFG.publishableKey && SDK);

  const cloud = ready ? SDK.createWorkBuddyCloud({
    endpoint: CFG.endpoint,
    oauthRelayBaseUrl: CFG.oauthRelayBaseUrl,
    publishableKey: CFG.publishableKey
  }) : null;

  /* ---------- 值转换 ---------- */
  const toNum = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
  const toDate = v => (v ? String(v).slice(0, 10) : null);
  const toText = v => (v === '' || v == null ? null : String(v));

  /* ---------- 表定义：objKey -> [dbColumn, type] ---------- */
  const TABLES = {
    products: {
      key: 'id', fields: {
        id: ['id', 't'], code: ['code', 't'], name: ['name', 't'], spec: ['spec', 't'],
        unit: ['unit', 't'], cat: ['cat', 't'], base: ['base', 'n'], target: ['target', 'n'],
        safety: ['safety', 'n'], prob: ['prob', 'n']
      }
    },
    suppliers: {
      key: 'id', fields: {
        id: ['id', 't'], name: ['name', 't'], contact: ['contact', 't'], phone: ['phone', 't'],
        city: ['city', 't'], cat: ['cat', 't'], rating: ['rating', 't'], settle: ['settle', 't']
      }
    },
    customers: {
      key: 'id', fields: {
        id: ['id', 't'], name: ['name', 't'], contact: ['contact', 't'], phone: ['phone', 't'],
        city: ['city', 't'], level: ['level', 't'], need: ['need', 't'], note: ['note', 't']
      }
    },
    sales: {
      key: 'id', fields: {
        id: ['id', 't'], ref: ['ref', 't'], date: ['date', 'd'], pid: ['pid', 't'], cid: ['cid', 't'],
        qty: ['qty', 'n'], price: ['price', 'n'], cost: ['cost', 'n'], amount: ['amount', 'n'],
        owner: ['owner', 't'], pay: ['pay', 't'], note: ['note', 't']
      }
    },
    stock_flows: {
      key: 'id', fields: {
        id: ['id', 't'], date: ['date', 'd'], pid: ['pid', 't'], type: ['type', 't'],
        qty: ['qty', 'n'], price: ['price', 'n'], partner: ['partner', 't'], ref: ['ref', 't'],
        operator: ['operator', 't'], note: ['note', 't']
      }
    },
    quotes: {
      key: 'id', fields: {
        id: ['id', 't'], date: ['date', 'd'], sid: ['sid', 't'], pid: ['pid', 't'],
        price: ['price', 'n'], moq: ['moq', 'n'], validUntil: ['valid_until', 't'],
        source: ['source', 't'], status: ['status', 't'], note: ['note', 't']
      }
    },
    inquiries: {
      key: 'id', fields: {
        id: ['id', 't'], date: ['date', 'd'], cid: ['cid', 't'], pid: ['pid', 't'],
        qty: ['qty', 'n'], ourPrice: ['our_price', 'n'], result: ['result', 't'],
        followUp: ['follow_up', 't'], owner: ['owner', 't'], note: ['note', 't']
      }
    }
  };

  const conv = (type, v) => type === 'n' ? toNum(v) : type === 'd' ? toDate(v) : toText(v);

  function toRow(table, obj) {
    const def = TABLES[table], row = {};
    for (const k in def.fields) {
      if (!(k in obj)) continue;
      const [col, type] = def.fields[k];
      row[col] = conv(type, obj[k]);
    }
    return row;
  }
  function fromRow(table, row) {
    const def = TABLES[table], obj = {};
    for (const k in def.fields) {
      const [col, type] = def.fields[k];
      const v = row[col];
      obj[k] = type === 'n' ? (v == null ? 0 : Number(v)) : (v == null ? '' : String(v).slice(0, type === 'd' ? 10 : undefined));
    }
    return obj;
  }

  /* ---------- 会话 ---------- */
  async function getSession() {
    if (!ready) return null;
    const { data, error } = await cloud.auth.getSession();
    if (error) return null;
    return data || null;
  }
  function sessionUser(s) {
    return (s && (s.user || (s.session && s.session.user))) || null;
  }
  function uidOf(u) {
    if (!u) return null;
    return u.id || u.sub || u.uid || u.userId || null;
  }

  /* ---------- 登录 ---------- */
  async function sendOtp(phone) {
    const { data, error } = await cloud.auth.sendOtp({ phone });
    if (error) throw new Error(error.message || '验证码发送失败');
    return data;
  }
  async function verifyOtp(phone, verificationId, isExistingUser, token) {
    const { data, error } = await cloud.auth.verifyOtp({
      phone, verificationId, isExistingUser, token
    });
    if (error) throw new Error(error.message || '验证码校验失败');
    return data;
  }
  async function signInWithWorkBuddy() {
    const back = new URL(location.href);
    back.pathname = location.pathname.replace(/[^/]*$/, '');
    for (const k of ['code', 'state', 'provider']) back.searchParams.delete(k);
    const { data, error } = await cloud.auth.signInWithOAuth({
      provider: 'workbuddy',
      redirectTo: back.toString()
    });
    if (error) throw new Error(error.message || 'WorkBuddy 登录发起失败');
    location.assign(data.url);
  }
  async function handleOAuthCallback() {
    const url = new URL(location.href);
    if (!url.searchParams.has('code') && !url.searchParams.has('error')) return { handled: false };
    const provider = url.searchParams.get('provider');
    if (provider !== 'workbuddy' && provider !== 'wechat') {
      return { handled: true, error: new Error('授权回调缺少有效的登录方式') };
    }
    const fn = provider === 'workbuddy' ? cloud.auth.handleWorkBuddyCallback : cloud.auth.handleWechatWebCallback;
    if (typeof fn !== 'function') return { handled: true, error: new Error('当前 SDK 不支持该登录方式') };
    const { data, error } = await fn.call(cloud.auth);
    if (error) return { handled: true, error: new Error(error.message || '授权登录失败') };
    for (const k of ['code', 'state', 'provider']) url.searchParams.delete(k);
    history.replaceState(null, '', url.pathname + (url.search || '') + (url.hash || ''));
    return { handled: true, session: data || null };
  }
  async function signOut() {
    if (!ready) return;
    try { await cloud.auth.signOut(); } catch (e) { }
  }

  /* ---------- 员工档案与角色 ---------- */
  async function ensureStaff(displayName) {
    const { data: rows, error } = await cloud.database.from('staff').select('*');
    if (error) throw new Error('读取员工档案失败：' + error.message);
    const list = rows || [];
    const s = await getSession();
    const uid = uidOf(sessionUser(s));
    let me = uid ? list.find(r => r.user_id === uid) : null;

    if (!me) {
      const role = list.length === 0 ? 'owner' : 'sales';
      const { data: created, error: e2 } = await cloud.database
        .from('staff')
        .insert({ name: displayName || null, role })
        .select();
      if (e2) throw new Error('建立员工档案失败：' + e2.message);
      const row = (created && created[0]) || {};
      me = { user_id: row.user_id || uid, name: row.name || displayName, role: row.role || role };
    }
    return { user_id: me.user_id, name: me.name || displayName || '', role: me.role || 'sales' };
  }

  /* ---------- 数据读取 ---------- */
  async function loadAll() {
    const names = Object.keys(TABLES);
    const res = await Promise.all(names.map(n => cloud.database.from(n).select('*')));
    const out = {};
    names.forEach((n, i) => {
      const r = res[i];
      if (r.error) throw new Error('读取 ' + n + ' 失败：' + r.error.message);
      out[n] = (r.data || []).map(x => fromRow(n, x));
    });

    const st = await cloud.database.from('init_stock').select('*');
    if (st.error) throw new Error('读取期初库存失败：' + st.error.message);
    const initStock = {};
    (st.data || []).forEach(r => { initStock[r.pid] = { qty: Number(r.qty) || 0, cost: Number(r.cost) || 0 }; });

    return {
      products: out.products,
      suppliers: out.suppliers,
      customers: out.customers,
      sales: out.sales.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
      stockFlows: out.stock_flows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1))),
      quotes: out.quotes.sort((a, b) => (a.date < b.date ? 1 : -1)),
      inquiries: out.inquiries.sort((a, b) => (a.date < b.date ? 1 : -1)),
      initStock
    };
  }

  /* ---------- 数据写入 ---------- */
  async function insertRow(table, obj) {
    const { data, error } = await cloud.database.from(table).insert(toRow(table, obj)).select();
    if (error) {
      const msg = error.code === '23505' ? '单据编号重复，请重试'
        : error.code === '42501' ? '没有权限写入该数据'
          : (error.message || '写入失败');
      const err = new Error(msg); err.code = error.code; throw err;
    }
    const row = (data && data[0]) || null;
    return row ? fromRow(table, row) : obj;
  }
  async function insertMany(table, objs, chunkSize) {
    const rows = objs.map(o => toRow(table, o));
    const size = chunkSize || 80;               // 分批提交，避免单次请求体过大
    for (let i = 0; i < rows.length; i += size) {
      const { error } = await cloud.database.from(table).insert(rows.slice(i, i + size));
      if (error) throw new Error('批量写入 ' + table + ' 失败（第 ' + (i + 1) + ' 条起）：' + error.message);
    }
    return rows.length;
  }
  async function upsertRow(table, obj) {
    const { data, error } = await cloud.database.from(table).upsert(toRow(table, obj)).select();
    if (error) {
      const err = new Error(error.message || '写入失败'); err.code = error.code; throw err;
    }
    return (data && data[0]) ? fromRow(table, data[0]) : obj;
  }

  /* ---------- 首次空库写入种子数据 ---------- */
  async function seedIfEmpty(seed) {
    const { count, error } = await cloud.database.from('products').select('*', { count: 'exact', head: true });
    if (error) throw new Error('检查云端数据失败：' + error.message);
    if (count && count > 0) return { seeded: false };

    await insertMany('suppliers', seed.SUPPLIERS || []);
    await insertMany('products', seed.PRODUCTS || []);
    await insertMany('customers', seed.CUSTOMERS || []);
    if (seed.initStock) {
      const rows = Object.keys(seed.initStock).map(pid => ({
        pid, qty: seed.initStock[pid].qty, cost: seed.initStock[pid].cost
      }));
      const { error: e0 } = await cloud.database.from('init_stock').insert(rows);
      if (e0) throw new Error('写入期初库存失败：' + e0.message);
    }
    await insertMany('sales', seed.sales || []);
    await insertMany('stock_flows', seed.stockFlows || []);
    await insertMany('quotes', seed.quotes || []);
    await insertMany('inquiries', seed.inquiries || []);
    return { seeded: true };
  }

  /* ---------- 健康检查（验证可用性） ---------- */
  async function health() {
    const out = { session: false, tables: {}, error: null };
    const s = await getSession();
    out.session = !!sessionUser(s);
    for (const t of Object.keys(TABLES).concat(['init_stock', 'staff'])) {
      const { count, error } = await cloud.database.from(t).select('*', { count: 'exact', head: true });
      out.tables[t] = error ? ('ERR ' + (error.code || error.message)) : count;
      if (error && !out.error) out.error = error.message;
    }
    return out;
  }

  return {
    ready, cloud,
    sendOtp, verifyOtp, signInWithWorkBuddy, handleOAuthCallback, signOut,
    getSession, sessionUser, uidOf, ensureStaff,
    loadAll, insertRow, insertMany, upsertRow, seedIfEmpty, health,
    TABLES
  };
})();
