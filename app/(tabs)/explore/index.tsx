import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  NativeModules,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useProvisioning } from "./_layout";
import { styles } from "./styles";

const { BlufiBridge, BluetoothScannerModule } = NativeModules;

export default function DeviceScanPage() {
  const router = useRouter();
  const { devices, setDevices } = useProvisioning();
  const [loading, setLoading] = useState(false);

  const startScan = () => {
    setDevices([]);
    setLoading(true);
    if (BluetoothScannerModule) {
      BluetoothScannerModule.startScan();
      setTimeout(() => setLoading(false), 5000);
    }
  };

  const selectDevice = async (device: any) => {
    setLoading(true);
    try {
      await BlufiBridge.connect(device.mac || device.id);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Auto-request WiFi scan for the next page
      await BlufiBridge.requestDeviceWifiScan();

      router.push("/explore/configure");
    } catch (error: any) {
      Alert.alert("Connection Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Provisioning</Text>
      </View>

      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Page 1: Select Your Device</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={startScan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Scan for Devices</Text>
          )}
        </TouchableOpacity>

        <FlatList
          data={devices}
          keyExtractor={(item) => item.mac || item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => selectDevice(item)}
            >
              <View>
                <Text style={styles.itemName}>{item.name || "Unknown"}</Text>
                <Text style={styles.itemMac}>{item.mac}</Text>
              </View>
              <Text style={styles.itemDetail}>{item.rssi} dBm</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No devices detected</Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}
