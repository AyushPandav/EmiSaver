import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { colors } from '../theme/colors';

// Screens
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { LoansScreen } from '../screens/LoansScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PrivacyCenterScreen } from '../screens/PrivacyCenterScreen';
import { BudgetScreen } from '../screens/BudgetScreen';
import { EnvelopeDetailScreen } from '../screens/EnvelopeDetailScreen';
import { AIPlanScreen } from '../screens/AIPlanScreen';
import { ReliefHubScreen } from '../screens/ReliefHubScreen';
import { useUserStore } from '../store/useUserStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const BudgetStack = createNativeStackNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const getIcon = () => {
    switch (name) {
      case 'Dashboard':
        return '📊';
      case 'Budget':
        return '💰';
      case 'AI Plan':
        return '🤖';
      case 'Relief':
        return '🛡️';
      case 'Loans':
        return '💳';
      default:
        return '📌';
    }
  };

  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.iconText, focused && styles.iconFocused]}>
        {getIcon()}
      </Text>
    </View>
  );
}

// Budget tab has its own stack so EnvelopeDetail slides in naturally
function BudgetStackNavigator() {
  return (
    <BudgetStack.Navigator screenOptions={{ headerShown: false }}>
      <BudgetStack.Screen name="BudgetMain" component={BudgetScreen} />
      <BudgetStack.Screen name="EnvelopeDetail" component={EnvelopeDetailScreen} />
    </BudgetStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Budget" component={BudgetStackNavigator} />
      <Tab.Screen name="AI Plan" component={AIPlanScreen} />
      <Tab.Screen name="Relief" component={ReliefHubScreen} />
      <Tab.Screen name="Loans" component={LoansScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isOnboarded } = useUserStore();

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isOnboarded ? 'MainTabs' : 'Welcome'}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Permissions" component={PermissionsScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="PrivacyCenter" component={PrivacyCenterScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  iconFocused: {
    transform: [{ scale: 1.15 }],
  },
});
