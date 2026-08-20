#!/bin/bash
set -e
PORT=${PORT:-5000}
echo "Starting static web server on port $PORT..."
exec python3 -m http.server $PORT --bind 0.0.0.0
