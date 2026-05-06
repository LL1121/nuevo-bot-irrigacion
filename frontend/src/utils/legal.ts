/**
 * Legal & Compliance Utilities
 * GDPR, Cookies, Privacy & Terms Management
 */

/**
 * Cookie Categories for GDPR/CCPA compliance
 */
export type CookieCategory = 'essential' | 'analytics' | 'marketing' | 'preferences';

export interface CookieConsent {
  essential: boolean;  // Always true, required
  analytics: boolean;  // Google Analytics, Sentry
  marketing: boolean;  // Tracking pixels
  preferences: boolean; // User preferences
  timestamp: number;   // When consent was given
  version: string;     // Version of consent form
}

/**
 * Default cookie consent (only essential)
 */
export const defaultConsent: CookieConsent = {
  essential: true,
  analytics: false,
  marketing: false,
  preferences: false,
  timestamp: Date.now(),
  version: '1.0',
};

/**
 * Get saved consent from localStorage
 */
export function getSavedConsent(): CookieConsent | null {
  try {
    const saved = localStorage.getItem('cookie_consent');
    if (!saved) return null;
    
    const consent = JSON.parse(saved);
    // Validate consent structure
    if (typeof consent === 'object' && consent !== null) {
      return consent as CookieConsent;
    }
  } catch (error) {
    console.error('Error reading consent:', error);
  }
  return null;
}

/**
 * Save consent to localStorage
 */
export function saveConsent(consent: CookieConsent): void {
  try {
    localStorage.setItem('cookie_consent', JSON.stringify(consent));
    localStorage.setItem('consent_updated_at', new Date().toISOString());
  } catch (error) {
    console.error('Error saving consent:', error);
  }
}

/**
 * Accept all cookies
 */
export function acceptAllCookies(): CookieConsent {
  const consent: CookieConsent = {
    ...defaultConsent,
    analytics: true,
    marketing: true,
    preferences: true,
    timestamp: Date.now(),
  };
  saveConsent(consent);
  return consent;
}

/**
 * Reject non-essential cookies
 */
export function rejectNonEssentialCookies(): CookieConsent {
  const consent: CookieConsent = {
    ...defaultConsent,
    timestamp: Date.now(),
  };
  saveConsent(consent);
  return consent;
}

/**
 * Check if specific cookie category is allowed
 */
export function isCategoryAllowed(category: CookieCategory): boolean {
  const consent = getSavedConsent();
  if (!consent) {
    // No consent yet, only essential allowed
    return category === 'essential';
  }
  return consent[category] === true;
}

/**
 * Enable analytics cookies (for integrations like Sentry, Google Analytics)
 */
export function enableAnalytics(): void {
  const consent = getSavedConsent() || defaultConsent;
  consent.analytics = true;
  consent.timestamp = Date.now();
  saveConsent(consent);
}

/**
 * Get HTML for Google Analytics (respecting consent)
 */
export function getGoogleAnalyticsTag(measurementId: string): string {
  if (!isCategoryAllowed('analytics')) {
    return '';
  }
  
  return `
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'analytics_storage': 'granted',
    'ad_storage': 'granted'
  });
  gtag('js', new Date());
  gtag('config', '${measurementId}');
</script>
  `;
}

/**
 * Log consent choices to analytics
 */
export function logConsentChoice(consent: CookieConsent): void {
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof window !== 'undefined' && gtag) {
    gtag('event', 'consent_update', {
      analytics: consent.analytics,
      marketing: consent.marketing,
      preferences: consent.preferences,
      timestamp: new Date(consent.timestamp).toISOString(),
    });
  }
}

/**
 * GDPR compliance check
 */
export interface GDPRStatus {
  consentGiven: boolean;
  hasDataProcessing: boolean;
  dataRetentionDays: number;
  userCanDelete: boolean;
  userCanExport: boolean;
}

export function getGDPRStatus(): GDPRStatus {
  const consent = getSavedConsent();
  
  return {
    consentGiven: consent !== null,
    hasDataProcessing: consent?.analytics === true || consent?.marketing === true,
    dataRetentionDays: 30, // Configurable
    userCanDelete: true,  // Should implement delete endpoint
    userCanExport: true,  // Should implement export endpoint
  };
}

/**
 * Request data export (GDPR Right to Access)
 */
export async function requestDataExport(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/gdpr/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    
    if (response.ok) {
      return {
        success: true,
        message: 'Solicitud de exportación enviada. Recibirás un email con tus datos en 24-48 horas.',
      };
    }
    
    return {
      success: false,
      message: 'Error al procesar la solicitud',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error de conexión',
    };
  }
}



/**
 * Privacy policy version management
 */
export interface PrivacyPolicyVersion {
  version: string;
  effectiveDate: Date;
  lastUpdated: Date;
  changes: string[];
}

const privacyPolicyVersions: PrivacyPolicyVersion[] = [
  {
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastUpdated: new Date('2024-01-01'),
    changes: ['Initial privacy policy'],
  },
];

export function getLatestPrivacyPolicyVersion(): PrivacyPolicyVersion {
  return privacyPolicyVersions[privacyPolicyVersions.length - 1];
}

export function getUserAcceptedPolicyVersion(): string | null {
  try {
    return localStorage.getItem('privacy_policy_accepted_version');
  } catch {
    return null;
  }
}

export function saveUserAcceptedPolicyVersion(version: string): void {
  try {
    localStorage.setItem('privacy_policy_accepted_version', version);
    localStorage.setItem('privacy_policy_accepted_at', new Date().toISOString());
  } catch (error) {
    console.error('Error saving policy acceptance:', error);
  }
}

export function hasUserAcceptedLatestPolicy(): boolean {
  const accepted = getUserAcceptedPolicyVersion();
  const latest = getLatestPrivacyPolicyVersion();
  return accepted === latest.version;
}

/**
 * Terms of Service version management
 */
export interface TermsOfServiceVersion {
  version: string;
  effectiveDate: Date;
  lastUpdated: Date;
  changes: string[];
}

const termsVersions: TermsOfServiceVersion[] = [
  {
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastUpdated: new Date('2024-01-01'),
    changes: ['Initial terms of service'],
  },
];

export function getLatestTermsVersion(): TermsOfServiceVersion {
  return termsVersions[termsVersions.length - 1];
}

export function getUserAcceptedTermsVersion(): string | null {
  try {
    return localStorage.getItem('terms_accepted_version');
  } catch {
    return null;
  }
}

export function saveUserAcceptedTermsVersion(version: string): void {
  try {
    localStorage.setItem('terms_accepted_version', version);
    localStorage.setItem('terms_accepted_at', new Date().toISOString());
  } catch (error) {
    console.error('Error saving terms acceptance:', error);
  }
}

export function hasUserAcceptedLatestTerms(): boolean {
  const accepted = getUserAcceptedTermsVersion();
  const latest = getLatestTermsVersion();
  return accepted === latest.version;
}
