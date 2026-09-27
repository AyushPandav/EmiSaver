import { create } from 'zustand';
import appStorage from '../utils/storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export type EnvelopeColor =
  | '#4F46E5'
  | '#10B981'
  | '#F59E0B'
  | '#EF4444'
  | '#8B5CF6'
  | '#EC4899'
  | '#06B6D4'
  | '#F97316';

export interface Envelope {
  id: string;
  name: string;
  icon: string;
  color: EnvelopeColor;
  monthlyBudget: number;
  isEmi?: boolean;
  isSavings?: boolean;
  savingsGoal?: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  envelopeId: string;
  amount: number;
  note: string;
  date: string;
  type: 'spend' | 'fill';
}

interface BudgetState {
  monthlyIncome: number;
  envelopes: Envelope[];
  transactions: Transaction[];
  isLoaded: boolean;

  setMonthlyIncome: (income: number) => void;
  addEnvelope: (env: Omit<Envelope, 'id' | 'createdAt'>) => void;
  updateEnvelope: (id: string, updates: Partial<Envelope>) => void;
  deleteEnvelope: (id: string) => void;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  syncEmiEnvelope: (totalEmi: number) => void;
  loadFromStorage: () => Promise<void>;

  getEnvelopeSpent: (envelopeId: string, month?: string) => number;
  getEnvelopeBalance: (envelopeId: string, month?: string) => number;
  getTotalAllocated: () => number;
  getAvailableToBudget: () => number;
}

const STORAGE_KEY = '@emisaver_budget_v1';
const currentMonth = () => new Date().toISOString().slice(0, 7);

const DEFAULT_ENVELOPES: Envelope[] = [
  {
    id: 'env-groceries',
    name: 'Groceries',
    icon: '🛒',
    color: '#10B981',
    monthlyBudget: 5000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'env-transport',
    name: 'Transport',
    icon: '🚗',
    color: '#06B6D4',
    monthlyBudget: 2000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'env-savings',
    name: 'Savings',
    icon: '🏦',
    color: '#4F46E5',
    monthlyBudget: 5000,
    isSavings: true,
    savingsGoal: 100000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'env-entertainment',
    name: 'Entertainment',
    icon: '🎬',
    color: '#8B5CF6',
    monthlyBudget: 2000,
    createdAt: new Date().toISOString(),
  },
];

async function persistState(state: {
  monthlyIncome: number;
  envelopes: Envelope[];
  transactions: Transaction[];
}) {
  try {
    await appStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  monthlyIncome: 35000,
  envelopes: DEFAULT_ENVELOPES,
  transactions: [],
  isLoaded: false,

  loadFromStorage: async () => {
    try {
      const raw = await appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        set({
          monthlyIncome: saved.monthlyIncome ?? 35000,
          envelopes: saved.envelopes ?? DEFAULT_ENVELOPES,
          transactions: saved.transactions ?? [],
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch (_) {
      set({ isLoaded: true });
    }
  },

  setMonthlyIncome: (income) => {
    set({ monthlyIncome: income });
    const s = get();
    persistState({ monthlyIncome: income, envelopes: s.envelopes, transactions: s.transactions });
  },

  addEnvelope: (env) => {
    const newEnv: Envelope = {
      ...env,
      id: 'env-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    const envelopes = [...get().envelopes, newEnv];
    set({ envelopes });
    persistState({ monthlyIncome: get().monthlyIncome, envelopes, transactions: get().transactions });
  },

  updateEnvelope: (id, updates) => {
    const envelopes = get().envelopes.map(e => (e.id === id ? { ...e, ...updates } : e));
    set({ envelopes });
    persistState({ monthlyIncome: get().monthlyIncome, envelopes, transactions: get().transactions });
  },

  deleteEnvelope: (id) => {
    const envelopes = get().envelopes.filter(e => e.id !== id);
    const transactions = get().transactions.filter(t => t.envelopeId !== id);
    set({ envelopes, transactions });
    persistState({ monthlyIncome: get().monthlyIncome, envelopes, transactions });
  },

  addTransaction: (tx) => {
    const newTx: Transaction = {
      ...tx,
      id: 'tx-' + Math.random().toString(36).substring(2, 9),
    };
    const transactions = [newTx, ...get().transactions];
    set({ transactions });
    persistState({ monthlyIncome: get().monthlyIncome, envelopes: get().envelopes, transactions });
  },

  deleteTransaction: (id) => {
    const transactions = get().transactions.filter(t => t.id !== id);
    set({ transactions });
    persistState({ monthlyIncome: get().monthlyIncome, envelopes: get().envelopes, transactions });
  },

  syncEmiEnvelope: (totalEmi) => {
    if (totalEmi <= 0) return;
    const existing = get().envelopes.find(e => e.isEmi);
    if (existing) {
      const envelopes = get().envelopes.map(e =>
        e.isEmi ? { ...e, monthlyBudget: totalEmi } : e,
      );
      set({ envelopes });
      persistState({ monthlyIncome: get().monthlyIncome, envelopes, transactions: get().transactions });
    } else {
      const emiEnv: Envelope = {
        id: 'env-emi',
        name: 'EMI Payments',
        icon: '💳',
        color: '#EF4444',
        monthlyBudget: totalEmi,
        isEmi: true,
        createdAt: new Date().toISOString(),
      };
      const envelopes = [emiEnv, ...get().envelopes];
      set({ envelopes });
      persistState({ monthlyIncome: get().monthlyIncome, envelopes, transactions: get().transactions });
    }
  },

  getEnvelopeSpent: (envelopeId, month?) => {
    const m = month || currentMonth();
    return get()
      .transactions.filter(
        t => t.envelopeId === envelopeId && t.type === 'spend' && t.date.startsWith(m),
      )
      .reduce((sum, t) => sum + t.amount, 0);
  },

  getEnvelopeBalance: (envelopeId, month?) => {
    const env = get().envelopes.find(e => e.id === envelopeId);
    if (!env) return 0;
    const spent = get().getEnvelopeSpent(envelopeId, month);
    return env.monthlyBudget - spent;
  },

  getTotalAllocated: () => get().envelopes.reduce((sum, e) => sum + e.monthlyBudget, 0),

  getAvailableToBudget: () => get().monthlyIncome - get().getTotalAllocated(),
}));
