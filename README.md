<div align="center">
  <img src="build/icon.png" alt="Last SSH" width="120" />
</div>

# Last SSH

A modern Desktop application for managing SSH and SFTP servers, built with Electron, ReactJS, and Vite. The application allows you to easily manage connection information, security keys, synchronize data across devices, and utilize a stylish integrated Terminal.

## 🚀 Key Features

- **Smart Server Management**: Batch manage Servers (Hosts) by Group with a user-friendly and intuitive interface.
- **Device Data Synchronization (P2P)**: Securely synchronize configurations, server lists, and keys across multiple devices via a WebRTC peer-to-peer network, ensuring your data remains private without relying on a central server.
- **Ultra-Smooth Terminal**: Uses `xterm.js` to simulate a realistic command-line interface, supporting keyboard shortcuts and advanced color customization.
- **Security Key Management (Keychain)**: Supports creating, storing, and connecting securely using your own Private Keys.
- **File Transfer (SFTP Browser)**: Manage server directories with ease, providing seamless upload and download functionality for your files.
- **Dark/Light Theme**: Automatically adapt or manually set the theme to match your preferred working environment.

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite
- **UI/UX**: Vanilla HTML/CSS (Tailored HSL design)
- **Desktop Core**: Electron
- **SSH/Terminal**: `ssh2` (Node.js SSH connection), `xterm.js` (command-line interface)
- **Networking**: `peerjs` (WebRTC for data synchronization)

## 📦 Development Setup

Prerequisites: **Node.js** installed (version 24+ recommended).

1. Clone this repository to your machine.
2. Open the terminal and install the dependencies:
   ```bash
   npm install
   ```
3. Run the application in the Development environment (both React and Electron will start simultaneously):
   ```bash
   npm run dev:desktop
   ```
> Note: If port `5173` is in use, please run `lsof -ti:5173 | xargs kill -9` (on MacOS/Linux) to kill the stuck process before running again.

## 🔄 Device Data Synchronization (P2P Sync)

Last SSH supports **peer-to-peer data synchronization** between devices using WebRTC (via PeerJS). No cloud server involved — data is encrypted with AES-GCM before transmission.

**What gets synced:** SSH hosts, private keys, identities, settings, and virtual filesystem.

### How to Sync

**Requirements:** Both devices must be running Last SSH and connected to the internet.

**Step 1 — Open P2P Sync on BOTH devices**

Click the sync icon (🔄) in the top-right corner of the app. Wait 3–5 seconds for the connection to the signaling server. When you see **"Sẵn sàng ghép đôi"** and a QR code appears, the device is ready.

**Step 2 — Pair the two devices**

- **Device A** (sender): Copy the Peer ID shown on screen (format: `xxxx-xxxx-xxxx`)
- **Device B** (receiver): Paste that Peer ID into the **"Nhập mã ghép đôi"** field and click **"Ghép Đôi Thiết Bị"**

Both devices will show **"Đã kết nối P2P thành công!"** in green when paired.

**Step 3 — Transfer data**

- **Device A**: (Optional) set a numeric PIN for encryption, then click **"Gửi Dữ Liệu"**
- **Device B**: Enter the same PIN if Device A used one, then click **"Áp dụng dữ liệu đồng bộ"**

> **Quick test on one machine:** Open two Last SSH windows, use the Peer ID from window 1 and enter it in window 2.

> **Troubleshooting:** If the connection fails, check your internet connection and click **"Thử lại kết nối"**. Connections through strict corporate firewalls may need a VPN.

## 🔨 Build Instructions (Packaging the App)

The application supports cross-platform packaging thanks to the `electron-builder` library.

### Manual Local Build

1. First, build the static web interface:
   ```bash
   npm run build
   ```
2. Then, run the packaging command according to your operating system:
   - **MacOS**: `npm run build:mac`
   - **Windows**: `npx electron-builder --win`
   - **Linux**: `npx electron-builder --linux`

The packaged installation files (such as `.dmg`, `.exe`, `.AppImage`) will be saved in the `dist-electron` folder.
