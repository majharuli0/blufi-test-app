import { useRouter } from "expo-router";
import React from "react";
import {
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useProvisioning } from "./_layout";
import { styles } from "./styles";

export default function ConfigurePage() {
  const router = useRouter();
  const {
    wifiNetworks,
    ssid,
    setSsid,
    password,
    setPassword,
    mqttIp,
    setMqttIp,
    mqttPort,
    setMqttPort,
    reset,
  } = useProvisioning();

  const handleNext = () => {
    router.push("/explore/provisioning");
  };

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

      <ScrollView
        style={styles.stepContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Page 2: Setup WiFi & MQTT</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select WiFi Network</Text>
          <View style={styles.wifiList}>
            {wifiNetworks.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.wifiItem,
                  ssid === item.ssid && styles.wifiItemActive,
                ]}
                onPress={() => setSsid(item.ssid)}
              >
                <Text
                  style={[
                    styles.wifiName,
                    ssid === item.ssid && styles.wifiNameActive,
                  ]}
                >
                  {item.ssid}
                </Text>
                <Text style={styles.wifiDetail}>{item.rssi} dBm</Text>
              </TouchableOpacity>
            ))}
            {wifiNetworks.length === 0 && (
              <Text style={styles.emptyWifiText}>
                No WiFi networks found yet...
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>WiFi SSID</Text>
          <TextInput
            style={styles.input}
            value={ssid}
            onChangeText={setSsid}
            placeholder="Enter SSID"
          />

          <Text style={styles.label}>WiFi Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter Password"
          />

          <View style={styles.row}>
            <View style={{ flex: 2, marginRight: 10 }}>
              <Text style={styles.label}>MQTT IP</Text>
              <TextInput
                style={styles.input}
                value={mqttIp}
                onChangeText={setMqttIp}
                placeholder="e.g. 192.168.1.1"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>MQTT Port</Text>
              <TextInput
                style={styles.input}
                value={mqttPort}
                onChangeText={setMqttPort}
                keyboardType="numeric"
                placeholder="443"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, (!ssid || !password) && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!ssid || !password}
        >
          <Text style={styles.buttonText}>Next: Provision</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
