#!/usr/bin/env bash
# ==============================================================================
# Runner script for Local AI Microservice
# ==============================================================================
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

export AI_SERVICE_PORT=${AI_SERVICE_PORT:-5005}
export AI_SERVICE_HOST=${AI_SERVICE_HOST:-0.0.0.0}

# Clean up any lingering process on port 5005
if lsof -t -i :$AI_SERVICE_PORT >/dev/null 2>&1; then
    echo "⚠️ Port $AI_SERVICE_PORT is in use. Stopping old process..."
    lsof -t -i :$AI_SERVICE_PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo "🤖 Starting Local AI Microservice on port $AI_SERVICE_PORT..."
python3 server.py
