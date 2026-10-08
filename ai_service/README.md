# 🤖 Local On-Device AI Microservice (DeepSeek Janus 1.3B)

This microservice provides **100% self-hosted, on-device AI capabilities** powered exclusively by **DeepSeek Janus 1.3B** without requiring any external or paid API keys.

Optimized specifically for **Oracle Cloud Always Free** instances (CPU-optimized, ARM64 Ampere / x86 micro instances).

---

## 🌟 Capabilities & Architecture

DeepSeek Janus 1.3B is an all-in-one multimodal foundation model that unifies text, vision, and image generation into a single memory-efficient footprint (~2.6 GB RAM).

| Feature | WhatsApp Command | AI Model | Description |
| :--- | :--- | :--- | :--- |
| **Chatbot & Q&A** | `.ask [question]` | `deepseek-ai/Janus-1.3B` | Unified text chat, reasoning, coding, and multi-turn conversations. |
| **Visual Understanding** | `.ask [question]` *(with image)* | `deepseek-ai/Janus-1.3B` | Multimodal SigLIP vision encoder for image analysis and visual Q&A. |
| **Chat Summarizer** | `.summarize` | `deepseek-ai/Janus-1.3B` | Summarizes the last 100 group chat messages into structured bullet points. |
| **Image Generation** | `.generateimage [prompt]` | `deepseek-ai/Janus-1.3B` | Autoregressive visual synthesis & neural text-to-image generator. |

---

## 🚀 Quick Setup on Oracle Cloud Always Free / Linux

### 1. Install System Dependencies
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y python3 python3-pip python3-venv

# Oracle Linux / RHEL / CentOS
sudo dnf install -y python3 python3-pip
```

### 2. Run the Setup Script
```bash
cd ai_service
bash setup_ai.sh
```

### 3. Start the AI Server
```bash
bash run_ai.sh
```
Or start in the background:
```bash
nohup bash run_ai.sh > ai_service.log 2>&1 &
```

The AI microservice will start listening on `http://127.0.0.1:5005`.

---

## ⚙️ Configuration (.env)

Set the following environment variables in `.env` in the root project:
```env
# AI Microservice URL (Default: http://127.0.0.1:5005)
AI_SERVICE_URL=http://127.0.0.1:5005
AI_ENABLED_DEFAULT=true
AI_IMAGE_GEN_DEFAULT=true
```
