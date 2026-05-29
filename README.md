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

Prerequisites: **Node.js** installed (version 20+ recommended).

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
