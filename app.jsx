/* ==========================================================
   o_C 总控 · 一体化工作台
   单文件 React 应用（零构建，Babel Standalone 运行时编译）
   ========================================================== */

const { useState, useEffect, useMemo, useRef } = React;
// 极简 hash 路由实现
function useHashRoute() {
  const [hash, setHash] = React.useState(window.location.hash.slice(1) || '/');
  React.useEffect(() => {
    const handler = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  const navigate = (path) => { window.location.hash = path; };
  return { path: hash, navigate };
}

function NavLink({ to, children, className, activeClassName }) {
  const { path } = useHashRoute();
  const isActive = path === to || (to !== '/' && path.startsWith(to));
  const cls = (className || '') + (isActive ? ' ' + (activeClassName || 'active') : '');
  return <a href={'#' + to} className={cls}>{children}</a>;
}

function Link({ to, children, className }) {
  return <a href={'#' + to} className={className}>{children}</a>;
}
function Routes({ children }) {
  const { path } = useHashRoute();
  let matched = null;
  React.Children.forEach(children, child => {
    if (!matched && child.props.path === path) matched = child;
  });
  // fallback to first route if no match
  if (!matched && React.Children.count(children) > 0) {
    matched = React.Children.toArray(children).find(c => c.props.path === '/') || React.Children.toArray(children)[0];
  }
  return matched ? matched.props.element : null;
}
function Route({ path, element }) { return null; }

/* ==========================================================
   常量与工具函数
   ========================================================== */

// 模块列表
const MODULES = [
  { key: '教学管理', icon: '📚', color: 'blue', path: '/teaching' },
  { key: '自媒体运营', icon: '✨', color: 'purple', path: '/media' },
  { key: '国际中文教学', icon: '🌏', color: 'cyan', path: '/chinese' },
  { key: '动画项目矩阵', icon: '🎬', color: 'pink', path: '/animation' },
  { key: '同等学力申硕', icon: '🎓', color: 'green', path: '/degree' },
  { key: '个人财务&生活', icon: '💰', color: 'yellow', path: '/finance' },
  { key: '想法沉淀与目标对齐', icon: '💡', color: 'orange', path: '/ideas' },
];

const STATUS_OPTIONS = ['待执行', '进行中', '已完成', '搁置', '归档'];
const STATUS_COLORS = {
  '待执行': 'tag-gray',
  '进行中': 'tag-blue',
  '已完成': 'tag-green',
  '搁置': 'tag-yellow',
  '归档': 'tag-gray',
};

const PRIORITY_OPTIONS = ['高', '中', '低'];
const PRIORITY_COLORS = {
  '高': 'tag-red',
  '中': 'tag-yellow',
  '低': 'tag-gray',
};

// 隐私密码
const STORAGE_KEY = 'oc_console_unlocked';
const PASSWORD_KEY = 'oc_console_password';
const DEFAULT_PASSWORD = '888888';

function getPassword() {
  return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
}
function checkPassword(input) {
  return input === getPassword();
}
function isUnlocked() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}
function unlock() {
  localStorage.setItem(STORAGE_KEY, 'true');
}
function lock() {
  localStorage.removeItem(STORAGE_KEY);
}

// 日期工具
function formatDate(dateInput) {
  if (!dateInput) return '-';
  let d;
  if (Array.isArray(dateInput)) d = new Date(dateInput[0]);
  else if (typeof dateInput === 'number') d = new Date(dateInput);
  else d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDueStatus(dateInput, status) {
  if (!dateInput || status === '已完成' || status === '归档') return 'normal';
  let d;
  if (Array.isArray(dateInput)) d = new Date(dateInput[0]);
  else if (typeof dateInput === 'number') d = new Date(dateInput);
  else d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'normal';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d < today) return 'overdue';
  if (d.getTime() === today.getTime()) return 'today';
  const diff = (d - today) / (1000 * 60 * 60 * 24);
  if (diff <= 3) return 'near';
  return 'normal';
}

function makeVersionEntry(action) {
  return `${new Date().toLocaleString('zh-CN')} - ${action}\n`;
}

function parseVersionHistory(text) {
  if (!text) return [];
  return text.split('\n').filter(line => line.trim()).map(line => {
    const match = line.match(/^(.+?)\s*-\s*(.+)$/);
    if (match) return { time: match[1].trim(), action: match[2].trim() };
    return { time: '', action: line.trim() };
  });
}

function calcStatusStats(records) {
  const stats = {
    total: records.length, todo: 0, doing: 0, done: 0,
    onHold: 0, archived: 0, overdue: 0, todayDue: 0, nearDue: 0,
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(today.getDate() + 3);

  records.forEach(r => {
    const status = r.fields['任务状态'];
    const dueText = r.fields['截止时间'];
    let dueDate = null;
    if (dueText) {
      const ts = Array.isArray(dueText) ? dueText[0] : dueText;
      if (typeof ts === 'number') dueDate = new Date(ts);
    }
    switch (status) {
      case '待执行': stats.todo++; break;
      case '进行中': stats.doing++; break;
      case '已完成': stats.done++; break;
      case '搁置': stats.onHold++; break;
      case '归档': stats.archived++; break;
    }
    if (dueDate && status !== '已完成' && status !== '归档') {
      const d = new Date(dueDate);
      d.setHours(0, 0, 0, 0);
      if (d < today) stats.overdue++;
      else if (d.getTime() === today.getTime()) stats.todayDue++;
      else if (d <= threeDaysLater) stats.nearDue++;
    }
  });
  const activeTotal = stats.todo + stats.doing + stats.done + stats.onHold;
  stats.completionRate = activeTotal > 0 ? Math.round((stats.done / activeTotal) * 100) : 0;
  return stats;
}

function groupByModule(records) {
  const groups = {};
  records.forEach(r => {
    const module = r.fields['所属模块'] || '未分类';
    if (!groups[module]) groups[module] = [];
    groups[module].push(r);
  });
  return groups;
}

/* ==========================================================
   API 封装（通过 Vercel Serverless Function 代理）
   ========================================================== */

// 飞书 API 配置
const FEISHU_APP_ID = 'cli_aad5d137cf345d01';
const FEISHU_APP_SECRET = ''; // 在设置面板中配置
const FEISHU_APP_TOKEN = 'ZGcrbdAztars3CsTFtAcUciLn9e';
const FEISHU_TABLE_ID = 'tblBiChovnHiqblx';
const FEISHU_LINK_TABLE_ID = 'tblmJxq9iOtGLmDz';
const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

// CORS 代理（用于绕过飞书 API 的跨域限制）
const CORS_PROXY = 'https://corsproxy.io/?';

// 从 localStorage 读取配置（用户可自定义密钥）
function getConfig() {
  const saved = localStorage.getItem('oc_feishu_config');
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  return {
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    appToken: FEISHU_APP_TOKEN,
    tableId: FEISHU_TABLE_ID,
    linkTableId: FEISHU_LINK_TABLE_ID,
  };
}

// token 缓存
let cachedToken = null;
let tokenExpireTime = 0;

async function getAccessToken() {
  const config = getConfig();
  const now = Date.now();
  if (cachedToken && now < tokenExpireTime - 60000) {
    return cachedToken;
  }

  const url = CORS_PROXY + encodeURIComponent(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(data.msg || '获取token失败，请检查飞书应用配置');
  }
  cachedToken = data.tenant_access_token;
  tokenExpireTime = now + data.expire * 1000;
  return cachedToken;
}

async function feishuRequest(path, options = {}) {
  const token = await getAccessToken();
  const url = CORS_PROXY + encodeURIComponent(`${FEISHU_BASE}${path}`);
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(data.msg || '飞书 API 请求失败');
  }
  return data.data;
}

// 获取所有任务记录（自动翻页）
async function getAllRecords() {
  const config = getConfig();
  const allItems = [];
  let pageToken = '';
  let hasMore = true;

  while (hasMore) {
    let url = `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records?page_size=500`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const data = await feishuRequest(url);
    allItems.push(...(data.items || []));
    hasMore = data.has_more;
    pageToken = data.page_token;
  }

  return allItems;
}

// 创建记录
async function createRecord(fields) {
  const config = getConfig();
  const data = await feishuRequest(
    `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`,
    {
      method: 'POST',
      body: JSON.stringify({ fields }),
    }
  );
  return data.record;
}

// 更新记录
async function updateRecord(recordId, fields) {
  const config = getConfig();
  const data = await feishuRequest(
    `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/${recordId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    }
  );
  return data.record;
}

// 归档记录
async function archiveRecord(recordId, currentFields = {}) {
  const versionHistory = currentFields['版本变更记录'] || '';
  const newVersion = makeVersionEntry('归档');
  return updateRecord(recordId, {
    '任务状态': '归档',
    '隐私状态': '隐藏',
    '版本变更记录': newVersion + versionHistory,
  });
}

// 获取外部链接
async function getLinks() {
  const config = getConfig();
  const data = await feishuRequest(
    `/bitable/v1/apps/${config.appToken}/tables/${config.linkTableId}/records?page_size=200`
  );
  const items = (data.items || [])
    .map(item => ({
      recordId: item.record_id,
      ...item.fields,
    }))
    .sort((a, b) => (a['排序'] || 99) - (b['排序'] || 99));
  return items;
}

/* ==========================================================
   组件：密码弹窗
   ========================================================== */

function PasswordModal({ onSuccess, onClose }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (checkPassword(pwd)) {
      unlock();
      if (onSuccess) onSuccess();
    } else {
      setError('密码错误');
      setPwd('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content password-modal" onClick={e => e.stopPropagation()}>
        <div className="password-icon">🔒</div>
        <h2 className="password-title">隐私验证</h2>
        <p className="password-desc">输入密码查看隐藏数据</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setError(''); }}
            placeholder="请输入密码"
            className="password-input"
          />
          {error && <div className="password-error">{error}</div>}
          <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '16px' }}>
            解锁
          </button>
        </form>
        <div className="password-hint text-xs text-muted">
          默认密码：888888
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   组件：侧边栏
   ========================================================== */

function Sidebar({ onLock }) {
  const { path: locationPath } = useHashRoute();
  const location = { pathname: locationPath };
  const [unlocked, setUnlocked] = useState(isUnlocked());

  useEffect(() => {
    const check = () => setUnlocked(isUnlocked());
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  const handleLock = () => {
    lock();
    setUnlocked(false);
    if (onLock) onLock();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">◈</span>
        <div>
          <div className="logo-text">o_C 总控</div>
          <div className="logo-sub">一体化工作台</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className="nav-item" end>
          <span className="nav-icon">🏠</span>
          <span className="nav-text">总看板</span>
        </NavLink>

        <div className="nav-divider">
          <span>业务模块</span>
        </div>

        {MODULES.map(m => (
          <NavLink key={m.key} to={m.path} className="nav-item">
            <span className="nav-icon">{m.icon}</span>
            <span className="nav-text">{m.key}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="lock-btn" onClick={handleLock}>
          <span>{unlocked ? '🔓 已解锁' : '🔒 已锁定'}</span>
        </button>
        <div className="sidebar-hint text-xs text-muted">
          {unlocked ? '点击锁定隐私数据' : '输入密码解锁隐藏数据'}
        </div>
      </div>
    </aside>
  );
}

/* ==========================================================
   组件：子页面通用模板
   ========================================================== */

function ModulePage({ moduleName, icon, color }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [showPwd, setShowPwd] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [viewRecord, setViewRecord] = useState(null);
  const [filters, setFilters] = useState({
    status: '', priority: '', search: '', showArchived: false,
  });

  useEffect(() => {
    loadRecords();
  }, [moduleName]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const all = await getAllRecords();
      const filtered = all.filter(r => r.fields['所属模块'] === moduleName);
      setRecords(filtered);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const visibleRecords = useMemo(() => {
    let result = [...records];
    if (!unlocked) {
      result = result.filter(r => r.fields['隐私状态'] !== '隐藏' && r.fields['任务状态'] !== '归档');
    }
    if (!filters.showArchived) {
      result = result.filter(r => r.fields['任务状态'] !== '归档');
    }
    if (filters.status) {
      result = result.filter(r => r.fields['任务状态'] === filters.status);
    }
    if (filters.priority) {
      result = result.filter(r => r.fields['优先级'] === filters.priority);
    }
    if (filters.search) {
      const keyword = filters.search.toLowerCase();
      result = result.filter(r =>
        (r.fields['任务标题'] || '').toLowerCase().includes(keyword) ||
        (r.fields['详细内容'] || '').toLowerCase().includes(keyword)
      );
    }
    result.sort((a, b) => {
      const statusOrder = { '进行中': 0, '待执行': 1, '搁置': 2, '已完成': 3, '归档': 4 };
      const sA = statusOrder[a.fields['任务状态']] ?? 5;
      const sB = statusOrder[b.fields['任务状态']] ?? 5;
      if (sA !== sB) return sA - sB;
      const aDate = Array.isArray(a.fields['截止时间']) ? a.fields['截止时间'][0] : a.fields['截止时间'] || 0;
      const bDate = Array.isArray(b.fields['截止时间']) ? b.fields['截止时间'][0] : b.fields['截止时间'] || 0;
      if (aDate && bDate) return aDate - bDate;
      if (aDate) return -1;
      if (bDate) return 1;
      const priOrder = { '高': 0, '中': 1, '低': 2 };
      return (priOrder[a.fields['优先级']] ?? 3) - (priOrder[b.fields['优先级']] ?? 3);
    });
    return result;
  }, [records, filters, unlocked]);

  const stats = useMemo(() => {
    const count = visibleRecords.length;
    const done = visibleRecords.filter(r => r.fields['任务状态'] === '已完成').length;
    const doing = visibleRecords.filter(r => r.fields['任务状态'] === '进行中').length;
    const todo = visibleRecords.filter(r => r.fields['任务状态'] === '待执行').length;
    return { total: count, done, doing, todo };
  }, [visibleRecords]);

  const openAddForm = () => {
    setEditingRecord(null);
    setFormData({
      '所属模块': moduleName,
      '任务标题': '',
      '详细内容': '',
      '任务状态': '待执行',
      '优先级': '中',
      '所属标签': [],
      '进度占比': 0,
      '隐私状态': '公开',
    });
    setShowForm(true);
  };

  const openEditForm = (record) => {
    setEditingRecord(record);
    setFormData({ ...record.fields });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData['任务标题']) return;
    try {
      const versionAction = editingRecord
        ? `修改：${editingRecord.fields['任务标题']} → ${formData['任务标题']}`
        : `新增：${formData['任务标题']}`;
      const oldVersion = editingRecord?.fields['版本变更记录'] || '';
      const fields = {
        ...formData,
        '版本变更记录': makeVersionEntry(versionAction) + oldVersion,
      };
      if (editingRecord) {
        await updateRecord(editingRecord.record_id, fields);
      } else {
        await createRecord(fields);
      }
      setShowForm(false);
      loadRecords();
    } catch (err) {
      alert('保存失败：' + err.message);
    }
  };

  const handleArchive = async (record) => {
    if (!confirm('确定归档这条任务吗？')) return;
    try {
      await archiveRecord(record.record_id, record.fields);
      loadRecords();
    } catch (err) {
      alert('归档失败：' + err.message);
    }
  };

  const handleStatusChange = async (record, newStatus) => {
    try {
      const oldVersion = record.fields['版本变更记录'] || '';
      await updateRecord(record.record_id, {
        '任务状态': newStatus,
        '版本变更记录': makeVersionEntry(`状态变更：${record.fields['任务状态']} → ${newStatus}`) + oldVersion,
      });
      loadRecords();
    } catch (err) {
      alert('更新失败：' + err.message);
    }
  };

  return (
    <div className="module-page">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <span className="page-icon">{icon}</span>
          <div>
            <h1 className="page-title">{moduleName}</h1>
            <div className="page-sub text-secondary">
              共 {stats.total} 项任务 · {stats.doing} 进行中 · {stats.todo} 待办 · {stats.done} 已完成
            </div>
          </div>
        </div>
        <div className="page-actions flex gap-2">
          {!unlocked && (
            <button className="btn btn-secondary" onClick={() => setShowPwd(true)}>
              🔒 解锁隐私
            </button>
          )}
          <button className="btn btn-primary" onClick={openAddForm}>
            + 新建任务
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button className="btn btn-secondary" style={{ marginLeft: '12px' }} onClick={loadRecords}>重试</button>
        </div>
      )}

      <div className="filter-bar card">
        <div className="filter-item">
          <input
            type="text"
            placeholder="🔍 搜索任务标题或内容..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="filter-input"
          />
        </div>
        <div className="filter-item">
          <select
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="filter-select"
          >
            <option value="">全部状态</option>
            {STATUS_OPTIONS.filter(s => s !== '归档').map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <select
            value={filters.priority}
            onChange={e => setFilters({ ...filters, priority: e.target.value })}
            className="filter-select"
          >
            <option value="">全部优先级</option>
            {PRIORITY_OPTIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.showArchived}
              onChange={e => setFilters({ ...filters, showArchived: e.target.checked })}
            />
            显示归档
          </label>
        </div>
        <button className="btn btn-secondary text-sm" onClick={loadRecords}>
          🔄 刷新
        </button>
      </div>

      <div className="task-list-section">
        {loading ? (
          <div className="card p-6 text-center text-muted">加载中...</div>
        ) : visibleRecords.length === 0 ? (
          <div className="card empty-task">
            <div className="empty-icon">📭</div>
            <div className="text-secondary mb-4">暂无任务</div>
            <button className="btn btn-primary" onClick={openAddForm}>+ 创建第一条任务</button>
          </div>
        ) : (
          <div className="task-cards">
            {visibleRecords.map(record => {
              const f = record.fields;
              const dueStatus = getDueStatus(f['截止时间'], f['任务状态']);
              const isHidden = f['隐私状态'] === '隐藏';
              const isArchived = f['任务状态'] === '归档';

              return (
                <div
                  key={record.record_id}
                  className={`task-card card ${isHidden ? 'task-hidden' : ''} ${isArchived ? 'task-archived' : ''}`}
                >
                  <div className="task-card-header">
                    <h3 className="task-card-title truncate">{f['任务标题'] || '未命名'}</h3>
                    <div className="task-card-actions">
                      <button className="action-btn" title="查看详情" onClick={() => setViewRecord(record)}>👁</button>
                      <button className="action-btn" title="编辑" onClick={() => openEditForm(record)}>✏️</button>
                      <button className="action-btn" title={isArchived ? '恢复' : '归档'} onClick={() => handleArchive(record)}>
                        {isArchived ? '↩️' : '📦'}
                      </button>
                    </div>
                  </div>

                  <div className="task-card-body">
                    {f['详细内容'] && (
                      <p className="task-desc text-secondary text-sm">
                        {f['详细内容'].slice(0, 100)}
                        {f['详细内容'].length > 100 ? '...' : ''}
                      </p>
                    )}
                  </div>

                  <div className="task-card-footer">
                    <div className="task-tags flex gap-2">
                      <span className={`tag ${STATUS_COLORS[f['任务状态']] || 'tag-gray'}`}>
                        {f['任务状态'] || '未设置'}
                      </span>
                      <span className={`tag ${PRIORITY_COLORS[f['优先级']] || 'tag-gray'}`}>
                        {f['优先级'] || '中'}优先级
                      </span>
                      {isHidden && <span className="tag tag-purple">🔒 隐藏</span>}
                    </div>
                    {f['截止时间'] && (
                      <div className={`task-due text-xs due-${dueStatus}`}>
                        📅 {formatDate(f['截止时间'])}
                      </div>
                    )}
                  </div>

                  {f['进度占比'] !== undefined && (
                    <div className="task-progress">
                      <div className="progress-bar-sm">
                        <div
                          className="progress-fill-sm"
                          style={{
                            width: `${f['进度占比'] || 0}%`,
                            background: `linear-gradient(90deg, var(--accent-${color}), var(--accent-purple))`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted">{f['进度占比'] || 0}%</span>
                    </div>
                  )}

                  <div className="status-quick">
                    {['待执行', '进行中', '已完成'].map(s => (
                      <button
                        key={s}
                        className={`status-btn ${f['任务状态'] === s ? 'active' : ''}`}
                        onClick={() => handleStatusChange(record, s)}
                      >
                        {s === '待执行' ? '⭕' : s === '进行中' ? '🔄' : '✅'}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPwd && (
        <PasswordModal
          onSuccess={() => { setUnlocked(true); setShowPwd(false); }}
          onClose={() => setShowPwd(false)}
        />
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content form-modal" onClick={e => e.stopPropagation()}>
            <h2 className="form-title">{editingRecord ? '编辑任务' : '新建任务'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>任务标题 *</label>
                <input
                  type="text"
                  value={formData['任务标题'] || ''}
                  onChange={e => setFormData({ ...formData, '任务标题': e.target.value })}
                  placeholder="输入任务标题"
                  required
                />
              </div>
              <div className="form-group">
                <label>详细内容</label>
                <textarea
                  value={formData['详细内容'] || ''}
                  onChange={e => setFormData({ ...formData, '详细内容': e.target.value })}
                  placeholder="任务详情、备注、方案..."
                  rows={4}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>任务状态</label>
                  <select
                    value={formData['任务状态'] || '待执行'}
                    onChange={e => setFormData({ ...formData, '任务状态': e.target.value })}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>优先级</label>
                  <select
                    value={formData['优先级'] || '中'}
                    onChange={e => setFormData({ ...formData, '优先级': e.target.value })}
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>截止时间</label>
                  <input
                    type="date"
                    value={formData['截止时间']
                      ? formatDate(Array.isArray(formData['截止时间']) ? formData['截止时间'][0] : formData['截止时间'])
                      : ''}
                    onChange={e => {
                      const date = new Date(e.target.value);
                      if (!isNaN(date.getTime())) {
                        setFormData({ ...formData, '截止时间': date.getTime() });
                      } else {
                        const newData = { ...formData };
                        delete newData['截止时间'];
                        setFormData(newData);
                      }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>进度占比 (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData['进度占比'] ?? 0}
                    onChange={e => setFormData({ ...formData, '进度占比': Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>隐私状态</label>
                <select
                  value={formData['隐私状态'] || '公开'}
                  onChange={e => setFormData({ ...formData, '隐私状态': e.target.value })}
                >
                  <option value="公开">公开</option>
                  <option value="隐藏">隐藏（需密码解锁）</option>
                </select>
              </div>
              <div className="form-group">
                <label>标签（逗号分隔）</label>
                <input
                  type="text"
                  value={(formData['所属标签'] || []).join(', ')}
                  onChange={e => {
                    const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                    setFormData({ ...formData, '所属标签': tags });
                  }}
                  placeholder="标签1, 标签2, 标签3"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRecord ? '保存修改' : '创建任务'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewRecord && (
        <div className="modal-overlay" onClick={() => setViewRecord(null)}>
          <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2 className="detail-title">{viewRecord.fields['任务标题'] || '未命名'}</h2>
              <button className="close-btn" onClick={() => setViewRecord(null)}>✕</button>
            </div>
            <div className="detail-tags flex gap-2 flex-wrap">
              <span className={`tag ${STATUS_COLORS[viewRecord.fields['任务状态']] || 'tag-gray'}`}>
                {viewRecord.fields['任务状态']}
              </span>
              <span className={`tag ${PRIORITY_COLORS[viewRecord.fields['优先级']] || 'tag-gray'}`}>
                {viewRecord.fields['优先级']}优先级
              </span>
              {viewRecord.fields['截止时间'] && (
                <span className="tag tag-cyan">📅 {formatDate(viewRecord.fields['截止时间'])}</span>
              )}
              {viewRecord.fields['隐私状态'] === '隐藏' && (
                <span className="tag tag-purple">🔒 隐藏</span>
              )}
            </div>
            {viewRecord.fields['详细内容'] && (
              <div className="detail-section">
                <h4 className="detail-section-title">详细内容</h4>
                <div className="detail-content text-secondary">
                  {viewRecord.fields['详细内容'].split('\n').map((line, i) => (
                    <div key={i}>{line || '　'}</div>
                  ))}
                </div>
              </div>
            )}
            {viewRecord.fields['所属标签']?.length > 0 && (
              <div className="detail-section">
                <h4 className="detail-section-title">标签</h4>
                <div className="flex gap-2 flex-wrap">
                  {viewRecord.fields['所属标签'].map((t, i) => (
                    <span key={i} className="tag tag-blue">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {viewRecord.fields['版本变更记录'] && (
              <div className="detail-section">
                <h4 className="detail-section-title">版本记录</h4>
                <div className="version-list">
                  {parseVersionHistory(viewRecord.fields['版本变更记录']).map((v, i) => (
                    <div key={i} className="version-item">
                      <span className="version-time text-xs text-muted">{v.time}</span>
                      <span className="version-action text-sm">{v.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="detail-footer">
              <button className="btn btn-secondary" onClick={() => setViewRecord(null)}>关闭</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setViewRecord(null);
                  openEditForm(viewRecord);
                }}
              >
                编辑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   页面：总看板 Dashboard
   ========================================================== */

function Dashboard() {
  const [records, setRecords] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [unlocked, setUnlocked] = useState(isUnlocked());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allRecords, allLinks] = await Promise.all([
        getAllRecords(),
        getLinks().catch(() => []),
      ]);
      setRecords(allRecords);
      setLinks(allLinks);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || '数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  const visibleRecords = unlocked
    ? records
    : records.filter(r => r.fields['隐私状态'] !== '隐藏' && r.fields['任务状态'] !== '归档');

  const overallStats = calcStatusStats(visibleRecords);
  const moduleGroups = groupByModule(visibleRecords);

  const moduleStats = MODULES.map(m => {
    const items = moduleGroups[m.key] || [];
    return {
      ...m,
      stats: calcStatusStats(items),
      count: items.length,
    };
  });

  const urgentTasks = visibleRecords
    .filter(r => {
      const status = getDueStatus(r.fields['截止时间'], r.fields['任务状态']);
      return status === 'overdue' || status === 'today' || status === 'near';
    })
    .sort((a, b) => {
      const aDate = Array.isArray(a.fields['截止时间']) ? a.fields['截止时间'][0] : a.fields['截止时间'];
      const bDate = Array.isArray(b.fields['截止时间']) ? b.fields['截止时间'][0] : b.fields['截止时间'];
      return (aDate || 0) - (bDate || 0);
    })
    .slice(0, 10);

  const recentChanges = [...visibleRecords]
    .sort((a, b) => {
      const aTime = a.fields['更新时间'] || a.fields['创建时间'] || 0;
      const bTime = b.fields['更新时间'] || b.fields['创建时间'] || 0;
      const aTs = Array.isArray(aTime) ? aTime[0] : aTime;
      const bTs = Array.isArray(bTime) ? bTime[0] : bTime;
      return bTs - aTs;
    })
    .slice(0, 10);

  return (
    <div className="dashboard">
      <div className="welcome-section">
        <div>
          <h1 className="welcome-title">o_C 总控工作台</h1>
          <p className="welcome-sub text-secondary">
            今天是 {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <div className="welcome-actions">
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新数据
          </button>
          {!unlocked && (
            <button className="btn btn-primary" onClick={() => setShowPwd(true)}>
              🔒 解锁隐私
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ 数据加载失败：{error}
          <button className="btn btn-secondary" style={{ marginLeft: '12px' }} onClick={loadData}>重试</button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>📋</div>
          <div className="stat-info">
            <div className="stat-value">{overallStats.total}</div>
            <div className="stat-label">任务总数</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>✅</div>
          <div className="stat-info">
            <div className="stat-value">{overallStats.done}</div>
            <div className="stat-label">已完成</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>⏳</div>
          <div className="stat-info">
            <div className="stat-value">{overallStats.doing}</div>
            <div className="stat-label">进行中</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>🔥</div>
          <div className="stat-info">
            <div className="stat-value">{overallStats.overdue + overallStats.todayDue}</div>
            <div className="stat-label">紧急/逾期</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>📊</div>
          <div className="stat-info">
            <div className="stat-value">{overallStats.completionRate}%</div>
            <div className="stat-label">完成率</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card p-6 module-progress">
          <h3 className="text-xl mb-4">各模块进度</h3>
          <div className="module-list">
            {moduleStats.map(m => (
              <Link key={m.key} to={m.path} className="module-item">
                <div className="module-header">
                  <div className="flex items-center gap-3">
                    <span className="module-icon">{m.icon}</span>
                    <span className="module-name">{m.key}</span>
                  </div>
                  <span className="module-count">{m.count} 项</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${m.stats.completionRate}%`,
                      background: `linear-gradient(90deg, var(--accent-${m.color}), var(--accent-purple))`,
                    }}
                  />
                </div>
                <div className="progress-info">
                  <span className="text-xs text-muted">
                    {m.stats.done}完成 / {m.stats.doing}进行 / {m.stats.todo}待办
                  </span>
                  <span className="text-xs font-medium">{m.stats.completionRate}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-6 urgent-tasks">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl">到期预警</h3>
            <span className="tag tag-red">{urgentTasks.length} 项待处理</span>
          </div>
          {loading ? (
            <div className="text-muted text-center py-8">加载中...</div>
          ) : urgentTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎉</div>
              <div className="text-secondary">没有紧急任务，保持节奏</div>
            </div>
          ) : (
            <div className="task-list">
              {urgentTasks.map(t => {
                const dueStatus = getDueStatus(t.fields['截止时间'], t.fields['任务状态']);
                const statusMap = {
                  overdue: { text: '已逾期', color: 'tag-red' },
                  today: { text: '今日到期', color: 'tag-orange' },
                  near: { text: '即将到期', color: 'tag-yellow' },
                };
                const statusInfo = statusMap[dueStatus] || { text: '', color: '' };
                return (
                  <div key={t.record_id} className="task-item">
                    <div className={`task-dot dot-${dueStatus}`}></div>
                    <div className="task-info">
                      <div className="task-title truncate">{t.fields['任务标题'] || '未命名'}</div>
                      <div className="task-meta text-xs text-muted">
                        {t.fields['所属模块']} · {formatDate(t.fields['截止时间'])}
                      </div>
                    </div>
                    <span className={`tag ${statusInfo.color}`}>{statusInfo.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card p-6 links-section">
          <h3 className="text-xl mb-4">快速链接</h3>
          <div className="links-grid">
            {links.map(link => (
              <a
                key={link.recordId || link.record_id}
                href={link['链接地址']}
                target="_blank"
                rel="noopener noreferrer"
                className="link-item"
              >
                <span className="link-icon">{link['图标'] || '🔗'}</span>
                <span className="link-name truncate">{link['链接名称']}</span>
              </a>
            ))}
            {links.length === 0 && (
              <div className="empty-state col-span-full">
                <div className="empty-icon">🔗</div>
                <div className="text-secondary">暂无外部链接</div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-6 recent-changes">
          <h3 className="text-xl mb-4">最近变更</h3>
          {recentChanges.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <div className="text-secondary">暂无变更记录</div>
            </div>
          ) : (
            <div className="changes-list">
              {recentChanges.map(r => (
                <div key={r.record_id} className="change-item">
                  <div className="change-dot"></div>
                  <div className="change-info">
                    <div className="change-title truncate">{r.fields['任务标题'] || '未命名'}</div>
                    <div className="change-meta text-xs text-muted">
                      {r.fields['任务状态']} · {r.fields['所属模块']}
                    </div>
                  </div>
                  <div className="change-time text-xs text-muted">
                    {formatDate(r.fields['更新时间'] || r.fields['创建时间'])}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPwd && (
        <PasswordModal
          onSuccess={() => { setUnlocked(true); setShowPwd(false); }}
          onClose={() => setShowPwd(false)}
        />
      )}
    </div>
  );
}

/* ==========================================================
   根组件 App
   ========================================================== */

function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked());

  const handleUnlock = () => setUnlocked(true);
  const handleLock = () => setUnlocked(false);

  useEffect(() => {
    const check = () => setUnlocked(isUnlocked());
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar onLock={handleLock} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {MODULES.map(m => (
            <Route
              key={m.key}
              path={m.path}
              element={<ModulePage moduleName={m.key} icon={m.icon} color={m.color} />}
            />
          ))}
        </Routes>
      </main>
    </div>
  );
}

/* ==========================================================
   入口
   ========================================================== */

// 入口在 index.html 的 debug_wrapper 中（ErrorBoundary 包裹）
