#!/usr/bin/env bash
# ==============================================================================
# Setup & Pre-download script for Local On-Device AI Microservice (DeepSeek Janus 1.3B)
# Compatible with Oracle Cloud Always Free, Ubuntu, Debian, Linux, and macOS
# ==============================================================================
set -e

echo "🚀 Setting up On-Device Local AI Environment for WhatsApp Bot..."

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required. Please install python3 and python3-venv first."
    exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 1. Create Virtual Environment if not exists
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment (venv)..."
    python3 -m venv venv
fi

# 2. Activate Virtual Environment
source venv/bin/activate

echo "🔄 Upgrading pip and installing PyTorch, Transformers & Janus dependencies..."
pip install --upgrade pip

# 3. Install dependencies from requirements.txt
pip install -r requirements.txt

# 4. Optional: Install Janus official package if available
pip install git+https://github.com/deepseek-ai/Janus.git || echo "⚠️ Notice: Using standard HuggingFace multi_modality transformers loader."

# 5. Pre-download DeepSeek Janus 1.3B Model Weights (~2.6 GB)
echo ""
echo "📥 Downloading DeepSeek Janus 1.3B model weights to local HuggingFace cache..."
python3 -c "
import sys
try:
    from huggingface_hub import snapshot_download
    print('Downloading deepseek-ai/Janus-1.3B snapshot...')
    snapshot_download(repo_id='deepseek-ai/Janus-1.3B', resume_download=True)
    print('✅ DeepSeek Janus 1.3B model weights successfully cached locally!')
except Exception as e:
    print(f'⚠️ Warning during pre-download: {e}. Model will stream on first run.')
"

echo ""
echo "✨ AI Environment & DeepSeek Janus 1.3B setup completed successfully!"
echo ""
echo "To start the AI microservice, run:"
echo "  bash run_ai.sh"
echo "or in the background:"
echo "  nohup bash run_ai.sh > ai_service.log 2>&1 &"
