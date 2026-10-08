# 🚀 Capybot — Oracle Cloud Deployment Guide

Two VM.Standard.E2.1.Micro instances on Oracle Cloud Always Free.

| Instance | Name | Purpose |
|---|---|---|
| **Instance 1** | `capybot-main` | Capybot bot + Web Dashboard |
| **Instance 2** | `capybot-ai` | Reserved for AI model (A1.Flex later) |

> **Phase 1:** Deploy Capybot only on Instance 1 (no AI).
> **Phase 2:** When you get A1.Flex, deploy AI model and point Instance 1 to it.

---

## 📋 Prerequisites (Do on Your Mac First)

### 1. Download Your SSH Private Key
OCI Console → **Compute → Instances → your instance** → download the `.key` file from the key pair selected during creation.

```bash
# Fix permissions on your Mac
chmod 400 ~/Downloads/your-oracle-key.key
```

### 2. Get Your Instance Public IP
OCI Console → **Compute → Instances** → copy the **Public IPv4 Address**.

---

## 🖥️ INSTANCE 1 — Capybot Main (`capybot-main`)

### Step 1 — SSH Into the Server
```bash
ssh -i ~/Downloads/your-oracle-key.key ubuntu@<INSTANCE_1_PUBLIC_IP>
```

---

### Step 2 — Update System
```bash
sudo apt update && sudo apt upgrade -y
```

---

### Step 3 — Configure Swap Memory (Critical!)
Oracle E2.1.Micro ships with 1 GB RAM and zero swap. Without swap, the OS can freeze under load.

```bash
# Create 2 GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap survive reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Use RAM first, swap only when necessary
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify — Swap line should show 2.0G
free -h
```

---

### Step 4 — Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Verify
node --version    # Must show v20.x.x
npm --version
```

---

### Step 5 — Open Firewall Port 3000

#### A. Oracle Cloud Security List (OCI Console)
```
OCI Console → Networking → Virtual Cloud Networks
→ Your VCN → Security Lists → Default Security List
→ Add Ingress Rule:
    Source CIDR:      0.0.0.0/0
    IP Protocol:      TCP
    Destination Port: 3000
```

#### B. Ubuntu OS Firewall (run on the server)
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo apt install iptables-persistent -y
sudo netfilter-persistent save
```

---

### Step 6 — Upload Capybot from Your Mac
Run this on your Mac (not the server):

```bash
rsync -avz \
  --exclude='node_modules' \
  --exclude='auth_sessions' \
  --exclude='auth_info_baileys' \
  --exclude='data' \
  --exclude='.env' \
  -e "ssh -i ~/Downloads/your-oracle-key.key" \
  ./ \
  ubuntu@<INSTANCE_1_PUBLIC_IP>:~/capybot/
```

---

### Step 7 — Install Dependencies (on the server)
```bash
cd ~/capybot
npm install --production
```

---

### Step 8 — Create Your .env File
```bash
cp .env.example .env
nano .env
```

Set the following (Ctrl+X → Y → Enter to save):
```env
# Server
PORT=3000
HOST=0.0.0.0

# Bot Settings
AUTO_REPLY_HI=true
REPLY_MESSAGE="Hi there! How can I help you today?"
BLOCK_INSTAGRAM=true
BLOCK_TIKTOK=true
DELETE_OFFENDING_LINKS=true
WARN_USER=true

# AI — DISABLED for now (enable in Phase 2 when A1.Flex is ready)
AI_SERVICE_URL=
AI_ENABLED_DEFAULT=false
AI_IMAGE_GEN_DEFAULT=false
```

---

### Step 9 — Start Capybot with PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start Capybot
pm2 start ecosystem.config.cjs

# Save process list (survives reboots)
pm2 save

# Configure auto-start on boot
pm2 startup
# Copy and run the command it prints (starts with: sudo env PATH=...)

# Verify
pm2 status
pm2 logs capybot --lines 30
```

---

### Step 10 — Access Your Dashboard
```
http://<INSTANCE_1_PUBLIC_IP>:3000
```

Scan the QR code shown in the dashboard to pair your WhatsApp.

---

### Useful PM2 Commands
```bash
pm2 status              # Check if running
pm2 logs capybot        # View live logs
pm2 restart capybot     # Restart the bot
pm2 stop capybot        # Stop the bot
pm2 monit               # Live CPU/RAM monitor
```

---

## 🖥️ INSTANCE 2 — Reserved for AI (`capybot-ai`)

Skip full deployment for now. At minimum, configure swap to keep the instance healthy.

```bash
ssh -i ~/Downloads/your-oracle-key.key ubuntu@<INSTANCE_2_PUBLIC_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Setup swap memory
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify
free -h
```

Leave it idle until you are ready to deploy the AI model.

---

## Phase 2 — Adding AI Later (When You Get A1.Flex)

When you get the A1.Flex instance and deploy the AI microservice on it:

1. SSH into capybot-main and update two lines in .env:

```bash
ssh -i ~/Downloads/your-oracle-key.key ubuntu@<INSTANCE_1_PUBLIC_IP>
nano ~/capybot/.env
```

Change these two lines:
```env
AI_SERVICE_URL=http://<A1_FLEX_PUBLIC_IP>:5005
AI_ENABLED_DEFAULT=true
```

2. Restart Capybot:
```bash
pm2 restart capybot
```

AI is now enabled — no reinstall or redeployment needed.

---

## Troubleshooting

### Bot unreachable at the IP address
```bash
pm2 status                             # Is Capybot running?
sudo ss -tlnp | grep 3000             # Is port 3000 listening?
sudo iptables -L INPUT -n | grep 3000 # Is iptables allowing port 3000?
# Also check OCI Console Security List has port 3000 open
```

### Out of Memory crash
```bash
free -h          # Check RAM and swap usage
swapon --show    # Verify swap is active
pm2 monit        # Live resource monitor
# If swap is missing: sudo swapon /swapfile
```

### Bot stopped after server reboot
```bash
pm2 status
# If not running:
pm2 start ecosystem.config.cjs
# Make sure you ran 'pm2 startup' and copied the generated command
```

---

## Expected Resource Usage (Instance 1 — No AI)

| Resource | Expected Usage |
|---|---|
| RAM | 300-450 MB |
| Swap used | 0-100 MB (safety net only) |
| CPU | Less than 5% idle, 10-20% during activity |
| Disk | ~500 MB for app and logs |
| Network | Less than 1 GB/month |

Well within the free tier limits.
