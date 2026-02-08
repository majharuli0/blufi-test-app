# 📟 Blufi Test App

A modern, streamlined reference implementation for **Espressif Blufi (Wi-Fi Provisioning)** in React Native.

This application demonstrates a high-performance, multi-page provisioning flow using `expo-router` and a shared `ProvisioningContext`. It is built on top of the localized `blufi` kit included in this repository.

---

## ✨ Key Features

- 🎯 **Single-Purpose UI**: Streamlined interface focused entirely on the provisioning flow.
- 🔄 **Multi-Page Navigation**: Clean separation into Scan, Configure, Provision, and Success screens.
- 🍎 **Robust iOS Detection**: Fixed the "waiting for device reboot" hang using native `CBCentralManagerDelegate` listeners.
- 🤖 **Unified Logging**: Real-time debug console capturing native events from both iOS and Android in one view.
- 🆔 **UID Capture**: Automated 12-digit Device UID extraction via custom data polling.

---

## 🛠 Project Structure

- **/blufi**: The core **React Native Blufi Kit**. Contains the native bridges and SDK reference.
- **/app/(tabs)/explore**: The main provisioning flow implementation.
- **/components**: Shared UI components and icons.

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have the latest Expo CLI and native build tools (Xcode/Android Studio) installed.

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize Native Bridge

The Blufi bridge must be patched into the native project folders:

```bash
# Generate native folders (if not present)
npx expo prebuild

# Patch Blufi native code
npm run setup:ios
npm run setup:android

# Link iOS (Required)
cd ios && pod install && cd ..
```

### 4. Run the App

```bash
# iOS
npx expo run:ios --device

# Android
npx expo run:android
```

---

## 📚 Documentation

For detailed API reference and kit-specific instructions, see the [Blufi Kit README](./blufi/README.md).

---

_Maintained by majharuli0_
