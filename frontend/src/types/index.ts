export type RiskStatus = 'safe' | 'caution' | 'over_limit';

export interface UserProfile {
  id: string;
  deviceId: string;
  createdAt: string;
}

export interface IncomeProfile {
  id?: string;
  userId?: string;
  monthlyIncome: number;
  salaryDate?: number;
  fixedExpenses: number;
  safeEmiRatio: number; // e.g. 0.40
  emergencyBuffer?: number;
  maxSafeEmi: number;
  calculationMethod?: 'gross' | 'net';
}

export interface Loan {
  id: string;
  userId: string;
  lender: string;
  loanIdentifier?: string;
  principalAmount?: number;
  emiAmount: number;
  category?: string;
  repaymentFrequency: string;
  status: 'active' | 'closed' | 'disputed';
  sourceConfidence?: number;
  manuallyVerified: boolean;
  nextDueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmiScheduleItem {
  id: string;
  loanId: string;
  lender: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  loanIdentifier?: string;
}

export interface DashboardSummary {
  monthlyIncome: number;
  totalEmi: number;
  emiToIncomePct: number;
  safeEmiRatioPct: number;
  maxSafeEmi: number;
  activeLoansCount: number;
  riskStatus: RiskStatus;
  currency: string;
  riskMessage: string;
}

export interface FilteredMessage {
  id: string;
  source: 'sms' | 'notification';
  sender?: string;
  rawText: string;
  receivedAt: string;
  matchedKeywords: string[];
  excluded: boolean;
  languageDetected?: string;
}

// --- PHASE 2 TYPES ---

export interface DayEmiItem {
  loanId: string;
  lender: string;
  loanIdentifier?: string;
  amount: number;
  paid: boolean;
}

export interface UnifiedCalendarDay {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  dayOfWeek: string;
  totalAmount: number;
  items: DayEmiItem[];
  isPast: boolean;
}

export interface BusiestWeekInfo {
  startDate: string;
  endDate: string;
  totalAmount: number;
  installmentCount: number;
}

export interface UnifiedCalendarSummary {
  month: number;
  year: number;
  days: UnifiedCalendarDay[];
  thisMonthTotal: number;
  nextMonthTotal: number;
  busiestWeek: BusiestWeekInfo | null;
}

export interface RepaymentRatioData {
  monthlyIncome: number;
  totalMonthlyEmi: number;
  ratioPct: number;
  safeLimitPct: number;
  status: 'within_limit' | 'above_limit';
  isAboveLimit: boolean;
  trendDeltaPct: number;
  trendDirection: 'up' | 'down' | 'flat';
  message: string;
  normalizationNotes?: string[];
}

export interface LoanSimulationInput {
  loanAmount?: number;
  newEmi: number;
  durationMonths: number;
  preferredDueDay?: number;
}

export interface SimulationCalendarImpact {
  simulatedDueDay: number;
  datesAdded: string[];
  landsInConcentrationWindow: boolean;
  createsNewPressureWindow: boolean;
  impactSummary: string;
}

export interface LoanSimulationResult {
  currentEmi: number;
  newEmi: number;
  combinedEmi: number;
  monthlyIncome: number;
  ratioBefore: number;
  ratioAfter: number;
  deltaPp: number;
  additionalMonthlyCommitment: number;
  isAboveSafeLimit: boolean;
  safeLimitPct: number;
  calendarImpact: SimulationCalendarImpact;
}

export interface PressureWindowData {
  id: string;
  windowStart: string;
  windowEnd: string;
  totalDue: number;
  pressureScore: number;
  severity: 'info' | 'caution' | 'high';
  contributingFactors: {
    concentration_ratio?: number;
    burden_ratio?: number;
    min_gap_days?: number;
    pre_salary?: boolean;
    active_loan_count?: number;
    missed_payment_count?: number;
    [key: string]: any;
  };
  computedAt?: string;
}

// Phase 3 Types
export interface LoanTimelineNode {
  eventId?: string;
  eventDate: string;
  title: string;
  description: string;
  nodeType: string;
  amount?: number;
  confidence?: number;
  isProjected: boolean;
}

export interface LoanTimelineResponse {
  loanId: string;
  lender: string;
  loanIdentifier?: string;
  status: string;
  totalEvents: number;
  timeline: LoanTimelineNode[];
}

export interface RiskExplanationData {
  riskStatus: string;
  repaymentRatioPct: number;
  monthlyIncome: number;
  totalMonthlyEmi: number;
  bullets: string[];
  plainLanguageSummary: string;
  evaluatedFactors: Record<string, any>;
}

export interface PrivacyExportData {
  userId: string;
  exportedAt: string;
  incomeProfile?: any;
  loans: any[];
  emiSchedules: any[];
  loanEvents: any[];
  pressureWindows: any[];
}


