// =========================================
// CHI TIEU CA NHAN - flexible cashflow tracker
// LocalStorage only, no backend
// =========================================

const STORAGE_KEYS = {
  txs: 'txs',
  budget: 'budget',
  openingBalance: 'openingBalance',
  savingTarget: 'savingTarget',
  lastTx: 'lastTx',
  customPresets: 'customPresets',
  presetGroups: 'presetGroups',
  debts: 'debts',
};

const CATEGORIES = [
  ['Ăn uống', '🍜'],
  ['Cafe / Trà sữa', '☕'],
  ['Đi lại', '🚗'],
  ['Học tập', '📚'],
  ['Mua sắm', '🛍️'],
  ['Giải trí', '🎮'],
  ['Sức khỏe', '💊'],
  ['Điện nước', '💡'],
  ['Tụ tập', '🎉'],
  ['Cho vay / Nợ', '🤝'],
  ['Trả nợ', '💳'],
  ['Khác', '📦'],
];

const INCOME_SOURCES = [
  ['Lương / Part-time', '💼'],
  ['Freelance', '🧑‍💻'],
  ['Gia đình', '🏠'],
  ['Học bổng', '🎓'],
  ['Bán đồ', '📦'],
  ['Hoàn tiền', '↩️'],
  ['Thu nợ', '🤝'],
  ['Vay / Nợ', '🧾'],
  ['Thưởng / Quà', '🎁'],
  ['Khác', '💰'],
];

const CAT_ICONS = Object.fromEntries(CATEGORIES);
const INCOME_ICONS = Object.fromEntries(INCOME_SOURCES);
const ALL_LABEL_ICONS = { ...CAT_ICONS, ...INCOME_ICONS };

const CAT_COLORS = {
  'Ăn uống': '#f97316',
  'Cafe / Trà sữa': '#a855f7',
  'Đi lại': '#3b82f6',
  'Học tập': '#10b981',
  'Mua sắm': '#ec4899',
  'Giải trí': '#f59e0b',
  'Sức khỏe': '#ef4444',
  'Điện nước': '#6366f1',
  'Tụ tập': '#14b8a6',
  'Khác': '#8b5cf6',
};

const MOOD_LABELS = {
  necessary: 'Cần thiết',
  normal: 'Bình thường',
  waste: 'Hơi phí',
  regret: 'Hối hận',
};

const DEFAULT_PRESETS = [
  { group: '🍚 Ăn tối', items: [
    { label: '25k', amount: 25000, category: 'Ăn uống', note: 'Ăn tối' },
    { label: '30k', amount: 30000, category: 'Ăn uống', note: 'Ăn tối' },
    { label: '35k', amount: 35000, category: 'Ăn uống', note: 'Ăn tối' },
    { label: '45k', amount: 45000, category: 'Ăn uống', note: 'Ăn tối' },
  ]},
  { group: '🥗 Ăn trưa', items: [
    { label: '25k', amount: 25000, category: 'Ăn uống', note: 'Ăn trưa' },
    { label: '30k', amount: 30000, category: 'Ăn uống', note: 'Ăn trưa' },
    { label: '35k', amount: 35000, category: 'Ăn uống', note: 'Ăn trưa' },
    { label: '45k', amount: 45000, category: 'Ăn uống', note: 'Ăn trưa' },
  ]},
  { group: '⚡ Nhanh', items: [
    { label: '☕ Cafe 25k', amount: 25000, category: 'Cafe / Trà sữa', note: 'Cafe' },
    { label: '⛽ Xăng 50k', amount: 50000, category: 'Đi lại', note: 'Đổ xăng' },
    { label: '🅿️ Gửi xe 5k', amount: 5000, category: 'Đi lại', note: 'Gửi xe' },
    { label: '🛍️ Mua đồ 100k', amount: 100000, category: 'Mua sắm', note: 'Mua đồ' },
  ]},
];

let activeRange = 'month';
let sheetKind = 'expense';
let editKind = 'expense';
let _chartPie = null;
let _chartBar = null;
let _chartCompare = null;

function $(id) { return document.getElementById(id); }

function safeJSONParse(value, fallback) {
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
}

function getNumber(key) { return Number(localStorage.getItem(key) || 0); }
function saveNumber(key, value) { localStorage.setItem(key, String(Number(value) || 0)); }
function getBudget() { return getNumber(STORAGE_KEYS.budget); }
function getOpeningBalance() { return getNumber(STORAGE_KEYS.openingBalance); }
function getSavingTarget() { return getNumber(STORAGE_KEYS.savingTarget); }

function normalizeTx(tx) {
  if (!tx || !tx.id || !tx.date || !tx.amount) return null;
  const kind = tx.kind || (tx.flow === 'income' ? 'income' : 'expense');
  return {
    id: tx.id,
    kind,
    amount: Math.abs(Number(tx.amount)),
    category: tx.category || (kind === 'income' ? 'Khác' : 'Khác'),
    note: tx.note || '',
    date: tx.date,
    type: kind === 'expense' ? (tx.type || (tx.isFixed ? 'fixed' : 'flexible')) : '',
    mood: kind === 'expense' ? (tx.mood || 'normal') : '',
    createdAt: tx.createdAt || tx.id,
  };
}

function getTransactions() {
  const data = safeJSONParse(localStorage.getItem(STORAGE_KEYS.txs) || '[]', []);
  return Array.isArray(data) ? data.map(normalizeTx).filter(Boolean) : [];
}

function saveTransactions(txs) { localStorage.setItem(STORAGE_KEYS.txs, JSON.stringify(txs)); }
function getLastTx() { return safeJSONParse(localStorage.getItem(STORAGE_KEYS.lastTx), null); }
function saveLastTx(tx) { localStorage.setItem(STORAGE_KEYS.lastTx, JSON.stringify(tx)); }
function normalizePresetItem(item, groupIndex = 0, itemIndex = 0) {
  if (!item) return null;
  const label = String(item.label || '').trim();
  const amount = Math.abs(Number(item.amount));
  const category = item.category || 'Khác';
  if (!label || !amount) return null;
  return {
    id: item.id || `preset-${groupIndex}-${itemIndex}-${label}`.replace(/\s+/g, '-'),
    label,
    amount: Math.round(amount),
    category,
    note: item.note || label,
  };
}

function normalizePresetGroup(group, groupIndex = 0) {
  if (!group) return null;
  const name = String(group.group || group.name || '').trim() || `Nhóm ${groupIndex + 1}`;
  const items = Array.isArray(group.items)
    ? group.items.map((item, itemIndex) => normalizePresetItem(item, groupIndex, itemIndex)).filter(Boolean)
    : [];
  if (!items.length) return null;
  return { group: name, items };
}

function getLegacyCustomPresets() {
  const data = safeJSONParse(localStorage.getItem(STORAGE_KEYS.customPresets) || '[]', []);
  return Array.isArray(data) ? data.map((item, idx) => normalizePresetItem(item, 99, idx)).filter(Boolean) : [];
}

function getDefaultPresetGroups() {
  return DEFAULT_PRESETS.map((group, idx) => normalizePresetGroup(group, idx)).filter(Boolean);
}

function getPresetGroups() {
  const saved = safeJSONParse(localStorage.getItem(STORAGE_KEYS.presetGroups) || '[]', []);
  if (Array.isArray(saved) && saved.length) {
    const normalized = saved.map((group, idx) => normalizePresetGroup(group, idx)).filter(Boolean);
    if (normalized.length) return normalized;
  }
  const groups = getDefaultPresetGroups();
  const legacyCustom = getLegacyCustomPresets();
  if (legacyCustom.length) groups.push({ group: '⭐ Của tôi', items: legacyCustom });
  return groups;
}

function savePresetGroups(groups) {
  const normalized = Array.isArray(groups)
    ? groups.map((group, idx) => normalizePresetGroup(group, idx)).filter(Boolean)
    : getDefaultPresetGroups();
  localStorage.setItem(STORAGE_KEYS.presetGroups, JSON.stringify(normalized));
}

function getCustomPresets() {
  const group = getPresetGroups().find(g => g.group.includes('Của tôi'));
  return group ? group.items : [];
}

function saveCustomPresets(items) {
  const groups = getPresetGroups().filter(g => !g.group.includes('Của tôi'));
  const normalized = Array.isArray(items) ? items.map((item, idx) => normalizePresetItem(item, 99, idx)).filter(Boolean) : [];
  if (normalized.length) groups.push({ group: '⭐ Của tôi', items: normalized });
  savePresetGroups(groups);
}

function normalizeDebt(debt) {
  if (!debt || !debt.id || !debt.person || !debt.amount) return null;
  return {
    id: debt.id,
    direction: debt.direction === 'borrowed' ? 'borrowed' : 'lent',
    person: debt.person,
    amount: Math.abs(Number(debt.amount)),
    date: debt.date || todayStr(),
    dueDate: debt.dueDate || '',
    note: debt.note || '',
    status: debt.status === 'done' ? 'done' : 'open',
    createdAt: debt.createdAt || new Date().toISOString(),
    closedAt: debt.closedAt || '',
    affectCash: debt.affectCash !== false,
  };
}
function getDebts() {
  const data = safeJSONParse(localStorage.getItem(STORAGE_KEYS.debts) || '[]', []);
  return Array.isArray(data) ? data.map(normalizeDebt).filter(Boolean) : [];
}
function saveDebts(items) { localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify(items)); }
function openDebts() { return getDebts().filter(d => d.status !== 'done'); }

function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseMoney(str) {
  if (!str) return NaN;
  let s = str.toString().toLowerCase().trim();
  s = s.replace(/\s/g, '').replace(/,/g, '.');
  if (/tr$/.test(s)) return Math.round(parseFloat(s.replace('tr', '')) * 1_000_000);
  if (/k$/.test(s)) return Math.round(parseFloat(s.replace('k', '')) * 1_000);
  const dots = (s.match(/\./g) || []).length;
  if (dots > 1) s = s.replace(/\./g, '');
  else if (dots === 1) {
    const parts = s.split('.');
    if (parts[1]?.length === 3) s = s.replace('.', '');
  }
  return parseFloat(s);
}






// Tự động định dạng ô tiền khi nhập trên điện thoại: 120000 -> 120.000
const MONEY_INPUT_IDS = [
  'inputAmount', 'incomeAmount', 'debtAmount',
  'inputBudget', 'inputOpeningBalance', 'inputSavingTarget',
  'customPresetAmount', 'sheetAmount', 'editAmount'
];

function formatMoneyInputValue(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

function attachMoneyAutoFormat(el) {
  if (!el || el.dataset.moneyFormatted === '1') return;
  el.dataset.moneyFormatted = '1';
  el.addEventListener('input', () => {
    const formatted = formatMoneyInputValue(el.value);
    el.value = formatted;
    // Đưa con trỏ về cuối ô nhập để thao tác trên iPhone mượt hơn
    requestAnimationFrame(() => {
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {}
    });
  });
}

function applyMoneyAutoFormat(root = document) {
  root.querySelectorAll('input[inputmode="numeric"], input[data-money-input="1"]').forEach(attachMoneyAutoFormat);
}

function bindMoneyAutoFormat() {
  MONEY_INPUT_IDS.forEach(id => attachMoneyAutoFormat($(id)));
}

function goToQuickEntry() {
  closeSheets();
  const quick = document.querySelector('#quick');
  if (quick) quick.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => {
    const amountInput = $('inputAmount');
    if (amountInput) amountInput.focus({ preventScroll: true });
  }, 450);
}

function fmtMoney(n) {
  if (isNaN(n) || n === null || n === undefined) return '—';
  return Number(n).toLocaleString('vi-VN') + ' ₫';
}
function fmtSignedMoney(n) { return n < 0 ? '-' + fmtMoney(Math.abs(n)) : fmtMoney(n); }
function roundToThousand(n) { return Math.max(0, Math.round(Number(n || 0) / 1000) * 1000); }
function toLocalISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function todayStr() { return toLocalISODate(); }
function thisMonthStr() { return todayStr().slice(0, 7); }
function lastMonthStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return toLocalISODate(d).slice(0, 7);
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function diffDaysFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayStr() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}
function defaultDebtDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalISODate(d);
}
function daysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(lastDay - now.getDate() + 1, 1);
}
function showToast(msg, duration = 2200) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

function populateSelect(select, items, includeAll = false, allLabel = 'Tất cả') {
  if (!select) return;
  select.innerHTML = includeAll ? `<option value="">${allLabel}</option>` : '';
  items.forEach(([name, icon]) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${icon} ${name}`;
    select.appendChild(opt);
  });
}

function populateCategorySelect(select, includeAll = false) { populateSelect(select, CATEGORIES, includeAll); }
function populateIncomeSelect(select, includeAll = false) { populateSelect(select, INCOME_SOURCES, includeAll); }
function populateMixedFilter() {
  const select = $('filterCat');
  if (!select) return;
  select.innerHTML = '<option value="">Tất cả</option>';
  const expenseGroup = document.createElement('optgroup');
  expenseGroup.label = 'Tiền ra';
  CATEGORIES.forEach(([name, icon]) => {
    const opt = document.createElement('option'); opt.value = name; opt.textContent = `${icon} ${name}`; expenseGroup.appendChild(opt);
  });
  const incomeGroup = document.createElement('optgroup');
  incomeGroup.label = 'Tiền vào';
  INCOME_SOURCES.forEach(([name, icon]) => {
    const opt = document.createElement('option'); opt.value = name; opt.textContent = `${icon} ${name}`; incomeGroup.appendChild(opt);
  });
  select.append(expenseGroup, incomeGroup);
}

function addTransaction({ kind = 'expense', amount, category, note = '', date = todayStr(), type = 'flexible', mood = 'normal' }) {
  if (!amount || isNaN(amount) || amount <= 0) {
    showToast('Số tiền không hợp lệ');
    return false;
  }
  const tx = {
    id: genId(),
    kind,
    amount: Math.round(amount),
    category: category || 'Khác',
    note,
    date,
    type: kind === 'expense' ? type : '',
    mood: kind === 'expense' ? mood : '',
    createdAt: new Date().toISOString(),
  };
  const txs = getTransactions();
  txs.unshift(tx);
  saveTransactions(txs);
  saveLastTx(tx);
  renderAll();
  showToast(`${kind === 'income' ? 'Đã ghi tiền vào' : 'Đã lưu chi tiêu'}: ${fmtMoney(tx.amount)}`);
  return true;
}

function deleteTransaction(id) {
  if (!confirm('Xóa giao dịch này?')) return;
  saveTransactions(getTransactions().filter(t => t.id !== id));
  renderAll();
  showToast('Đã xóa giao dịch');
}

function updateTransaction(id, updates) {
  const txs = getTransactions().map(t => t.id === id ? normalizeTx({ ...t, ...updates, amount: Math.round(updates.amount) }) : t).filter(Boolean);
  saveTransactions(txs);
  renderAll();
  showToast('Đã cập nhật giao dịch');
}

function addDebt({ direction = 'lent', person, amount, date = todayStr(), dueDate = '', note = '', affectCash = true }) {
  if (!person.trim()) { showToast('Nhập tên người liên quan'); return false; }
  if (!amount || isNaN(amount) || amount <= 0) { showToast('Số tiền nợ không hợp lệ'); return false; }
  const debt = {
    id: genId(), direction, person: person.trim(), amount: Math.round(amount), date, dueDate, note,
    status: 'open', createdAt: new Date().toISOString(), affectCash: !!affectCash,
  };
  const debts = getDebts();
  debts.unshift(debt);
  saveDebts(debts);
  if (affectCash) {
    if (direction === 'lent') {
      addTransaction({ kind: 'expense', amount, category: 'Cho vay / Nợ', note: `Cho ${person.trim()} nợ${note ? ' - ' + note : ''}`, date, type: 'flexible', mood: 'necessary' });
    } else {
      addTransaction({ kind: 'income', amount, category: 'Vay / Nợ', note: `Vay từ ${person.trim()}${note ? ' - ' + note : ''}`, date });
    }
  } else {
    renderAll();
  }
  showToast(direction === 'lent' ? 'Đã thêm khoản người khác nợ mình' : 'Đã thêm khoản mình đang nợ');
  return true;
}
function closeDebt(id) {
  const debt = getDebts().find(d => d.id === id);
  if (!debt) return;
  const action = debt.direction === 'lent' ? 'Đánh dấu đã thu nợ?' : 'Đánh dấu đã trả nợ?';
  if (!confirm(action)) return;
  const debts = getDebts().map(d => d.id === id ? { ...d, status: 'done', closedAt: new Date().toISOString() } : d);
  saveDebts(debts);
  if (debt.affectCash) {
    if (debt.direction === 'lent') {
      addTransaction({ kind: 'income', amount: debt.amount, category: 'Thu nợ', note: `Thu nợ từ ${debt.person}${debt.note ? ' - ' + debt.note : ''}`, date: todayStr() });
    } else {
      addTransaction({ kind: 'expense', amount: debt.amount, category: 'Trả nợ', note: `Trả nợ cho ${debt.person}${debt.note ? ' - ' + debt.note : ''}`, date: todayStr(), type: 'fixed', mood: 'necessary' });
    }
  } else {
    renderAll();
  }
  showToast(debt.direction === 'lent' ? 'Đã đánh dấu thu nợ' : 'Đã đánh dấu trả nợ');
}
function deleteDebt(id) {
  if (!confirm('Xóa khoản nợ này? Giao dịch tiền đã ghi trước đó sẽ không tự xóa.')) return;
  saveDebts(getDebts().filter(d => d.id !== id));
  renderAll();
  showToast('Đã xóa khoản nợ');
}
function debtTotals() {
  const open = openDebts();
  const receivable = sumTxs(open.filter(d => d.direction === 'lent'));
  const payable = sumTxs(open.filter(d => d.direction === 'borrowed'));
  const dueSoon = sumTxs(open.filter(d => { const x = diffDaysFromToday(d.dueDate); return x !== null && x >= 0 && x <= 3; }));
  const overdue = sumTxs(open.filter(d => { const x = diffDaysFromToday(d.dueDate); return x !== null && x < 0; }));
  return { open, receivable, payable, dueSoon, overdue };
}

function currentMonthTxs(kind = '') {
  return getTransactions().filter(t => t.date.startsWith(thisMonthStr()) && (!kind || t.kind === kind));
}
function sumTxs(txs) { return txs.reduce((s, t) => s + t.amount, 0); }
function expenseTxs(txs) { return txs.filter(t => t.kind !== 'income'); }
function incomeTxs(txs) { return txs.filter(t => t.kind === 'income'); }

function getFilteredTransactions() {
  const txs = getTransactions();
  const cat = $('filterCat')?.value || '';
  const type = $('filterType')?.value || '';
  const flow = $('filterFlow')?.value || '';
  const month = $('filterMonth')?.value || thisMonthStr();
  const today = todayStr();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekStart = toLocalISODate(weekAgo);

  return txs.filter(t => {
    let okRange = true;
    if (activeRange === 'today') okRange = t.date === today;
    if (activeRange === 'week') okRange = t.date >= weekStart && t.date <= today;
    if (activeRange === 'month') okRange = t.date.startsWith(month);
    if (!okRange) return false;
    if (flow && t.kind !== flow) return false;
    if (cat && t.category !== cat) return false;
    if (type && t.kind === 'expense' && t.type !== type) return false;
    if (type && t.kind === 'income') return false;
    return true;
  });
}

function renderKPI() {
  const txs = getTransactions();
  const monthExpenses = currentMonthTxs('expense');
  const monthIncomes = currentMonthTxs('income');
  const todayExpenses = expenseTxs(txs).filter(t => t.date === todayStr());
  const budget = getBudget();
  const openingBalance = getOpeningBalance();
  const savingTarget = getSavingTarget();

  const monthExpenseTotal = sumTxs(monthExpenses);
  const monthIncomeTotal = sumTxs(monthIncomes);
  const todayTotal = sumTxs(todayExpenses);
  const fixedTotal = sumTxs(monthExpenses.filter(t => t.type === 'fixed'));
  const flexibleTotal = monthExpenseTotal - fixedTotal;
  const cashBalance = openingBalance + monthIncomeTotal - monthExpenseTotal;
  const budgetRemain = budget > 0 ? budget - monthExpenseTotal : null;
  const cashAfterSaving = cashBalance - savingTarget;
  const spendableBase = budget > 0 ? Math.min(Math.max(budgetRemain, 0), Math.max(cashAfterSaving, 0)) : Math.max(cashAfterSaving, 0);
  const dailyLimit = Math.floor(spendableBase / daysLeftInMonth());

  $('kpiMonthIncome').textContent = fmtMoney(monthIncomeTotal);
  $('kpiMonthExpense').textContent = fmtMoney(monthExpenseTotal);
  $('kpiCashBalance').textContent = fmtSignedMoney(cashBalance);
  $('kpiToday').textContent = fmtMoney(todayTotal);
  $('kpiDailyLimit').textContent = spendableBase > 0 ? fmtMoney(dailyLimit) : '0 ₫';
  $('kpiMonth').textContent = fmtMoney(monthExpenseTotal);
  $('kpiRemain').textContent = budgetRemain !== null ? fmtSignedMoney(budgetRemain) : '—';
  $('kpiFixed').textContent = fmtMoney(fixedTotal);
  $('kpiFlexible').textContent = fmtMoney(flexibleTotal);
  $('kpiSavingTarget').textContent = savingTarget > 0 ? fmtMoney(savingTarget) : 'Chưa đặt';
  $('kpiSpendable').textContent = fmtMoney(Math.max(spendableBase, 0));
  const debtsKpi = debtTotals();
  $('kpiDebtReceivable').textContent = fmtMoney(debtsKpi.receivable);
  $('kpiDebtPayable').textContent = fmtMoney(debtsKpi.payable);

  renderBudgetProgress(monthExpenseTotal, budget);
  renderStatus({ monthExpenseTotal, monthIncomeTotal, cashBalance, budget, todayTotal, dailyLimit, spendableBase, savingTarget });
  renderAlerts({ monthExpenseTotal, cashBalance, budget, savingTarget, openingBalance, monthIncomeTotal });
  renderSuggestion({ monthExpenseTotal, monthIncomeTotal, cashBalance, budget, savingTarget, fixedTotal, flexibleTotal, spendableBase });
  renderSavingAdvice({ monthExpenseTotal, monthIncomeTotal, cashBalance, budget, savingTarget, fixedTotal, flexibleTotal, spendableBase });
}

function renderBudgetProgress(monthExpenseTotal, budget) {
  const fill = $('budgetProgressFill');
  const pct = $('budgetPercent');
  const label = $('budgetProgressLabel');
  if (budget <= 0) {
    fill.style.width = '0%';
    fill.className = 'budget-progress-fill';
    pct.textContent = '—';
    label.textContent = 'Chưa đặt ngân sách';
    return;
  }
  const ratio = monthExpenseTotal / budget;
  fill.style.width = Math.min(ratio * 100, 100).toFixed(1) + '%';
  pct.textContent = (ratio * 100).toFixed(1) + '%';
  label.textContent = `${fmtMoney(monthExpenseTotal)} / ${fmtMoney(budget)}`;
  fill.className = 'budget-progress-fill';
  if (ratio >= 1) fill.classList.add('over');
  else if (ratio >= 0.8) fill.classList.add('warn');
}

function renderStatus(data) {
  const { monthExpenseTotal, monthIncomeTotal, cashBalance, budget, todayTotal, dailyLimit, spendableBase } = data;
  const title = $('statusTitle');
  const subtitle = $('statusSubtitle');
  const pill = $('statusPill');

  if (monthIncomeTotal <= 0 && getOpeningBalance() <= 0) {
    title.textContent = 'Chưa có dòng tiền vào';
    subtitle.textContent = 'Hãy ghi tiền vào mỗi khi nhận được để số dư phản ánh đúng thực tế.';
    pill.textContent = 'Cần ghi tiền vào';
    pill.className = 'status-pill neutral';
    return;
  }
  if (cashBalance < 0) {
    title.textContent = 'Số dư đang âm';
    subtitle.textContent = `Bạn đã chi vượt phần tiền đang có khoảng ${fmtMoney(Math.abs(cashBalance))}.`;
    pill.textContent = 'Nguy hiểm';
    pill.className = 'status-pill danger';
    return;
  }
  if (budget > 0 && monthExpenseTotal >= budget) {
    title.textContent = 'Đã vượt ngân sách chi tiêu';
    subtitle.textContent = `Bạn đã vượt ${fmtMoney(monthExpenseTotal - budget)}. Nên dừng các khoản linh hoạt.`;
    pill.textContent = 'Vượt ngân sách';
    pill.className = 'status-pill danger';
    return;
  }
  if (spendableBase <= 0) {
    title.textContent = 'Nên tạm ngưng chi linh hoạt';
    subtitle.textContent = 'Sau khi trừ mục tiêu tiết kiệm/ngân sách, phần có thể tiêu gần như không còn.';
    pill.textContent = 'Cẩn thận';
    pill.className = 'status-pill warn';
    return;
  }
  if (todayTotal > dailyLimit && dailyLimit > 0) {
    title.textContent = 'Hôm nay hơi mạnh tay';
    subtitle.textContent = `Bạn đã vượt hạn mức gợi ý hôm nay ${fmtMoney(todayTotal - dailyLimit)}.`;
    pill.textContent = 'Chú ý hôm nay';
    pill.className = 'status-pill warn';
    return;
  }
  title.textContent = 'Dòng tiền đang ổn';
  subtitle.textContent = `Còn có thể tiêu khoảng ${fmtMoney(dailyLimit)}/ngày nếu giữ mục tiêu hiện tại.`;
  pill.textContent = 'An toàn';
  pill.className = 'status-pill good';
}

function renderAlerts(data) {
  const { monthExpenseTotal, cashBalance, budget, savingTarget, openingBalance, monthIncomeTotal } = data;
  const area = $('alertArea');
  const alerts = [];
  if (openingBalance <= 0 && monthIncomeTotal <= 0) alerts.push('<div class="alert alert-warn">💵 Bạn chưa ghi tiền vào. Hãy ghi từng lần nhận tiền để số dư không bị sai.</div>');
  if (cashBalance < 0) alerts.push(`<div class="alert alert-danger">🚨 Số dư âm ${fmtMoney(Math.abs(cashBalance))}. Cần kiểm tra lại khoản chi hoặc ghi thêm tiền vào nếu có.</div>`);
  if (budget > 0) {
    const ratio = monthExpenseTotal / budget;
    if (ratio >= 1) alerts.push(`<div class="alert alert-danger">🚨 Bạn đã vượt ngân sách tháng ${fmtMoney(monthExpenseTotal - budget)}.</div>`);
    else if (ratio >= 0.8) alerts.push(`<div class="alert alert-warn">⚠️ Bạn đã dùng ${(ratio * 100).toFixed(0)}% ngân sách. Nên hạn chế các khoản không cần thiết.</div>`);
  }
  if (savingTarget > 0 && cashBalance < savingTarget) alerts.push(`<div class="alert alert-warn">🏦 Số dư hiện tại chưa đủ mục tiêu tiết kiệm. Còn thiếu ${fmtMoney(savingTarget - cashBalance)}.</div>`);
  area.innerHTML = alerts.join('');
}

function renderSuggestion(data) {
  const { monthExpenseTotal, monthIncomeTotal, cashBalance, budget, savingTarget, fixedTotal, flexibleTotal, spendableBase } = data;
  const box = $('suggestionBox');
  let html = '';
  html += `💡 Công thức số dư: <strong>Số dư đầu tháng + tiền vào - tiền ra</strong>.<br>`;
  if (monthIncomeTotal > 0) html += `💵 Tháng này bạn đã có <strong>${fmtMoney(monthIncomeTotal)}</strong> tiền vào và <strong>${fmtMoney(monthExpenseTotal)}</strong> tiền ra.<br>`;
  if (spendableBase > 0) html += `🧭 Còn <strong>${daysLeftInMonth()} ngày</strong>. Hạn mức gợi ý là <strong>${fmtMoney(Math.floor(spendableBase / daysLeftInMonth()))}/ngày</strong>.<br>`;
  if (budget > 0 && budget < cashBalance) html += `🎯 Ngân sách đang thấp hơn số dư, nên app ưu tiên giới hạn theo ngân sách để bạn không tiêu quá tay.<br>`;
  if (fixedTotal > 0) html += `📌 Chi cố định chiếm <strong>${monthExpenseTotal ? ((fixedTotal / monthExpenseTotal) * 100).toFixed(0) : 0}%</strong>, chi linh hoạt là <strong>${fmtMoney(flexibleTotal)}</strong>.`;
  if (savingTarget > 0 && cashBalance >= savingTarget) html += `🏦 Nếu không chi thêm, bạn đang giữ được mục tiêu tiết kiệm <strong>${fmtMoney(savingTarget)}</strong>.`;
  box.innerHTML = html;
}


function renderSavingAdvice(data) {
  const card = $('savingAdviceCard');
  if (!card) return;

  const { monthExpenseTotal, monthIncomeTotal, cashBalance, budget, savingTarget, fixedTotal, flexibleTotal } = data;
  const day = new Date().getDate();
  const left = daysLeftInMonth();
  const avgFlexiblePerDay = day > 0 ? flexibleTotal / day : 0;
  const projectedFlexibleNeed = avgFlexiblePerDay * left;
  const budgetRemain = budget > 0 ? Math.max(budget - monthExpenseTotal, 0) : projectedFlexibleNeed;
  const livingBuffer = Math.max(projectedFlexibleNeed, budget > 0 ? budgetRemain : 0);
  const availableForSaving = Math.max(cashBalance - livingBuffer, 0);

  let safe = roundToThousand(availableForSaving * 0.35);
  let incomeTarget = monthIncomeTotal > 0 ? monthIncomeTotal * 0.2 : cashBalance * 0.15;
  let recommended = roundToThousand(Math.min(availableForSaving, Math.max(safe, incomeTarget)));
  let max = roundToThousand(availableForSaving);

  if (savingTarget > 0) {
    recommended = roundToThousand(Math.min(availableForSaving, Math.max(recommended, Math.min(savingTarget, availableForSaving))));
  }
  if (cashBalance <= 0) {
    safe = recommended = max = 0;
  }

  const rate = monthIncomeTotal > 0 ? Math.min((recommended / monthIncomeTotal) * 100, 100) : 0;
  const fill = $('savingProgressFill');
  if (fill) fill.style.width = `${Math.min(rate, 100).toFixed(0)}%`;

  $('savingSafe').textContent = fmtMoney(safe);
  $('savingRecommended').textContent = fmtMoney(recommended);
  $('savingMax').textContent = fmtMoney(max);
  $('savingRateValue').textContent = monthIncomeTotal > 0 ? `${rate.toFixed(0)}% tiền vào tháng này` : 'Cần ghi tiền vào';

  const score = $('savingScore');
  const text = $('savingAdviceText');
  const hint = $('savingHint');

  if (monthIncomeTotal <= 0 && getOpeningBalance() <= 0) {
    score.textContent = 'Chưa đủ dữ liệu';
    score.className = 'saving-score neutral';
    text.textContent = 'Hãy ghi tiền vào hoặc số dư đầu tháng để app tính mức tiết kiệm phù hợp hơn.';
    hint.textContent = 'Khi chưa có dữ liệu tiền vào, chưa nên đặt mức tiết kiệm tự động.';
    return;
  }

  if (recommended <= 0) {
    score.textContent = 'Chưa nên cất thêm';
    score.className = 'saving-score warn';
    text.textContent = 'Sau khi trừ khoản đã chi và phần nên giữ lại cho những ngày còn lại, hiện chưa có phần dư an toàn để tiết kiệm thêm.';
    hint.textContent = budget > 0
      ? 'Ưu tiên giảm chi linh hoạt hoặc chờ thêm tiền vào trước khi cất riêng tiền tiết kiệm.'
      : 'Bạn có thể đặt ngân sách tháng để gợi ý tiết kiệm chính xác hơn.';
    return;
  }

  if (savingTarget > 0 && recommended >= savingTarget) {
    score.textContent = 'Đủ mục tiêu';
    score.className = 'saving-score good';
    text.textContent = `Bạn có thể cất khoảng ${fmtMoney(recommended)} mà vẫn giữ lại phần dự phòng cho các ngày còn lại.`;
    hint.textContent = `Mức này đã chạm hoặc vượt mục tiêu tiết kiệm tháng ${fmtMoney(savingTarget)}.`;
    return;
  }

  score.textContent = 'Nên cất riêng';
  score.className = 'saving-score good';
  text.textContent = `Mức cân bằng nên tiết kiệm hiện tại là khoảng ${fmtMoney(recommended)}.`;
  hint.textContent = `App đã giữ lại khoảng ${fmtMoney(roundToThousand(livingBuffer))} làm vùng đệm chi tiêu cho ${left} ngày còn lại trong tháng.`;
}

function renderPresets() {
  const container = $('presetContainer');
  const groups = getPresetGroups();

  container.innerHTML = groups.map(group => `
    <div class="preset-group">
      <span class="preset-label">${escapeHTML(group.group)}</span>
      <div class="preset-btns">
        ${group.items.map(item => `
          <button class="preset-btn" type="button" data-amount="${item.amount}" data-cat="${escapeHTML(item.category)}" data-note="${escapeHTML(item.note || item.label)}">
            ${escapeHTML(item.label)}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      addTransaction({ kind: 'expense', amount: Number(btn.dataset.amount), category: btn.dataset.cat, note: btn.dataset.note, date: todayStr(), type: 'flexible', mood: 'normal' });
    });
  });
}

function renderCustomPresetList() {
  const list = $('customPresetList');
  if (!list) return;
  const groups = getPresetGroups();
  if (!groups.length) {
    list.innerHTML = '<div class="empty-small">Chưa có nút nhập nhanh.</div>';
    return;
  }

  list.innerHTML = `
    <div class="preset-manager-head">
      <div>
        <strong>Chỉnh sửa nút có sẵn</strong>
        <span>Đổi tên, số tiền, danh mục, ghi chú hoặc xóa nút không dùng.</span>
      </div>
      <button class="preset-reset-btn" type="button" id="btnResetPresets">Khôi phục mặc định</button>
    </div>
    ${groups.map((group, groupIndex) => `
      <div class="preset-edit-group">
        <div class="preset-edit-group-title">${escapeHTML(group.group)}</div>
        <div class="preset-edit-list">
          ${group.items.map((item, itemIndex) => `
            <div class="preset-edit-item" data-group-index="${groupIndex}" data-item-index="${itemIndex}">
              <input class="preset-edit-label" value="${escapeHTML(item.label)}" placeholder="Tên nút" />
              <input class="preset-edit-amount" inputmode="numeric" value="${formatMoneyInputValue(String(item.amount))}" placeholder="Số tiền" />
              <select class="preset-edit-category">
                ${CATEGORIES.map(([name, icon]) => `<option value="${escapeHTML(name)}" ${name === item.category ? 'selected' : ''}>${icon} ${escapeHTML(name)}</option>`).join('')}
              </select>
              <input class="preset-edit-note" value="${escapeHTML(item.note || '')}" placeholder="Ghi chú" />
              <div class="preset-edit-actions">
                <button class="preset-save-btn" type="button" data-save-preset="${groupIndex}-${itemIndex}">Lưu</button>
                <button class="preset-delete-btn" type="button" data-delete-preset="${groupIndex}-${itemIndex}">Xóa</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  `;

  applyMoneyAutoFormat(list);

  const resetBtn = $('btnResetPresets');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm('Khôi phục toàn bộ nút nhập nhanh về mặc định? Các nút bạn tự thêm sẽ bị xóa.')) return;
      localStorage.removeItem(STORAGE_KEYS.presetGroups);
      localStorage.removeItem(STORAGE_KEYS.customPresets);
      renderPresets();
      renderCustomPresetList();
      showToast('Đã khôi phục nút nhập nhanh mặc định');
    });
  }

  list.querySelectorAll('[data-save-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.preset-edit-item');
      const groupIndex = Number(row.dataset.groupIndex);
      const itemIndex = Number(row.dataset.itemIndex);
      const groups = getPresetGroups();
      const label = row.querySelector('.preset-edit-label').value.trim();
      const amount = parseMoney(row.querySelector('.preset-edit-amount').value);
      const category = row.querySelector('.preset-edit-category').value;
      const note = row.querySelector('.preset-edit-note').value.trim() || label;
      if (!label || isNaN(amount) || amount <= 0) { showToast('Tên nút hoặc số tiền chưa hợp lệ'); return; }
      groups[groupIndex].items[itemIndex] = { ...groups[groupIndex].items[itemIndex], label, amount: Math.round(amount), category, note };
      savePresetGroups(groups);
      renderPresets();
      renderCustomPresetList();
      showToast('Đã cập nhật nút nhập nhanh');
    });
  });

  list.querySelectorAll('[data-delete-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.preset-edit-item');
      const groupIndex = Number(row.dataset.groupIndex);
      const itemIndex = Number(row.dataset.itemIndex);
      const groups = getPresetGroups();
      const item = groups[groupIndex]?.items[itemIndex];
      if (!item) return;
      if (!confirm(`Xóa nút "${item.label}"?`)) return;
      groups[groupIndex].items.splice(itemIndex, 1);
      const cleaned = groups.filter(g => g.items.length);
      savePresetGroups(cleaned);
      renderPresets();
      renderCustomPresetList();
      showToast('Đã xóa nút nhập nhanh');
    });
  });
}

function renderRepeatLast() {
  const last = getLastTx();
  const area = $('repeatLastArea');
  const label = $('repeatLastLabel');
  if (!last) { area.hidden = true; return; }
  area.hidden = false;
  const sign = last.kind === 'income' ? '+' : '−';
  label.textContent = `${last.kind === 'income' ? '💵' : (CAT_ICONS[last.category] || '')} ${last.category} — ${sign}${fmtMoney(last.amount)}${last.note ? ' (' + last.note + ')' : ''}`;
}

function renderTransactions() {
  const txs = getFilteredTransactions();
  const list = $('txList');
  $('txCount').textContent = `${txs.length} giao dịch`;
  if (!txs.length) {
    list.innerHTML = '<div class="tx-empty">Không có giao dịch nào trong bộ lọc này.</div>';
    return;
  }

  list.innerHTML = txs.map(t => {
    const note = t.note ? `<span class="tx-note"> · ${escapeHTML(t.note)}</span>` : '';
    const isIncome = t.kind === 'income';
    const icon = isIncome ? (INCOME_ICONS[t.category] || '💰') : (CAT_ICONS[t.category] || '📦');
    const detail = isIncome ? 'Tiền vào' : `${t.type === 'fixed' ? 'Cố định' : 'Linh hoạt'} · ${MOOD_LABELS[t.mood] || 'Bình thường'}`;
    return `
      <article class="tx-item ${isIncome ? 'tx-income' : ''}" data-id="${t.id}">
        <div class="tx-cat-badge" style="--badge-color:${isIncome ? '#10b981' : (CAT_COLORS[t.category] || '#8b5cf6')}">${icon}</div>
        <div class="tx-body">
          <div class="tx-top"><span class="tx-cat-name">${escapeHTML(t.category)}</span>${note}</div>
          <div class="tx-date">${formatDate(t.date)} · ${detail}</div>
        </div>
        <div class="tx-amount ${isIncome ? 'income-amount' : ''}">${isIncome ? '+' : '−'}${fmtMoney(t.amount)}</div>
        <div class="tx-actions">
          <button class="tx-edit" data-edit="${t.id}" title="Sửa">Sửa</button>
          <button class="tx-delete" data-delete="${t.id}" title="Xóa">✕</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteTransaction(btn.dataset.delete)));
  list.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openEditSheet(btn.dataset.edit)));
}


function renderDebts() {
  const { open, receivable, payable, dueSoon, overdue } = debtTotals();
  $('debtCount').textContent = `${open.length} khoản mở`;
  $('debtReceivableTotal').textContent = fmtMoney(receivable);
  $('debtPayableTotal').textContent = fmtMoney(payable);
  $('debtDueSoonTotal').textContent = fmtMoney(dueSoon);
  $('debtOverdueTotal').textContent = fmtMoney(overdue);

  const advice = [];
  const sorted = [...open].sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'));
  sorted.slice(0, 4).forEach(d => {
    const days = diffDaysFromToday(d.dueDate);
    const who = escapeHTML(d.person);
    const amount = fmtMoney(d.amount);
    if (days === null) {
      advice.push(`📌 ${who}: chưa có ngày hẹn. Nên đặt hạn để khỏi quên.`);
    } else if (days < 0) {
      advice.push(d.direction === 'lent'
        ? `🚨 ${who} đã quá hạn ${Math.abs(days)} ngày. Nên nhắn đòi ${amount} ngay.`
        : `🚨 Bạn đã quá hạn trả ${who} ${Math.abs(days)} ngày. Nên trả hoặc xin hẹn lại.`);
    } else if (days === 0) {
      advice.push(d.direction === 'lent'
        ? `⏰ Hôm nay đến hạn đòi ${who} ${amount}.`
        : `⏰ Hôm nay đến hạn trả ${who} ${amount}.`);
    } else if (days <= 3) {
      advice.push(d.direction === 'lent'
        ? `🔔 Còn ${days} ngày đến hạn. Có thể nhắc nhẹ ${who} về khoản ${amount}.`
        : `🔔 Còn ${days} ngày đến hạn trả ${who}. Nên chuẩn bị ${amount}.`);
    }
  });
  $('debtAdvice').innerHTML = advice.length
    ? advice.map(x => `<div class="debt-advice-item">${x}</div>`).join('')
    : '<div class="debt-advice-item good">Chưa có khoản nợ nào cần nhắc gấp.</div>';

  const list = $('debtList');
  if (!open.length) {
    list.innerHTML = '<div class="tx-empty">Chưa có khoản nợ/vay nào đang mở.</div>';
    return;
  }
  list.innerHTML = sorted.map(d => {
    const days = diffDaysFromToday(d.dueDate);
    let dueText = d.dueDate ? `Hạn: ${formatDate(d.dueDate)}` : 'Chưa đặt hạn';
    let dueClass = '';
    if (days !== null && days < 0) { dueText += ` · Quá hạn ${Math.abs(days)} ngày`; dueClass = 'overdue'; }
    else if (days === 0) { dueText += ' · Hôm nay'; dueClass = 'today'; }
    else if (days !== null && days <= 3) { dueText += ` · Còn ${days} ngày`; dueClass = 'soon'; }
    const isLent = d.direction === 'lent';
    return `
      <article class="debt-item ${isLent ? 'lent' : 'borrowed'} ${dueClass}">
        <div class="debt-badge">${isLent ? '🤝' : '🧾'}</div>
        <div class="debt-body">
          <div class="debt-top"><strong>${escapeHTML(d.person)}</strong><span>${isLent ? 'Nợ mình' : 'Mình nợ'}</span></div>
          <div class="debt-meta">${dueText} · Phát sinh ${formatDate(d.date)}${d.note ? ' · ' + escapeHTML(d.note) : ''}</div>
        </div>
        <div class="debt-amount">${fmtMoney(d.amount)}</div>
        <div class="debt-actions">
          <button data-close-debt="${d.id}" class="debt-done">${isLent ? 'Đã thu' : 'Đã trả'}</button>
          <button data-delete-debt="${d.id}" class="tx-delete">✕</button>
        </div>
      </article>`;
  }).join('');
  list.querySelectorAll('[data-close-debt]').forEach(btn => btn.addEventListener('click', () => closeDebt(btn.dataset.closeDebt)));
  list.querySelectorAll('[data-delete-debt]').forEach(btn => btn.addEventListener('click', () => deleteDebt(btn.dataset.deleteDebt)));
}

function renderInsights() {
  const txs = getTransactions();
  const monthExpenses = currentMonthTxs('expense');
  const monthIncomes = currentMonthTxs('income');
  const prevExpenses = expenseTxs(txs).filter(t => t.date.startsWith(lastMonthStr()));
  const expenseTotal = sumTxs(monthExpenses);
  const incomeTotal = sumTxs(monthIncomes);
  const prevExpenseTotal = sumTxs(prevExpenses);
  const cashBalance = getOpeningBalance() + incomeTotal - expenseTotal;
  const budget = getBudget();
  const insights = [];

  if (!monthIncomes.length && getOpeningBalance() <= 0) insights.push({ type: 'warn', text: '💵 Tháng này chưa ghi tiền vào. Nên ghi từng lần nhận tiền để app tính đúng số dư.' });
  if (!txs.some(t => t.kind === 'expense' && t.date === todayStr())) insights.push({ type: 'warn', text: '📝 Hôm nay bạn chưa ghi khoản chi nào. Bấm nút + Ghi nhanh để lưu ngay.' });
  if (monthExpenses.length) {
    const byCat = {};
    monthExpenses.forEach(t => byCat[t.category] = (byCat[t.category] || 0) + t.amount);
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    insights.push({ type: 'info', text: `📊 Tháng này bạn tiêu nhiều nhất vào <strong>${top[0]}</strong>: ${fmtMoney(top[1])}.` });
  }
  if (incomeTotal > 0) insights.push({ type: 'good', text: `💵 Tiền vào tháng này là <strong>${fmtMoney(incomeTotal)}</strong>, tiền ra là <strong>${fmtMoney(expenseTotal)}</strong>.` });
  if (prevExpenseTotal > 0) {
    const diff = expenseTotal - prevExpenseTotal;
    insights.push(diff > 0
      ? { type: 'warn', text: `📈 Tháng này đang chi nhiều hơn tháng trước ${fmtMoney(diff)}.` }
      : { type: 'good', text: `📉 Tháng này đang chi ít hơn tháng trước ${fmtMoney(Math.abs(diff))}.` });
  }
  if (budget > 0) {
    const ratio = expenseTotal / budget;
    if (ratio >= 1) insights.push({ type: 'danger', text: `🚨 Đã vượt ngân sách ${fmtMoney(expenseTotal - budget)}.` });
    else if (ratio >= 0.8) insights.push({ type: 'warn', text: `⚠️ Đã dùng ${(ratio * 100).toFixed(0)}% ngân sách.` });
  }
  const wasteTotal = sumTxs(monthExpenses.filter(t => ['waste', 'regret'].includes(t.mood)));
  if (wasteTotal > 0) insights.push({ type: 'warn', text: `🤔 Các khoản “hơi phí/hối hận” tháng này là ${fmtMoney(wasteTotal)}.` });
  if (cashBalance < 0) insights.push({ type: 'danger', text: `🚨 Số dư tháng này đang âm ${fmtMoney(Math.abs(cashBalance))}.` });
  const debtsNow = debtTotals();
  if (debtsNow.overdue > 0) insights.push({ type: 'danger', text: `🤝 Có ${fmtMoney(debtsNow.overdue)} khoản nợ đã quá hạn. Nên xử lý trước.` });
  else if (debtsNow.dueSoon > 0) insights.push({ type: 'warn', text: `🤝 Có ${fmtMoney(debtsNow.dueSoon)} khoản nợ sắp đến hạn trong 3 ngày.` });

  const insightMeta = {
    good: { icon: '✅', title: 'Đang ổn' },
    warn: { icon: '⚠️', title: 'Cần chú ý' },
    danger: { icon: '🚨', title: 'Ưu tiên xử lý' },
    info: { icon: '📊', title: 'Thông tin' }
  };
  $('insightsList').innerHTML = insights.length
    ? insights.map(i => {
        const meta = insightMeta[i.type] || insightMeta.info;
        return `<article class="insight-item ${i.type}"><span class="insight-icon">${meta.icon}</span><div><b>${meta.title}</b><p>${i.text}</p></div></article>`;
      }).join('')
    : '<article class="insight-item good"><span class="insight-icon">✨</span><div><b>Đang ổn</b><p>Mọi thứ đang ổn. Tiếp tục ghi chép đều nhé.</p></div></article>';
}

function renderExtraStats() {
  const monthExpenses = currentMonthTxs('expense');
  const monthIncomes = currentMonthTxs('income');
  const top = [...monthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
  $('topExpenses').innerHTML = top.length ? top.map((t, i) => `
    <div class="rank-item"><span>${i + 1}. ${CAT_ICONS[t.category] || ''} ${escapeHTML(t.note || t.category)}</span><strong>${fmtMoney(t.amount)}</strong></div>
  `).join('') : '<div class="empty-small">Chưa có dữ liệu chi tiêu tháng này.</div>';

  const topIn = [...monthIncomes].sort((a, b) => b.amount - a.amount).slice(0, 5);
  $('topIncomes').innerHTML = topIn.length ? topIn.map((t, i) => `
    <div class="rank-item income-rank"><span>${i + 1}. ${INCOME_ICONS[t.category] || '💰'} ${escapeHTML(t.note || t.category)}</span><strong>+${fmtMoney(t.amount)}</strong></div>
  `).join('') : '<div class="empty-small">Chưa có tiền vào tháng này.</div>';

  const byDay = {};
  monthExpenses.forEach(t => byDay[t.date] = (byDay[t.date] || 0) + t.amount);
  const maxDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  $('biggestDay').innerHTML = maxDay ? `<strong>${formatDate(maxDay[0])}</strong><span>${fmtMoney(maxDay[1])}</span>` : '—';

  const byMood = { necessary: 0, normal: 0, waste: 0, regret: 0 };
  monthExpenses.forEach(t => byMood[t.mood || 'normal'] += t.amount);
  $('moodStats').innerHTML = Object.entries(byMood).map(([mood, val]) => `
    <div class="mood-row"><span>${MOOD_LABELS[mood]}</span><strong>${fmtMoney(val)}</strong></div>
  `).join('');
}

function chartEmptyPlugin() {
  return {
    id: 'emptyMessage',
    afterDraw(chart) {
      const data = chart.data.datasets?.flatMap(ds => ds.data || []) || [];
      const sum = data.reduce((a, b) => a + Number(b || 0), 0);
      if (sum > 0) return;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Be Vietnam Pro';
      ctx.fillText('Chưa có dữ liệu', (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
      ctx.restore();
    }
  };
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;
  const month = $('filterMonth')?.value || thisMonthStr();
  const monthExpenses = getTransactions().filter(t => t.kind === 'expense' && t.date.startsWith(month));
  const monthIncomes = getTransactions().filter(t => t.kind === 'income' && t.date.startsWith(month));
  const expenseTotal = sumTxs(monthExpenses);

  const catTotals = {};
  monthExpenses.forEach(t => catTotals[t.category] = (catTotals[t.category] || 0) + t.amount);
  const catKeys = Object.keys(CAT_ICONS);
  const catData = catKeys.map(k => catTotals[k] || 0);

  if (_chartPie) _chartPie.destroy();
  _chartPie = new Chart($('chartPie'), {
    type: 'doughnut',
    plugins: [chartEmptyPlugin()],
    data: {
      labels: catKeys.map(k => `${CAT_ICONS[k]} ${k}`),
      datasets: [{ data: catData, backgroundColor: catKeys.map(k => CAT_COLORS[k]), borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: window.innerWidth < 640 ? 'bottom' : 'right', labels: { boxWidth: 12, font: { family: 'Be Vietnam Pro', size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtMoney(ctx.raw)}${expenseTotal ? ` (${((ctx.raw / expenseTotal) * 100).toFixed(1)}%)` : ''}` } }
      }
    }
  });

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const dayLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  const dayExpenses = Array(daysInMonth).fill(0);
  const dayIncomes = Array(daysInMonth).fill(0);
  monthExpenses.forEach(t => { const idx = Number(t.date.slice(8, 10)) - 1; if (idx >= 0) dayExpenses[idx] += t.amount; });
  monthIncomes.forEach(t => { const idx = Number(t.date.slice(8, 10)) - 1; if (idx >= 0) dayIncomes[idx] += t.amount; });

  if (_chartBar) _chartBar.destroy();
  _chartBar = new Chart($('chartBar'), {
    type: 'bar',
    plugins: [chartEmptyPlugin()],
    data: {
      labels: dayLabels,
      datasets: [
        { label: 'Tiền vào', data: dayIncomes, backgroundColor: '#10b98166', borderRadius: 6 },
        { label: 'Tiền ra', data: dayExpenses, backgroundColor: '#1a6cff33', borderColor: '#1a6cff', borderWidth: 1.5, borderRadius: 6 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12, font: { family: 'Be Vietnam Pro', size: 11 } } } },
      scales: {
        y: { ticks: { callback: v => v >= 1000 ? `${v / 1000}k` : v }, grid: { color: '#f1f5f9' } },
        x: { ticks: { maxTicksLimit: window.innerWidth < 640 ? 8 : 16 }, grid: { display: false } }
      }
    }
  });

  renderCompareChart(month);
}

function renderCompareChart(currentMonth) {
  const [y, m] = currentMonth.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const allTxs = getTransactions().filter(t => t.kind === 'expense');
  const cats = Object.keys(CAT_ICONS);
  const currentData = cats.map(c => sumTxs(allTxs.filter(t => t.date.startsWith(currentMonth) && t.category === c)));
  const prevData = cats.map(c => sumTxs(allTxs.filter(t => t.date.startsWith(prevMonth) && t.category === c)));

  if (_chartCompare) _chartCompare.destroy();
  _chartCompare = new Chart($('chartCompare'), {
    type: 'bar',
    plugins: [chartEmptyPlugin()],
    data: {
      labels: cats.map(c => `${CAT_ICONS[c]} ${c}`),
      datasets: [
        { label: `Tháng ${m}`, data: currentData, backgroundColor: '#1a6cff99', borderRadius: 5 },
        { label: `Tháng ${prevDate.getMonth() + 1}`, data: prevData, backgroundColor: '#10b98166', borderRadius: 5 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12, font: { family: 'Be Vietnam Pro', size: 11 } } } },
      scales: {
        y: { ticks: { callback: v => v >= 1000 ? `${v / 1000}k` : v }, grid: { color: '#f1f5f9' } },
        x: { ticks: { maxRotation: 35, font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

function openSheet(sheet) {
  $('sheetBackdrop').hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
}
function closeSheets() {
  document.querySelectorAll('.bottom-sheet').forEach(sheet => {
    sheet.classList.remove('open');
    setTimeout(() => sheet.hidden = true, 180);
  });
  $('sheetBackdrop').hidden = true;
}
function setSheetKind(kind) {
  sheetKind = kind;
  document.querySelectorAll('[data-sheet-kind]').forEach(btn => btn.classList.toggle('active', btn.dataset.sheetKind === kind));
  if (kind === 'income') {
    populateIncomeSelect($('sheetCategory'));
    $('sheetCategory').value = 'Lương / Part-time';
    document.querySelector('.sheet-expense-extra').style.display = 'none';
  } else {
    populateCategorySelect($('sheetCategory'));
    $('sheetCategory').value = 'Ăn uống';
    document.querySelector('.sheet-expense-extra').style.display = '';
  }
}
function setEditKind(kind) {
  editKind = kind;
  document.querySelectorAll('[data-edit-kind]').forEach(btn => btn.classList.toggle('active', btn.dataset.editKind === kind));
  if (kind === 'income') {
    populateIncomeSelect($('editCategory'));
    document.querySelector('.edit-expense-extra').style.display = 'none';
  } else {
    populateCategorySelect($('editCategory'));
    document.querySelector('.edit-expense-extra').style.display = '';
  }
}
function openQuickSheet() {
  $('sheetAmount').value = '';
  $('sheetNote').value = '';
  $('sheetDate').value = todayStr();
  setSheetKind('expense');
  openSheet($('quickSheet'));
  setTimeout(() => $('sheetAmount').focus(), 100);
}
function openEditSheet(id) {
  const tx = getTransactions().find(t => t.id === id);
  if (!tx) return;
  $('editId').value = tx.id;
  $('editAmount').value = tx.amount.toLocaleString('vi-VN');
  setEditKind(tx.kind || 'expense');
  $('editCategory').value = tx.category;
  $('editDate').value = tx.date;
  $('editNote').value = tx.note || '';
  $('editType').value = tx.type || 'flexible';
  $('editMood').value = tx.mood || 'normal';
  openSheet($('editSheet'));
}

function exportCSV() {
  const txs = getTransactions();
  if (!txs.length) { showToast('Chưa có dữ liệu để xuất'); return; }
  const header = ['Ngày', 'Dòng tiền', 'Số tiền (VND)', 'Danh mục/Nguồn', 'Ghi chú', 'Loại chi', 'Cảm giác'];
  const rows = txs.map(t => [
    t.date,
    t.kind === 'income' ? 'Tiền vào' : 'Tiền ra',
    t.amount,
    t.category,
    `"${(t.note || '').replace(/"/g, '""')}"`,
    t.kind === 'expense' ? (t.type === 'fixed' ? 'Cố định' : 'Linh hoạt') : '',
    t.kind === 'expense' ? (MOOD_LABELS[t.mood] || t.mood) : '',
  ]);
  const bom = '\uFEFF';
  const csv = bom + [header, ...rows].map(r => r.join(',')).join('\n');
  downloadBlob(csv, `dong-tien-${thisMonthStr()}.csv`, 'text/csv;charset=utf-8;');
  showToast(`Đã xuất ${txs.length} giao dịch`);
}

function backupJSON() {
  const data = {
    transactions: getTransactions(),
    budget: getBudget(),
    openingBalance: getOpeningBalance(),
    savingTarget: getSavingTarget(),
    presetGroups: getPresetGroups(),
    customPresets: getCustomPresets(),
    debts: getDebts(),
    exportedAt: new Date().toISOString(),
  };
  downloadBlob(JSON.stringify(data, null, 2), `backup-chi-tieu-${todayStr()}.json`, 'application/json');
}
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = safeJSONParse(reader.result, null);
    if (!data || !Array.isArray(data.transactions)) { showToast('File backup không hợp lệ'); return; }
    if (!confirm('Nhập backup sẽ ghi đè dữ liệu hiện tại. Tiếp tục?')) return;
    saveTransactions(data.transactions.map(normalizeTx).filter(Boolean));
    saveNumber(STORAGE_KEYS.budget, data.budget || 0);
    saveNumber(STORAGE_KEYS.openingBalance, data.openingBalance || data.income || 0);
    saveNumber(STORAGE_KEYS.savingTarget, data.savingTarget || 0);
    if (Array.isArray(data.presetGroups)) savePresetGroups(data.presetGroups);
    else saveCustomPresets(Array.isArray(data.customPresets) ? data.customPresets : []);
    saveDebts(Array.isArray(data.debts) ? data.debts.map(normalizeDebt).filter(Boolean) : []);
    hydrateSettingsInputs(true);
    renderAll();
    showToast('Đã nhập backup');
  };
  reader.readAsText(file);
}

function renderAll() {
  renderKPI();
  renderPresets();
  renderRepeatLast();
  renderTransactions();
  renderDebts();
  renderInsights();
  renderExtraStats();
  renderCharts();
  renderCustomPresetList();
}
function hydrateSettingsInputs(clear = false) {
  if (clear) {
    $('inputBudget').value = '';
    $('inputOpeningBalance').value = '';
    $('inputSavingTarget').value = '';
  }
  if (getBudget() > 0) $('inputBudget').value = getBudget().toLocaleString('vi-VN');
  if (getOpeningBalance() > 0) $('inputOpeningBalance').value = getOpeningBalance().toLocaleString('vi-VN');
  if (getSavingTarget() > 0) $('inputSavingTarget').value = getSavingTarget().toLocaleString('vi-VN');
}
function saveSettingMoney(key, inputId, message, allowZero = true) {
  const raw = $(inputId).value.trim();
  const val = raw ? parseMoney(raw) : 0;
  if (isNaN(val) || val < 0 || (!allowZero && val <= 0)) { showToast('Giá trị không hợp lệ'); return; }
  saveNumber(key, val);
  renderAll();
  showToast(message);
}
function syncRangeButtons() {
  document.querySelectorAll('.range-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.range === activeRange));
}
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function initEventListeners() {
  bindMoneyAutoFormat();
  $('expenseForm').addEventListener('submit', e => {
    e.preventDefault();
    const ok = addTransaction({
      kind: 'expense',
      amount: parseMoney($('inputAmount').value),
      category: $('inputCategory').value,
      note: $('inputNote').value.trim(),
      date: $('inputDate').value || todayStr(),
      type: $('inputType').value,
      mood: $('inputMood').value,
    });
    if (ok) {
      $('inputAmount').value = '';
      $('inputNote').value = '';
      $('inputDate').value = todayStr();
      $('inputType').value = 'flexible';
      $('inputMood').value = 'normal';
    }
  });

  $('incomeForm').addEventListener('submit', e => {
    e.preventDefault();
    const ok = addTransaction({
      kind: 'income',
      amount: parseMoney($('incomeAmount').value),
      category: $('incomeSource').value,
      note: $('incomeNote').value.trim(),
      date: $('incomeDate').value || todayStr(),
    });
    if (ok) {
      $('incomeAmount').value = '';
      $('incomeNote').value = '';
      $('incomeDate').value = todayStr();
    }
  });


  $('debtForm').addEventListener('submit', e => {
    e.preventDefault();
    const ok = addDebt({
      direction: $('debtDirection').value,
      person: $('debtPerson').value,
      amount: parseMoney($('debtAmount').value),
      date: $('debtDate').value || todayStr(),
      dueDate: $('debtDueDate').value,
      note: $('debtNote').value.trim(),
      affectCash: $('debtAffectCash').checked,
    });
    if (ok) {
      $('debtPerson').value = '';
      $('debtAmount').value = '';
      $('debtNote').value = '';
      $('debtDate').value = todayStr();
      $('debtDueDate').value = defaultDebtDueDate();
      $('debtAffectCash').checked = true;
    }
  });

  $('btnFocusAmount').addEventListener('click', () => $('inputAmount').focus());
  $('btnFocusIncome').addEventListener('click', () => $('incomeAmount').focus());
  $('btnRepeatLast').addEventListener('click', () => {
    const last = getLastTx();
    if (!last) return;
    addTransaction({ kind: last.kind || 'expense', amount: last.amount, category: last.category, note: last.note, date: todayStr(), type: last.type || 'flexible', mood: last.mood || 'normal' });
  });

  $('btnSetBudget').addEventListener('click', () => saveSettingMoney(STORAGE_KEYS.budget, 'inputBudget', 'Đã lưu ngân sách'));
  $('btnSetOpeningBalance').addEventListener('click', () => saveSettingMoney(STORAGE_KEYS.openingBalance, 'inputOpeningBalance', 'Đã lưu số dư đầu tháng'));
  $('btnSetSavingTarget').addEventListener('click', () => saveSettingMoney(STORAGE_KEYS.savingTarget, 'inputSavingTarget', 'Đã lưu mục tiêu tiết kiệm'));

  $('filterMonth').addEventListener('change', () => { activeRange = 'month'; syncRangeButtons(); renderAll(); });
  $('filterCat').addEventListener('change', renderTransactions);
  $('filterType').addEventListener('change', renderTransactions);
  $('filterFlow').addEventListener('change', renderTransactions);
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeRange = btn.dataset.range;
      syncRangeButtons();
      renderTransactions();
    });
  });

  $('btnExportCSV').addEventListener('click', exportCSV);
  $('btnBackupJSON').addEventListener('click', backupJSON);
  $('inputImportJSON').addEventListener('change', e => e.target.files?.[0] && importJSON(e.target.files[0]));

  $('btnClearAll').addEventListener('click', () => {
    if (!confirm('Xóa toàn bộ dữ liệu chi tiêu?')) return;
    if (!confirm('Hành động này không thể hoàn tác. Xác nhận lần cuối?')) return;
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    hydrateSettingsInputs(true);
    renderAll();
    showToast('Đã xóa toàn bộ dữ liệu');
  });

  $('btnAddCustomPreset').addEventListener('click', () => {
    const label = $('customPresetLabel').value.trim();
    const amount = parseMoney($('customPresetAmount').value);
    const category = $('customPresetCat').value;
    const note = $('customPresetNote').value.trim() || label;
    if (!label || isNaN(amount) || amount <= 0) { showToast('Nhập tên nút và số tiền hợp lệ'); return; }
    const groups = getPresetGroups();
    let customGroup = groups.find(g => g.group.includes('Của tôi'));
    if (!customGroup) {
      customGroup = { group: '⭐ Của tôi', items: [] };
      groups.push(customGroup);
    }
    customGroup.items.push({ id: genId(), label, amount: Math.round(amount), category, note });
    savePresetGroups(groups);
    $('customPresetLabel').value = '';
    $('customPresetAmount').value = '';
    $('customPresetNote').value = '';
    renderPresets();
    renderCustomPresetList();
    showToast('Đã thêm nút nhập nhanh');
  });

  $('fabAdd').addEventListener('click', goToQuickEntry);
  $('btnOpenSettings').addEventListener('click', () => document.querySelector('#settings').scrollIntoView({ behavior: 'smooth' }));
  $('sheetBackdrop').addEventListener('click', closeSheets);
  document.querySelectorAll('[data-close-sheet]').forEach(btn => btn.addEventListener('click', closeSheets));
  document.querySelectorAll('[data-sheet-kind]').forEach(btn => btn.addEventListener('click', () => setSheetKind(btn.dataset.sheetKind)));
  document.querySelectorAll('[data-edit-kind]').forEach(btn => btn.addEventListener('click', () => setEditKind(btn.dataset.editKind)));

  $('sheetForm').addEventListener('submit', e => {
    e.preventDefault();
    const ok = addTransaction({
      kind: sheetKind,
      amount: parseMoney($('sheetAmount').value),
      category: $('sheetCategory').value,
      note: $('sheetNote').value.trim(),
      date: $('sheetDate').value || todayStr(),
      type: $('sheetType').value,
      mood: $('sheetMood').value,
    });
    if (ok) closeSheets();
  });

  $('editForm').addEventListener('submit', e => {
    e.preventDefault();
    const amount = parseMoney($('editAmount').value);
    if (isNaN(amount) || amount <= 0) { showToast('Số tiền không hợp lệ'); return; }
    updateTransaction($('editId').value, {
      kind: editKind,
      amount,
      category: $('editCategory').value,
      note: $('editNote').value.trim(),
      date: $('editDate').value || todayStr(),
      type: editKind === 'expense' ? $('editType').value : '',
      mood: editKind === 'expense' ? $('editMood').value : '',
    });
    closeSheets();
  });

  window.addEventListener('resize', debounce(renderCharts, 250));
}

function init() {
  ['inputCategory', 'customPresetCat'].forEach(id => populateCategorySelect($(id)));
  populateIncomeSelect($('incomeSource'));
  populateMixedFilter();
  setSheetKind('expense');
  setEditKind('expense');
  $('inputDate').value = todayStr();
  $('incomeDate').value = todayStr();
  $('debtDate').value = todayStr();
  $('debtDueDate').value = defaultDebtDueDate();
  $('sheetDate').value = todayStr();
  $('filterMonth').value = thisMonthStr();
  hydrateSettingsInputs(true);
  initEventListeners();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
