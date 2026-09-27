/**
 * Language & Script inspection helper for UI review screens (§3.5)
 */

export interface ScriptInfo {
  code: string;
  name: string;
  nativeName: string;
  badgeColor: string;
}

export function detectScriptAndLanguage(text: string, serverLangCode?: string): ScriptInfo {
  if (serverLangCode) {
    switch (serverLangCode.toLowerCase()) {
      case 'hi':
        return { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी (Devanagari)', badgeColor: '#EA580C' };
      case 'mr':
        return { code: 'mr', name: 'Marathi', nativeName: 'मराठी (Devanagari)', badgeColor: '#D97706' };
      case 'ta':
        return { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', badgeColor: '#059669' };
      case 'te':
        return { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', badgeColor: '#2563EB' };
      case 'bn':
        return { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', badgeColor: '#7C3AED' };
      case 'hinglish':
        return { code: 'hinglish', name: 'Hinglish', nativeName: 'Hinglish (Latin)', badgeColor: '#0891B2' };
      case 'en':
      default:
        return { code: 'en', name: 'English', nativeName: 'English (Latin)', badgeColor: '#4F46E5' };
    }
  }

  // Fallback client-side script inspection
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', badgeColor: '#059669' };
  }
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', badgeColor: '#2563EB' };
  }
  if (/[\u0980-\u09FF]/.test(text)) {
    return { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', badgeColor: '#7C3AED' };
  }
  if (/[\u0900-\u097F]/.test(text)) {
    if (/(आहे|करावे|हप्ता|दिनांक)/.test(text)) {
      return { code: 'mr', name: 'Marathi', nativeName: 'मराठी (Devanagari)', badgeColor: '#D97706' };
    }
    return { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी (Devanagari)', badgeColor: '#EA580C' };
  }

  return { code: 'en', name: 'English', nativeName: 'English (Latin)', badgeColor: '#4F46E5' };
}
