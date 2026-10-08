# ☁️ Dual-Instance Deployment Guide (Oracle Always Free: 2x VM.Standard.E2.1.Micro)

This guide walks you through deploying **Capybot V1.1** across **two separate Always Free `VM.Standard.E2.1.Micro` AMD instances** (1 GB RAM each) on Oracle Cloud for **$0.00 forever**:
- **Instance 1 (`capybot-main`):** WhatsApp Bot, Web Dashboard, SQLite & Auto-restart (2 GB Swap).
- **Instance 2 (`capybot-ai`):** Dedicated Python Qwen 3.5 AI Microservice (8 GB Swap).

---

## 🏗️ Architecture Overview

```
[ Your Phone (WhatsApp) ]               [ Web Browser (Dashboard) ]
           │                                       │
           ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Instance 1: capybot-main (VM.Standard.E2.1.Micro • 1 GB RAM)          │
│  - Node.js 20, Baileys WebSocket, Express Web Server, SQLite          │
│  - Port 3000: Web Admin Dashboard                                     │
│  - 2 GB Swapfile (Smooth, non-blocking 24/7 uptime)                   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Internal Oracle VCN Network
                                     │ (Private IP: http://10.0.0.X:5005)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Instance 2: capybot-ai (VM.Standard.E2.1.Micro • 1 GB RAM)            │
│  - Python FastAPI + Qwen 3.5 0.8B Q4 LLM Engine                       │
│  - Port 5005: AI Inference Microservice                                │
│  - 8 GB Swapfile (Provides virtual memory to load model weights)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🌐 Step 1: Create Both Instances & Configure Oracle Firewall

### 1.1 Create Instance 1 (`capybot-main`)
1. In Oracle Cloud Console, go to **Compute** > **Instances** > **Create Instance**.
2. **Name:** `capybot-main`
3. **Image:** Ubuntu 24.04 (or 22.04) x86_64.
4. **Shape:** `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM - Always Free Eligible).
5. **Boot Volume:** 50 GB.
6. **Save your SSH Private Key** and click **Create**.
7. Note down:
   - **Public IP** (e.g. `140.238.X.X`)
   - **Private IP** (e.g. `10.0.0.10`)

### 1.2 Create Instance 2 (`capybot-ai`)
1. Click **Create Instance** again.
2. **Name:** `capybot-ai`
3. **Image:** Ubuntu 24.04 (or 22.04) x86_64.
4. **Shape:** `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM - Always Free Eligible).
5. **Networking:** Select the **same Virtual Cloud Network (VCN)** and **same Subnet** as Instance 1.
6. **Boot Volume:** 50 GB.
7. **Save your SSH Private Key** and click **Create**.
8. Note down:
   - **Public IP** (e.g. `140.238.Y.Y`)
   - **Private IP** (e.g. `10.0.0.25`) 👈 *Crucial for AI communication!*

---

### 1.3 Open Firewall Ports in Oracle VCN Security List
1. In Oracle Cloud Console, navigate to **Networking** > **Virtual Cloud Networks** > Click your VCN.
2. Under **Security Lists**, click **Default Security List for...**
3. Click **Add Ingress Rules** and add these two rules:

| Rule | Source CIDR | IP Protocol | Destination Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `0.0.0.0/0` | `TCP` | `3000` | Web Dashboard (Public) |
| **Internal AI** | `10.0.0.0/16` | `TCP` | `5005` | Internal AI Microservice (Private only) |

4. Click **Add Ingress Rules**.

---

## 🧠 Step 2: Setup Instance 2 (`capybot-ai`)

SSH into Instance 2:
```bash
ssh -i /path/to/key.key ubuntu@<INSTANCE_2_PUBLIC_IP>
```

### 2.1 Create 8 GB Swapfile (Mandatory for 1GB RAM)
```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
*Verify swap is active with: `free -h` (Swap should show 8.0Gi).*

### 2.2 Open Port 5005 in Ubuntu Firewall
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5005 -j ACCEPT
sudo apt update && sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 2.3 Install Python & PM2
```bash
sudo apt install -y python3 python3-pip python3-venv git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2.4 Deploy and Start AI Microservice
```bash
cd ~
git clone <YOUR_GIT_REPO_URL> "Whatsapp Bot"
cd "Whatsapp Bot/ai_service"

# Run setup to create Python venv and install dependencies
bash setup_ai.sh

# Start AI service with PM2
pm2 start run_ai.sh --name "capy-ai"
pm2 save
pm2 startup
# (Run the sudo env PATH=... command printed on screen)
```

Verify it is running:
```bash
curl http://localhost:5005/api/status
# Expected: {"status":"available", ...}
```

---

## 🤖 Step 3: Setup Instance 1 (`capybot-main`)

SSH into Instance 1:
```bash
ssh -i /path/to/key.key ubuntu@<INSTANCE_1_PUBLIC_IP>
```

### 3.1 Create 2 GB Swapfile
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3.2 Open Port 3000 in Ubuntu Firewall
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo apt update && sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 3.3 Install Node.js 20 & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential libvips-dev
sudo npm install -g pm2
```

### 3.4 Deploy Capybot & Point to Instance 2's Private IP
```bash
cd ~
git clone <YOUR_GIT_REPO_URL> "Whatsapp Bot"
cd "Whatsapp Bot"
npm install

# Copy environment config
cp .env.example .env
```

Now open `.env` and set `AI_SERVICE_URL` to Instance 2's **Private IP**:
```bash
nano .env
```
Update line:
```env
AI_SERVICE_URL=http://<INSTANCE_2_PRIVATE_IP>:5005
```
*(Replace `<INSTANCE_2_PRIVATE_IP>` with the actual private IP, e.g. `http://10.0.0.25:5005`).*

### 3.5 Launch Capybot with PM2
```bash
npm run start:pm2
pm2 save
pm2 startup
# (Run the sudo env PATH=... command printed on screen)
```

---

## 📱 Step 4: Pair WhatsApp & Verify Everything

1. Open your browser and navigate to:
   ```
   http://<INSTANCE_1_PUBLIC_IP>:3000
   ```
2. Scan the QR code with WhatsApp (**Linked Devices** > **Link a device**).
3. Verify in WhatsApp:
   - `.about` — Checks bot status and uptime.
   - `.ask Hello! Are you online?` — Verifies connection to Instance 2's AI microservice!
   - `.match`, `.topic`, `.wordgame` — Interactive games run on Instance 1 with 0 delay.
4. Open the Web Dashboard:
   - Click **AI Models** in the sidebar: Notice the status shows **Available** and connected to the remote microservice!
   - In Settings > **Application Crash History**: System status shows **Healthy (0 crashes)**.

---

## 🛠️ Management Cheat Sheet

| Task | Command on Instance 1 (Bot) | Command on Instance 2 (AI) |
| :--- | :--- | :--- |
| **View Live Logs** | `pm2 logs capybot` | `pm2 logs capy-ai` |
| **Check Process Health**| `pm2 status` | `pm2 status` |
| **Restart Service** | `npm run restart:pm2` | `pm2 restart capy-ai` |
| **Check Memory/Swap** | `free -h` | `free -h` |
