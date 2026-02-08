import { useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { useProvisioning } from "./_layout";
import { styles } from "./styles";

export default function DonePage() {
  const router = useRouter();
  const { capturedUID, reset } = useProvisioning();

  const handleFinish = () => {
    reset();
    router.replace("/explore");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Provisioning</Text>
      </View>

      <View style={styles.stepContainerCenter}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Finished</Text>

        <View style={styles.uidDisplay}>
          <Text style={styles.uidLabel}>Device UID:</Text>
          <Text style={styles.uidValue}>{capturedUID || "Capturing..."}</Text>
        </View>

        <Text style={styles.doneDescription}>
          Configuration has been sent successfully. Your device is now rebooting
          to connect to your WiFi network.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleFinish}>
          <Text style={styles.primaryButtonText}>Finish & Close</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
