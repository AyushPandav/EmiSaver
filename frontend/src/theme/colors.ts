export const colors = {
  primary: '#4F46E5', // Deep Indigo
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  primarySoft: '#EEF2FF',

  // Risk bands per spec: Safe (green), Caution (amber), Over-limit (red)
  safe: '#10B981', // Emerald green (<70% of safe limit)
  safeLight: '#D1FAE5',
  safeText: '#065F46',

  caution: '#F59E0B', // Amber (70-100% of safe limit)
  cautionLight: '#FEF3C7',
  cautionText: '#92400E',

  overLimit: '#EF4444', // Red / Rose (>100% of safe limit)
  overLimitLight: '#FEE2E2',
  overLimitText: '#991B1B',

  // Convenience aliases for risk components
  riskHigh: '#EF4444',
  riskHighLight: '#FEE2E2',
  riskMedium: '#F59E0B',
  riskMediumLight: '#FEF3C7',
  riskLow: '#10B981',
  riskLowLight: '#D1FAE5',

  // Neutrals
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  border: '#E2E8F0',
  borderFocus: '#6366F1',

  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Card accents
  cardShadow: 'rgba(15, 23, 42, 0.08)',
};

export type ColorTheme = typeof colors;
