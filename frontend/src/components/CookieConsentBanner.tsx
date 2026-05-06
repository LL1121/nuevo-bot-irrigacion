/**
 * Cookie Consent Banner Component
 * GDPR & CCPA compliant cookie consent management
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getSavedConsent,
  saveConsent,
  acceptAllCookies,
  rejectNonEssentialCookies,
  logConsentChoice,
  type CookieConsent,
} from '@/utils/legal';

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const saved = getSavedConsent();
    setConsent(saved);
    setShowBanner(!saved);
  }, []);

  const handleAcceptAll = () => {
    const newConsent = acceptAllCookies();
    setConsent(newConsent);
    logConsentChoice(newConsent);
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    const newConsent = rejectNonEssentialCookies();
    setConsent(newConsent);
    logConsentChoice(newConsent);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    if (consent) {
      saveConsent(consent);
      logConsentChoice(consent);
      setShowBanner(false);
    }
  };

  const handleToggleCategory = (category: keyof Omit<CookieConsent, 'timestamp' | 'version'>) => {
    if (consent && category !== 'essential') {
      setConsent({
        ...consent,
        [category]: !consent[category],
      });
    }
  };

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-background to-background/95 border-t border-border"
      role="region"
      aria-label="Cookie consent"
    >
      <div className="max-w-6xl mx-auto">
        {!showDetails ? (
          // Compact banner
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">Preferencias de Cookies</h2>
              <p className="text-sm text-muted-foreground">
                Utilizamos cookies para mejorar tu experiencia. Puedes aceptar todas o personalizar tus preferencias.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setShowDetails(true)}
                className="w-full sm:w-auto"
                aria-label="Personalizar preferencias de cookies"
              >
                Personalizar
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectAll}
                className="w-full sm:w-auto"
                aria-label="Rechazar cookies no esenciales"
              >
                Rechazar Todo
              </Button>
              <Button
                onClick={handleAcceptAll}
                className="w-full sm:w-auto"
                aria-label="Aceptar todas las cookies"
              >
                Aceptar Todo
              </Button>
            </div>
          </div>
        ) : (
          // Detailed preferences
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Preferencias de Cookies</CardTitle>
              <CardDescription>
                Personaliza qué tipo de cookies permites que usemos.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Essential */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="essential"
                  checked={true}
                  disabled
                  aria-label="Cookies esenciales (siempre activo)"
                />
                <div className="flex-1">
                  <label
                    htmlFor="essential"
                    className="font-medium cursor-pointer"
                  >
                    Cookies Esenciales
                  </label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Requeridas para el funcionamiento básico del sitio. No se pueden desactivar.
                  </p>
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="analytics"
                  checked={consent?.analytics || false}
                  onCheckedChange={() => handleToggleCategory('analytics')}
                  aria-label="Permitir cookies de análisis"
                />
                <div className="flex-1">
                  <label
                    htmlFor="analytics"
                    className="font-medium cursor-pointer"
                  >
                    Cookies de Análisis
                  </label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nos ayudan a entender cómo usas el sitio para mejorarlo.
                    (Google Analytics, Sentry)
                  </p>
                </div>
              </div>

              {/* Marketing */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="marketing"
                  checked={consent?.marketing || false}
                  onCheckedChange={() => handleToggleCategory('marketing')}
                  aria-label="Permitir cookies de marketing"
                />
                <div className="flex-1">
                  <label
                    htmlFor="marketing"
                    className="font-medium cursor-pointer"
                  >
                    Cookies de Marketing
                  </label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Utilizadas para mostrar anuncios relevantes y rastrear su efectividad.
                  </p>
                </div>
              </div>

              {/* Preferences */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="preferences"
                  checked={consent?.preferences || false}
                  onCheckedChange={() => handleToggleCategory('preferences')}
                  aria-label="Permitir cookies de preferencias"
                />
                <div className="flex-1">
                  <label
                    htmlFor="preferences"
                    className="font-medium cursor-pointer"
                  >
                    Cookies de Preferencias
                  </label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Guardan tus preferencias y configuraciones.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowDetails(false)}
                  className="flex-1"
                >
                  Volver
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRejectAll}
                  className="flex-1"
                >
                  Rechazar Todo
                </Button>
                <Button
                  onClick={handleSavePreferences}
                  className="flex-1"
                >
                  Guardar Preferencias
                </Button>
              </div>

              {/* Info */}
              <p className="text-xs text-muted-foreground text-center">
                Lee nuestra{' '}
                <a href="/privacy" className="underline hover:text-foreground">
                  Política de Privacidad
                </a>{' '}
                para más información.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
