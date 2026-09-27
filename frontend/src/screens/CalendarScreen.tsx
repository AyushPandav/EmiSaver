import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { formatCurrency } from '../utils/formatters';
import { useUnifiedCalendar } from '../hooks/useUnifiedCalendar';
import { UnifiedCalendarDay } from '../types';

export const CalendarScreen: React.FC = () => {
  const {
    selectedMonth,
    selectedYear,
    viewMode,
    setViewMode,
    calendarData,
    isLoading,
    fetchCalendar,
    nextMonth,
    prevMonth,
  } = useUnifiedCalendar();

  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthName = monthNames[selectedMonth - 1] || 'Current Month';

  const daysWithPayments = (calendarData?.days || []).filter(d => d.totalAmount > 0);

  // If in week view, slice to the busiest week or the current 7 days
  const displayedDays = viewMode === 'week' && calendarData?.busiestWeek
    ? (calendarData.days || []).filter(d => {
        const dStr = d.date;
        return dStr >= calendarData.busiestWeek!.startDate && dStr <= calendarData.busiestWeek!.endDate;
      })
    : daysWithPayments;

  const toggleExpand = (dateStr: string) => {
    setExpandedDate(prev => (prev === dateStr ? null : dateStr));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchCalendar} />
        }
      >
        {/* Screen Title */}
        <View style={styles.header}>
          <Text style={styles.title}>Unified Repayment Calendar</Text>
          <Text style={styles.subtitle}>
            Aggregated day-level commitments across all lenders and BNPL apps
          </Text>
        </View>

        {/* Month Navigation Row */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Text style={styles.navBtnText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {monthName.toUpperCase()} {selectedYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* Header Summary Block (§3.1) */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Total {monthName} EMI</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(calendarData?.thisMonthTotal || 0)}
              </Text>
            </View>
            <View style={styles.nextMonthBox}>
              <Text style={styles.nextMonthLabel}>Next Month</Text>
              <Text style={styles.nextMonthAmount}>
                {formatCurrency(calendarData?.nextMonthTotal || 0)}
              </Text>
            </View>
          </View>

          {/* Busiest Week Indicator (§3.1) */}
          {calendarData?.busiestWeek && (
            <View style={styles.busiestWeekPill}>
              <Text style={styles.busiestWeekIcon}>⚡</Text>
              <Text style={styles.busiestWeekText}>
                Busiest window: {new Date(calendarData.busiestWeek.startDate).getDate()}–
                {new Date(calendarData.busiestWeek.endDate).getDate()} {monthName.substring(0, 3)} ({formatCurrency(calendarData.busiestWeek.totalAmount)})
              </Text>
            </View>
          )}
        </Card>

        {/* View Switcher: Month vs Week View (§3.1) */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'month' && styles.segmentActive]}
            onPress={() => setViewMode('month')}
          >
            <Text
              style={[
                styles.segmentText,
                viewMode === 'month' && styles.segmentTextActive,
              ]}
            >
              Month View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, viewMode === 'week' && styles.segmentActive]}
            onPress={() => setViewMode('week')}
          >
            <Text
              style={[
                styles.segmentText,
                viewMode === 'week' && styles.segmentTextActive,
              ]}
            >
              Peak Week View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Day-bucketed timeline (§3.1) */}
        <View style={styles.timelineContainer}>
          {displayedDays.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Repayments Due</Text>
              <Text style={styles.emptyDesc}>
                There are no active scheduled EMI payments detected in this period.
              </Text>
            </View>
          ) : (
            displayedDays.map((dayItem) => {
              const isExpanded = expandedDate === dayItem.date;

              return (
                <View key={dayItem.date} style={styles.dateBlock}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleExpand(dayItem.date)}
                    style={[
                      styles.dateRow,
                      dayItem.isPast && styles.pastDateRow,
                      isExpanded && styles.dateRowExpanded,
                    ]}
                  >
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayNumber}>{dayItem.dayOfMonth}</Text>
                      <Text style={styles.dayWeek}>{dayItem.dayOfWeek}</Text>
                    </View>

                    <View style={styles.lineConnector} />

                    <View style={styles.amountWrap}>
                      <Text style={styles.dayTotalAmount}>
                        {formatCurrency(dayItem.totalAmount)}
                      </Text>
                      <Text style={styles.loanCountHint}>
                        {dayItem.items.length} {dayItem.items.length === 1 ? 'loan' : 'loans'} {isExpanded ? '▲' : '▼'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded individual loan items for traceability (§3.1) */}
                  {isExpanded && (
                    <View style={styles.expandedItemsContainer}>
                      {dayItem.items.map((sub, idx) => (
                        <View key={idx} style={styles.subItemRow}>
                          <View>
                            <Text style={styles.subLender}>{sub.lender}</Text>
                            {sub.loanIdentifier ? (
                              <Text style={styles.subId}>{sub.loanIdentifier}</Text>
                            ) : null}
                          </View>
                          <View style={styles.subAmountCol}>
                            <Text style={styles.subAmount}>
                              {formatCurrency(sub.amount)}
                            </Text>
                            <Text style={[styles.subStatus, sub.paid && styles.subPaid]}>
                              {sub.paid ? 'Paid ✓' : 'Due'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
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
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  navBtn: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusSm,
  },
  navBtnText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  summaryCard: {
    padding: spacing.base,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  nextMonthBox: {
    alignItems: 'flex-end',
  },
  nextMonthLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  nextMonthAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  busiestWeekPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.sm,
  },
  busiestWeekIcon: {
    marginRight: 6,
  },
  busiestWeekText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.radiusMd,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: spacing.radiusSm,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  timelineContainer: {
    marginTop: spacing.xs,
  },
  dateBlock: {
    marginBottom: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.radiusMd,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pastDateRow: {
    opacity: 0.6,
  },
  dateRowExpanded: {
    borderColor: colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dayBadge: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dayWeek: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  lineConnector: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  amountWrap: {
    alignItems: 'flex-end',
  },
  dayTotalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  loanCountHint: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  expandedItemsContainer: {
    backgroundColor: colors.surfaceSubtle,
    borderBottomLeftRadius: spacing.radiusMd,
    borderBottomRightRadius: spacing.radiusMd,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary,
    padding: spacing.sm,
  },
  subItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subLender: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subId: {
    fontSize: 10,
    color: colors.textMuted,
  },
  subAmountCol: {
    alignItems: 'flex-end',
  },
  subAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subStatus: {
    fontSize: 10,
    color: colors.riskMedium,
    fontWeight: '600',
  },
  subPaid: {
    color: colors.riskLow,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: spacing.radiusLg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
