import {
  UserProfile,
  IncomeProfile,
  Loan,
  DashboardSummary,
  EmiScheduleItem,
  UnifiedCalendarSummary,
  RepaymentRatioData,
  LoanSimulationInput,
  LoanSimulationResult,
  PressureWindowData,
} from '../types';

import Constants from 'expo-constants';

// Automatically detect host IP from Expo bundler connection, or fallback to current LAN IP
const getBaseUrl = (): string => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8000`;
  }
  return 'http://192.168.0.103:8000';
};

export const DEFAULT_API_BASE = getBaseUrl();

class ApiClient {
  private baseUrl: string = DEFAULT_API_BASE;
  private deviceId: string = 'emisaver-demo-device';
  private userId: string | null = null;

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setCredentials(deviceId: string, userId?: string) {
    this.deviceId = deviceId;
    if (userId) this.userId = userId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Device-Id': this.deviceId,
      ...(this.userId ? { 'X-User-Id': this.userId } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Error [${response.status}] ${response.statusText}: ${errorBody}`);
    }

    return response.json();
  }

  // 1. User & Income
  async createUser(deviceId: string): Promise<UserProfile> {
    const res = await this.request<UserProfile>('/users', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
    this.userId = res.id;
    return res;
  }

  async saveIncomeProfile(userId: string, profile: Partial<IncomeProfile>): Promise<IncomeProfile> {
    return this.request<IncomeProfile>(`/users/${userId}/income-profile`, {
      method: 'POST',
      body: JSON.stringify({
        monthly_income: profile.monthlyIncome,
        salary_date: profile.salaryDate,
        fixed_expenses: profile.fixedExpenses || 0,
        safe_emi_ratio: profile.safeEmiRatio || 0.40,
        emergency_buffer: profile.emergencyBuffer || 0,
        calculation_method: profile.calculationMethod || 'gross',
      }),
    });
  }

  // 2. Message Ingestion
  async ingestMessages(messages: Array<{ source: string; sender?: string; raw_text: string; received_at?: string }>) {
    return this.request<{
      total_received: number;
      processed_count: number;
      new_events: any[];
      loans_updated: number;
      message: string;
    }>('/messages/ingest', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  }

  async deleteRawMessage(messageId: string) {
    return this.request<{ status: string; message_id: string }>(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  // 3. Loans & Manual Corrections
  async getLoans(status = 'active'): Promise<Loan[]> {
    const rawLoans = await this.request<any[]>(`/loans?status=${status}`);
    return rawLoans.map(l => ({
      id: l.id,
      userId: l.user_id,
      lender: l.lender,
      loanIdentifier: l.loan_identifier,
      principalAmount: l.principal_amount,
      emiAmount: l.emi_amount,
      repaymentFrequency: l.repayment_frequency,
      status: l.status,
      sourceConfidence: l.source_confidence,
      manuallyVerified: l.manually_verified,
      nextDueDate: l.next_due_date,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    }));
  }

  async updateLoan(loanId: string, updates: {
    lender?: string;
    loan_identifier?: string;
    emi_amount?: number;
    next_due_date?: string;
    status?: string;
  }): Promise<Loan> {
    return this.request<Loan>(`/loans/${loanId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async mergeLoans(primaryLoanId: string, secondaryLoanId: string): Promise<Loan> {
    return this.request<Loan>(`/loans/${primaryLoanId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ merge_with_loan_id: secondaryLoanId }),
    });
  }

  async markNotLoan(loanId: string) {
    return this.request<{ status: string; message: string }>(`/loans/${loanId}/mark-not-loan`, {
      method: 'POST',
    });
  }

  // 4. Dashboard & Calendar
  async getDashboardSummary(): Promise<DashboardSummary> {
    const raw = await this.request<any>('/dashboard/summary');
    return {
      monthlyIncome: raw.monthly_income,
      totalEmi: raw.total_emi,
      emiToIncomePct: raw.emi_to_income_pct,
      safeEmiRatioPct: raw.safe_emi_ratio_pct,
      maxSafeEmi: raw.max_safe_emi,
      activeLoansCount: raw.active_loans_count,
      riskStatus: raw.risk_status,
      currency: raw.currency,
      riskMessage: raw.risk_message,
    };
  }

  async getUpcomingCalendar(): Promise<{ upcoming_repayments: EmiScheduleItem[]; total_upcoming_amount: number }> {
    const raw = await this.request<any>('/calendar/upcoming');
    return {
      total_upcoming_amount: raw.total_upcoming_amount,
      upcoming_repayments: (raw.upcoming_repayments || []).map((item: any) => ({
        id: item.id,
        loanId: item.loan_id,
        lender: item.lender,
        dueDate: item.due_date,
        amount: item.amount,
        paid: item.paid,
        loanIdentifier: item.loan_identifier,
      })),
    };
  }

  // 5. Phase 2: Unified Calendar
  async getUnifiedCalendar(month?: number, year?: number): Promise<UnifiedCalendarSummary> {
    const params = new URLSearchParams();
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    const query = params.toString() ? `?${params.toString()}` : '';

    const raw = await this.request<any>(`/calendar/unified${query}`);
    return {
      month: raw.month,
      year: raw.year,
      thisMonthTotal: raw.this_month_total,
      nextMonthTotal: raw.next_month_total,
      busiestWeek: raw.busiest_week
        ? {
            startDate: raw.busiest_week.start_date,
            endDate: raw.busiest_week.end_date,
            totalAmount: raw.busiest_week.total_amount,
            installmentCount: raw.busiest_week.installment_count,
          }
        : null,
      days: (raw.days || []).map((d: any) => ({
        date: d.date,
        dayOfMonth: d.day_of_month,
        dayOfWeek: d.day_of_week,
        totalAmount: d.total_amount,
        isPast: d.is_past,
        items: (d.items || []).map((i: any) => ({
          loanId: i.loan_id,
          lender: i.lender,
          loanIdentifier: i.loan_identifier,
          amount: i.amount,
          paid: i.paid,
        })),
      })),
    };
  }

  // 6. Phase 2: Repayment-to-Income Ratio
  async getRepaymentRatio(): Promise<RepaymentRatioData> {
    const raw = await this.request<any>('/risk/ratio');
    return {
      monthlyIncome: raw.monthly_income,
      totalMonthlyEmi: raw.total_monthly_emi,
      ratioPct: raw.ratio_pct,
      safeLimitPct: raw.safe_limit_pct,
      status: raw.status,
      isAboveLimit: raw.is_above_limit,
      trendDeltaPct: raw.trend_delta_pct,
      trendDirection: raw.trend_direction,
      message: raw.message,
      normalizationNotes: raw.normalization_notes || undefined,
    };
  }

  // 7. Phase 2: Loan Simulation ("What-if" Calculator)
  async simulateLoan(params: LoanSimulationInput): Promise<LoanSimulationResult> {
    const raw = await this.request<any>('/simulate/new-loan', {
      method: 'POST',
      body: JSON.stringify({
        loan_amount: params.loanAmount,
        new_emi: params.newEmi,
        duration_months: params.durationMonths,
        preferred_due_day: params.preferredDueDay,
      }),
    });

    return {
      currentEmi: raw.current_emi,
      newEmi: raw.new_emi,
      combinedEmi: raw.combined_emi,
      monthlyIncome: raw.monthly_income,
      ratioBefore: raw.ratio_before,
      ratioAfter: raw.ratio_after,
      deltaPp: raw.delta_pp,
      additionalMonthlyCommitment: raw.additional_monthly_commitment,
      isAboveSafeLimit: raw.is_above_safe_limit,
      safeLimitPct: raw.safe_limit_pct,
      calendarImpact: {
        simulatedDueDay: raw.calendar_impact.simulated_due_day,
        datesAdded: raw.calendar_impact.dates_added || [],
        landsInConcentrationWindow: raw.calendar_impact.lands_in_concentration_window,
        createsNewPressureWindow: raw.calendar_impact.creates_new_pressure_window,
        impactSummary: raw.calendar_impact.impact_summary,
      },
    };
  }

  // 8. Phase 2: Payment Pressure Windows
  async getPressureWindows(): Promise<PressureWindowData[]> {
    const raw = await this.request<any>('/risk/pressure-windows');
    return (raw.active_windows || []).map((w: any) => ({
      id: w.id,
      windowStart: w.window_start,
      windowEnd: w.window_end,
      totalDue: w.total_due,
      pressureScore: w.pressure_score,
      severity: w.severity,
      contributingFactors: w.contributing_factors || {},
      computedAt: w.computed_at,
    }));
  }

  async getPressureWindowDetail(windowId: string): Promise<PressureWindowData> {
    const raw = await this.request<any>(`/risk/pressure-windows/${windowId}`);
    return {
      id: raw.id,
      windowStart: raw.window_start,
      windowEnd: raw.window_end,
      totalDue: raw.total_due,
      pressureScore: raw.pressure_score,
      severity: raw.severity,
      contributingFactors: raw.contributing_factors || {},
      computedAt: raw.computed_at,
    };
  }

  // 9. Phase 3: On-Device Structured Ingest (No Raw Text)
  async structuredIngest(items: Array<{
    lender?: string | null;
    emi?: number | null;
    due_date?: string | null;
    message_type?: string;
    loan_identifier?: string | null;
    confidence: { lender: number; emi: number; due_date: number; overall: number };
    local_message_ref?: string;
  }>) {
    return this.request<{
      total_received: number;
      processed_count: number;
      loans_updated: number;
      new_events_count: number;
      low_confidence_refs: string[];
      message: string;
    }>('/loans/structured-ingest', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // 10. Phase 3: Opt-in Fallback Parse (With Explicit Consent)
  async fallbackParse(params: {
    raw_text: string;
    sender?: string;
    source?: string;
    local_message_ref?: string;
    user_consent: boolean;
    retention_days?: number;
  }) {
    return this.request<any>('/messages/fallback-parse', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // 11. Phase 3: Loan Timeline Reconstruction
  async getLoanTimeline(loanId: string): Promise<any> {
    const raw = await this.request<any>(`/loans/${loanId}/timeline`);
    return {
      loanId: raw.loan_id,
      lender: raw.lender,
      loanIdentifier: raw.loan_identifier,
      status: raw.status,
      totalEvents: raw.total_events,
      timeline: (raw.timeline || []).map((n: any) => ({
        eventId: n.event_id,
        eventDate: n.event_date,
        title: n.title,
        description: n.description,
        nodeType: n.node_type,
        amount: n.amount,
        confidence: n.confidence,
        isProjected: n.is_projected,
      })),
    };
  }

  // 12. Phase 3: Explainable Warnings
  async explainRiskSnapshot(snapshotId: string = 'current'): Promise<any> {
    const raw = await this.request<any>(`/risk/explain/${snapshotId}`);
    return {
      riskStatus: raw.risk_status,
      repaymentRatioPct: raw.repayment_ratio_pct,
      monthlyIncome: raw.monthly_income,
      totalMonthlyEmi: raw.total_monthly_emi,
      bullets: raw.bullets || [],
      plainLanguageSummary: raw.plain_language_summary,
      evaluatedFactors: raw.evaluated_factors || {},
    };
  }

  async explainPressureWindow(windowId: string): Promise<any> {
    const raw = await this.request<any>(`/risk/explain/pressure-window/${windowId}`);
    return {
      riskStatus: raw.risk_status,
      repaymentRatioPct: raw.repayment_ratio_pct,
      monthlyIncome: raw.monthly_income,
      totalMonthlyEmi: raw.total_monthly_emi,
      bullets: raw.bullets || [],
      plainLanguageSummary: raw.plain_language_summary,
      evaluatedFactors: raw.evaluated_factors || {},
    };
  }

  // 13. Phase 3: Privacy Center Controls
  async deleteAllData() {
    return this.request<{ status: string; message: string }>('/privacy/delete-all', {
      method: 'POST',
    });
  }

  async purgeRawMessages(onlyExpired: boolean = false) {
    return this.request<{ purged_count: number; message: string }>(`/privacy/purge-raw-messages?only_expired=${onlyExpired}`, {
      method: 'POST',
    });
  }

  async exportUserData(): Promise<any> {
    return this.request<any>('/privacy/export');
  }

  // 14. Phase 4: Mistral AI Debt Relief & Planning
  async getAiPlan(goals: any, loans: any[], incomeData?: any): Promise<{ plan: string; is_ai_powered?: boolean; model?: string }> {
    return this.request<{ plan: string; is_ai_powered?: boolean; model?: string }>('/ai/plan', {
      method: 'POST',
      body: JSON.stringify({
        goals,
        loans,
        income_data: incomeData,
      }),
    });
  }

  async askAiChat(question: string, loans: any[] = [], incomeData?: any): Promise<{ reply: string; is_ai_powered?: boolean }> {
    return this.request<{ reply: string; is_ai_powered?: boolean }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        question,
        loans,
        income_data: incomeData,
      }),
    });
  }
}

export const apiClient = new ApiClient();
