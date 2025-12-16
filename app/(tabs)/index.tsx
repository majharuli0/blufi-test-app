import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { BlufiBridge, BluetoothScannerModule } = NativeModules;
const blufiEmitter = BlufiBridge ? new NativeEventEmitter(BlufiBridge) : null;
const scannerEmitter = BluetoothScannerModule ? new NativeEventEmitter(BluetoothScannerModule) : null;

// --- Types ---
type WizardStep = 'SCAN' | 'WIFI' | 'PROVISION';

interface BlufiDevice {
  name: string;
  mac: string;
  rssi: number;
}

interface WifiNetwork {
  ssid: string;
  rssi: number;
}

interface LogEntry {
  id: string;
  msg: string;
  type: 'info' | 'error' | 'success';
}

// --- Constants ---
const THEME = {
  primary: '#007AFF',
  success: '#34C759',
  error: '#FF3B30',
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  border: '#C6C6C8',
};

export default function ProvisioningWizard() {
  // --- State ---
  const [step, setStep] = useState<WizardStep>('SCAN');

  // Scan Step
  const [devices, setDevices] = useState<BlufiDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [filterUid, setFilterUid] = useState('');

  // Wifi Step
  const [selectedDevice, setSelectedDevice] = useState<BlufiDevice | null>(null);
  const [ssid, setSsid] = useState('TP-Link_AD75');
  const [password, setPassword] = useState('82750152');
  const [mqttIp, setMqttIp] = useState('3.104.3.162');
  const [mqttPort, setMqttPort] = useState('1060');

  // Wifi Scan (New)
  const [wifiList, setWifiList] = useState<WifiNetwork[]>([]);
  const [isWifiScanning, setIsWifiScanning] = useState(false);
  const [showWifiList, setShowWifiList] = useState(false);

  // Provision Step
  const [provisionState, setProvisionState] = useState<'IDLE' | 'CONNECTING' | 'NEGOTIATING' | 'CONFIGURING' | 'WAITING' | 'DONE' | 'ERROR'>('IDLE');
  // State
  const [connectedMac, setConnectedMac] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // --- Helpers ---
  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{ id: Date.now().toString() + Math.random(), msg, type }, ...prev]);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper to wait for a specific log message (Status or Log)
  const waitForStatus = (statusKeyword: string, timeoutMs: number = 10000): Promise<boolean> => {
    return new Promise((resolve) => {
      let resolved = false;
      let listeners: any[] = [];

      const cleanup = () => {
        resolved = true;
        listeners.forEach(l => l.remove());
        clearTimeout(timer);
      };

      const timer = setTimeout(() => {
        if (!resolved) {
          cleanup();
          resolve(false); // Timed out
        }
      }, timeoutMs);

      const checkMsg = (msg: string) => {
        if (!resolved && msg && msg.includes(statusKeyword)) {
          cleanup();
          resolve(true); // Found it!
        }
      };

      if (blufiEmitter) {
        // Listen to BOTH Status and Log
        listeners.push(blufiEmitter.addListener("BlufiStatus", (e: any) => checkMsg(e.status)));
        listeners.push(blufiEmitter.addListener("BlufiLog", (e: any) => checkMsg(e.log)));
      } else {
        resolve(true); // Fallback
      }
    });
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
      } catch (err) {
        console.warn(err);
      }
    }
    startScan();
  };

  // ... (Scan Logic)



  useEffect(() => {
    requestPermissions();

    const listeners: any[] = [];

    if (blufiEmitter) {
      listeners.push(blufiEmitter.addListener("BlufiLog", (e: any) => addLog(e.log)));
      listeners.push(blufiEmitter.addListener("BlufiStatus", (e: any) => {
        // Optional: Handle detailed status changes here if needed
      }));
    }

    if (scannerEmitter) {
      listeners.push(scannerEmitter.addListener("DeviceFound", (device: BlufiDevice) => {
        setDevices(prev => {
          if (prev.find(d => d.mac === device.mac)) return prev;
          return [...prev, device].sort((a, b) => b.rssi - a.rssi);
        });
      }));
      listeners.push(scannerEmitter.addListener("ScanError", (e: any) => {
        console.error("Scan Error", e);
        setIsScanning(false);
      }));
    }

    return () => {
      listeners.forEach(l => l.remove());
      if (BluetoothScannerModule) BluetoothScannerModule.stopScan();
      if (BlufiBridge) BlufiBridge.disconnect();
    };
  }, []);



  // --- Actions: Scan ---
  const startScan = () => {
    if (BluetoothScannerModule) {
      setIsScanning(true);
      setDevices([]);
      BluetoothScannerModule.startScan();
    }
  };

  const handleSelectDevice = async (device: BlufiDevice) => {
    if (BluetoothScannerModule) BluetoothScannerModule.stopScan();
    setIsScanning(false);
    setSelectedDevice(device);
    setStep('WIFI');
  };

  // --- Actions: Wi-Fi Scan ---
  const scanForWifi = async () => {
    if (isWifiScanning) return;
    if (!BlufiBridge) {
      Alert.alert("Error", "BlufiBridge module not available.");
      return;
    }
    setIsWifiScanning(true);
    setWifiList([]);
    try {
      if (!selectedDevice) {
        Alert.alert("Error", "No device selected for scanning.");
        setIsWifiScanning(false);
        return;
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "This app needs location access to scan for Wi-Fi networks.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          addLog("Location permission denied. Wi-Fi scan may fail.", 'error');
        }
      }

      addLog("Connecting to device for Wi-Fi scan...");

      // 1. Connect first because scanning requires an active Blufi connection
      const connectionPromise = waitForStatus("Connected", 10000);
      await BlufiBridge.connect(selectedDevice.mac);
      const connected = await connectionPromise;

      if (!connected) {
        throw new Error("Could not connect to device.");
      }
      setConnectedMac(selectedDevice.mac); // Track active connection

      // 2. Security Negotiation (Requested by User)
      addLog("Negotiating Security...");
      try {
        await BlufiBridge.negotiateSecurity();
        await waitForStatus("Security Result: 0", 10000); // Increased timeout to 10s
        addLog("Security Negotiated!", 'success');
      } catch (secError) {
        addLog("Security Negotiation timed out or failed. Proceeding anyway...", 'info');
        // We proceed because some devices might not require security or it might have already happened.
      }

      // Ensure Device is in Station Mode (1) for Scanning
      addLog("Setting OpMode to Station (1)...");
      await BlufiBridge.setOpMode(1);
      await sleep(500); // Short delay

      // 3. DIAGNOSTIC: Request Device Version to confirm communication works
      addLog("Checking Protocol Version...");
      // @ts-ignore
      await BlufiBridge.requestDeviceVersion();
      // We don't strictly wait for this to block, but it usually returns fast.
      // If we see "Device Version" in logs, we know comms are good.

      addLog("Requesting Device to Scan for Wi-Fi...");

      // Wrap the event listener in a Promise with a timeout
      const scanPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Scan timed out (15s) - No results received."));
        }, 15000);

        // 1. Listen for "Legacy" event (if native code wasn't rebuilt)
        const subLegacy = blufiEmitter?.addListener("BlufiDeviceScanResult", (event: any) => {
          console.log("Got BlufiDeviceScanResult:", event);
          if (event.data) {
            handleResults(event.data);
          }
        });

        // 2. Listen for "New" event (BlufiStatus) - Handle Logs and Results
        const subStatus = blufiEmitter?.addListener("BlufiStatus", (event: any) => {
          console.log("Got BlufiStatus:", event);

          // Show Native Loops in UI
          if (event.type === 'Log' && event.data) {
            addLog(`[Native] ${event.data}`, 'info');
          }

          // Handle Scan Results
          if (event.type === 'DeviceScan' && event.data) {
            handleResults(event.data);
          }

          // Handle Error Status
          if (event.status && typeof event.status === 'string' && event.status.startsWith('Error')) {
            addLog(`[Native Error] ${event.status}`, 'error');
          }
        });

        const handleResults = (networks: any[]) => {
          cleanup();
          console.log("Wi-Fi Networks Found:", networks.length);

          // Deduplicate and Sort
          const unique = new Map();
          networks.forEach((n: any) => {
            if (n.ssid && !unique.has(n.ssid)) unique.set(n.ssid, n);
          });
          const sorted = Array.from(unique.values()).sort((a: any, b: any) => b.rssi - a.rssi);

          setWifiList(sorted);
          setShowWifiList(true);
          resolve();
        };

        const cleanup = () => {
          clearTimeout(timeout);
          subLegacy?.remove();
          subStatus?.remove();
        };
      });

      await BlufiBridge.requestDeviceWifiScan();

      await scanPromise;
      setIsWifiScanning(false);

      // Revert Connection Strategy: Disconnect after Scan
      addLog("Scan complete. Disconnecting...", 'info');
      if (BlufiBridge) BlufiBridge.disconnect();
      setConnectedMac(null);

    } catch (e: any) {
      setIsWifiScanning(false);
      addLog("Error requesting Wi-Fi scan: " + e.message, 'error');
      Alert.alert("Scan Failed", e.message);
    }
  };

  const selectWifi = (network: WifiNetwork) => {
    setSsid(network.ssid);
    setShowWifiList(false);
  };


  // --- Actions: Provisioning ---


  const startProvisioning = async () => {
    if (!selectedDevice || !BlufiBridge) return;
    setStep('PROVISION');
    setProvisionState('CONNECTING');
    setLogs([]);

    try {
      // 1. Connect (Always Fresh)
      addLog(`Connecting to ${selectedDevice.name}...`);
      const connectionPromise = waitForStatus("Connected", 15000);
      await BlufiBridge.connect(selectedDevice.mac);
      setConnectedMac(selectedDevice.mac);
      addLog("Waiting for Stable Connection...");
      const connected = await connectionPromise;
      if (!connected) throw new Error("Connection Timeout");
      addLog("Stable Connection Confirmed!", 'success');

      await sleep(1000);

      // 2. Negotiate Security (Required)
      addLog("Negotiating Security...");
      try {
        await BlufiBridge.negotiateSecurity();
        await waitForStatus("Security Result: 0", 10000);
        addLog("Security Negotiated!", 'success');
        await sleep(1000);
      } catch (secError) {
        addLog("Security negotiation skipped or failed. Proceeding...", 'info');
      } // 3. Configure Wi-Fi
      setProvisionState('CONFIGURING');

      const configureWifi = async () => {
        addLog(`Configuring Wi-Fi: ${ssid}`);
        await BlufiBridge.configureWifi(ssid, password);
        addLog("Wi-Fi Config Sent", 'success');

        addLog("Waiting 3s for device to connect...", 'info');
        await sleep(3000);

        addLog("Checking Device Status...");
        await BlufiBridge.postCustomData("12:"); // Trigger status report
        await BlufiBridge.requestDeviceStatus(); // Fetch status

        await sleep(1000);
      };

      await configureWifi();

      // 4. Configure MQTT
      if (mqttIp && mqttPort) {
        const configureMqtt = async () => {
          addLog(`Sending MQTT Config: ${mqttIp}:${mqttPort}`);

          await BlufiBridge.postCustomData(`1:${mqttIp}`);
          await BlufiBridge.postCustomData(`2:${mqttPort}`);
          await BlufiBridge.postCustomData("8:0");

          addLog("MQTT Config Sent & Finalized!", 'success');
          await sleep(2000);
        };
        await configureMqtt();
      }

      addLog("All Config Sent!", 'success');

      // 4. Wait for Result
      setProvisionState('WAITING');
      addLog("Waiting for device to connect to Wi-Fi (30s)...");

      checkStatusLoop();

    } catch (error: any) {
      handleProvisionFailure(error.message || "Unknown error");
    }
  };

  const handleProvisionFailure = (errorMsg: string) => {
    setProvisionState('ERROR');
    addLog(`Error: ${errorMsg}`, 'error');
    addLog("Disconnecting...", 'info');
    if (BlufiBridge) BlufiBridge.disconnect();
  };

  const checkStatusLoop = async () => {
    let elapsed = 0;
    const timeout = 30000;
    const intervalTime = 2000;

    const statusParams: any[] = [];
    if (blufiEmitter) {
      const sub = blufiEmitter.addListener("BlufiStatus", (event: any) => {
        const msg = event.status || "";
        if (
          msg.includes("Connected to Wi-Fi") ||
          msg.includes("State: 0") ||
          msg.includes("Disconnected")
        ) {
          clearInterval(interval);
          setProvisionState('DONE');
          addLog("✅ Device Provisioned / Rebooting!", 'success');
          BlufiBridge.disconnect();
        }
      });
      statusParams.push(sub);
    }

    const interval = setInterval(async () => {
      elapsed += intervalTime;
      addLog(`Checking status (${elapsed / 1000}s)...`);

      if (elapsed >= timeout) {
        clearInterval(interval);
        statusParams.forEach(s => s.remove());
        if (provisionState !== 'DONE') {
          handleProvisionFailure("Timeout: Device did not confirm connection in 30s.");
        }
        return;
      }

      try {
        await BlufiBridge.postCustomData("12:");
        await BlufiBridge.requestDeviceStatus();
      } catch (e) { }
    }, intervalTime);
  };

  const resetFlow = () => {
    if (BlufiBridge) BlufiBridge.disconnect();
    setStep('SCAN');
    setProvisionState('IDLE');
    setSelectedDevice(null);
    startScan();
  };

  // --- Renderers ---

  const renderHeader = (title: string, subtitle: string) => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderScanStep = () => {
    const filtered = devices.filter(d =>
      filterUid ? (d.name.includes(filterUid) || d.mac.includes(filterUid)) : true
    );

    return (
      <View style={styles.stepContainer}>
        {renderHeader("Select Device", "Scan the device UID or select from list.")}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Filter by UID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter UID or Mac..."
            value={filterUid}
            onChangeText={setFilterUid}
          />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Nearby Devices ({filtered.length})</Text>
          <TouchableOpacity onPress={startScan} disabled={isScanning}>
            {isScanning ? <ActivityIndicator size="small" color={THEME.primary} /> : <Text style={styles.linkText}>Refresh</Text>}
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.mac}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.deviceCard} onPress={() => handleSelectDevice(item)}>
              <View>
                <Text style={styles.deviceName}>{item.name || "Unknown Device"}</Text>
                <Text style={styles.deviceMac}>{item.mac}</Text>
              </View>
              <Text style={styles.deviceRssi}>{item.rssi} dBm</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No devices found. Ensure Bluetooth is on.</Text>}
        />
      </View>
    );
  };

  const renderWifiStep = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.stepContainer}>
      <TouchableOpacity onPress={() => setStep('SCAN')} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {renderHeader("Configure Wi-Fi", `Connect ${selectedDevice?.name} to your network.`)}

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.label}>Wi-Fi SSID</Text>
            <TouchableOpacity onPress={scanForWifi} disabled={isWifiScanning}>
              {isWifiScanning ? <ActivityIndicator size="small" color={THEME.primary} /> : <Text style={styles.linkText}>Scan Networks</Text>}
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Network Name"
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Network Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>MQTT Server (Optional)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 2, marginRight: 10 }]}
              placeholder="IP Address"
              value={mqttIp}
              onChangeText={setMqttIp}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Port"
              value={mqttPort}
              onChangeText={setMqttPort}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={startProvisioning}>
          <Text style={styles.primaryButtonText}>Provision Device</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>Logs</Text>
      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        style={[styles.logs, { maxHeight: 150 }]}
        renderItem={({ item }) => (
          <Text style={[
            styles.logText,
            item.type === 'error' && styles.logError,
            item.type === 'success' && styles.logSuccess
          ]}>
            {item.msg}
          </Text>
        )}
      />

      {/* Wi-Fi List Modal */}
      <Modal visible={showWifiList} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Network</Text>
              <TouchableOpacity onPress={() => setShowWifiList(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={wifiList}
              keyExtractor={(item, index) => item.ssid + index}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.wifiItem} onPress={() => selectWifi(item)}>
                  <Text style={styles.wifiSsid}>{item.ssid}</Text>
                  <Text style={styles.wifiRssi}>{item.rssi} dBm</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No networks found.</Text>}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );

  const renderProvisionStep = () => (
    <View style={styles.stepContainer}>
      {renderHeader("Provisioning", provisionState === 'DONE' ? "Process Complete" : "Please wait...")}

      <View style={styles.progressCard}>
        <View style={styles.statusIndicator}>
          {provisionState === 'ERROR' ? (
            <Text style={[styles.statusTitle, { color: THEME.error }]}>Failed</Text>
          ) : provisionState === 'DONE' ? (
            <Text style={[styles.statusTitle, { color: THEME.success }]}>Success!</Text>
          ) : (
            <>
              <ActivityIndicator size="large" color={THEME.primary} />
              <Text style={styles.statusTitle}>{provisionState}...</Text>
            </>
          )}
        </View>

        <Text style={styles.label}>Logs</Text>
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          style={styles.logs}
          renderItem={({ item }) => (
            <Text style={[
              styles.logText,
              item.type === 'error' && styles.logError,
              item.type === 'success' && styles.logSuccess
            ]}>
              {item.msg}
            </Text>
          )}
        />

        {(provisionState === 'DONE' || provisionState === 'ERROR') && (
          <TouchableOpacity style={styles.secondaryButton} onPress={resetFlow}>
            <Text style={styles.secondaryButtonText}>Done / Start Over</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {step === 'SCAN' && renderScanStep()}
      {step === 'WIFI' && renderWifiStep()}
      {step === 'PROVISION' && renderProvisionStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: THEME.textSecondary,
  },
  // Form & Inputs
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: THEME.card,
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    color: THEME.text,
  },
  inputContainer: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  divider: {
    height: 1,
    backgroundColor: THEME.border,
    marginVertical: 20,
  },
  // Buttons
  primaryButton: {
    backgroundColor: THEME.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: THEME.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 10,
  },
  backText: {
    color: THEME.primary,
    fontSize: 16,
  },
  linkText: {
    color: THEME.primary,
    fontWeight: '600',
  },
  // List
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text,
  },
  deviceCard: {
    backgroundColor: THEME.card,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
  },
  deviceMac: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  deviceRssi: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: THEME.textSecondary,
    marginTop: 30,
  },
  // Provisioning Status
  progressCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 20,
    flex: 1,
  },
  statusIndicator: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    marginTop: 15,
    fontSize: 20,
    fontWeight: '600',
    color: THEME.text,
  },
  logs: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 10,
  },
  logText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
    color: '#333',
  },
  logError: {
    color: THEME.error,
  },
  logSuccess: {
    color: THEME.success,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeText: {
    color: THEME.primary,
    fontSize: 16,
  },
  wifiItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wifiSsid: {
    fontSize: 16,
    fontWeight: '500',
  },
  wifiRssi: {
    color: THEME.textSecondary,
  }
});