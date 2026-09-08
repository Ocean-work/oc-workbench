#!/bin/bash
set -e
PORT=${PORT:-5000}
echo "Starting o_C workbench server on port $PORT..."
cd "$(dirname "$0")/.."
exec python3 server.py
