import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  SafeAreaView,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { useUserStore } from '../store/useUserStore';

interface WelcomeScreenProps {
  navigation: any;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const [hasConsented, setHasConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const { initSession, setConsent } = useUserStore();

  const handleGetStarted = async () => {
    if (!hasConsented) return;
    setLoading(true);
    try {
      setConsent(true);
      await initSession();
      navigation.navigate('Onboarding');
    } catch (err) {
      console.error(err);
      // Fallback navigation for offline demo
      navigation.navigate('Onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>
          <Text style={styles.title}>EmiSaver</Text>
          <Text style={styles.subtitle}>
            Personal Loan Inbox & On-Device EMI Aggregator
          </Text>
        </View>

        <Card style={styles.privacyCard}>
          <Text style={styles.privacyHeader}>Privacy-Preserving Design</Text>
          
          <View style={styles.bulletItem}>
            <Text style={styles.bulletIcon}>✓</Text>
            <View style={styles.bulletContent}>
              <Text style={styles.bulletTitle}>On-Device Pre-Filtering</Text>
              <Text style={styles.bulletText}>
                Your OTPs, private chats, and shopping messages are discarded on-device. Only loan-related keywords ever get evaluated.
              </Text>
            </View>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletIcon}>✓</Text>
            <View style={styles.bulletContent}>
              <Text style={styles.bulletTitle}>No Bureau or Lender Logins</Text>
              <Text style={styles.bulletText}>
                We never ask for your bank credentials or credit score logins. Everything is synthesized from your passive SMS timeline.
              </Text>
            </View>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletIcon}>✓</Text>
            <View style={styles.bulletContent}>
              <Text style={styles.bulletTitle}>Full Privacy Control</Text>
              <Text style={styles.bulletText}>
                You can review queued messages, exclude individual texts, and permanently delete raw message logs at any time.
              </Text>
            </View>
          </View>
        </Card>

        {/* Consent Opt-In Toggle per Section 5.1 */}
        <View style={styles.consentBox}>
          <Switch
            value={hasConsented}
            onValueChange={setHasConsented}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
          <Text style={styles.consentText}>
            I understand and consent to EmiSaver scanning SMS and notifications locally on my phone to detect active EMIs.
          </Text>
        </View>

        <Button
          title="Get Started & Set Up Profile"
          onPress={handleGetStarted}
          disabled={!hasConsented}
          loading={loading}
          style={styles.ctaButton}
        />
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
  heroSection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 34,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  privacyCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  privacyHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  bulletIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  bulletContent: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bulletText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  consentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.base,
    borderRadius: spacing.radiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    marginLeft: spacing.md,
    lineHeight: 18,
    fontWeight: '500',
  },
  ctaButton: {
    marginBottom: spacing.xl,
  },
});
