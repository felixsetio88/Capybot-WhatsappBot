# 🤖 WhatsApp Group Bot, Admin Dashboard & On-Device AI

A powerful, full-featured WhatsApp Group Management Bot and on-device AI assistant built with Node.js and `@whiskeysockets/baileys`, coupled with a real-time Web Admin Dashboard and a 100% self-hosted, zero-API-key local AI microservice powered by **Qwen 2.5** and **DeepSeek Janus 1.3B** (optimized for Oracle Cloud Always Free).

---

## 🌟 Key Features

### 🤖 On-Device AI Features (Zero API Keys Required)
1. **`.ask [question]` (Q&A and Multimodal Vision)**:
   - **Text Question Answering**: Powered by `Qwen/Qwen2.5-0.5B-Instruct` (or `1.5B`) for instant (<1s) answers on CPU.
   - **Multimodal Visual Analysis**: Send or reply to any photo with `.ask [question]` to have `deepseek-ai/Janus-1.3B` inspect and describe the image in detail.
2. **`.summarize` (Group Chat Summarizer)**:
   - Fetches the last 100 group messages from the local SQLite database.
   - Generates an executive summary with Key Discussion Topics, Decisions & Highlights, and Active Contributors.
3. **`.generateimage [prompt]` (Text-to-Image Generation)**:
   - Autoregressively generates custom visual artwork directly on-device using DeepSeek Janus 1.3B visual tokenizer without external cloud APIs.

### 🛡️ Group Management, Utilities & Moderation
4. **Member Activity & Passive Member Detection**:
   - **`.passive`**: Lists group members who have sent fewer messages than the configured threshold (e.g. `< 5 msgs`), sorted from least active to most active.
   - **`.passive set [number]`**: Allows Group Admins to adjust the passive threshold directly in chat or on the Web Dashboard.
   - **`.inactive`**: Lists members who have been inactive for more than 24 hours.
   - **`.chatcount`**: Real-time group leaderboard with medal rankings.
5. **View Once Revealer & System Telemetry**:
   - **`.peek` (or `.rvo`, `.viewonce`)**: Reply to any WhatsApp View Once ("one time view") image or video to decrypt and resend it permanently to the chat.
   - **`.ping` (or `.speed`)**: Measures bot response latency in milliseconds and reports active memory usage.
   - **`.runtime` (or `.uptime`)**: Shows the bot server's total continuous uptime and environment status.
6. **In-Chat Admin Commands**:
   - **`.tagall [announcement]`**: Tag all members with a numbered list.
   - **`.delete` (or `.del`)**: Reply to any message to delete it immediately.
   - **`.kick @user`**: Remove a member from the group (admins protected).
   - **`.hidetag [announcement]`**: Ghost tag all members silently.
   - **`.block @user` / `.unblock @user`**: Auto-delete all future messages from specific members.
   - **`.sticker` (or `.s`)**: Reply to any image to convert it into a 512x512 transparent WebP sticker.
7. **Interactive Group Chat & Message Search**:
   - Live stream of WhatsApp group conversations with WhatsApp Web dark styling.
   - Search past messages and load older historical archives.
   - Admin Web Messenger: send messages directly from the dashboard.
8. **Instagram & TikTok Link Blocker (Admin-Exempt)**:
   - Detects and deletes unauthorized Instagram and TikTok links from non-admins with customizable warning messages.

---

## 📁 Project Structure

```
Whatsapp Bot/
├── ai_service/                         # Local Python AI Microservice (Janus 1.3B & Qwen 2.5)
│   ├── server.py                       # FastAPI REST API endpoints
│   ├── models_manager.py               # Multimodal vision, Q&A, and image generation engine
│   ├── requirements.txt                # PyTorch, Transformers, Pillow, FastAPI
│   ├── setup_ai.sh                     # Automated setup script for Oracle Always Free / Linux / macOS
│   ├── run_ai.sh                       # AI service runner script
│   └── README.md                       # AI microservice documentation
├── auth_info_baileys/                  # Multi-file authentication session (auto-generated)
├── data/                               # Persistent SQLite database storage
│   └── bot.sqlite
├── public/                             # Web Admin Dashboard Frontend
│   ├── css/
│   │   └── dashboard.css               # Dark-mode glassmorphism design system
│   ├── js/
│   │   └── dashboard.js                # Real-time WebSocket & settings controller
│   └── index.html                      # Dashboard UI markup & Help Guide
├── src/
│   ├── bot/
│   │   ├── handlers/
│   │   │   └── messageHandler.js       # Command processor, AI handlers & link blocker
│   │   ├── services/
│   │   │   └── aiService.js            # Node.js client for local AI microservice
│   │   ├── utils/
│   │   │   ├── auth.js                 # Password hashing & JWT auth
│   │   │   ├── linkDetector.js         # Link regex & greeting matcher
│   │   │   └── stickerConverter.js     # Media downloader, WebP sticker & View Once decoder
│   │   └── client.js                   # Baileys WhatsApp client & QR manager
│   ├── database/
│   │   └── db.js                       # SQLite database queries, settings & migrations
│   └── server.js                       # Express API server & Socket.IO realtime hub
├── tests/
│   ├── test_ai.js                      # AI unit & integration test suite
│   └── test_core.js                    # Core test suite
├── .env.example                        # Environment variables template
├── package.json
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Install Node.js Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. (Optional) Setup Local AI Microservice (Janus 1.3B & Qwen 2.5)
On your Oracle Cloud Always Free VM or local computer:
```bash
cd ai_service
bash setup_ai.sh
bash run_ai.sh
```
*Note: The bot includes built-in fallback handling, so WhatsApp features continue to operate seamlessly even if the Python AI service is offline or downloading models.*

### 4. Start the WhatsApp Bot Server
```bash
npm start
```
Or with auto-reloading:
```bash
npm run dev
```

### 5. Pair WhatsApp
1. Open your browser and go to `http://localhost:3000`.
2. Click **"Pair Device (QR)"** in the sidebar (or scan the QR code printed in terminal).
3. On your phone: Open **WhatsApp** > **Settings** > **Linked Devices** > **Link a Device**, and scan the QR code.

---

## 🤖 In-Chat Commands Summary

| Command | Usage | Description |
| :--- | :--- | :--- |
| **`.ask [question]`** | `.ask What is quantum computing?` | Ask on-device AI any question (Qwen 2.5). |
| **`.ask [question]`** *(reply to image)* | Reply to photo: `.ask Describe this picture` | Multimodal visual analysis (DeepSeek Janus 1.3B). |
| **`.summarize`** | `.summarize` | Summarizes last 100 group chat messages into structured bullet points. |
| **`.generateimage [prompt]`** | `.generateimage a cute baby capybara in space` | Autoregressively generates an image on-device (Janus 1.3B). |
| **`.peek`** *(or `.rvo`)* | Reply to View Once image/video with `.peek` | Decrypts and resends WhatsApp View Once media permanently. |
| **`.passive`** | `.passive` | Lists group members with fewer chats than threshold. |
| **`.passive set [num]`** | `.passive set 10` *(Admin)* | Sets group minimum chat threshold for passive status. |
| **`.about`** *(or `.info`)* | `.about` | Displays Capybot V1.1 version details, release notes, and status. |
| **`.ping`** | `.ping` | Shows bot response latency (ms) and memory stats. |
| **`.runtime`** | `.runtime` | Shows total server continuous uptime and system details. |
| **`.sticker`** *(or `.s`)* | Reply to image with `.sticker` | Converts image into a 512x512 transparent WebP sticker. |
| **`.chatcount`** | `.chatcount` | Displays member message leaderboard with medals. |
| **`.inactive`** | `.inactive` | Lists members who haven't chatted in >24h. |
| **`.tagall [text]`** | `.tagall Meeting starts now!` *(Admin)* | Tags all group members with a numbered list. |
| **`.hidetag [text]`** | `.hidetag Notice!` *(Admin)* | Ghost tags all group members silently. |
| **`.delete`** | Reply to message with `.delete` *(Admin)* | Deletes target member message immediately. |
| **`.kick @user`** | `.kick @user` *(Admin)* | Removes member from group (admins protected). |
| **`.block @user`** | `.block @user` *(Admin)* | Auto-deletes all future messages from target user. |
| **`.unblock @user`** | `.unblock @user` *(Admin)* | Unblocks member from auto-deletion. |

---

## 🧪 Running Automated Tests

Run the complete test suite (47 core tests + 11 AI tests = 58 tests):
```bash
npm test
```
