import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { apiClient, DEFAULT_API_BASE } from '../api/client';
import { useUserStore } from '../store/useUserStore';

export const SettingsScreen: React.FC = () => {
  const { deviceId, incomeProfile } = useUserStore();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_BASE);

  const handleSaveApiUrl = () => {
    apiClient.setBaseUrl(apiUrl);
    Alert.alert('Backend URL Updated', `API requests will be directed to: ${apiUrl}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings & Privacy</Text>
        <Text style={styles.subtitle}>Manage your device connection and data controls</Text>

        {/* Device Session Info */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Device Session</Text>
          <Text style={styles.metaLabel}>Device Identifier:</Text>
          <Text style={styles.metaValue}>{deviceId}</Text>
          <Text style={styles.cardHint}>
            EmiSaver uses device-based tokens. No third-party social logins or email registrations are required.
          </Text>
        </Card>

        {/* Backend API Configuration */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Backend Server Connection</Text>
          <Input
            label="FastAPI Host URL"
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="http://10.0.2.2:8000"
            hint="For Android Emulator use 10.0.2.2:8000; for physical phone use your local IP."
          />
          <Button
            title="Save Connection URL"
            variant="outline"
            onPress={handleSaveApiUrl}
          />
        </Card>

        {/* Privacy Design Principles (§2 & §10) */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Privacy Posture</Text>
          <Text style={styles.privacyPoint}>
            • <Text style={styles.bold}>On-Device Filtering:</Text> All raw SMS text is evaluated on your phone first. Non-loan content (OTPs, personal chats, marketing) is discarded immediately.
          </Text>
          <Text style={styles.privacyPoint}>
            • <Text style={styles.bold}>Zero Bureau Access:</Text> No access to CIBIL, Experian, or lender backends.
          </Text>
          <Text style={styles.privacyPoint}>
            • <Text style={styles.bold}>Phase 1 MVP Scope:</Text> Uses backend NLP pipeline for high accuracy extraction as an interim MVP step, with on-device migration scheduled for subsequent phases.
          </Text>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.versionText}>EmiSaver Phase 1 • Build v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  cardHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  privacyPoint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginVertical: 4,
  },
  bold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  footer: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
