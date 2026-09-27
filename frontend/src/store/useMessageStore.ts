import { create } from 'zustand';
import { FilteredMessage } from '../types';
import { runOnDevicePreFilter } from '../utils/messageFilter';
import { apiClient } from '../api/client';
import { onDeviceParser, StructuredLoanPayload } from '../services/onDeviceParser';
import { readSms, SmsMessage } from '../services/smsReader';
import { useLoansStore } from './useLoansStore';
import { computeDebtAggregation } from '../services/debtAggregator';

export interface ScanResultStats {
  totalRead: number;
  financialCount: number;
  discardedCount: number;
  detectedLoansCount: number;
  detectedSalary?: number | null;
  totalMonthlyDebt: number;
  debtToIncomeRatioPct: number;
}

interface MessageState {
  queuedMessages: FilteredMessage[];
  isScanning: boolean;
  isSyncing: boolean;
  syncSuccessCount: number;
  lastScanStats: ScanResultStats | null;

  scanDeviceSms: () => Promise<ScanResultStats>;
  processSingleSms: (text: string, sender?: string) => StructuredLoanPayload;
  queueRawMessages: (rawList: Array<{ sender?: string; text: string; date?: string }>) => ScanResultStats;
  toggleExclusion: (id: string) => void;
  clearQueue: () => void;
  syncFilteredBatch: () => Promise<number>;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  queuedMessages: [],
  isScanning: false,
  isSyncing: false,
  syncSuccessCount: 0,
  lastScanStats: null,

  scanDeviceSms: async () => {
    set({ isScanning: true });
    try {
      const messages: SmsMessage[] = await readSms();
      const rawList = messages.map(m => ({
        sender: m.sender || m.address,
        text: m.body,
        date: m.date || new Date(m.timestamp).toISOString(),
      }));

      const stats = get().queueRawMessages(rawList);
      set({ isScanning: false, lastScanStats: stats });
      return stats;
    } catch (err) {
      set({ isScanning: false });
      throw err;
    }
  },

  processSingleSms: (text: string, sender?: string) => {
    const parsed = onDeviceParser.parseMessage(text, sender);
    if (parsed.is_loan_related && parsed.emi && parsed.emi > 0) {
      useLoansStore.getState().ingestParsedLoans([parsed]);
    }
    return parsed;
  },

  queueRawMessages: (rawList) => {
    set({ isScanning: true });
    const processed: FilteredMessage[] = [];
    const parsedFinancialPayloads: StructuredLoanPayload[] = [];
    let detectedSalary: number | null = null;
    let discardedCount = 0;

    for (const item of rawList) {
      const filterRes = runOnDevicePreFilter(item.sender, item.text);
      if (filterRes.isLoanRelated) {
        processed.push({
          id: 'msg-' + Math.random().toString(36).substring(2, 9),
          source: 'sms',
          sender: item.sender,
          rawText: filterRes.sanitizedText,
          receivedAt: item.date || new Date().toISOString(),
          matchedKeywords: filterRes.matchedKeywords,
          excluded: false,
        });

        // Run On-Device EMI Parser immediately (§10)
        const parsed = onDeviceParser.parseMessage(filterRes.sanitizedText, item.sender);
        if (parsed.salary_amount) {
          detectedSalary = parsed.salary_amount;
        }
        if (parsed.emi && parsed.emi > 0) {
          parsedFinancialPayloads.push(parsed);
        }
      } else {
        // Discard non-financial message on-device
        discardedCount++;
      }
    }

    // Ingest into local store in real-time
    if (parsedFinancialPayloads.length > 0) {
      useLoansStore.getState().ingestParsedLoans(parsedFinancialPayloads, detectedSalary || undefined);
    }

    const currentLoans = useLoansStore.getState().loans;
    const agg = computeDebtAggregation(currentLoans, detectedSalary || 35000, 40);

    const stats: ScanResultStats = {
      totalRead: rawList.length,
      financialCount: processed.length,
      discardedCount,
      detectedLoansCount: parsedFinancialPayloads.length,
      detectedSalary,
      totalMonthlyDebt: agg.totalMonthlyDebt,
      debtToIncomeRatioPct: agg.debtToIncomeRatioPct,
    };

    set({
      queuedMessages: processed,
      isScanning: false,
      lastScanStats: stats,
    });

    return stats;
  },

  toggleExclusion: (id) => {
    set(state => ({
      queuedMessages: state.queuedMessages.map(m =>
        m.id === id ? { ...m, excluded: !m.excluded } : m
      ),
    }));
  },

  clearQueue: () => set({ queuedMessages: [] }),

  syncFilteredBatch: async () => {
    const { queuedMessages } = get();
    const toSend = queuedMessages.filter(m => !m.excluded);

    if (toSend.length === 0) return 0;

    set({ isSyncing: true });
    try {
      const structuredItems = toSend
        .map(message => onDeviceParser.parseMessage(message.rawText, message.sender))
        .filter(item => item.is_loan_related)
        .map(({ is_loan_related: _isLoanRelated, ...item }) => item);

      if (structuredItems.length === 0) {
        set({ queuedMessages: [], isSyncing: false, syncSuccessCount: 0 });
        return 0;
      }

      const res = await apiClient.structuredIngest(structuredItems);

      // Refresh loans & dashboard immediately
      await useLoansStore.getState().fetchDashboardData();

      set({
        queuedMessages: [],
        isSyncing: false,
        syncSuccessCount: res.processed_count,
      });

      return res.processed_count;
    } catch (err) {
      set({ isSyncing: false });
      throw err;
    }
  },
}));
