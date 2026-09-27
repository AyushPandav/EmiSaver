import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { EmiScheduleItem } from '../../types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatters';

interface CalendarGridProps {
  repayments: EmiScheduleItem[];
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({ repayments }) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Group repayments by day of current month
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 for Sunday

  const dailyTotals: Record<number, { total: number; items: EmiScheduleItem[] }> = {};

  for (const item of repayments) {
    const itemDate = new Date(item.dueDate);
    if (itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear) {
      const day = itemDate.getDate();
      if (!dailyTotals[day]) {
        dailyTotals[day] = { total: 0, items: [] };
      }
      dailyTotals[day].total += item.amount;
      dailyTotals[day].items.push(item);
    }
  }

  const monthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const selectedData = selectedDay ? dailyTotals[selectedDay] : null;

  return (
    <View style={styles.container}>
      <Text style={styles.monthHeader}>{monthName}</Text>

      <View style={styles.weekDaysRow}>
        {weekDays.map((d, i) => (
          <Text key={i} style={styles.weekDayText}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {/* Empty padding cells */}
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.dayCell} />
        ))}

        {/* Calendar days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayData = dailyTotals[day];
          const hasEmi = !!dayData;
          const isSelected = selectedDay === day;

          return (
            <TouchableOpacity
              key={`day-${day}`}
              style={[
                styles.dayCell,
                hasEmi && styles.hasEmiCell,
                isSelected && styles.selectedCell,
              ]}
              onPress={() => setSelectedDay(day)}
            >
              <Text
                style={[
                  styles.dayNumber,
                  hasEmi && styles.hasEmiText,
                  isSelected && styles.selectedText,
                ]}
              >
                {day}
              </Text>
              {hasEmi ? (
                <View style={styles.emiDot}>
                  <Text style={styles.dotAmount}>
                    {dayData.total >= 1000 ? `${(dayData.total / 1000).toFixed(1)}k` : dayData.total}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Day Details */}
      {selectedDay && selectedData ? (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedHeader}>
            Due on {selectedDay} {today.toLocaleString('default', { month: 'short' })}: {formatCurrency(selectedData.total)}
          </Text>
          {selectedData.items.map((item, idx) => (
            <View key={idx} style={styles.selectedRow}>
              <Text style={styles.selectedLender}>{item.lender}</Text>
              <Text style={styles.selectedAmount}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: spacing.radiusLg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.md,
  },
  monthHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  weekDayText: {
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 42,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.radiusSm,
    marginVertical: 2,
  },
  hasEmiCell: {
    backgroundColor: colors.primarySoft,
  },
  selectedCell: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayNumber: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  hasEmiText: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  selectedText: {
    fontWeight: '800',
  },
  emiDot: {
    marginTop: 2,
  },
  dotAmount: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
  },
  selectedContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectedHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  selectedLender: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  selectedAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
