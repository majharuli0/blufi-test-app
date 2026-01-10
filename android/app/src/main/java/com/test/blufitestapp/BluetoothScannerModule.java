package com.test.blufitestapp;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashSet;
import java.util.Set;

public class BluetoothScannerModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothLeScanner;
    private Set<String> foundDevices = new HashSet<>();
    private boolean isScanning = false;
    private static final String TAG = "BluetoothScanner";

    public BluetoothScannerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    @Override
    public String getName() {
        return "BluetoothScannerModule";
    }

    private void sendLog(String message) {
        Log.d(TAG, message);
        WritableMap params = Arguments.createMap();
        params.putString("log", message);
        sendEvent("ScanLog", params);
    }

    @ReactMethod
    public void startScan() {
        if (bluetoothAdapter == null) {
            sendLog("BluetoothAdapter is null");
            sendError("BluetoothAdapter is null");
            return;
        }
        
        bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
        if (bluetoothLeScanner == null) {
             sendLog("BluetoothLeScanner is null");
             sendError("BluetoothLeScanner is null (Bluetooth might be off)");
             return;
        }

        if (isScanning) {
            sendLog("Already scanning");
            return;
        }

        foundDevices.clear();
        isScanning = true;
        
        // Use default settings to match reference app
        try {
            bluetoothLeScanner.startScan(scanCallback);
            sendLog("BLE Scan started (Default Settings)");
        } catch (SecurityException e) {
            sendLog("SecurityException during scan: " + e.getMessage());
            sendError("SecurityException: " + e.getMessage());
            isScanning = false;
        }
    }

    @ReactMethod
    public void stopScan() {
        if (bluetoothLeScanner != null && isScanning) {
            try {
                bluetoothLeScanner.stopScan(scanCallback);
                sendLog("BLE Scan stopped");
            } catch (SecurityException e) {
                sendLog("SecurityException during stop scan: " + e.getMessage());
            }
            isScanning = false;
        }
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            if (device != null) {
                String address = device.getAddress();
                if (!foundDevices.contains(address)) {
                    foundDevices.add(address);
                    
                    WritableMap params = Arguments.createMap();
                    try {
                        String name = device.getName();
                        params.putString("name", name != null ? name : "Unknown");
                        sendLog("Found: " + (name != null ? name : "Unknown") + " (" + address + ")");
                    } catch (SecurityException e) {
                        params.putString("name", "Unknown (Perm)");
                        sendLog("Found: " + address + " (Perm Error)");
                    }
                    params.putString("id", address);
                    params.putString("mac", address);
                    params.putInt("rssi", result.getRssi());
                    
                    sendEvent("DeviceFound", params);
                }
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            sendLog("Scan failed: " + errorCode);
            sendError("Scan failed with error code: " + errorCode);
        }
    };

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        } else {
            Log.e(TAG, "No active CatalystInstance, cannot send event: " + eventName);
        }
    }

    private void sendError(String errorMessage) {
        WritableMap params = Arguments.createMap();
        params.putString("error", errorMessage);
        sendEvent("ScanError", params);
    }
    
    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}
}
