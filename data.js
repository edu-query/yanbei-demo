/* ============================================================
   研倍 · 材料贸易工作台 —— 演示数据集
   说明：字段结构参考金蝶 ERP 销售/采购明细的常见导出列，
   真实导入时按「数据导入模板」映射，字段以客户实际数据为准。
   ============================================================ */
(function () {
  // ---- 固定种子随机：保证每次打开数字一致，便于对照验收 ----
  let _s = 20261124;
  function rnd() { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; }
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function rf(a, b) { return a + rnd() * (b - a); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function ds(d) { const m = d.getMonth() + 1, x = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x; }
  function addDays(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function r2(n) { return Math.round(n * 100) / 100; }

  // ---------------- 基础档案 ----------------
  const PRODUCTS = [
    { id: 'P01', code: 'YB-FE100', name: '还原铁粉', spec: '100目', unit: '吨', cat: '铁粉', base: 4800, target: 160, safety: 50, prob: 0.62 },
    { id: 'P02', code: 'YB-FE200', name: '还原铁粉', spec: '200目', unit: '吨', cat: '铁粉', base: 5250, target: 120, safety: 40, prob: 0.5 },
    { id: 'P03', code: 'YB-FEAT', name: '雾化铁粉', spec: '80-200目', unit: '吨', cat: '铁粉', base: 8600, target: 70, safety: 25, prob: 0.34 },
    { id: 'P04', code: 'YB-FE2O3', name: '氧化铁红', spec: '130', unit: '吨', cat: '颜料', base: 3250, target: 90, safety: 30, prob: 0.4 },
    { id: 'P05', code: 'YB-TIO2', name: '金红石型钛白粉', spec: 'R-996', unit: '吨', cat: '颜料', base: 14800, target: 60, safety: 20, prob: 0.3 },
    { id: 'P06', code: 'YB-BASO4', name: '沉淀硫酸钡', spec: '1250目', unit: '吨', cat: '填料项', base: 1850, target: 110, safety: 35, prob: 0.36 },
    { id: 'P07', code: 'YB-CACO3', name: '轻质碳酸钙', spec: '800目', unit: '吨', cat: '填料项', base: 920, target: 140, safety: 45, prob: 0.3 },
    { id: 'P08', code: 'YB-ZN325', name: '锌粉', spec: '325目', unit: '吨', cat: '金属粉', base: 25800, target: 40, safety: 15, prob: 0.26 },
    { id: 'P09', code: 'YB-CU', name: '球形铜粉', spec: '200目', unit: '吨', cat: '金属粉', base: 68000, target: 12, safety: 5, prob: 0.16 },
    { id: 'P10', code: 'YB-GR', name: '鳞片石墨粉', spec: '325目', unit: '吨', cat: '非金属', base: 5600, target: 55, safety: 20, prob: 0.22 }
  ];

  const SUPPLIERS = [
    { id: 'S01', name: '河北津冀铁粉厂', contact: '王经理', phone: '138****2071', city: '河北石家庄', cat: '铁粉', rating: 'A', settle: '月结30天' },
    { id: 'S02', name: '山西恒源金属粉末', contact: '刘工', phone: '139****5520', city: '山西太原', cat: '铁粉/金属粉', rating: 'A', settle: '款到发货' },
    { id: 'S03', name: '辽宁鞍山粉材贸易', contact: '张总', phone: '137****8834', city: '辽宁鞍山', cat: '铁粉', rating: 'B', settle: '月结15天' },
    { id: 'S04', name: '江苏中钛化工', contact: '陈经理', phone: '136****1162', city: '江苏镇江', cat: '钛白粉', rating: 'A', settle: '月结30天' },
    { id: 'S05', name: '安徽皖钛新材料', contact: '孙经理', phone: '158****7743', city: '安徽马鞍山', cat: '钛白粉', rating: 'B', settle: '款到发货' },
    { id: 'S06', name: '山东鲁北硫酸钡', contact: '赵厂长', phone: '135****6628', city: '山东滨州', cat: '硫酸钡/碳酸钙', rating: 'A', settle: '月结30天' },
    { id: 'S07', name: '浙江建德钙业', contact: '胡经理', phone: '189****3014', city: '浙江建德', cat: '碳酸钙', rating: 'B', settle: '款到发货' },
    { id: 'S08', name: '湖南株洲锌业', contact: '周经理', phone: '133****9957', city: '湖南株洲', cat: '锌粉', rating: 'A', settle: '月结30天' },
    { id: 'S09', name: '江西铜业粉体', contact: '吴工', phone: '187****4408', city: '江西鹰潭', cat: '铜粉', rating: 'B', settle: '预付30%' },
    { id: 'S10', name: '内蒙古兴和石墨', contact: '李经理', phone: '150****2286', city: '内蒙古乌兰察布', cat: '石墨粉', rating: 'C', settle: '款到发货' }
  ];

  const CUSTOMERS = [
    { id: 'C01', name: '上海鑫磁电子材料', contact: '徐工', phone: '138****3321', city: '上海嘉定', level: 'A', need: '还原铁粉、雾化铁粉', note: '磁性材料，月用量稳定，价格敏感度中等' },
    { id: 'C02', name: '苏州瑞泰粉末冶金', contact: '钱经理', phone: '139****8802', city: '江苏苏州', level: 'A', need: '还原铁粉 200目、铜粉', note: '粉末冶金件，对粒度一致性要求高' },
    { id: 'C03', name: '宁波恒立磁业', contact: '孙总', phone: '137****6644', city: '浙江宁波', level: 'A', need: '还原铁粉', note: '老客户，走量为主，账期 30 天' },
    { id: 'C04', name: '常州华彩涂料', contact: '周经理', phone: '135****1190', city: '江苏常州', level: 'B', need: '钛白粉、氧化铁红、硫酸钡', note: '建筑涂料，季度集中采购' },
    { id: 'C05', name: '东莞铭辉塑胶', contact: '何工', phone: '186****5573', city: '广东东莞', level: 'B', need: '硫酸钡、碳酸钙', note: '填充母粒，比价频繁' },
    { id: 'C06', name: '无锡金瑞摩擦材料', contact: '华经理', phone: '158****2216', city: '江苏无锡', level: 'B', need: '石墨粉、硫酸钡', note: '刹车片用，小批量多批次' },
    { id: 'C07', name: '杭州泰普新材料', contact: '林工', phone: '133****7735', city: '浙江杭州', level: 'B', need: '氧化铁红、钛白粉', note: '新客户，正在试样阶段' },
    { id: 'C08', name: '顺德盈丰电器', contact: '梁经理', phone: '136****4482', city: '广东佛山', level: 'C', need: '碳酸钙', note: '小单为主，付款及时' },
    { id: 'C09', name: '青岛海诺化工', contact: '于经理', phone: '139****9021', city: '山东青岛', level: 'B', need: '锌粉、氧化铁红', note: '防腐涂料方向' },
    { id: 'C10', name: '天津博远磁材', contact: '魏总', phone: '150****3367', city: '天津', level: 'A', need: '还原铁粉、雾化铁粉', note: '大单客户，年框供货，价格谈判强' },
    { id: 'C11', name: '昆山盛达精密', contact: '徐经理', phone: '187****6690', city: '江苏昆山', level: 'C', need: '铜粉', note: '小批量试样，潜力客户' },
    { id: 'C12', name: '重庆渝丰橡塑', contact: '罗工', phone: '158****1105', city: '重庆', level: 'C', need: '碳酸钙、硫酸钡', note: '刚接洽，暂未成交' }
  ];

  const SALES = ['林小雨', '王子涵'];
  const TODAY = new Date(2026, 10, 24);
  const START = new Date(2026, 5, 1);

  // ---------------- 期初库存 ----------------
  const initStock = {};
  PRODUCTS.forEach(p => { initStock[p.id] = { qty: Math.round(p.target * rf(0.85, 1.1)), cost: Math.round(p.base * rf(0.92, 1.02)) }; });

  // ---------------- 供应商报价（近 90 天，含未成交） ----------------
  const quotes = [];
  let qId = 1;
  PRODUCTS.forEach(p => {
    const sup = SUPPLIERS.filter(s => s.cat.indexOf(p.cat) >= 0 || (p.cat === '铁粉' && s.id === 'S03'));
    const list = sup.length ? sup : [SUPPLIERS[0]];
    // 每个产品 4-8 条报价，横跨近 90 天
    const n = ri(4, 8);
    for (let i = 0; i < n; i++) {
      const s = pick(list);
      const daysAgo = ri(2, 88);
      const d = addDays(TODAY, -daysAgo);
      const trend = 1 + (90 - daysAgo) / 90 * 0.045;   // 近期缓涨
      const price = Math.round(p.base * trend * rf(0.93, 1.06));
      const moq = pick([5, 10, 20, 30]);
      quotes.push({
        id: 'Q' + String(qId++).padStart(3, '0'),
        date: ds(d),
        sid: s.id,
        pid: p.id,
        price: price,
        moq: moq,
        validUntil: ds(addDays(d, pick([7, 15, 30]))),
        source: pick(['微信群', '微信私聊', '电话', '邮件', '报价单']),
        status: rnd() < 0.35 ? '已成交' : '有效',
        note: rnd() < 0.25 ? '量大可再谈' : ''
      });
    }
  });
  quotes.sort((a, b) => (a.date < b.date ? 1 : -1));
  // 过期标记
  quotes.forEach(q => { if (q.date < ds(addDays(TODAY, -30)) && q.status !== '已成交') q.status = '已过期'; });

  // ---------------- 库存流水 + 销售（同一套加权平均成本） ----------------
  const stockFlows = [];
  const sales = [];
  const state = {};
  PRODUCTS.forEach(p => state[p.id] = { qty: initStock[p.id].qty, cost: initStock[p.id].cost });
  let fId = 1, sId = 1;

  for (let d = new Date(START); d <= addDays(TODAY, -1); d = addDays(d, 1)) {
    PRODUCTS.forEach(p => {
      const st = state[p.id];
      // 补货：库存低于 70% 库位时入库
      if (st.qty < p.target * 0.7 && rnd() < 0.55) {
        const qty = Math.round(p.target * rf(0.25, 0.45));
        const price = Math.round(p.base * (1 + (d - START) / (TODAY - START) * 0.05) * rf(0.95, 1.04));
        st.cost = r2((st.qty * st.cost + qty * price) / (st.qty + qty));
        st.qty += qty;
        const sup = pick(SUPPLIERS.filter(s => s.cat.indexOf(p.cat) >= 0)) || SUPPLIERS[0];
        stockFlows.push({
          id: 'F' + String(fId++).padStart(5, '0'), date: ds(d), pid: p.id, type: '入库',
          qty: qty, price: price, partner: sup.name, ref: 'CG' + ds(d).replace(/-/g, '') + ri(10, 99),
          operator: '林小雨', note: '按需补货'
        });
      }
      // 出货：按产品概率
      if (st.qty > p.safety * 0.8 && rnd() < p.prob * 0.42) {
        const qty = Math.max(1, Math.round(p.target * rf(0.03, 0.11)));
        const cid = pick(CUSTOMERS);
        const cost = st.cost;
        const margin = rnd() < 0.12 ? rf(1.06, 1.12) : rf(1.18, 1.36);
        const price = Math.round(cost * margin);
        st.qty -= qty;
        const ref = 'XS' + ds(d).replace(/-/g, '') + String(sId).padStart(2, '0');
        stockFlows.push({
          id: 'F' + String(fId++).padStart(5, '0'), date: ds(d), pid: p.id, type: '出库',
          qty: qty, price: price, partner: cid.name, ref: ref, operator: pick(SALES), note: ''
        });
        sales.push({
          id: 'S' + String(sId).padStart(4, '0'), ref: ref, date: ds(d), pid: p.id, cid: cid.id,
          qty: qty, price: price, cost: r2(cost), amount: Math.round(qty * price),
          owner: pick(SALES), pay: pick(['已收款', '已收款', '月结', '月结', '预付']),
          note: ''
        });
        sId++;
      }
    });
  }
  sales.sort((a, b) => (a.date < b.date ? 1 : (a.date > b.date ? -1 : 0)));
  stockFlows.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : (a.date < b.date ? -1 : 1)));

  // ---------------- 客户询价记录 ----------------
  const inquiries = [];
  let iId = 1;
  const results = ['已成交', '已成交', '跟进中', '未成交', '未成交', '待报价'];
  for (let i = 0; i < 46; i++) {
    const c = pick(CUSTOMERS);
    const p = pick(PRODUCTS);
    const daysAgo = ri(0, 80);
    const d = addDays(TODAY, -daysAgo);
    const q = quotes.find(x => x.pid === p.id);
    const our = Math.round((q ? q.price : p.base) * rf(1.2, 1.34));
    const result = pick(results);
    inquiries.push({
      id: 'I' + String(iId++).padStart(3, '0'),
      date: ds(d), cid: c.id, pid: p.id, qty: Math.max(1, Math.round(p.target * rf(0.02, 0.08))),
      ourPrice: our, result: result,
      followUp: result === '跟进中' || result === '待报价' ? ds(addDays(d, ri(1, 14))) : '',
      owner: pick(SALES), note: pick(['客户对比中', '嫌价高', '等样品检测', '', '', '要求账期', '']) 
    });
  }
  inquiries.sort((a, b) => (a.date < b.date ? 1 : -1));

  // ---------------- 制造两笔「刚出完大单、还没补货」的真实场景 ----------------
  // 让低库存预警不是空的，也便于验收「库存不足 → 提示补货」链路
  [['P04', 'C04', 52], ['P10', 'C06', 26]].forEach(function (cfg) {
    const pid = cfg[0], cid = cfg[1], qty = cfg[2];
    const p = PRODUCTS.find(x => x.id === pid), st = state[pid], c = CUSTOMERS.find(x => x.id === cid);
    if (!st || st.qty < qty) return;
    const d = addDays(TODAY, -3);
    const price = Math.round(st.cost * 1.24);
    const ref = 'XS' + ds(d).replace(/-/g, '') + String(sId).padStart(2, '0');
    st.qty -= qty;
    stockFlows.push({
      id: 'F' + String(fId++).padStart(5, '0'), date: ds(d), pid: pid, type: '出库', qty: qty,
      price: price, partner: c.name, ref: ref, operator: '林小雨', note: '客户集中提货'
    });
    sales.push({
      id: 'S' + String(sId).padStart(4, '0'), ref: ref, date: ds(d), pid: pid, cid: cid, qty: qty,
      price: price, cost: r2(st.cost), amount: Math.round(qty * price), owner: '林小雨', pay: '月结', note: '集中提货'
    });
    sId++;
  });
  sales.sort((a, b) => (a.date < b.date ? 1 : (a.date > b.date ? -1 : 0)));
  stockFlows.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : (a.date < b.date ? -1 : 1)));

  // ---------------- 当前库存（由流水推算） ----------------
  const stock = PRODUCTS.map(p => ({
    pid: p.id, qty: state[p.id].qty, cost: r2(state[p.id].cost),
    amount: Math.round(state[p.id].qty * state[p.id].cost)
  }));

  window.WB = {
    meta: { company: '上海研倍材料科技有限公司', version: 'v0.9 演示版', today: ds(TODAY) },
    PRODUCTS, SUPPLIERS, CUSTOMERS, stockFlows, sales, quotes, inquiries, stock, initStock
  };
})();
