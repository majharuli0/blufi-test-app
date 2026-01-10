package com.test.blufitestapp;

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.List;

import blufi.espressif.BlufiCallback;
import blufi.espressif.BlufiClient;
import blufi.espressif.params.BlufiConfigureParams;
import blufi.espressif.params.BlufiParameter;
import blufi.espressif.response.BlufiScanResult;
import blufi.espressif.response.BlufiStatusResponse;
import blufi.espressif.response.BlufiVersionResponse;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.BroadcastReceiver;
import android.net.wifi.WifiManager;
import android.net.wifi.ScanResult;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothProfile;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BlufiModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private BlufiClient blufiClient;
    private String currentDeviceId;
    private static final String TAG = "BlufiModule";

    public BlufiModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "BlufiBridge";
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    private void sendStatus(String status) {
        WritableMap params = Arguments.createMap();
        params.putString("status", status);
        sendEvent("BlufiStatus", params);
    }

    private void sendLog(String message) {
        Log.d(TAG, message);
        WritableMap params = Arguments.createMap();
        params.putString("log", message);
        sendEvent("BlufiLog", params);
    }

    @ReactMethod
    public void connect(String deviceId, Promise promise) {
        if (blufiClient != null) {
            blufiClient.close();
            blufiClient = null;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
             promise.reject("ERR_NO_BT", "Bluetooth not supported");
             return;
        }

        BluetoothDevice device = adapter.getRemoteDevice(deviceId);

        if (device == null) {
            promise.reject("ERR_DEVICE_NOT_FOUND", "Device not found");
            return;
        }

        currentDeviceId = deviceId;
        blufiClient = new BlufiClient(reactContext, device);
        blufiClient.setBlufiCallback(new BlufiCallbackMain());
        blufiClient.setGattCallback(new GattCallbackMain()); 
        blufiClient.connect();

        promise.resolve(true);
    }

    @ReactMethod
    public void disconnect() {
        if (blufiClient != null) {
            blufiClient.close();
            blufiClient = null;
        }
    }

    @ReactMethod
    public void negotiateSecurity(Promise promise) {
        if (blufiClient == null) {
            promise.reject("ERR_NO_CLIENT", "Blufi client not initialized");
            return;
        }
        blufiClient.negotiateSecurity();
        promise.resolve(true);
    }
    
    @ReactMethod
    public void setOpMode(int opMode, Promise promise) {
        if (blufiClient == null) {
             promise.reject("ERR_NO_CLIENT", "Blufi client not initialized");
             return;
        }
        BlufiConfigureParams params = new BlufiConfigureParams();
        params.setOpMode(opMode);
        blufiClient.configure(params);
        promise.resolve(true);
    }

    @ReactMethod
    public void configureWifi(String ssid, String password, Promise promise) {
        if (blufiClient == null) {
            promise.reject("ERR_NO_CLIENT", "Blufi client not initialized");
            return;
        }

        BlufiConfigureParams params = new BlufiConfigureParams();
        params.setOpMode(BlufiParameter.OP_MODE_STA);
        params.setStaSSIDBytes(ssid != null ? ssid.getBytes() : new byte[0]);
        params.setStaPassword(password);

        blufiClient.configure(params);
        promise.resolve(true);
    }

    @ReactMethod
    public void postCustomData(String data, Promise promise) {
        if (blufiClient == null) {
            promise.reject("ERR_NO_CLIENT", "Blufi client not initialized");
            return;
        }
        blufiClient.postCustomData(data.getBytes());
        promise.resolve(true);
    }

    @ReactMethod
    public void requestDeviceStatus() {
        if (blufiClient != null) {
            blufiClient.requestDeviceStatus();
        }
    }

    @ReactMethod
    public void requestDeviceVersion() {
        if (blufiClient != null) {
            blufiClient.requestDeviceVersion();
        }
    }

    @ReactMethod
    public void requestDeviceWifiScan(Promise promise) {
        // Fallback or explicit request for Device Scan
        if (blufiClient != null) {
             blufiClient.requestDeviceWifiScan();
        }
        // ALSO triggering Phone Scan as backup/primary if requested
        scanPhoneWifi(); 
        promise.resolve(true);
    }
    
    // New Method: Phone-Side Sanning
    private void scanPhoneWifi() {
        Log.d(TAG, "Starting Phone-Side Wi-Fi Scan...");
        WifiManager wifiManager = (WifiManager) reactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifiManager != null) {
             if (!wifiManager.isWifiEnabled()) {
                 wifiManager.setWifiEnabled(true);
             }
             
             BroadcastReceiver wifiScanReceiver = new BroadcastReceiver() {
                  @Override
                  public void onReceive(Context c, Intent intent) {
                      boolean success = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false);
                      if (success) {
                          scanSuccess(wifiManager);
                      } else {
                          scanFailure(wifiManager);
                      }
                      try {
                        reactContext.unregisterReceiver(this);
                      } catch(Exception e) {}
                  }
             };
             
             IntentFilter intentFilter = new IntentFilter();
             intentFilter.addAction(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION);
             reactContext.registerReceiver(wifiScanReceiver, intentFilter);
             
             boolean started = wifiManager.startScan();
             if (!started) {
                 scanFailure(wifiManager);
             }
        } else {
            sendLog("WifiManager not available");
        }
    }
    
    private void scanSuccess(WifiManager wifiManager) {
        List<ScanResult> results = wifiManager.getScanResults();
        WritableMap params = Arguments.createMap();
        WritableArray data = Arguments.createArray();
        
        for (ScanResult result : results) {
            if (result.SSID != null && !result.SSID.isEmpty()) {
                WritableMap wifi = Arguments.createMap();
                wifi.putString("ssid", result.SSID);
                wifi.putInt("rssi", result.level);
                data.pushMap(wifi);
            }
        }
        
        params.putArray("data", data);
        sendEvent("BlufiDeviceScanResult", params); // Reuse same event name for frontend compatibility
        sendLog("Phone Scan: Found " + results.size() + " networks");
    }
    
    private void scanFailure(WifiManager wifiManager) {
        // Still try to get old results
        scanSuccess(wifiManager);
    }

    private class GattCallbackMain extends BluetoothGattCallback {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            String stateStr = (newState == BluetoothProfile.STATE_CONNECTED) ? "Connected" :
                              (newState == BluetoothProfile.STATE_DISCONNECTED) ? "Disconnected" : "Unknown";

            sendLog("Gatt Connection State: " + stateStr + " (" + newState + "), Status: " + status);  

            if (newState == BluetoothProfile.STATE_CONNECTED) {
                new Handler(Looper.getMainLooper()).post(() ->
                    Toast.makeText(reactContext, "Blufi Connected!", Toast.LENGTH_SHORT).show()        
                );
                sendStatus("Connected");
                
                WritableMap params = Arguments.createMap();
                params.putInt("state", 2);
                params.putInt("status", 0);
                sendEvent("BlufiStatus", params);
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                sendStatus("Disconnected");

                WritableMap params = Arguments.createMap();
                params.putInt("state", 0);
                params.putInt("status", 0);
                sendEvent("BlufiStatus", params);
            }
        }
        
        @Override
        public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
            super.onMtuChanged(gatt, mtu, status);
            if (status == BluetoothGatt.GATT_SUCCESS) {
                sendLog("MTU Changed to: " + mtu);
            } else {
                sendLog("MTU Change Failed, Status: " + status);
            }
        }
    }

    private class BlufiCallbackMain extends BlufiCallback {

        public void onGattPrepared(BlufiClient client, BluetoothGatt gatt, BluetoothGattService service, BluetoothGattCharacteristic writeChar, BluetoothGattCharacteristic notifyChar) {
            sendLog("Gatt Prepared (Service Discovered). Requesting MTU 512...");
            if (gatt != null) {
                gatt.requestMtu(512);
            }
        }

        @Override
        public void onNegotiateSecurityResult(BlufiClient client, int status) {
            sendStatus("Security Result: " + status);
            sendLog("Security Negotiation Result: " + status);
        }

        @Override
        public void onPostConfigureParams(BlufiClient client, int status) {
            sendStatus("Configure Params: " + status);
            sendLog("Post Configure Params Result: " + status);
        }

        @Override
        public void onDeviceStatusResponse(BlufiClient client, int status, BlufiStatusResponse response) {
            sendStatus("Device Status: " + status);
            if (response != null) {
                sendLog("Status Response: " + response.toString());

                WritableMap params = Arguments.createMap();
                params.putString("status", "Device Status");
                params.putInt("opMode", response.getOpMode());
                params.putInt("staConnectionStatus", response.getStaConnectionStatus());
                sendEvent("BlufiStatus", params);
            }
        }

        @Override
        public void onDeviceVersionResponse(BlufiClient client, int status, BlufiVersionResponse response) {
            sendStatus("Device Version: " + status);
            if (response != null) {
                sendLog("Version Response: " + response.getVersionString());
            }
        }

        @Override
        public void onReceiveCustomData(BlufiClient client, int status, byte[] data) {
            if (data != null) {
                String dataStr = new String(data);
                sendLog("Received Custom Data: " + dataStr);
                WritableMap params = Arguments.createMap();
                params.putString("data", dataStr);
                sendEvent("BlufiData", params);
            }
        }

        @Override
        public void onPostCustomDataResult(BlufiClient client, int status, byte[] data) {
             sendLog("Post Custom Data Result: " + status);
        }

        @Override
        public void onError(BlufiClient client, int errCode) {
            if (errCode == 0) {
                 sendStatus("Error: " + errCode + " (Possible Success/No-Op)");
                 sendLog("Blufi Error Code 0 received (No-Op).");
            } else {
                sendStatus("Error: " + errCode);
                sendLog("Blufi Error Code: " + errCode);
            }
        }

        @Override
        public void onDeviceScanResult(BlufiClient client, int status, List<BlufiScanResult> results) {
            sendStatus("Device Scan Result: " + status);
            if (status == 0 && results != null) {
                WritableMap params = Arguments.createMap();
                WritableArray data = Arguments.createArray();
                
                for (BlufiScanResult result : results) {
                    WritableMap wifi = Arguments.createMap();
                    wifi.putString("ssid", result.getSsid());
                    wifi.putInt("rssi", result.getRssi());
                    data.pushMap(wifi);
                }
                
                params.putArray("data", data);
                sendEvent("BlufiDeviceScanResult", params); // This complements Phone Scan
                sendLog("Device Scan: Found " + results.size() + " Wi-Fi networks");
            } else {
                sendLog("Device Scan Failed with status: " + status);
            }
        }
    }

    @ReactMethod
    public void addListener(String eventName) { }

    @ReactMethod
    public void removeListeners(Integer count) { }
}
