#!/usr/bin/env python3
"""
o_C 工作台后端服务
- 提供静态文件服务（前端页面）
- 提供飞书 API 代理（自动注入 tenant_access_token）
  - GET/POST /api/feishu/* -> 转发到 https://open.feishu.cn/open-apis/*
  - 自动获取并缓存 tenant_access_token
"""

import os
import json
import time
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ===== 配置 =====
FEISHU_BASE = "https://open.feishu.cn/open-apis"
APP_ID = os.environ.get("FEISHU_APP_ID", "")
APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")

# Token 缓存
_token_cache = {"token": None, "expire_at": 0}


def get_tenant_access_token():
    """获取并缓存 tenant_access_token"""
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expire_at"] - 60:
        return _token_cache["token"]

    if not APP_ID or not APP_SECRET:
        raise RuntimeError("FEISHU_APP_ID 或 FEISHU_APP_SECRET 未设置")

    url = f"{FEISHU_BASE}/auth/v3/tenant_access_token/internal"
    data = json.dumps({"app_id": APP_ID, "app_secret": APP_SECRET}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read().decode("utf-8"))

    if result.get("code") != 0:
        raise RuntimeError(f"获取 token 失败: {result.get('msg', result)}")

    _token_cache["token"] = result["tenant_access_token"]
    _token_cache["expire_at"] = now + result.get("expire", 7200)
    return _token_cache["token"]


class WorkbenchHandler(SimpleHTTPRequestHandler):
    """带飞书 API 代理的 HTTP 处理器"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/feishu/"):
            self._proxy_feishu("GET")
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/feishu/"):
            self._proxy_feishu("POST")
        else:
            super().do_POST()

    def do_PUT(self):
        if self.path.startswith("/api/feishu/"):
            self._proxy_feishu("PUT")
        else:
            super().do_PUT()

    def do_DELETE(self):
        if self.path.startswith("/api/feishu/"):
            self._proxy_feishu("DELETE")
        else:
            super().do_DELETE()

    def do_PATCH(self):
        if self.path.startswith("/api/feishu/"):
            self._proxy_feishu("PATCH")
        else:
            self.send_error(405)

    def _proxy_feishu(self, method):
        """转发飞书 API 请求，自动注入 token"""
        try:
            token = get_tenant_access_token()
        except Exception as e:
            self._send_json(500, {"code": 99999, "msg": f"获取 token 失败: {str(e)}"})
            return

        # 构造目标 URL：/api/feishu/bitable/v1/... -> https://open.feishu.cn/open-apis/bitable/v1/...
        path = self.path[len("/api/feishu"):]
        target_url = f"{FEISHU_BASE}{path}"

        # 读取请求体
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # 构造请求头（复制必要头，添加 Authorization）
        headers = {}
        for h in ["Content-Type", "Accept"]:
            val = self.headers.get(h)
            if val:
                headers[h] = val
        headers["Authorization"] = f"Bearer {token}"

        req = urllib.request.Request(
            target_url,
            data=body,
            headers=headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                resp_headers = dict(resp.headers)
                # 返回响应
                self.send_response(resp.status)
                for k, v in resp_headers.items():
                    if k.lower() not in ("transfer-encoding", "connection", "content-encoding"):
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            for k, v in dict(e.headers).items():
                if k.lower() not in ("transfer-encoding", "connection", "content-encoding"):
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(err_body)
        except Exception as e:
            self._send_json(502, {"code": 99998, "msg": f"代理请求失败: {str(e)}"})

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        """简化日志，避免刷屏"""
        if not args or str(args[0]).startswith("GET /api"):
            print(f"[{self.log_date_time_string()}] {format % args}")
        elif args and str(args[0]) in ("GET", "POST", "PUT", "DELETE"):
            pass  # 静态文件请求不打印


def main():
    port = int(os.environ.get("PORT", 5000))
    server = HTTPServer(("0.0.0.0", port), WorkbenchHandler)
    print(f"o_C 工作台服务启动于 http://0.0.0.0:{port}")
    print(f"飞书代理: /api/feishu/ -> {FEISHU_BASE}/")
    print(f"APP_ID: {APP_ID[:8]}...{'已配置' if APP_ID else '未配置'}")
    print(f"APP_SECRET: {'已配置' if APP_SECRET else '未配置'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.shutdown()


if __name__ == "__main__":
    main()
