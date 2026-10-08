# ☁️ Oracle Cloud (Always Free) Deployment Guide for Capybot & On-Device AI

This guide walks you through deploying **Capybot V1.1** (Node.js WhatsApp Bot + Web Dashboard) and the **On-Device Local AI Microservice** (Qwen 2.5 & DeepSeek Janus 1.3B) on **Oracle Cloud Always Free Tier** (100% free forever, no credit card charges).

---

## 🏗️ 1. Recommended Oracle Cloud VM Instance

Oracle Cloud provides one of the most generous free tiers in the world:
- **Compute Shape**: `VM.Standard.A1.Flex` (Ampere ARM)
- **CPU**: Up to **4 OCPUs** (ARM Neoverse-N1)
- **RAM**: Up to **24 GB RAM** *(Plenty of RAM to run both Qwen and Janus effortlessly!)*
- **Boot Volume**: 50 GB to 100 GB (Always Free includes 200 GB total storage)
- **Image**: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS (aarch64 / ARM64)**

---

## 🌐 2. Oracle Cloud Firewall / Security List (Open Port 3000)

To access your Web Dashboard from your browser:
1. In Oracle Cloud Console, go to **Networking** > **Virtual Cloud Networks** > Click your VCN.
2. Under **Security Lists**, click the **Default Security List**.
3. Click **Add Ingress Rules**:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `3000`
   - **Description**: `Capybot Web Dashboard`
4. Click **Add Ingress Rules**.

---

## 🖥️ 3. Server Setup on Ubuntu VM

Connect to your Oracle VM via SSH:
```bash
ssh -i /path/to/your_private_key ubuntu@<YOUR_VM_PUBLIC_IP>
```

### Step 3.1: Update System & Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git curl build-essential libvips-dev
```

### Step 3.2: Install Node.js (v20 LTS or v22)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 3.3: Configure Swap Memory (4 GB)
*(Ensures stability when downloading model weights & compiling dependencies)*
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Step 3.4: Open OS Firewall (iptables / ufw)
Oracle Ubuntu instances block ports locally by default. Run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo apt install -y iptables-persistent && sudo netfilter-persistent save
```

---

## 📦 4. Install Capybot & AI Microservice

### Step 4.1: Clone or Copy Your Code
```bash
cd ~
git clone <YOUR_GIT_REPO_URL> "Whatsapp Bot"
cd "Whatsapp Bot"
```

### Step 4.2: Install Node.js Packages
```bash
npm install
cp .env.example .env
```

### Step 4.3: Setup On-Device AI Microservice
```bash
cd ai_service
bash setup_ai.sh
cd ..
```

---

## 🚀 5. Auto-Restart Mechanisms (Run 24/7 in Background)

Choose either **PM2** (recommended for production) or the built-in **Node Daemon** (zero setup):

### Option A: PM2 (Recommended)
PM2 ensures Capybot automatically restarts on crashes, memory spikes, and system reboots:
```bash
# 1. Install PM2
sudo npm install -g pm2

# 2. Start Capybot using the pre-configured ecosystem config
cd ~/Whatsapp\ Bot
pm2 start ecosystem.config.cjs

# 3. Enable auto-start on server reboot
pm2 save
pm2 startup
# Run the sudo env PATH=... command printed by PM2
```

### Option B: Built-in Self-Healing Supervisor (Zero External Tools)
Capybot includes an integrated supervisor that monitors the bot, enforces a 450MB memory ceiling, and auto-restarts the app within 2 seconds if it crashes:
```bash
npm run daemon
```

---

## 🔧 6. Troubleshooting: "IP Address Inaccessible"

If your dashboard `http://<PUBLIC_IP>:3000` is unreachable, check these 4 common causes:

### 1. VM Freezing Due to Out-Of-Memory (No Swap)
- **Symptom**: SSH disconnects, dashboard doesn't load, VM becomes completely unresponsive.
- **Immediate Fix**: Go to Oracle Cloud Console > Compute > Instances > Click your instance > Click **"Reboot"** (or Force Reboot).
- **Permanent Solution**: Add a 2GB swapfile so memory spikes never freeze the machine:
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

### 2. Port 3000 Blocked in Oracle Cloud Security List
- **Symptom**: SSH works, but port 3000 times out in browser.
- **Fix**: In Oracle Cloud Console:
  1. Go to **Networking** > **Virtual Cloud Networks** > Click your VCN > **Security Lists** > **Default Security List**.
  2. Click **Add Ingress Rules**:
     - **Source CIDR**: `0.0.0.0/0`
     - **IP Protocol**: `TCP`
     - **Destination Port Range**: `3000`
  3. Save rules.

### 3. Ubuntu OS Local Firewall (`iptables`)
- **Symptom**: Oracle Ubuntu blocks incoming ports locally by default.
- **Fix**: Open port 3000 in Ubuntu:
  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
  sudo apt install -y iptables-persistent && sudo netfilter-persistent save
  ```

### 4. App Process Crashed and Stopped
- **Fix**: Use PM2 (`pm2 start ecosystem.config.cjs`) or `npm run daemon`. Both automatically restart Capybot if it encounters an error.

---

## 📱 7. Pair WhatsApp & Access Dashboard

1. Open your browser and visit:
   ```
   http://<YOUR_ORACLE_VM_PUBLIC_IP>:3000
   ```
2. Click **"Pair Device (QR)"** in the sidebar.
3. Open **WhatsApp** on your phone > **Settings** > **Linked Devices** > **Link a Device**, and scan the QR code.
4. Once paired, test in any WhatsApp chat:
   - `.about` — Verify Capybot V1.1 status
   - `.match` — Test Gen-Z partner compatibility
   - `.topic` — Test interactive Gen-Z conversation starter
   - `.wordgame` — Test bilingual word riddle game
   - `.leaderboard` — View group game leaderboard

---

## 🛠️ Handy PM2 Commands

| Action | Command |
| :--- | :--- |
| View status | `pm2 status` |
| View live logs | `pm2 logs capybot` |
| Restart bot | `npm run restart:pm2` (or `pm2 restart capybot`) |
| Stop bot | `npm run stop:pm2` (or `pm2 stop capybot`) |
