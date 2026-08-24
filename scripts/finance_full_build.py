#!/usr/bin/env python3
"""
财务模块完整修复与二三波开发
"""
import re

HTML_PATH = '/Coze/Drive/工作台开发/oc-console-v2/_tmp_online.html'
OUTPUT_PATH = '/Coze/Drive/工作台开发/oc-console-v2/index.html'

with open(HTML_PATH, 'r', encoding='utf-8') as f:
    html = f.read()

print(f'原始行数: {html.count(chr(10))}')

# ==========================================================
# 1. 删除第一套重复的 FINANCE_CONFIG 和 fetchAllFinanceData
# ==========================================================
# 第一套在 第一个FINANCE_CONFIG（行487）到 proxyFetch 之前
# 找到第一个 FINANCE_CONFIG 的起始行和 proxyFetch 的起始行
# 然后用正则替换掉中间内容（包括FINANCE_CONFIG和fetchAllFinanceData，保留空行后的proxyFetch）

# 匹配：从 "  // 财务模块配置\n  const FINANCE_CONFIG = {" 到 "  return { ledger, assets, income, loans, reminders };\n}"
pattern1 = r'(\n\s*// 财务模块配置\s*\n\s*const FINANCE_CONFIG = \{.*?return \{ ledger, assets, income, loans, reminders \};\s*\n\s*\})'
match = re.search(pattern1, html, re.DOTALL)
if match:
    print(f'找到第一套重复代码，位置: {match.start()}-{match.end()}, 长度: {len(match.group(1))}')
    html = html.replace(match.group(1), '\n', 1)
    print('已删除第一套重复定义')
else:
    print('WARNING: 未找到第一套重复定义')

# 验证：还剩几个 FINANCE_CONFIG
count = html.count('const FINANCE_CONFIG')
print(f'删除后 FINANCE_CONFIG 数量: {count}')
count2 = html.count('async function fetchAllFinanceData')
print(f'删除后 fetchAllFinanceData 数量: {count2}')

# ==========================================================
# 2. 补充通用的按表 CRUD 函数（在 deleteRecord 函数后面加）
# ==========================================================
crud_functions = '''
// 按表创建记录
async function createRecordByTable(appToken, tableId, fields) {
  const data = await feishuRequest(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    { method: 'POST', body: JSON.stringify({ fields }) }
  );
  const item = data.record;
  return { ...item, fields: cleanFields(item.fields) };
}

// 按表更新记录
async function updateRecordByTable(appToken, tableId, recordId, fields) {
  const data = await feishuRequest(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    { method: 'PUT', body: JSON.stringify({ fields }) }
  );
  const item = data.record;
  return { ...item, fields: cleanFields(item.fields) };
}

// 按表删除记录
async function deleteRecordByTable(appToken, tableId, recordId) {
  await feishuRequest(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    { method: 'DELETE' }
  );
  return true;
}
'''

# 在最后一个 async function deleteRecord(recordId) { ... } 结束后插入
# 找到 getAllRecords 后面那套 deleteRecord 的结尾
pattern2 = r'(async function deleteRecord\(recordId\) \{[\s\S]*?\n\})'
matches = list(re.finditer(pattern2, html))
if matches:
    last_match = matches[-1]
    print(f'找到 deleteRecord 函数，位置: {last_match.start()}-{last_match.end()}')
    insert_pos = last_match.end()
    html = html[:insert_pos] + crud_functions + html[insert_pos:]
    print('已插入按表 CRUD 函数')
else:
    print('WARNING: 未找到 deleteRecord 函数')

# ==========================================================
# 3. 替换 FinancePage 组件，补全所有6个分区
# ==========================================================
# 找到 function FinancePage() { 到对应的结束 }
# 这个函数很长，找到正确的结束大括号是关键
# 策略：找到 function FinancePage 起始位置，然后在 App 函数之前结束

finance_start = html.find('function FinancePage()')
app_start = html.find('function App()')
print(f'FinancePage 起始位置: {finance_start}')
print(f'App 起始位置: {app_start}')

if finance_start > 0 and app_start > finance_start:
    old_finance_section = html[finance_start:app_start]
    print(f'旧 FinancePage 区域长度: {len(old_finance_section)}')
else:
    print('ERROR: 无法定位 FinancePage 区域')
    exit(1)
