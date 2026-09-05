/* ==========================================================
   教务教学管理模块 TeachingPage
   ========================================================== */

/* ==========================================================
   教务教学管理模块配置
   ========================================================== */

const TEACHING_CONFIG = {
  appToken: 'ZGcrbdAztars3CsTFtAcUciLn9e',
  tables: {
    semester: 'tblPoTo3oqv4izaa',     // 学期表
    teacher: 'tblIkr456IASanjo',      // 教师表
    course: 'tblMGFvaEfncrnwV',       // 课程表
    classroom: 'tblYRnSlySLGvl9q',    // 教室表
    teachingClass: 'tblcwtGhOTmeZdzy', // 教学班表
    archive: 'tblozi3xBLYLSrVh',      // 课程档案表
    work: 'tbl4PDL0rQQtlDua',         // 工作表
    module: 'tblo2A5lbJxcP7Jx',       // 模块表
  }
};

// 通用：按条件搜索记录（全量拉取后 JS 过滤，保持与现有模式一致）
async function fetchTeachingTable(tableKey) {
  const { appToken, tables } = TEACHING_CONFIG;
  const tableId = tables[tableKey];
  if (!tableId) return [];
  const allItems = [];
  let pageToken = '';
  let hasMore = true;
  while (hasMore) {
    const url = `/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`;
    const body = { page_size: 500 };
    if (pageToken) body.page_token = pageToken;
    const data = await feishuRequest(url, { method: 'POST', body: JSON.stringify(body) });
    allItems.push(...(data.items || []));
    hasMore = data.has_more;
    pageToken = data.page_token || '';
  }
  return allItems.map(item => ({ ...item, fields: cleanFields(item.fields) }));
}

// 获取所有教学相关数据
async function fetchAllTeachingData() {
  const [semesters, teachers, courses, classrooms, teachingClasses, archives, works] = await Promise.all([
    fetchTeachingTable('semester'),
    fetchTeachingTable('teacher'),
    fetchTeachingTable('course'),
    fetchTeachingTable('classroom'),
    fetchTeachingTable('teachingClass'),
    fetchTeachingTable('archive'),
    fetchTeachingTable('work'),
  ]);
  return { semesters, teachers, courses, classrooms, teachingClasses, archives, works };
}

// 工具：从关联字段（record_id 数组）映射名称
function mapRelationNames(recordIds, allRecords, nameField = '名称') {
  if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) return [];
  const map = {};
  allRecords.forEach(r => { map[r.record_id] = getFieldValue(r.fields[nameField]) || r.record_id; });
  return recordIds.map(id => map[id] || id).filter(Boolean);
}

function getFirstRelationName(recordIds, allRecords, nameField = '名称') {
  const names = mapRelationNames(recordIds, allRecords, nameField);
  return names.length > 0 ? names[0] : '';
}

// 获取本周的起止时间
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7; // 周日=7
  const start = new Date(d);
  start.setDate(d.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// 计算当前学期进度（第几周/总周数）
function calcSemesterProgress(semester) {
  if (!semester) return { currentWeek: 0, totalWeeks: 0, percent: 0 };
  const f = semester.fields;
  const startDate = f['开始日期'] ? new Date(f['开始日期']) : null;
  const endDate = f['结束日期'] ? new Date(f['结束日期']) : null;
  const totalWeeks = Number(f['总周数']) || 0;
  
  if (!startDate || !endDate) {
    return { currentWeek: 0, totalWeeks, percent: 0 };
  }
  
  const now = new Date();
  if (now < startDate) {
    return { currentWeek: 0, totalWeeks, percent: 0 };
  }
  if (now > endDate) {
    return { currentWeek: totalWeeks, totalWeeks, percent: 100 };
  }
  
  const diffMs = now - startDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.min(totalWeeks, Math.floor(diffDays / 7) + 1);
  const percent = totalWeeks > 0 ? Math.round((currentWeek / totalWeeks) * 100) : 0;
  
  return { currentWeek, totalWeeks, percent };
}


// 工作名称字段三级 fallback：工作名称 / 工作标题 / 标题
function getWorkName(fields) {
  return fields['工作名称'] || fields['工作标题'] || fields['标题'] || '未命名';
}

// 计算学期教学检查周期（期初/期中/期末）
function getSemesterCheckCycles(semester) {
  if (!semester) return [];
  const f = semester.fields;
  const totalWeeks = Number(f['总周数']) || 18;
  const startDate = f['开始日期'] ? new Date(f['开始日期']) : new Date();
  
  const addWeeks = (date, weeks) => {
    const d = new Date(date);
    d.setDate(d.getDate() + weeks * 7);
    return d;
  };
  
  return [
    {
      name: '期初教学检查',
      startWeek: 1,
      endWeek: 3,
      startDate: startDate,
      endDate: addWeeks(startDate, 3),
      color: '#f59e0b',
      icon: '📋',
      desc: '开学初教学秩序与准备工作检查'
    },
    {
      name: '期中教学检查',
      startWeek: 8,
      endWeek: 10,
      startDate: addWeeks(startDate, 7),
      endDate: addWeeks(startDate, 10),
      color: '#3b82f6',
      icon: '🔍',
      desc: '中期教学质量与进度检查'
    },
    {
      name: '期末教学检查',
      startWeek: 15,
      endWeek: 18,
      startDate: addWeeks(startDate, 14),
      endDate: addWeeks(startDate, 18),
      color: '#ef4444',
      icon: '📝',
      desc: '期末考核与教学总结检查'
    }
  ];
}

function getCurrentCheckCycle(semester) {
  const cycles = getSemesterCheckCycles(semester);
  const progress = calcSemesterProgress(semester);
  const week = progress.currentWeek;
  return cycles.find(c => week >= c.startWeek && week <= c.endWeek) || null;
}

/* ==========================================================
   组件：教学管理模块 TeachingPage
   ========================================================== */

function TeachingPage() {
  const { path } = useHashRoute();
  const [activeNav, setActiveNav] = React.useState('overview');
  const [data, setData] = React.useState({
    semesters: [], teachers: [], courses: [], classrooms: [],
    teachingClasses: [], archives: [], works: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [currentSemester, setCurrentSemester] = React.useState(null);

  // 模块锁定状态
  const [moduleLocked, setModuleLocked] = React.useState(false);
  const [moduleUnlocked, setModuleUnlocked] = React.useState(false);
  const [showLockModal, setShowLockModal] = React.useState(false);

  const modulePath = '/teaching';

  const refreshModuleLock = () => {
    const locked = isModuleLocked(modulePath);
    setModuleLocked(locked);
    setModuleUnlocked(locked ? isSessionUnlocked(modulePath) : true);
  };

  React.useEffect(() => {
    refreshModuleLock();
    const onStorage = () => refreshModuleLock();
    const onLockChange = () => refreshModuleLock();
    window.addEventListener('storage', onStorage);
    window.addEventListener('oc_lock_changed', onLockChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('oc_lock_changed', onLockChange);
    };
  }, []);

  const handleModuleUnlock = () => {
    setSessionUnlocked(modulePath, true);
    setModuleUnlocked(true);
    setShowLockModal(false);
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchAllTeachingData();
      setData(result);
      // 设置当前学期：找「当前学期=是」的记录
      const current = result.semesters.find(s => s.fields['当前学期'] === '是');
      setCurrentSemester(current || (result.semesters.length > 0 ? result.semesters[0] : null));
    } catch (e) {
      setError('加载失败：' + (e.message || '未知错误'));
    }
    setLoading(false);
  };

  React.useEffect(() => { loadData(); }, []);

  // 从路径解析当前导航
  React.useEffect(() => {
    if (path.startsWith('/teaching/')) {
      const sub = path.replace('/teaching/', '');
      setActiveNav(sub);
    } else {
      setActiveNav('overview');
    }
  }, [path]);

  const navigateTo = (key) => {
    window.location.hash = key === 'overview' ? '/teaching' : `/teaching/${key}`;
  };

  const semesterNavItems = [
    { key: 'overview', label: '总览', icon: '📊' },
    { key: 'courses', label: '专业课程', icon: '📚' },
    { key: 'teachers', label: '任课教师', icon: '👨‍🏫' },
    { key: 'archives', label: '课程档案', icon: '📁' },
    { key: 'classes', label: '教学班', icon: '🏫' },
    { key: 'schedule', label: '排课安排', icon: '📅' },
    { key: 'resources', label: '学期资源', icon: '📎' },
  ];

  const fullDataNavItems = [
    { key: 'teacher-archive', label: '教师档案', icon: '👥' },
    { key: 'course-lib', label: '课程库', icon: '📖' },
    { key: 'classroom-archive', label: '教室档案', icon: '🚪' },
    { key: 'all-work', label: '全部工作', icon: '✅' },
    { key: 'all-resources', label: '全部资源', icon: '📦' },
  ];

  // 当前学期相关的过滤数据
  const semesterData = React.useMemo(() => {
    if (!currentSemester) {
      return { courses: [], teachers: [], classes: [], archives: [], works: [] };
    }
    const semId = currentSemester.record_id;
    
    // 课程：所属学期关联
    const semesterCourses = data.courses.filter(c => {
      const sems = c.fields['所属学期'];
      return Array.isArray(sems) ? sems.includes(semId) : sems === semId;
    });
    
    // 教学班：所属学期关联
    const semesterClasses = data.teachingClasses.filter(c => {
      const sems = c.fields['所属学期'];
      return Array.isArray(sems) ? sems.includes(semId) : sems === semId;
    });
    
    // 任课教师：通过教学班关联
    const teacherIds = new Set();
    semesterClasses.forEach(c => {
      const tids = c.fields['授课教师'];
      if (Array.isArray(tids)) tids.forEach(id => teacherIds.add(id));
      else if (tids) teacherIds.add(tids);
    });
    const semesterTeachers = data.teachers.filter(t => teacherIds.has(t.record_id));
    
    // 课程档案：所属学期关联
    const semesterArchives = data.archives.filter(a => {
      const sems = a.fields['所属学期'];
      return Array.isArray(sems) ? sems.includes(semId) : sems === semId;
    });
    
    // 工作：所属学期关联
    const semesterWorks = data.works.filter(w => {
      const sems = w.fields['所属学期'];
      return Array.isArray(sems) ? sems.includes(semId) : sems === semId;
    });
    
    return {
      courses: semesterCourses,
      teachers: semesterTeachers,
      classes: semesterClasses,
      archives: semesterArchives,
      works: semesterWorks,
    };
  }, [data, currentSemester]);

  const handleSemesterChange = (recordId) => {
    const sem = data.semesters.find(s => s.record_id === recordId);
    if (sem) setCurrentSemester(sem);
  };

  // ========== 渲染 ==========
  if (loading) {
    return (
      <div className="teaching-page">
        <div className="teaching-loading">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="teaching-page">
        <div style={{padding:'40px', textAlign:'center', color:'#f87171'}}>
          {error}
          <div style={{marginTop:'16px'}}>
            <button className="teaching-btn primary" onClick={loadData}>重试</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="teaching-page">
      {/* 顶部栏 */}
      <div className="teaching-header">
        <div className="teaching-header-left">
          <span className="teaching-header-icon">📚</span>
          <div>
            <h1 className="teaching-header-title">
              教务教学管理
              {moduleLocked && <span className="page-lock-icon" title="模块已锁定">🔒</span>}
            </h1>
            <div className="teaching-header-sub">
              {moduleLocked && !moduleUnlocked
                ? '此模块已锁定，请解锁后查看内容'
                : currentSemester
                  ? `当前学期：${currentSemester.fields['学期名称'] || '未设置'} · 共 ${semesterData.courses.length} 门课程 · ${semesterData.teachers.length} 位教师`
                  : '暂无学期数据'}
            </div>
          </div>
        </div>
        <div className="teaching-header-right">
          {moduleLocked && !moduleUnlocked && (
            <button className="btn btn-warning" onClick={() => setShowLockModal(true)}>
              🔓 解锁模块
            </button>
          )}
          {(!moduleLocked || moduleUnlocked) && (
            <>
              <select
                className="teaching-semester-select"
                value={currentSemester?.record_id || ''}
                onChange={e => handleSemesterChange(e.target.value)}
              >
                {data.semesters.map(s => (
                  <option key={s.record_id} value={s.record_id}>
                    {s.fields['学期名称'] || '未命名学期'}
                  </option>
                ))}
              </select>
              <button className="teaching-btn primary" onClick={loadData}>🔄 刷新</button>
            </>
          )}
        </div>
      </div>

      {/* 模块锁定 - 大锁界面 */}
      {moduleLocked && !moduleUnlocked && (
        <div className="module-lock-screen">
          <div className="module-lock-content">
            <div
              className="module-lock-big-icon-only"
              onClick={() => setShowLockModal(true)}
              title="点击解锁"
            >
              🔒
            </div>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      {(!moduleLocked || moduleUnlocked) && (
        <div className="teaching-layout">
          {/* 左侧导航 */}
          <aside className="teaching-sidebar">
            <div className="teaching-nav-group">
              <div className="teaching-nav-group-title">
                <span>📁</span> 学期入口
                <span className="teaching-nav-group-hint">随学期切换</span>
              </div>
              {semesterNavItems.map(item => (
                <div
                  key={item.key}
                  className={'teaching-nav-item' + (activeNav === item.key ? ' active' : '')}
                  onClick={() => navigateTo(item.key)}
                >
                  <span className="teaching-nav-icon">{item.icon}</span>
                  <span className="teaching-nav-label">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="teaching-nav-group">
              <div className="teaching-nav-group-title">
                <span>📂</span> 全量数据
                <span className="teaching-nav-group-hint">不随学期切换</span>
              </div>
              {fullDataNavItems.map(item => (
                <div
                  key={item.key}
                  className={'teaching-nav-item' + (activeNav === item.key ? ' active' : '')}
                  onClick={() => navigateTo(item.key)}
                >
                  <span className="teaching-nav-icon">{item.icon}</span>
                  <span className="teaching-nav-label">{item.label}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* 右侧内容 */}
          <main className="teaching-content">
            {activeNav === 'overview' && (
              <TeachingOverview
                semester={currentSemester}
                semesterData={semesterData}
                allData={data}
              />
            )}
            {activeNav === 'courses' && (
              <TeachingCourses
                courses={semesterData.courses}
                teachingClasses={semesterData.classes}
                archives={semesterData.archives}
                allTeachers={data.teachers}
              />
            )}
            {activeNav === 'teachers' && (
              <TeachingTeachers
                teachers={semesterData.teachers}
                teachingClasses={semesterData.classes}
              />
            )}
            {activeNav === 'archives' && (
              <TeachingArchives
                archives={semesterData.archives}
                allCourses={semesterData.courses}
                allTeachers={data.teachers}
              />
            )}
            {activeNav === 'classes' && (
              <TeachingPlaceholder title="教学班" icon="🏫" />
            )}
            {activeNav === 'schedule' && (
              <TeachingPlaceholder title="排课安排" icon="📅" />
            )}
            {activeNav === 'resources' && (
              <TeachingPlaceholder title="学期资源" icon="📎" />
            )}
            {activeNav === 'teacher-archive' && (
              <TeachingTeacherArchive teachers={data.teachers} />
            )}
            {activeNav === 'course-lib' && (
              <TeachingPlaceholder title="课程库" icon="📖" />
            )}
            {activeNav === 'classroom-archive' && (
              <TeachingPlaceholder title="教室档案" icon="🚪" />
            )}
            {activeNav === 'all-work' && (
              <TeachingAllWorks works={data.works} semesters={data.semesters} />
            )}
            {activeNav === 'all-resources' && (
              <TeachingPlaceholder title="全部资源" icon="📦" />
            )}
          </main>
        </div>
      )}

      {showLockModal && (
        <ModuleUnlockModal
          title="解锁「教务教学管理」"
          onSuccess={handleModuleUnlock}
          onClose={() => setShowLockModal(false)}
        />
      )}
    </div>
  );
}

/* ==========================================================
   子页面：总览 TeachingOverview
   ========================================================== */

function TeachingOverview({ semester, semesterData, allData }) {
  const { courses, teachers, classes, archives, works } = semesterData;
  const { classrooms } = allData;

  const progress = React.useMemo(() => calcSemesterProgress(semester), [semester]);

  // 本周工作
  const weekWorks = React.useMemo(() => {
    const { start, end } = getWeekRange();
    return works
      .filter(w => {
        const due = w.fields['截止日期'];
        if (!due) return false;
        const d = new Date(due);
        return d >= start && d <= end;
      })
      .sort((a, b) => (a.fields['截止日期'] || 0) - (b.fields['截止日期'] || 0))
      .slice(0, 5);
  }, [works]);

  // 重点工作（高优先级且未完成）
  const keyWorks = React.useMemo(() => {
    return works
      .filter(w => {
        const priority = w.fields['优先级'];
        const status = w.fields['状态'];
        return priority === '高' && status !== '已完成';
      })
      .sort((a, b) => (a.fields['截止日期'] || 0) - (b.fields['截止日期'] || 0))
      .slice(0, 5);
  }, [works]);

  // 常规工作进度（从课程档案统计）
  const routineProgress = React.useMemo(() => {
    const total = archives.length || 1;
    const calcDone = (fieldName, doneVal = '已完成') => {
      const done = archives.filter(a => a.fields[fieldName] === doneVal).length;
      return Math.round((done / total) * 100);
    };
    return {
      outline: calcDone('大纲状态', '已完成'),
      lessonPlan: calcDone('教案状态', '已完成'),
      observation: calcDone('听课状态', '已完成'),
      homework: calcDone('作业批改状态', '已完成'),
    };
  }, [archives]);

  const quickActions = [
    { icon: '📝', label: '新增工作' },
    { icon: '📋', label: '会议记录' },
    { icon: '👂', label: '听课记录' },
    { icon: '📚', label: '资源库' },
    { icon: '➕', label: '新增课程' },
    { icon: '📦', label: '档案归档' },
  ];

  const handleQuickAction = (label) => {
    alert(`${label} - 功能开发中...`);
  };

  return (
    <div className="teaching-overview">
      {/* 统计卡片 */}
      <div className="teaching-stat-grid">
        <div className="teaching-stat-card stat-courses">
          <div className="teaching-stat-label">课程数</div>
          <div className="teaching-stat-value">{courses.length}</div>
          <div className="teaching-stat-sub">本学期开设课程</div>
        </div>
        <div className="teaching-stat-card stat-teachers">
          <div className="teaching-stat-label">任课教师</div>
          <div className="teaching-stat-value">{teachers.length}</div>
          <div className="teaching-stat-sub">本学期授课教师</div>
        </div>
        <div className="teaching-stat-card stat-classes">
          <div className="teaching-stat-label">教学班级</div>
          <div className="teaching-stat-value">{classes.length}</div>
          <div className="teaching-stat-sub">教学班数量</div>
        </div>
        <div className="teaching-stat-card stat-classrooms">
          <div className="teaching-stat-label">教室数</div>
          <div className="teaching-stat-value">{classrooms.length}</div>
          <div className="teaching-stat-sub">可用教室总数</div>
        </div>
      </div>

      {/* 学期进度 */}
      <div className="teaching-card">
        <div className="teaching-card-title">
          <span>📅</span> 本学期进度
        </div>
        <div className="teaching-semester-progress">
          <div className="teaching-progress-info">
            <span>第 {progress.currentWeek} 周 / 共 {progress.totalWeeks} 周</span>
            <span className="teaching-progress-percent">{progress.percent}%</span>
          </div>
          <div className="teaching-progress-bar">
            <div
              className="teaching-progress-fill"
              style={{ width: progress.percent + '%' }}
            ></div>
          </div>
          <div className="teaching-progress-dates">
            <span>{semester?.fields['开始日期'] ? formatDate(semester.fields['开始日期']) : '—'}</span>
            <span>{semester?.fields['结束日期'] ? formatDate(semester.fields['结束日期']) : '—'}</span>
          </div>
        </div>
      </div>

      {/* 学期教学检查周期时间轴 */}
      <SemesterCheckTimeline semester={semester} />

      <div className="teaching-grid-2col">
        {/* 本周工作 */}
        <div className="teaching-card">
          <div className="teaching-card-title">
            <span>📋</span> 本周工作
            <span className="teaching-card-badge">{weekWorks.length}</span>
          </div>
          {weekWorks.length === 0 ? (
            <div className="teaching-empty">暂无本周待办</div>
          ) : (
            <div className="teaching-work-list">
              {weekWorks.map(w => {
                const status = w.fields['状态'] || '待执行';
                const priority = w.fields['优先级'] || '中';
                return (
                  <div key={w.record_id} className="teaching-work-item">
                    <div className="teaching-work-dot"></div>
                    <div className="teaching-work-info">
                      <div className="teaching-work-title">{w.fields['工作标题'] || w.fields['标题'] || '未命名'}</div>
                      <div className="teaching-work-meta">
                        {formatDate(w.fields['截止日期'])} · {w.fields['负责人'] || '未分配'}
                      </div>
                    </div>
                    <span className={`tag ${PRIORITY_COLORS[priority] || 'tag-gray'}`}>{priority}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 重点工作 */}
        <div className="teaching-card">
          <div className="teaching-card-title">
            <span>🔥</span> 重点工作
            <span className="teaching-card-badge badge-red">{keyWorks.length}</span>
          </div>
          {keyWorks.length === 0 ? (
            <div className="teaching-empty">暂无高优先级工作</div>
          ) : (
            <div className="teaching-work-list">
              {keyWorks.map(w => {
                const status = w.fields['状态'] || '待执行';
                return (
                  <div key={w.record_id} className="teaching-work-item">
                    <div className="teaching-work-dot dot-red"></div>
                    <div className="teaching-work-info">
                      <div className="teaching-work-title">{w.fields['工作标题'] || w.fields['标题'] || '未命名'}</div>
                      <div className="teaching-work-meta">
                        截止：{formatDate(w.fields['截止日期'])}
                      </div>
                    </div>
                    <span className={`tag ${STATUS_COLORS[status] || 'tag-gray'}`}>{status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 常规工作进度 */}
      <div className="teaching-card">
        <div className="teaching-card-title">
          <span>📊</span> 常规工作进度
        </div>
        <div className="teaching-routine-grid">
          <div className="teaching-routine-item">
            <div className="teaching-routine-label">大纲完成</div>
            <div className="teaching-routine-bar">
              <div className="teaching-routine-fill" style={{ width: routineProgress.outline + '%' }}></div>
            </div>
            <div className="teaching-routine-percent">{routineProgress.outline}%</div>
          </div>
          <div className="teaching-routine-item">
            <div className="teaching-routine-label">教案进度</div>
            <div className="teaching-routine-bar">
              <div className="teaching-routine-fill" style={{ width: routineProgress.lessonPlan + '%' }}></div>
            </div>
            <div className="teaching-routine-percent">{routineProgress.lessonPlan}%</div>
          </div>
          <div className="teaching-routine-item">
            <div className="teaching-routine-label">听课进度</div>
            <div className="teaching-routine-bar">
              <div className="teaching-routine-fill" style={{ width: routineProgress.observation + '%' }}></div>
            </div>
            <div className="teaching-routine-percent">{routineProgress.observation}%</div>
          </div>
          <div className="teaching-routine-item">
            <div className="teaching-routine-label">作业批改</div>
            <div className="teaching-routine-bar">
              <div className="teaching-routine-fill" style={{ width: routineProgress.homework + '%' }}></div>
            </div>
            <div className="teaching-routine-percent">{routineProgress.homework}%</div>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="teaching-card">
        <div className="teaching-card-title">
          <span>⚡</span> 快捷操作
        </div>
        <div className="teaching-quick-grid">
          {quickActions.map(act => (
            <button
              key={act.label}
              className="teaching-quick-btn"
              onClick={() => handleQuickAction(act.label)}
            >
              <span className="teaching-quick-icon">{act.icon}</span>
              <span className="teaching-quick-label">{act.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   子页面：专业课程 TeachingCourses
   ========================================================== */

function TeachingCourses({ courses, teachingClasses, archives, allTeachers }) {
  const [typeFilter, setTypeFilter] = React.useState('all');

  const courseTypes = React.useMemo(() => {
    const types = new Set();
    courses.forEach(c => {
      const t = c.fields['课程类型'] || c.fields['类型'] || '未分类';
      types.add(t);
    });
    return Array.from(types);
  }, [courses]);

  const filteredCourses = React.useMemo(() => {
    if (typeFilter === 'all') return courses;
    return courses.filter(c =>
      (c.fields['课程类型'] || c.fields['类型'] || '未分类') === typeFilter
    );
  }, [courses, typeFilter]);

  // 每门课的授课教师（从教学班关联）
  const getCourseTeachers = (courseId) => {
    const relatedClasses = teachingClasses.filter(c => {
      const cid = c.fields['课程'];
      return Array.isArray(cid) ? cid.includes(courseId) : cid === courseId;
    });
    const teacherIds = new Set();
    relatedClasses.forEach(c => {
      const tids = c.fields['授课教师'];
      if (Array.isArray(tids)) tids.forEach(id => teacherIds.add(id));
      else if (tids) teacherIds.add(tids);
    });
    return allTeachers.filter(t => teacherIds.has(t.record_id));
  };

  // 每门课的大纲完成度（从课程档案统计）
  const getCourseProgress = (courseId) => {
    const courseArchives = archives.filter(a => {
      const cid = a.fields['课程'];
      return Array.isArray(cid) ? cid.includes(courseId) : cid === courseId;
    });
    if (courseArchives.length === 0) return 0;
    const done = courseArchives.filter(a => a.fields['大纲状态'] === '已完成').length;
    return Math.round((done / courseArchives.length) * 100);
  };

  return (
    <div className="teaching-courses">
      <div className="teaching-toolbar">
        <div className="teaching-filter-group">
          <button
            className={'teaching-filter-btn' + (typeFilter === 'all' ? ' active' : '')}
            onClick={() => setTypeFilter('all')}
          >
            全部类型
          </button>
          {courseTypes.map(t => (
            <button
              key={t}
              className={'teaching-filter-btn' + (typeFilter === t ? ' active' : '')}
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="teaching-toolbar-right">
          <span className="teaching-count">共 {filteredCourses.length} 门课程</span>
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="teaching-empty-card">
          <div className="teaching-empty-icon">📚</div>
          <div className="teaching-empty-text">暂无课程数据</div>
        </div>
      ) : (
        <div className="teaching-course-grid">
          {filteredCourses.map(course => {
            const f = course.fields;
            const courseTeachers = getCourseTeachers(course.record_id);
            const progress = getCourseProgress(course.record_id);
            const type = f['课程类型'] || f['类型'] || '未分类';
            const code = f['课程代码'] || f['课程编号'] || '';
            const hours = f['学时'] || f['总学时'] || '';
            const credits = f['学分'] || '';

            return (
              <div key={course.record_id} className="teaching-course-card">
                <div className="teaching-course-header">
                  <h3 className="teaching-course-name">{f['课程名称'] || f['名称'] || '未命名课程'}</h3>
                  <span className="teaching-course-type">{type}</span>
                </div>
                {code && <div className="teaching-course-code">课程代码：{code}</div>}
                <div className="teaching-course-meta">
                  {hours && <span>📖 {hours}学时</span>}
                  {credits && <span>⭐ {credits}学分</span>}
                </div>
                <div className="teaching-course-teachers">
                  <span className="teaching-course-teachers-label">授课教师：</span>
                  {courseTeachers.length > 0 ? (
                    courseTeachers.map(t => (
                      <span key={t.record_id} className="teaching-teacher-chip">
                        {t.fields['姓名'] || t.fields['教师姓名'] || '未知'}
                      </span>
                    ))
                  ) : (
                    <span className="teaching-muted">未分配</span>
                  )}
                </div>
                <div className="teaching-course-progress">
                  <div className="teaching-progress-bar-sm">
                    <div className="teaching-progress-fill-sm" style={{ width: progress + '%' }}></div>
                  </div>
                  <span className="teaching-progress-text">大纲完成 {progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   子页面：任课教师 TeachingTeachers
   ========================================================== */

function TeachingTeachers({ teachers, teachingClasses }) {
  const getTeacherCourseCount = (teacherId) => {
    return teachingClasses.filter(c => {
      const tids = c.fields['授课教师'];
      return Array.isArray(tids) ? tids.includes(teacherId) : tids === teacherId;
    }).length;
  };

  return (
    <div className="teaching-teachers">
      <div className="teaching-toolbar">
        <span className="teaching-count">共 {teachers.length} 位任课教师</span>
      </div>

      {teachers.length === 0 ? (
        <div className="teaching-empty-card">
          <div className="teaching-empty-icon">👨‍🏫</div>
          <div className="teaching-empty-text">本学期暂无任课教师</div>
        </div>
      ) : (
        <div className="teaching-teacher-grid">
          {teachers.map(teacher => {
            const f = teacher.fields;
            const courseCount = getTeacherCourseCount(teacher.record_id);
            const name = f['姓名'] || f['教师姓名'] || '未知';
            const title = f['职称'] || f['教师职称'] || '';
            const research = f['研究方向'] || f['研究领域'] || '';

            return (
              <div key={teacher.record_id} className="teaching-teacher-card">
                <div className="teaching-teacher-avatar">
                  {name.charAt(0)}
                </div>
                <div className="teaching-teacher-info">
                  <h3 className="teaching-teacher-name">{name}</h3>
                  {title && <div className="teaching-teacher-title">{title}</div>}
                  {research && <div className="teaching-teacher-research">{research}</div>}
                  <div className="teaching-teacher-stats">
                    <span className="teaching-teacher-stat">
                      <strong>{courseCount}</strong> 门授课
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   子页面：课程档案 TeachingArchives
   ========================================================== */

function TeachingArchives({ archives, allCourses, allTeachers }) {
  const [typeFilter, setTypeFilter] = React.useState('all');

  const archiveTypes = React.useMemo(() => {
    const types = new Set();
    archives.forEach(a => {
      const t = a.fields['档案类型'] || a.fields['类型'] || '未分类';
      types.add(t);
    });
    return Array.from(types);
  }, [archives]);

  const filteredArchives = React.useMemo(() => {
    if (typeFilter === 'all') return archives;
    return archives.filter(a =>
      (a.fields['档案类型'] || a.fields['类型'] || '未分类') === typeFilter
    );
  }, [archives, typeFilter]);

  const getCourseName = (courseId) => {
    if (!courseId) return '';
    const course = allCourses.find(c => c.record_id === courseId);
    return course ? (course.fields['课程名称'] || course.fields['名称'] || '') : '';
  };

  const getStatusColor = (status) => {
    const map = {
      '已完成': 'tag-green',
      '进行中': 'tag-blue',
      '待开始': 'tag-gray',
      '已逾期': 'tag-red',
      '搁置': 'tag-yellow',
    };
    return map[status] || 'tag-gray';
  };

  return (
    <div className="teaching-archives">
      <div className="teaching-toolbar">
        <div className="teaching-filter-group">
          <button
            className={'teaching-filter-btn' + (typeFilter === 'all' ? ' active' : '')}
            onClick={() => setTypeFilter('all')}
          >
            全部类型
          </button>
          {archiveTypes.map(t => (
            <button
              key={t}
              className={'teaching-filter-btn' + (typeFilter === t ? ' active' : '')}
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="teaching-toolbar-right">
          <span className="teaching-count">共 {filteredArchives.length} 份档案</span>
        </div>
      </div>

      {filteredArchives.length === 0 ? (
        <div className="teaching-empty-card">
          <div className="teaching-empty-icon">📁</div>
          <div className="teaching-empty-text">暂无档案数据</div>
        </div>
      ) : (
        <div className="teaching-archive-list">
          {filteredArchives.map(archive => {
            const f = archive.fields;
            const name = f['档案名称'] || f['名称'] || '未命名';
            const type = f['档案类型'] || f['类型'] || '未分类';
            const status = f['状态'] || f['档案状态'] || '待开始';
            const owner = f['负责人'] || f['档案负责人'] || '';
            
            // 关联课程
            const courseIds = f['课程'];
            let courseName = '';
            if (Array.isArray(courseIds) && courseIds.length > 0) {
              courseName = getCourseName(courseIds[0]);
            } else if (courseIds) {
              courseName = getCourseName(courseIds);
            }

            const dueDate = f['截止日期'] || f['完成期限'] || '';

            return (
              <div key={archive.record_id} className="teaching-archive-item">
                <div className="teaching-archive-icon">📄</div>
                <div className="teaching-archive-content">
                  <div className="teaching-archive-name">{name}</div>
                  <div className="teaching-archive-meta">
                    {courseName && <span>课程：{courseName}</span>}
                    {type && <span>类型：{type}</span>}
                    {owner && <span>负责人：{owner}</span>}
                    {dueDate && <span>截止：{formatDate(dueDate)}</span>}
                  </div>
                </div>
                <span className={`tag ${getStatusColor(status)}`}>{status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   子页面：教师档案（全量数据）TeachingTeacherArchive
   ========================================================== */

function TeachingTeacherArchive({ teachers }) {
  const [statusFilter, setStatusFilter] = React.useState('all');

  const statusOptions = ['在职', '外出进修', '调离', '退休'];

  const filteredTeachers = React.useMemo(() => {
    if (statusFilter === 'all') return teachers;
    return teachers.filter(t => (t.fields['状态'] || '在职') === statusFilter);
  }, [teachers, statusFilter]);

  const getStatusClass = (status) => {
    const map = {
      '在职': 'teaching-status-active',
      '外出进修': 'teaching-status-leave',
      '调离': 'teaching-status-inactive',
      '退休': 'teaching-status-inactive',
    };
    return map[status] || 'teaching-status-active';
  };

  return (
    <div className="teaching-teacher-archive">
      <div className="teaching-toolbar">
        <div className="teaching-filter-group">
          <button
            className={'teaching-filter-btn' + (statusFilter === 'all' ? ' active' : '')}
            onClick={() => setStatusFilter('all')}
          >
            全部
          </button>
          {statusOptions.map(s => (
            <button
              key={s}
              className={'teaching-filter-btn' + (statusFilter === s ? ' active' : '')}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="teaching-toolbar-right">
          <span className="teaching-count">共 {filteredTeachers.length} 位教师</span>
        </div>
      </div>

      {filteredTeachers.length === 0 ? (
        <div className="teaching-empty-card">
          <div className="teaching-empty-icon">👥</div>
          <div className="teaching-empty-text">暂无教师数据</div>
        </div>
      ) : (
        <div className="teaching-teacher-grid">
          {filteredTeachers.map(teacher => {
            const f = teacher.fields;
            const name = f['姓名'] || f['教师姓名'] || '未知';
            const title = f['职称'] || f['教师职称'] || '';
            const position = f['教研室职务'] || f['职务'] || '';
            const status = f['状态'] || '在职';
            const joinDate = f['入职时间'] || f['入职日期'] || '';

            return (
              <div key={teacher.record_id} className={`teaching-teacher-card ${getStatusClass(status)}`}>
                <div className="teaching-teacher-avatar">
                  {name.charAt(0)}
                </div>
                <div className="teaching-teacher-info">
                  <h3 className="teaching-teacher-name">
                    {name}
                    <span className={`teaching-teacher-status-dot dot-${status === '在职' ? 'green' : status === '外出进修' ? 'yellow' : 'gray'}`}></span>
                  </h3>
                  {title && <div className="teaching-teacher-title">{title}</div>}
                  {position && <div className="teaching-teacher-research">{position}</div>}
                  <div className="teaching-teacher-stats">
                    <span className="teaching-teacher-stat">
                      状态：<strong style={{
                        color: status === '在职' ? '#4ade80' : status === '外出进修' ? '#fbbf24' : '#6b7280'
                      }}>{status}</strong>
                    </span>
                    {joinDate && (
                      <span className="teaching-teacher-stat">
                        入职：{formatDate(joinDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ==========================================================
   子页面：全部工作列表 TeachingAllWorks
   ========================================================== */

function TeachingAllWorks({ works, semesters }) {
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [semesterFilter, setSemesterFilter] = React.useState('all');
  const [searchText, setSearchText] = React.useState('');

  const categories = React.useMemo(() => {
    const set = new Set();
    works.forEach(w => {
      const c = w.fields['分类'] || w.fields['工作分类'] || '未分类';
      set.add(c);
    });
    return Array.from(set);
  }, [works]);

  const statuses = React.useMemo(() => {
    const set = new Set();
    works.forEach(w => {
      const s = w.fields['状态'] || '待执行';
      set.add(s);
    });
    return Array.from(set);
  }, [works]);

  const filteredWorks = React.useMemo(() => {
    return works.filter(w => {
      if (categoryFilter !== 'all') {
        const cat = w.fields['分类'] || w.fields['工作分类'] || '未分类';
        if (cat !== categoryFilter) return false;
      }
      if (statusFilter !== 'all') {
        const st = w.fields['状态'] || '待执行';
        if (st !== statusFilter) return false;
      }
      if (semesterFilter !== 'all') {
        const sems = w.fields['所属学期'];
        const semArr = Array.isArray(sems) ? sems : (sems ? [sems] : []);
        if (!semArr.includes(semesterFilter)) return false;
      }
      if (searchText) {
        const name = getWorkName(w.fields);
        const detail = w.fields['工作详情'] || w.fields['详情'] || '';
        if (!name.includes(searchText) && !detail.includes(searchText)) return false;
      }
      return true;
    }).sort((a, b) => (b.fields['截止日期'] || 0) - (a.fields['截止日期'] || 0));
  }, [works, categoryFilter, statusFilter, semesterFilter, searchText]);

  const getSemesterName = (semIds) => {
    if (!semIds) return '—';
    const ids = Array.isArray(semIds) ? semIds : [semIds];
    const names = ids.map(id => {
      const s = semesters.find(sem => sem.record_id === id);
      return s ? s.fields['学期名称'] : id;
    });
    return names.join('、');
  };

  return (
    <div className="teaching-all-works">
      <div className="teaching-card">
        <div className="teaching-card-title">
          <span>✅</span> 全部工作
          <span className="teaching-card-badge">{filteredWorks.length}</span>
        </div>

        <div className="teaching-filter-bar">
          <div className="teaching-filter-group">
            <span className="teaching-filter-label">分类</span>
            <button
              className={'teaching-filter-btn' + (categoryFilter === 'all' ? ' active' : '')}
              onClick={() => setCategoryFilter('all')}
            >
              全部
            </button>
            {categories.map(c => (
              <button
                key={c}
                className={'teaching-filter-btn' + (categoryFilter === c ? ' active' : '')}
                onClick={() => setCategoryFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="teaching-filter-group">
            <span className="teaching-filter-label">状态</span>
            <button
              className={'teaching-filter-btn' + (statusFilter === 'all' ? ' active' : '')}
              onClick={() => setStatusFilter('all')}
            >
              全部
            </button>
            {statuses.map(s => (
              <button
                key={s}
                className={'teaching-filter-btn' + (statusFilter === s ? ' active' : '')}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="teaching-filter-group">
            <span className="teaching-filter-label">学期</span>
            <button
              className={'teaching-filter-btn' + (semesterFilter === 'all' ? ' active' : '')}
              onClick={() => setSemesterFilter('all')}
            >
              全部
            </button>
            {semesters.map(s => (
              <button
                key={s.record_id}
                className={'teaching-filter-btn' + (semesterFilter === s.record_id ? ' active' : '')}
                onClick={() => setSemesterFilter(s.record_id)}
              >
                {s.fields['学期名称'] || '未命名'}
              </button>
            ))}
          </div>

          <div className="teaching-filter-search">
            <input
              type="text"
              placeholder="搜索工作名称..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
        </div>

        {filteredWorks.length === 0 ? (
          <div className="teaching-empty">暂无符合条件的工作</div>
        ) : (
          <div className="teaching-work-table">
            <div className="teaching-work-table-head">
              <div className="tw-col-name">工作名称</div>
              <div className="tw-col-cat">分类</div>
              <div className="tw-col-status">状态</div>
              <div className="tw-col-priority">优先级</div>
              <div className="tw-col-due">截止日期</div>
              <div className="tw-col-sem">所属学期</div>
            </div>
            <div className="teaching-work-table-body">
              {filteredWorks.map(w => {
                const status = w.fields['状态'] || '待执行';
                const priority = w.fields['优先级'] || '中';
                return (
                  <div key={w.record_id} className="teaching-work-table-row">
                    <div className="tw-col-name">
                      <div className="tw-work-name">{getWorkName(w.fields)}</div>
                      {w.fields['工作详情'] && (
                        <div className="tw-work-detail">{w.fields['工作详情']}</div>
                      )}
                    </div>
                    <div className="tw-col-cat">
                      {w.fields['分类'] || w.fields['工作分类'] || '—'}
                    </div>
                    <div className="tw-col-status">
                      <span className={'tag ' + (STATUS_COLORS[status] || 'tag-gray')}>
                        {status}
                      </span>
                    </div>
                    <div className="tw-col-priority">
                      <span className={'tag ' + (PRIORITY_COLORS[priority] || 'tag-gray')}>
                        {priority}
                      </span>
                    </div>
                    <div className="tw-col-due">
                      {formatDate(w.fields['截止日期']) || '—'}
                    </div>
                    <div className="tw-col-sem">
                      {getSemesterName(w.fields['所属学期'])}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================
   组件：学期教学检查周期时间轴 SemesterCheckTimeline
   ========================================================== */

function SemesterCheckTimeline({ semester }) {
  const cycles = getSemesterCheckCycles(semester);
  const progress = calcSemesterProgress(semester);
  const currentWeek = progress.currentWeek;
  const totalWeeks = progress.totalWeeks || 18;

  if (cycles.length === 0) return null;

  const currentCycle = getCurrentCheckCycle(semester);

  return (
    <div className="teaching-card">
      <div className="teaching-card-title">
        <span>📅</span> 学期教学检查周期
        {currentCycle && (
          <span className="teaching-card-badge" style={{ background: currentCycle.color + '22', color: currentCycle.color }}>
            当前：{currentCycle.name}
          </span>
        )}
      </div>
      
      <div className="check-timeline">
        <div className="check-timeline-track">
          {cycles.map((c, i) => {
            const leftPct = ((c.startWeek - 1) / totalWeeks) * 100;
            const widthPct = ((c.endWeek - c.startWeek + 1) / totalWeeks) * 100;
            const isActive = currentWeek >= c.startWeek && currentWeek <= c.endWeek;
            return (
              <div
                key={c.name}
                className={'check-cycle-segment' + (isActive ? ' active' : '')}
                style={{
                  left: leftPct + '%',
                  width: widthPct + '%',
                  background: c.color + '33',
                  borderColor: c.color,
                }}
              >
                <div className="check-cycle-icon" style={{ color: c.color }}>{c.icon}</div>
                <div className="check-cycle-name">{c.name}</div>
                <div className="check-cycle-weeks">第{c.startWeek}-{c.endWeek}周</div>
              </div>
            );
          })}
          
          {currentWeek > 0 && (
            <div
              className="check-timeline-marker"
              style={{ left: ((currentWeek - 1) / totalWeeks) * 100 + '%' }}
            >
              <div className="check-marker-dot"></div>
              <div className="check-marker-label">第{currentWeek}周</div>
            </div>
          )}
        </div>
        
        <div className="check-timeline-ruler">
          <span>第1周</span>
          <span>第{Math.floor(totalWeeks/2)}周</span>
          <span>第{totalWeeks}周</span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   组件：占位页 TeachingPlaceholder
   ========================================================== */

function TeachingPlaceholder({ title, icon }
