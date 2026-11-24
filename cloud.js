/* ============================================================
   云端存储适配层
   ------------------------------------------------------------
   用法（在 index.html 里、app.js 之前配置）：
     <script>window.WB_CLOUD = { apiBase: "" };</script>
       apiBase 为空 = 与页面同源（页面由 server.js 托管）
       apiBase 填 "https://api.your-domain.com" = 页面在 GitHub Pages，接口在服务器
   不配置 window.WB_CLOUD = 纯本机模式（数据存浏览器，演示用）
   ============================================================ */
window.Cloud = (function () {
  const CFG = window.WB_CLOUD || null;
  const TK = 'yanbei_token';
  let status = CFG ? 'offline' : 'local';
  let version = 0;

  const base = () => ((CFG && CFG.apiBase) || '').replace(/\/$/, '');
  const enabled = () => !!CFG;
  const getToken = () => { try { return sessionStorage.getItem(TK) || ''; } catch (e) { return ''; } };
  const setToken = t => { try { t ? sessionStorage.setItem(TK, t) : sessionStorage.removeItem(TK); } catch (e) { } };
  const hasToken = () => !!getToken();

  function setStatus(s) {
    status = s;
    try { document.dispatchEvent(new CustomEvent('cloud:status', { detail: s })); } catch (e) { }
  }
  function getStatus() { return status; }
  function getVersion() { return version; }

  async function req(path, opts) {
    const o = Object.assign({ method: 'GET' }, opts || {});
    o.headers = Object.assign({ 'Content-Type': 'application/json' }, o.headers || {});
    const t = getToken();
    if (t) o.headers['Authorization'] = 'Bearer ' + t;
    let r;
    try {
      r = await fetch(base() + path, o);
    } catch (e) {
      setStatus('offline');
      throw new Error('连不上服务器，请检查网络');
    }
    const txt = await r.text();
    let j = {};
    try { j = JSON.parse(txt); } catch (e) { }
    if (!r.ok) {
      if (r.status === 401) { setToken(''); setStatus('unauth'); }
      const err = new Error(j.error || ('请求失败（' + r.status + '）'));
      err.code = r.status; err.payload = j;
      throw err;
    }
    return j;
  }

  async function login(username, password) {
    const res = await req('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setToken(res.token);
    setStatus('online');
    return res.user;
  }

  async function bootstrap() {
    const res = await req('/api/bootstrap');
    version = res.version || 0;
    setStatus('online');
    return res;   // {version, updatedAt, user, data}
  }

  async function push(data) {
    setStatus('syncing');
    const res = await req('/api/data', { method: 'PUT', body: JSON.stringify({ data, baseVersion: version }) });
    version = res.version;
    setStatus('online');
    return res;
  }

  async function health() {
    try {
      const r = await fetch(base() + '/api/health');
      return r.ok;
    } catch (e) { return false; }
  }

  function logout() { setToken(''); setStatus('offline'); }

  return { enabled, login, bootstrap, push, health, logout, setStatus, getStatus, getVersion, hasToken, base };
})();
