import { useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useProvisioning } from "./_layout";
import { styles } from "./styles";

const { BlufiBridge } = NativeModules;

export default function ProvisioningTrackerPage() {
  const router = useRouter();
  const {
    ssid,
    password,
    mqttIp,
    mqttPort,
    provisionStatus,
    setProvisionStatus,
    isProvisioningDone,
    statusPings,
    reset,
  } = useProvisioning();

  const startProvisioning = useCallback(async () => {
    try {
      setProvisionStatus("1. Connecting to device...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setProvisionStatus("2. Sending WiFi & MQTT credentials...");
      // Request UID first to ensure it's captured
      await BlufiBridge.requestDeviceVersion();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await BlufiBridge.postCustomData("12:");
      await new Promise((resolve) => setTimeout(resolve, 500));

      await BlufiBridge.configureWifi(ssid, password);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await BlufiBridge.postCustomData(`1:${mqttIp}`);
      await BlufiBridge.postCustomData(`2:${mqttPort}`);
      await BlufiBridge.postCustomData("8:0");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setProvisionStatus("3. Waiting for device reboot...");
    } catch (error: any) {
      Alert.alert("Provisioning failed", error.message);
      router.back();
    }
  }, [ssid, password, mqttIp, mqttPort, router, setProvisionStatus]);

  useEffect(() => {
    startProvisioning();
  }, [startProvisioning]);

  useEffect(() => {
    if (isProvisioningDone) {
      router.push("/explore/done");
    }
  }, [isProvisioningDone, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Provisioning</Text>
        <TouchableOpacity
          onPress={() => {
            reset();
            router.replace("/explore");
          }}
          style={styles.resetButton}
        >
          <Text style={styles.resetButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stepContainerCenter}>
        <ActivityIndicator size="large" color="#1A73E8" />
        <Text style={styles.provisionMainTitle}>Provisioning Device...</Text>

        <View style={styles.statusTracker}>
          <Text
            style={[
              styles.statusLine,
              provisionStatus.startsWith("1") && styles.statusLineActive,
            ]}
          >
            {provisionStatus.startsWith("1") ? "●" : "○"} Connecting to
            device...
          </Text>
          <Text
            style={[
              styles.statusLine,
              provisionStatus.startsWith("2") && styles.statusLineActive,
            ]}
          >
            {provisionStatus.startsWith("2") ? "●" : "○"} Sending WiFi & MQTT
            credentials...
          </Text>
          <Text
            style={[
              styles.statusLine,
              provisionStatus.startsWith("3") && styles.statusLineActive,
            ]}
          >
            {provisionStatus.startsWith("3") ? "●" : "○"} Waiting for device
            reboot...
          </Text>
        </View>

        <Text style={styles.hintText}>Please stay close to the device</Text>

        <View style={styles.debugContainer}>
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>
              Debug Console ({statusPings.length} messages):
            </Text>
          </View>
          <ScrollView style={styles.debugList} nestedScrollEnabled>
            {statusPings.length === 0 ? (
              <Text style={styles.debugText}>⏳ Waiting for data...</Text>
            ) : (
              statusPings
                .slice()
                .reverse()
                .map((item, idx) => (
                  <Text key={idx} style={styles.debugText}>
                    {item}
                  </Text>
                ))
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
