import { Stack } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";

const { BlufiBridge, BluetoothScannerModule } = NativeModules;
const blufiEmitter = BlufiBridge ? new NativeEventEmitter(BlufiBridge) : null;
const scannerEmitter = BluetoothScannerModule
  ? new NativeEventEmitter(BluetoothScannerModule)
  : null;

type ProvisioningContextType = {
  devices: any[];
  setDevices: React.Dispatch<React.SetStateAction<any[]>>;
  wifiNetworks: any[];
  setWifiNetworks: React.Dispatch<React.SetStateAction<any[]>>;
  ssid: string;
  setSsid: (s: string) => void;
  password: string;
  setPassword: (p: string) => void;
  mqttIp: string;
  setMqttIp: (ip: string) => void;
  mqttPort: string;
  setMqttPort: (p: string) => void;
  provisionStatus: string;
  setProvisionStatus: (s: string) => void;
  capturedUID: string;
  setCapturedUID: (uid: string) => void;
  isProvisioningDone: boolean;
  setIsProvisioningDone: (d: boolean) => void;
  statusPings: string[];
  setStatusPings: React.Dispatch<React.SetStateAction<string[]>>;
  reset: () => void;
};

const ProvisioningContext = createContext<ProvisioningContextType | undefined>(
  undefined,
);

export function ProvisioningProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [devices, setDevices] = useState<any[]>([]);
  const [wifiNetworks, setWifiNetworks] = useState<any[]>([]);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [mqttIp, setMqttIp] = useState("3.104.3.162");
  const [mqttPort, setMqttPort] = useState("443");
  const [provisionStatus, setProvisionStatus] = useState("");
  const [capturedUID, setCapturedUID] = useState("");
  const [isProvisioningDone, setIsProvisioningDone] = useState(false);
  const [statusPings, setStatusPings] = useState<string[]>([]);

  useEffect(() => {
    const listeners: any[] = [];

    if (scannerEmitter) {
      listeners.push(
        scannerEmitter.addListener("DeviceFound", (device) => {
          setDevices((prev) => {
            if (prev.find((d) => d.mac === device.mac)) return prev;
            return [...prev, device].sort((a, b) => b.rssi - a.rssi);
          });
        }),
      );
    }

    if (blufiEmitter) {
      listeners.push(
        blufiEmitter.addListener("BlufiDeviceScanResult", (event) => {
          if (event.data) {
            setWifiNetworks(event.data);
          }
        }),
      );

      const handleBlufiEvent = (event: any) => {
        const timestamp = new Date().toLocaleTimeString();
        // Capture message from any possible field (log, status, or data)
        const msg = event.log || event.status || event.data;

        if (msg && typeof msg === "string") {
          setStatusPings((prev) => [...prev, `[${timestamp}] ${msg}`]);

          // UID Extraction logic
          if (
            msg.includes("Version Response:") ||
            msg.includes("Device Version:") ||
            msg.includes("Received Custom Data: 12:")
          ) {
            let extracted = "";
            if (msg.includes("Received Custom Data: 12:")) {
              extracted = msg.split("Received Custom Data: 12:")[1].trim();
            } else {
              const versionMatch = msg.match(
                /(?:Version Response|Device Version):\s*(.+)/,
              );
              if (versionMatch) extracted = versionMatch[1].trim();
            }

            if (extracted && /^\d{10,}$/.test(extracted)) {
              setCapturedUID(extracted);
            }
          }

          // Termination logic
          if (msg.includes("Disconnected")) {
            setIsProvisioningDone(true);
          }
        }
      };

      listeners.push(blufiEmitter.addListener("BlufiLog", handleBlufiEvent));
      listeners.push(blufiEmitter.addListener("BlufiStatus", handleBlufiEvent));
      listeners.push(blufiEmitter.addListener("BlufiData", handleBlufiEvent));
    }

    return () => {
      listeners.forEach((l) => l.remove());
    };
  }, []);

  const reset = () => {
    if (BlufiBridge) BlufiBridge.disconnect();
    setDevices([]);
    setWifiNetworks([]);
    setSsid("");
    setPassword("");
    setCapturedUID("");
    setProvisionStatus("");
    setIsProvisioningDone(false);
    setStatusPings([]);
  };

  return (
    <ProvisioningContext.Provider
      value={{
        devices,
        setDevices,
        wifiNetworks,
        setWifiNetworks,
        ssid,
        setSsid,
        password,
        setPassword,
        mqttIp,
        setMqttIp,
        mqttPort,
        setMqttPort,
        provisionStatus,
        setProvisionStatus,
        capturedUID,
        setCapturedUID,
        isProvisioningDone,
        setIsProvisioningDone,
        statusPings,
        setStatusPings,
        reset,
      }}
    >
      {children}
    </ProvisioningContext.Provider>
  );
}

export const useProvisioning = () => {
  const context = useContext(ProvisioningContext);
  if (!context)
    throw new Error(
      "useProvisioning must be used within a ProvisioningProvider",
    );
  return context;
};

export default function ProvisioningLayout() {
  return (
    <ProvisioningProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ProvisioningProvider>
  );
}
