# Legal & Compliance Documentation

## Overview

Complete legal framework for the Bot Irrigación application with GDPR/CCPA compliance, cookie consent management, and privacy/terms policies.

## Components & Utilities

### 1. Cookie Consent Management (`utils/legal.ts`)

Comprehensive cookie consent system with localStorage persistence.

#### Types

```typescript
type CookieCategory = 'essential' | 'analytics' | 'marketing' | 'preferences';

interface CookieConsent {
  essential: boolean;    // Always true (required)
  analytics: boolean;    // Google Analytics, Sentry
  marketing: boolean;    // Tracking pixels
  preferences: boolean;  // User preferences
  timestamp: number;     // When consent was given
  version: string;       // Consent form version
}
```

#### Key Functions

**Getting & Saving Consent**
```typescript
// Get saved consent or null
const consent = getSavedConsent();

// Save consent to localStorage
saveConsent(consent);

// Accept all cookies
const consent = acceptAllCookies();

// Reject non-essential (only essential remains)
const consent = rejectNonEssentialCookies();
```

**Checking Permissions**
```typescript
// Check if category is allowed
if (isCategoryAllowed('analytics')) {
  // Initialize analytics
}

// Enable specific category
enableAnalytics();
```

**Tracking & Analytics**
```typescript
// Log consent choice to Google Analytics
logConsentChoice(consent);

// Get Google Analytics tag respecting consent
const gaTag = getGoogleAnalyticsTag('GA-MEASUREMENT-ID');
```

### 2. GDPR Compliance (`utils/legal.ts`)

Full GDPR compliance utilities for data rights.

#### GDPR Rights Implementation

```typescript
interface GDPRStatus {
  consentGiven: boolean;
  hasDataProcessing: boolean;
  dataRetentionDays: number;
  userCanDelete: boolean;
  userCanExport: boolean;
}

// Get GDPR compliance status
const status = getGDPRStatus();
```

#### Right to Access (Data Export)

```typescript
// Request data export (30 days to deliver)
const result = await requestDataExport('user@example.com');
// {
//   success: true,
//   message: 'Solicitud de exportación enviada. Recibirás un email con tus datos en 24-48 horas.'
// }
```

### 3. Privacy Policy Versioning

Version management for privacy policies with user acceptance tracking.

```typescript
// Get latest privacy policy version
const version = getLatestPrivacyPolicyVersion();
// {
//   version: '1.0',
//   effectiveDate: Date,
//   lastUpdated: Date,
//   changes: ['Initial privacy policy']
// }

// Save user acceptance
saveUserAcceptedPolicyVersion('1.0');

// Check if user accepted latest
if (hasUserAcceptedLatestPolicy()) {
  // User has latest version
}

// Get accepted version
const accepted = getUserAcceptedPolicyVersion(); // '1.0' or null
```

### 4. Terms of Service Versioning

Similar to privacy policy with version control.

```typescript
// Get latest terms version
const version = getLatestTermsVersion();

// Save user acceptance
saveUserAcceptedTermsVersion('1.0');

// Check if accepted
if (hasUserAcceptedLatestTerms()) {
  // User has accepted latest
}
```

## Components

### CookieConsentBanner Component

Sticky banner for cookie consent with two modes: compact and detailed.

#### Usage

```tsx
import { CookieConsentBanner } from '@/components/CookieConsentBanner';

export function App() {
  return (
    <>
      {/* Your app content */}
      <CookieConsentBanner />
    </>
  );
}
```

#### Features

- **Compact View**: Shows brief message with Personalize, Reject All, Accept All buttons
- **Detailed View**: Full preference selection with descriptions for each category
- **Accessibility**: ARIA labels, keyboard navigation, semantic HTML
- **Persistence**: Shows only once until user makes choice
- **Analytics Integration**: Logs choices to Google Analytics

#### Customization

The banner respects user preferences:
- Essential cookies: Always active, cannot be disabled
- Analytics: For Google Analytics, Sentry integration
- Marketing: For tracking pixels and ad systems
- Preferences: For storing user settings

### TermsOfServicePage Component

Full-page terms of service with 8 main sections.

#### Usage

```tsx
import { TermsOfServicePage } from '@/components/TermsOfService';

// Add route
<Route path="/terms" element={<TermsOfServicePage />} />
```

#### Sections

1. **Uso Aceptable** - Prohibited behaviors
2. **Restricciones de Uso** - Content restrictions
3. **Propiedad Intelectual** - Ownership and licensing
4. **Limitación de Responsabilidad** - Liability limitations
5. **Modificaciones del Servicio** - Service change policy
6. **Terminación** - Account termination conditions
7. **Ley Aplicable** - Governing law (Argentina)
8. **Contacto** - Contact information

#### TermsDialog Component

Modal for first-time acceptance:

```tsx
import { TermsDialog } from '@/components/TermsOfService';

<TermsDialog
  open={true}
  onClose={() => {}}
  onAccept={() => console.log('Terms accepted')}
/>
```

### PrivacyPolicyPage Component

Full-page privacy policy with GDPR compliance.

#### Usage

```tsx
import { PrivacyPolicyPage } from '@/components/PrivacyPolicy';

// Add route
<Route path="/privacy" element={<PrivacyPolicyPage />} />
```

#### Sections

1. **Información que Recopilamos** - Data collection types
2. **Cómo Usamos Tu Información** - Data usage purposes
3. **Compartir Información** - Third-party sharing policies
4. **Tus Derechos GDPR** - User rights (Access, Rectification, Deletion, Restriction, Portability, Objection)
5. **Seguridad** - Security measures
6. **Retención de Datos** - How long data is kept
7. **Cookies** - Cookie usage explanation
8. **Cambios en Esta Política** - Update notification policy
9. **Contacto** - DPO and contact info

#### PrivacyDialog Component

Modal for first-time acceptance:

```tsx
import { PrivacyDialog } from '@/components/PrivacyPolicy';

<PrivacyDialog
  open={true}
  onClose={() => {}}
  onAccept={() => console.log('Privacy accepted')}
/>
```

## Complete Integration Example

### App Setup with All Legal Components

```tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { TermsDialog } from '@/components/TermsOfService';
import { PrivacyDialog } from '@/components/PrivacyPolicy';
import {
  hasUserAcceptedLatestTerms,
  hasUserAcceptedLatestPolicy,
} from '@/utils/legal';

export function App() {
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check on first visit
    if (!hasUserAcceptedLatestTerms() && location.pathname === '/') {
      setShowTerms(true);
    }
  }, []);

  return (
    <>
      {/* Main app */}
      <main>
        {/* Routes */}
      </main>

      {/* Legal modals - only on first visit */}
      {showTerms && (
        <TermsDialog
          open={true}
          onClose={() => setShowTerms(false)}
          onAccept={() => {
            setShowTerms(false);
            if (!hasUserAcceptedLatestPolicy()) {
              setShowPrivacy(true);
            }
          }}
        />
      )}

      {showPrivacy && (
        <PrivacyDialog
          open={true}
          onClose={() => setShowPrivacy(false)}
          onAccept={() => setShowPrivacy(false)}
        />
      )}

      {/* Cookie consent (always shown until accepted) */}
      <CookieConsentBanner />
    </>
  );
}
```

### Footer Links

```tsx
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-muted py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row gap-4 text-sm">
          <Link to="/terms" className="hover:underline">
            Términos de Servicio
          </Link>
          <Link to="/privacy" className="hover:underline">
            Política de Privacidad
          </Link>
          <a href="mailto:legal@bot-irrigacion.com" className="hover:underline">
            Contacto Legal
          </a>
        </div>
      </div>
    </footer>
  );
}
```

## Data Retention Policies

### Default Retention Periods

- **User Accounts**: While active, plus 30-day grace period after deletion request
- **Access Logs**: 90 days
- **Consent Records**: As long as needed for legal compliance
- **Deleted Account Data**: 30 days before permanent deletion

## Compliance Checklist

✅ **GDPR Compliance**
- Consent collection before processing
- Privacy policy explaining data use
- Terms of service clearly stating restrictions
- Right to access (data export)
- Right to rectification (profile editing)
- Data retention policies
- DPO contact information

✅ **CCPA Compliance (California)**
- Opt-out mechanisms
- Data collection disclosure
- Right to deletion
- Right to access
- Limitation on data sharing

✅ **Cookie Compliance**
- Pre-consent for non-essential cookies
- Clear cookie categories
- Easy opt-out mechanism
- Version tracking for cookie policies

✅ **Accessibility**
- ARIA labels and roles
- Keyboard navigation
- Semantic HTML
- High contrast text
- Clear language

## Testing

All components and utilities are tested with:
- 40+ legal utility tests
- Component render tests
- GDPR functionality tests
- Accessibility tests
- LocalStorage persistence tests

Run tests:
```bash
npm run test -- src/utils/legal.test.ts
npm run test -- src/components/legal.test.tsx
```

## API Endpoints Required (Backend)

```typescript
// GDPR Data Export
POST /api/gdpr/export
{
  email: string
}
// Response: 200 OK, sends email with data
```

## Best Practices

### 1. Always Request Consent First

```typescript
// Before initializing analytics
if (isCategoryAllowed('analytics')) {
  initializeAnalytics();
}
```

### 2. Track Consent Choices

```typescript
const consent = acceptAllCookies();
logConsentChoice(consent); // To Google Analytics
```

### 3. Update Policies When Needed

```typescript
// In legal.ts, when policies change:
const privacyPolicyVersions = [
  { version: '1.0', ... },
  { version: '1.1', ..., changes: ['Added GDPR clause'] },
];
```

### 4. Make Legal Pages Accessible

- Use semantic HTML
- Include skip to content links
- Ensure sufficient color contrast
- Support keyboard navigation
- Provide print-friendly layouts

## Troubleshooting

### Cookie Consent Not Persisting

Check localStorage permissions:
```typescript
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch (e) {
  console.error('localStorage not available');
}
```

### GDPR Requests Failing

Ensure backend endpoint is configured:
- POST `/api/gdpr/export`

### Version Mismatches

Clear localStorage to force re-acceptance:
```typescript
localStorage.clear();
```

## Resources

- [GDPR Official Documentation](https://gdpr.eu/)
- [CCPA Guidelines](https://oag.ca.gov/privacy/ccpa)
- [Cookie Law Compliance](https://www.cookielaw.org/)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/)

## Support

For legal questions:
- Email: legal@bot-irrigacion.com
- DPO: dpo@bot-irrigacion.com
