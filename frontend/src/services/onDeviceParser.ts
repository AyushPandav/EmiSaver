import ruleset from '../assets/ruleset.json';

export interface FieldConfidence {
  lender: number;
  emi: number;
  due_date: number;
  overall: number;
}

export type DebtCategory =
  | 'personal_loan'
  | 'bnpl'
  | 'credit_card'
  | 'home_loan'
  | 'loan_emi'
  | 'salary'
  | 'other_debt';

export interface StructuredLoanPayload {
  lender: string | null;
  emi: number | null;
  due_date: string | null; // ISO YYYY-MM-DD
  message_type: string;
  category: DebtCategory;
  outstanding: number | null;
  salary_amount: number | null;
  loan_identifier: string | null;
  confidence: FieldConfidence;
  local_message_ref: string;
  is_loan_related: boolean;
}

export class OnDeviceParser {
  private rules = ruleset;

  /**
   * Generates a unique local reference UUID
   */
  private generateLocalRef(): string {
    return 'local-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
  }

  /**
   * Stage 1: Convert Indic digits (Hindi, Tamil, Bengali) to Arabic digits
   */
  private normalizeIndicDigits(text: string): string {
    const digitMap: Record<string, string> = this.rules.amount_patterns.indic_digit_map;
    let res = '';
    for (const ch of text) {
      res += digitMap[ch] !== undefined ? digitMap[ch] : ch;
    }
    return res;
  }

  /**
   * Stage 2: Identify Lender from sender header and body text
   */
  public identifyLender(sender?: string, text: string = ''): { lender: string | null; confidence: number } {
    const normSender = (sender || '').toUpperCase().replace(/[-_]/g, '');
    const normText = text.toLowerCase();

    // 1. Sender ID exact pattern match (Highest confidence: 0.96)
    for (const l of this.rules.lenders) {
      for (const pat of l.sender_patterns) {
        if (normSender.includes(pat)) {
          return { lender: l.canonical_name, confidence: 0.96 };
        }
      }
    }

    // 2. Keyword match in body (0.92)
    for (const l of this.rules.lenders) {
      for (const kw of l.keywords) {
        const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, 'i');
        if (regex.test(normText)) {
          return { lender: l.canonical_name, confidence: 0.92 };
        }
      }
    }

    // 3. Substring match (0.80)
    for (const l of this.rules.lenders) {
      const cleanName = l.canonical_name.toLowerCase().replace(/\s+/g, '');
      if (normText.replace(/\s+/g, '').includes(cleanName)) {
        return { lender: l.canonical_name, confidence: 0.80 };
      }
    }

    // 4. Generic finance sender pattern fallback (0.45)
    if (normSender && /(loan|crdt|krdt|bank|fin)/i.test(normSender)) {
      const match = normSender.match(/[A-Z]{3,}/g);
      if (match && match.length > 0) {
        return { lender: match[match.length - 1], confidence: 0.45 };
      }
    }

    return { lender: null, confidence: 0.20 };
  }

  /**
   * Stage 3: Amount Regex Extraction
   */
  public detectAmount(text: string): { amount: number | null; confidence: number } {
    const clean = this.normalizeIndicDigits(text);

    // Look for currency symbols + numbers with commas and decimals
    const patterns = [
      /(?:₹|rs\.?|inr|रू|ரூ|টাকা)\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
      /(?:emi|installment|due|amount)\s*(?:of|is|:)?\s*(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+)/i,
      /(?:किस्त|राशि|ईएमआई)\s*(?:₹|रु\.?)?\s*([0-9]+)/i
    ];

    for (const pat of patterns) {
      const match = clean.match(pat);
      if (match && match[1]) {
        const numStr = match[1].replace(/,/g, '');
        const val = parseFloat(numStr);
        if (!isNaN(val) && val > 0 && val < 10000000) {
          return { amount: val, confidence: 0.95 };
        }
      }
    }

    // Fallback standalone number if loan keywords present
    const numberMatch = clean.match(/\b([0-9]{3,6}(?:\.[0-9]{2})?)\b/);
    if (numberMatch && numberMatch[1]) {
      const val = parseFloat(numberMatch[1]);
      if (!isNaN(val) && val >= 500) {
        return { amount: val, confidence: 0.65 };
      }
    }

    return { amount: null, confidence: 0.20 };
  }

  /**
   * Stage 4: Date Extraction with Indic Month Parsing
   */
  public detectDueDate(text: string): { dueDate: string | null; confidence: number } {
    const clean = this.normalizeIndicDigits(text);
    const today = new Date();
    const currentYear = today.getFullYear();

    // 1. Regex for DD/MM/YYYY or DD-MM-YYYY
    const numericDateMatch = clean.match(/\b([0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.]([2-9][0-9]{3}|[0-9]{2})\b/);
    if (numericDateMatch) {
      const day = parseInt(numericDateMatch[1], 10);
      const month = parseInt(numericDateMatch[2], 10);
      let year = parseInt(numericDateMatch[3], 10);
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { dueDate: iso, confidence: 0.95 };
      }
    }

    // 2. Multilingual Month Lookup (Hindi, Tamil, Bengali, English)
    const allMonths: Record<string, number> = {
      ...this.rules.date_patterns.english_months,
      ...this.rules.date_patterns.indic_months,
    };

    for (const [mName, mNum] of Object.entries(allMonths)) {
      // e.g. "25 Sep", "25 सितंबर", "Sep 25", "25th September"
      const dayMonthRegex = new RegExp(`\\b([0-3]?[0-9])(?:st|nd|rd|th)?\\s+${mName}\\b`, 'i');
      const monthDayRegex = new RegExp(`\\b${mName}\\s+([0-3]?[0-9])(?:st|nd|rd|th)?\\b`, 'i');

      const dmMatch = clean.match(dayMonthRegex);
      const mdMatch = clean.match(monthDayRegex);

      const dayStr = dmMatch ? dmMatch[1] : (mdMatch ? mdMatch[1] : null);
      if (dayStr) {
        const day = parseInt(dayStr, 10);
        if (day >= 1 && day <= 31) {
          const iso = `${currentYear}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return { dueDate: iso, confidence: 0.94 };
        }
      }
    }

    // 3. Fallback "due on 25th"
    const dayOnlyMatch = clean.match(/(?:due\s+(?:on|by)|देय)\s+([0-3]?[0-9])(?:st|nd|rd|th)?\b/i);
    if (dayOnlyMatch) {
      const day = parseInt(dayOnlyMatch[1], 10);
      if (day >= 1 && day <= 31) {
        let month = today.getMonth() + 1;
        let year = currentYear;
        if (day < today.getDate()) {
          month += 1;
          if (month > 12) {
            month = 1;
            year += 1;
          }
        }
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { dueDate: iso, confidence: 0.70 };
      }
    }

    return { dueDate: null, confidence: 0.20 };
  }

  /**
   * Stage 5: Loan Account / Reference Identifier
   */
  public detectLoanIdentifier(text: string): string | null {
    const match = text.match(/(?:a\/c|acc|loan|ref|ending|no\.?|xx+)\s*(?:no\.?|id|:)?\s*([xX0-9]{4,16})/i);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
    return null;
  }

  /**
   * Stage 6: Message Classification
   */
  public classifyMessageType(text: string): { messageType: string; isLoanRelated: boolean } {
    const norm = text.toLowerCase();
    const rules = this.rules.classification_rules;

    for (const [type, cfg] of Object.entries(rules)) {
      for (const kw of cfg.keywords) {
        if (norm.includes(kw.toLowerCase())) {
          return { messageType: type, isLoanRelated: true };
        }
      }
    }

    // Default heuristics
    if (/(emi|loan|repay|disburs|किस्त|ऋण)/i.test(norm)) {
      return { messageType: 'emi_reminder', isLoanRelated: true };
    }

    return { messageType: 'not_loan_related', isLoanRelated: false };
  }

  /**
   * Stage 7: Detect Outstanding Balance / Principal
   */
  public detectOutstanding(text: string): number | null {
    const clean = this.normalizeIndicDigits(text);
    const patterns = [
      /(?:outstanding(?:\s+principal)?|principal(?:\s+amount)?|total\s+bal(?:ance)?|out\s+bal)\s*(?:is|:)?\s*(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+)/i,
      /(?:bal|balance)\s*(?:is|:)?\s*(?:₹|rs\.?|inr)\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+)/i
    ];

    for (const pat of patterns) {
      const match = clean.match(pat);
      if (match && match[1]) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return null;
  }

  /**
   * Stage 8: Detect Salary / Income credit
   */
  public detectSalary(text: string): number | null {
    const clean = this.normalizeIndicDigits(text);
    if (!/(salary|sal\s+credit|stipend|payroll)/i.test(clean)) return null;

    const match = clean.match(/(?:salary|sal|payroll)\s*(?:of)?\s*(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+)/i);
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val >= 5000) return val;
    }
    return null;
  }

  /**
   * Stage 9: Detailed Debt Category classification
   */
  public detectCategory(text: string, lender: string | null): DebtCategory {
    const lower = text.toLowerCase();
    const lName = (lender || '').toLowerCase();

    if (this.detectSalary(text) !== null || (/salary/i.test(lower) && /credit/i.test(lower))) {
      return 'salary';
    }

    if (
      /bnpl|pay\s*later|paylater/i.test(lower) ||
      ['lazypay', 'simpl', 'slice', 'zestmoney'].includes(lName)
    ) {
      return 'bnpl';
    }

    if (/credit\s*card|card\s*ending|card\s*a\/c|min\s*due|total\s*amt\s*due|credit\s*limit/i.test(lower)) {
      return 'credit_card';
    }

    if (/personal\s*loan|pl\s*loan/i.test(lower)) {
      return 'personal_loan';
    }

    if (/home\s*loan|housing\s*loan|hl\s*loan/i.test(lower)) {
      return 'home_loan';
    }

    if (/(emi|installment|loan)/i.test(lower)) {
      return 'loan_emi';
    }

    return 'other_debt';
  }

  /**
   * Master Pipeline: Parses a message on-device and generates structured fields + per-field confidence.
   * Derived overall confidence is the conservative minimum of fields (§4.1).
   */
  public parseMessage(rawText: string, sender?: string): StructuredLoanPayload {
    const lenderResult = this.identifyLender(sender, rawText);
    const amountResult = this.detectAmount(rawText);
    const dateResult = this.detectDueDate(rawText);
    const classification = this.classifyMessageType(rawText);
    const loanIdentifier = this.detectLoanIdentifier(rawText);
    const outstanding = this.detectOutstanding(rawText);
    const salaryAmount = this.detectSalary(rawText);
    const category = this.detectCategory(rawText, lenderResult.lender);

    // Conservative confidence strategy: Minimum-of-fields (§4.1)
    const minConfidence = Math.min(
      lenderResult.confidence,
      amountResult.confidence,
      dateResult.confidence
    );

    const confidence: FieldConfidence = {
      lender: lenderResult.confidence,
      emi: amountResult.confidence,
      due_date: dateResult.confidence,
      overall: parseFloat(minConfidence.toFixed(2))
    };

    const isFinancialOrLoan = classification.isLoanRelated || category !== 'other_debt' || salaryAmount !== null;

    return {
      lender: lenderResult.lender || (category === 'bnpl' ? 'BNPL Provider' : null),
      emi: amountResult.amount,
      due_date: dateResult.dueDate,
      message_type: classification.messageType,
      category,
      outstanding,
      salary_amount: salaryAmount,
      loan_identifier: loanIdentifier,
      confidence,
      local_message_ref: this.generateLocalRef(),
      is_loan_related: isFinancialOrLoan
    };
  }
}

export const onDeviceParser = new OnDeviceParser();
