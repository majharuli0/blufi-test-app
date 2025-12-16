# Blufi Integration Kit for React Native

This kit contains everything you need to add Espressif Blufi (Wi-Fi Provisioning) support to your React Native app (iOS & Android).

## 📦 Contents
*   `ios-reference/`: Native iOS source files (Swift/Obj-C) and Podspec.
*   `scripts/`: Automation scripts for setting up Android and iOS.
*   `BlufiClient.ts`: A ready-to-use TypeScript client for managing the connection.

## 🚀 Installation Guide

### 1. Copy Files
Copy the contents of this folder (`ios-reference`, `scripts`, `BlufiClient.ts`) into the **root** of your React Native project.

```bash
cp -r blufi-kit/* /path/to/your/project/
```

### 2. Install Dependencies
Ensure you have the required packages installed:
```bash
npm install react-native-permissions
```

### 3. Configure `package.json`
Add the setup scripts to your `package.json` under the `"scripts"` section:

```json
"scripts": {
  "setup:ios": "node scripts/setup-ios.js",
  "setup:android": "node scripts/setup-android.js"
}
```

### 4. Run Setup
Run the setup commands to generate the native code and configuration.

**For iOS:**
```bash
# 1. Generate iOS project (if not already done)
npx expo prebuild --platform ios

# 2. Run the setup script
npm run setup:ios

# 3. Install Pods
cd ios && pod install && cd ..
```

**For Android:**
```bash
# 1. Generate Android project (if not already done)
npx expo prebuild --platform android

# 2. Run the setup script
npm run setup:android
```

### 5. Usage
Import `BlufiClient` in your code and use it to connect and provision devices.

```typescript
import { BlufiClient } from './BlufiClient';

// Initialize
const blufi = BlufiClient.getInstance();

// Scan
blufi.startScan((device) => {
  console.log('Found:', device.name);
});

// Connect & Provision
await blufi.connect(deviceMac);
await blufi.negotiateSecurity();
await blufi.configureWifi('SSID', 'PASSWORD');
```

## 🛠 Troubleshooting

*   **iOS Build Error (Developer Mode)**: Go to Settings > Privacy & Security > Developer Mode on your iPhone and enable it.
*   **iOS Runtime Error (Module not found)**: Ensure you ran `pod install` inside `ios/` after running `npm run setup:ios`.
*   **Android Build Error**: Ensure `npx expo prebuild` was run to create the `android` folder before running `setup:android`.
