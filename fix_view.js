const fs = require('fs');
let content = fs.readFileSync('app.jsx', 'utf8');

// Fix the empty className templates in view toggle buttons
// The backticks got eaten by bash, so className={} is missing content
const old1 = '            className={}\n            onClick={() => handleViewChange(\'card\')}';
const new1 = '            className={`view-btn ${viewMode === \'card\' ? \'active\' : \'\'}`}\n            onClick={() => handleViewChange(\'card\')}';
content = content.replace(old1, new1);

const old2 = '            className={}\n            onClick={() => handleViewChange(\'list\')}';
const new2 = '            className={`view-btn ${viewMode === \'list\' ? \'active\' : \'\'}`}\n            onClick={() => handleViewChange(\'list\')}';
content = content.replace(old2, new2);

// Now add the list view rendering section after the card view
// Find the end of task-cards div and add conditional list view
const cardEndMarker = '                  </div>\n                </div>\n              );\n            })}\n          </div>\n        )}\n      </div>';

// We need to find it more precisely
const lines = content.split('\n');
let inCards = false;
let cardStartLine = -1;
let cardEndLine = -1;
let cardDivCount = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('className="task-cards"')) {
    inCards = true;
    cardStartLine = i;
    cardDivCount = 1; // the task-cards div itself
    continue;
  }
  if (inCards) {
    // Count divs to find matching closing tag
    const opens = (lines[i].match(/<div[^>]*>/g) || []).length;
    const closes = (lines[i].match(/<\/div>/g) || []).length;
    cardDivCount += opens - closes;
    if (cardDivCount <= 0) {
      cardEndLine = i;
      break;
    }
  }
}

console.log('Card section:', cardStartLine, '-', cardEndLine);

if (cardStartLine >= 0 && cardEndLine >= 0) {
  const cardSection = lines.slice(cardStartLine, cardEndLine + 1).join('\n');
  console.log('Found card section, length:', cardSection.length);
  
  // Now wrap the card section in viewMode==='card' condition
  // and add list view for viewMode==='list'
  const wrappedSection = `          {viewMode === 'card' ? (
${cardSection}
          ) : (
            <div className="task-list-table">
              <div className="table-header">
                <span className="col-title">任务</span>
                <span className="col-status">状态</span>
                <span className="col-priority">优先级</span>
                <span className="col-progress">进度</span>
                <span className="col-due">截止时间</span>
                <span className="col-actions">操作</span>
              </div>
              {visibleRecords.map(record => {
                const f = record.fields;
                const dueStatus = getDueStatus(f['截止时间'], f['任务状态']);
                const isHidden = f['隐私状态'] === '隐藏';
                const isArchived = f['任务状态'] === '归档';
                
                return (
                  <div
                    key={record.record_id}
                    className={\`table-row \${isHidden ? 'task-hidden' : ''} \${isArchived ? 'task-archived' : ''}\`}
                  >
                    <div className="col-title">
                      <div className="row-title truncate">{f['任务标题'] || '未命名'}</div>
                      {f['详细内容'] && (
                        <div className="row-desc text-secondary text-xs truncate">
                          {f['详细内容']}
                        </div>
                      )}
                    </div>
                    <div className="col-status">
                      <span className={\`tag \${STATUS_COLORS[f['任务状态']] || 'tag-gray'}\`}>
                        {f['任务状态'] || '未设置'}
                      </span>
                    </div>
                    <div className="col-priority">
                      <span className={\`tag \${PRIORITY_COLORS[f['优先级']] || 'tag-gray'}\`}>
                        {f['优先级'] || '中'}
                      </span>
                    </div>
                    <div className="col-progress">
                      {f['进度占比'] !== undefined ? (
                        <div className="row-progress">
                          <div className="progress-bar-sm">
                            <div
                              className="progress-fill-sm"
                              style={{
                                width: \`\${f['进度占比'] || 0}%\`,
                                background: \`linear-gradient(90deg, var(--accent-\${color}), var(--accent-purple))\`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted">{f['进度占比'] || 0}%</span>
                        </div>
                      ) : '-'}
                    </div>
                    <div className="col-due">
                      {f['截止时间'] ? (
                        <span className={\`text-xs due-\${dueStatus}\`}>
                          📅 {formatDate(f['截止时间'])}
                        </span>
                      ) : '-'}
                    </div>
                    <div className="col-actions">
                      <button className="action-btn" title="查看详情" onClick={() => setViewRecord(record)}>👁</button>
                      <button className="action-btn" title="编辑" onClick={() => openEditForm(record)}>✏️</button>
                      <button className="action-btn" title={isArchived ? '恢复' : '归档'} onClick={() => handleArchive(record)}>
                        {isArchived ? '↩️' : '📦'}
                      </button>
                      <button className="action-btn action-danger" title="删除" onClick={() => handleDelete(record)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}`;

  content = content.replace(cardSection, wrappedSection);
  fs.writeFileSync('app.jsx', content);
  console.log('Done - view toggle + list view added');
} else {
  console.log('Could not find card section');
}
