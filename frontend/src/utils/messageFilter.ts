// On-Device Local Pre-Filter per Section 5.2
// Ensures only loan/EMI-related messages ever leave the device to protect user privacy.

const LENDER_SENDER_PATTERNS = [
  'LAZYPY', 'LAZYPAY', 'LZPAY',
  'KRDTBI', 'KRDBEE', 'KREDTB', 'KREDITBEE',
  'NAVITM', 'NAVIFN', 'NAVI', 'NAVILN',
  'SIMPL', 'GETSMP', 'SMPL',
  'SLICEC', 'SLICE', 'SLICEN',
  'CASHE', 'CSHEIN',
  'MNYTAP', 'MONEYTAP',
  'RINGAP', 'RINGLN',
  'KISSHT', 'KSHTLN',
  'PAYSNS', 'PAYSENSE',
  'TRUEBL', 'TRUBLN',
  'FIBE', 'EARLYS',
  'BAJAJF', 'BAJAJ', 'BFINSV',
  'ZESTMN', 'ZEST',
  'MPOKKT', 'MPOKKET',
  'HMCRDT', 'HOMECR',
  'DHANIS', 'DHANIL',
  'PAYTM', 'AMZPAY', 'FLPKRT'
];

const FINANCIAL_KEYWORDS = [
  'emi',
  'loan',
  'repayment',
  'due date',
  'due on',
  'due amount',
  'auto-debit',
  'auto debit',
  'installment',
  'sanctioned',
  'disbursed',
  'repay',
  'overdue',
  'kist',
  'chukaen'
];

const EXCLUSION_PATTERNS = [
  /\botp\b/i,
  /verification code/i,
  /one time password/i,
  /food delivery/i,
  /cab booking/i,
  /swiggy/i,
  /zomato/i,
  /uber/i,
  /ola/i
];

export interface PreFilterResult {
  isLoanRelated: boolean;
  matchedKeywords: string[];
  sanitizedText: string;
}

export function runOnDevicePreFilter(sender: string | undefined, rawText: string): PreFilterResult {
  const normSender = (sender || '').toUpperCase().replace(/[-_]/g, '');
  const lowerText = rawText.toLowerCase();

  // Check exclusions first (e.g. OTP unless specifically an EMI auto-debit OTP)
  const isExcluded = EXCLUSION_PATTERNS.some(pat => pat.test(lowerText));
  const hasStrongEmiContext = lowerText.includes('emi') || lowerText.includes('loan repayment');
  
  if (isExcluded && !hasStrongEmiContext) {
    return {
      isLoanRelated: false,
      matchedKeywords: [],
      sanitizedText: '',
    };
  }

  const matchedKeywords: string[] = [];

  // 1. Sender pattern check
  const senderMatch = LENDER_SENDER_PATTERNS.some(pat => normSender.includes(pat));
  if (senderMatch) {
    matchedKeywords.push(`Sender: ${sender}`);
  }

  // 2. Financial keywords check
  for (const kw of FINANCIAL_KEYWORDS) {
    if (lowerText.includes(kw)) {
      matchedKeywords.push(kw);
    }
  }

  // Check currency mention
  const hasCurrency = /₹|rs\.?|inr/i.test(lowerText);

  // Decision rule:
  // Must match either (known sender + at least 1 keyword or amount)
  // OR (at least 2 strong loan keywords + currency)
  const isLoanRelated = (senderMatch && (matchedKeywords.length > 1 || hasCurrency)) ||
                        (matchedKeywords.length >= 2 && hasCurrency);

  // Sanitize: strip out personal phone numbers, links, private identifiers
  let sanitizedText = rawText;
  sanitizedText = sanitizedText.replace(/https?:\/\/\S+/gi, ''); // remove links

  return {
    isLoanRelated,
    matchedKeywords,
    sanitizedText: sanitizedText.trim(),
  };
}
