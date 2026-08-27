#!/usr/bin/env python3
"""
Apply 5 UI changes for module lock feature in o_C console.
Modifies index.html (JSX) and styles.css (styles).
"""

import re

INDEX_PATH = "/Coze/Drive/工作台开发/oc-console-v2/index.html"
STYLES_PATH = "/Coze/Drive/工作台开发/oc-console-v2/styles.css"

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def modify_index(html):
    changes_applied = []

    # ============ 1. Sidebar: replace footer lock btn with "修改解锁密码" ============
    old_sidebar_footer = '''      <div className="sidebar-footer">
        <button className="lock-btn" onClick={handleLock}>
          <span>{unlocked ? '🔓 已解锁' : '🔒 已锁定'}</span>
        </button>
        <div className="sidebar-hint text-xs text-muted">
          {unlocked ? '点击锁定隐私数据' : '输入密码解锁隐藏数据'}
        </div>
      </div>'''

    new_sidebar_footer = '''      <div className="sidebar-footer">
        <div className="nav-item sidebar-change-pwd-btn" onClick={() => setShowChangePwdModal(true)}>
          <span className="nav-icon">🔐</span>
          <span className="nav-text">修改解锁密码</span>
        </div>
      </div>

      {showChangePwdModal && (
        <ChangeLockPasswordModal
          onSuccess={() => setShowChangePwdModal(false)}
          onClose={() => setShowChangePwdModal(false)}
        />
      )}'''

    if old_sidebar_footer in html:
        html = html.replace(old_sidebar_footer, new_sidebar_footer)
        changes_applied.append("1. Sidebar footer replaced with 🔐 修改解锁密码")
    else:
        # Try to find with different whitespace
        print("WARNING: sidebar-footer exact match failed, trying regex...")
        pattern = r'      <div className="sidebar-footer">\s*<button className="lock-btn" onClick=\{handleLock\}>\s*<span>\{unlocked \? \'🔓 已解锁\' : \'🔒 已锁定\'\}</span>\s*</button>\s*<div className="sidebar-hint text-xs text-muted">\s*\{unlocked \? \'点击锁定隐私数据\' : \'输入密码解锁隐藏数据\'\}\s*</div>\s*</div>'
        if re.search(pattern, html):
            html = re.sub(pattern, new_sidebar_footer, html)
            changes_applied.append("1. Sidebar footer replaced (regex)")
        else:
            print("ERROR: Could not find sidebar-footer section!")

    # Add showChangePwdModal state to Sidebar component
    old_sidebar_state = '''  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [showPwd, setShowPwd] = useState(false);'''
    new_sidebar_state = '''  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [showPwd, setShowPwd] = useState(false);
  const [showChangePwdModal, setShowChangePwdModal] = useState(false);'''

    if old_sidebar_state in html:
        html = html.replace(old_sidebar_state, new_sidebar_state)
        changes_applied.append("1b. Added showChangePwdModal state to Sidebar")
    else:
        print("WARNING: Could not find Sidebar state section!")

    # ============ 2. ModuleManagePage: simplify actions to 3 buttons ============
    old_actions = '''            <div className="module-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => openEditForm(mod)}>✏️ 编辑</button>
              <button className="btn btn-danger-ghost btn-sm" onClick={() => handleDelete(mod)}>🗑 删除</button>
              {isLocked ? (
                <button className="btn btn-warning btn-sm" onClick={() => openUnlockModal(mod)}>🔓 解锁</button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => handleLock(mod)}>🔒 锁定</button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setShowChangePwdModal(true)}>🔐 改密码</button>
            </div>'''

    new_actions = '''            <div className="module-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => openEditForm(mod)}>✏️ 编辑</button>
              <button className="btn btn-danger-ghost btn-sm" onClick={() => handleDelete(mod)}>🗑 删除</button>
              {!isLocked && (
                <button className="btn btn-secondary btn-sm" onClick={() => handleLock(mod)}>🔒 锁定</button>
              )}
            </div>'''

    if old_actions in html:
        html = html.replace(old_actions, new_actions)
        changes_applied.append("2. ModuleManagePage actions simplified to 3 buttons")
    else:
        print("WARNING: Could not find module-actions section!")
        # Print surrounding context for debugging
        idx = html.find('module-actions')
        if idx > 0:
            print("  Context:", repr(html[idx-50:idx+500]))

    # Remove showChangePwdModal state from ModuleManagePage (no longer needed)
    old_mmp_state = '''  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState(null);'''

    new_mmp_state = '''  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState(null);'''

    if old_mmp_state in html:
        html = html.replace(old_mmp_state, new_mmp_state)
        changes_applied.append("2b. Removed showChangePwdModal state from ModuleManagePage")
    else:
        print("WARNING: Could not find ModuleManagePage showChangePwdModal state!")

    # Remove ChangeLockPasswordModal rendering from ModuleManagePage
    old_mmp_pwd_modal = '''      {showChangePwdModal && (
        <ChangeLockPasswordModal
          onSuccess={() => setShowChangePwdModal(false)}
          onClose={() => setShowChangePwdModal(false)}
        />
      )}'''

    if old_mmp_pwd_modal in html:
        html = html.replace(old_mmp_pwd_modal, '')
        changes_applied.append("2c. Removed ChangeLockPasswordModal from ModuleManagePage")
    else:
        print("WARNING: Could not find ChangeLockPasswordModal in ModuleManagePage!")

    # ============ 5. Module card lock icon clickable (already triggers unlock) ============
    # Make the 🔒 icon clickable to open unlock modal
    old_lock_icon = '''{isLocked && <span className="module-lock-icon" title="已锁定">🔒</span>}'''
    new_lock_icon = '''{isLocked && <span className="module-lock-icon" title="点击解锁" onClick={() => openUnlockModal(mod)}>🔒</span>}'''

    if old_lock_icon in html:
        html = html.replace(old_lock_icon, new_lock_icon)
        changes_applied.append("5. Module card lock icon made clickable")
    else:
        print("WARNING: Could not find module-lock-icon span!")

    # ============ 4. ModulePage: remove "解锁模块" button + simplify big lock ============
    # Remove "🔓 解锁模块" button from page-actions
    old_unlock_btn = '''          {moduleLocked && !moduleUnlocked && (
            <button className="btn btn-warning" onClick={() => setShowLockModal(true)}>
              🔓 解锁模块
            </button>
          )}
          {(!moduleLocked || moduleUnlocked) && !unlocked && ('''

    new_unlock_btn = '''          {(!moduleLocked || moduleUnlocked) && !unlocked && ('''

    if old_unlock_btn in html:
        html = html.replace(old_unlock_btn, new_unlock_btn)
        changes_applied.append("4a. Removed 🔓 解锁模块 button from ModulePage")
    else:
        print("WARNING: Could not find 解锁模块 button in ModulePage!")
        idx = html.find('解锁模块')
        if idx > 0:
            print("  Context:", repr(html[idx-100:idx+200]))

    # Replace the big lock screen - remove text, keep just the icon
    old_big_lock = '''      {/* 模块锁定 - 大锁界面 */}
      {moduleLocked && !moduleUnlocked && (
        <div className="module-lock-screen">
          <div className="module-lock-content">
            <button
              className="module-lock-big-btn"
              onClick={() => setShowLockModal(true)}
              title="点击解锁"
            >
              <div className="module-lock-big-icon">🔒</div>
              <div className="module-lock-big-text">模块已锁定</div>
              <div className="module-lock-big-hint">点击输入密码解锁</div>
            </button>
          </div>
        </div>
      )}'''

    new_big_lock = '''      {/* 模块锁定 - 大锁界面 */}
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
      )}'''

    if old_big_lock in html:
        html = html.replace(old_big_lock, new_big_lock)
        changes_applied.append("4b. Simplified big lock to icon only")
    else:
        print("WARNING: Could not find module-lock-screen section!")
        idx = html.find('module-lock-screen')
        if idx > 0:
            print("  Context:", repr(html[idx-50:idx+600]))

    return html, changes_applied

def modify_styles(css):
    changes_applied = []

    # 3. Add blur/hide for locked card meta info
    old_locked = '''/* Module card locked state */
.module-card-locked {
  opacity: 0.75;
  position: relative;
}'''

    new_locked = '''/* Module card locked state */
.module-card-locked {
  opacity: 0.85;
  position: relative;
}
.module-card-locked .module-desc {
  filter: blur(6px);
  user-select: none;
  pointer-events: none;
}
.module-card-locked .module-meta {
  filter: blur(6px);
  user-select: none;
  pointer-events: none;
}'''

    if old_locked in css:
        css = css.replace(old_locked, new_locked)
        changes_applied.append("3. Added blur effect to locked card desc/meta")
    else:
        print("WARNING: Could not find .module-card-locked style!")

    # 5. Make module-lock-icon clickable with hover effect
    old_icon = '''.module-lock-icon {
  margin-left: 6px;
  font-size: 14px;
  vertical-align: middle;
}'''

    new_icon = '''.module-lock-icon {
  margin-left: 6px;
  font-size: 14px;
  vertical-align: middle;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-block;
}
.module-lock-icon:hover {
  transform: scale(1.2);
  filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.6));
}'''

    if old_icon in css:
        css = css.replace(old_icon, new_icon)
        changes_applied.append("5. Added clickable hover effect to lock icon")
    else:
        print("WARNING: Could not find .module-lock-icon style!")

    # 1. Add sidebar-change-pwd-btn style (match nav-item)
    old_footer_style = '''.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}'''

    new_footer_style = '''.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}
.sidebar-change-pwd-btn {
  cursor: pointer;
}'''

    if old_footer_style in css:
        css = css.replace(old_footer_style, new_footer_style)
        changes_applied.append("1. Added sidebar-change-pwd-btn style")
    else:
        print("WARNING: Could not find .sidebar-footer style!")

    # 4. Big lock icon-only style
    old_big_icon = '''.module-lock-big-icon {
  font-size: 96px;
  margin-bottom: 20px;
  animation: lockFloat 3s ease-in-out infinite;
}'''

    new_big_icon = '''.module-lock-big-icon {
  font-size: 96px;
  margin-bottom: 20px;
  animation: lockFloat 3s ease-in-out infinite;
}
.module-lock-big-icon-only {
  font-size: 140px;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: lockFloat 3s ease-in-out infinite;
  display: inline-block;
  filter: drop-shadow(0 4px 20px rgba(168, 85, 247, 0.25));
}
.module-lock-big-icon-only:hover {
  transform: scale(1.1) translateY(-4px);
  filter: drop-shadow(0 8px 40px rgba(168, 85, 247, 0.45));
}'''

    if old_big_icon in css:
        css = css.replace(old_big_icon, new_big_icon)
        changes_applied.append("4. Added big lock icon-only style with hover effect")
    else:
        print("WARNING: Could not find .module-lock-big-icon style!")

    return css, changes_applied


if __name__ == '__main__':
    html = read_file(INDEX_PATH)
    css = read_file(STYLES_PATH)

    print(f"Original index.html size: {len(html)} chars")
    print(f"Original styles.css size: {len(css)} chars")
    print()

    html, html_changes = modify_index(html)
    css, css_changes = modify_styles(css)

    print("=== JSX (index.html) changes ===")
    for c in html_changes:
        print(f"  ✓ {c}")
    print()
    print("=== CSS (styles.css) changes ===")
    for c in css_changes:
        print(f"  ✓ {c}")
    print()

    write_file(INDEX_PATH, html)
    write_file(STYLES_PATH, css)

    print(f"New index.html size: {len(html)} chars")
    print(f"New styles.css size: {len(css)} chars")
    print("All changes applied.")
