/**
 * Terms of Service Page
 * Comprehensive legal agreement
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface TermsDialogProps {
  open?: boolean;
  onClose?: () => void;
  onAccept?: () => void;
}

export function TermsDialog({ open = true, onClose, onAccept }: TermsDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const latestVersion = getLatestTermsVersion();

  const handleAccept = () => {
    saveUserAcceptedTermsVersion(latestVersion.version);
    setAccepted(true);
    onAccept?.();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="max-h-screen max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Términos de Servicio</DialogTitle>
          <DialogDescription>
            Por favor, lee y acepta nuestros términos de servicio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <TermsContent />

          <div className="flex items-start gap-3 pt-4 border-t">
            <Checkbox
              id="accept-terms"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked as boolean)}
              aria-label="Acepto los términos de servicio"
            />
            <label
              htmlFor="accept-terms"
              className="text-sm font-medium cursor-pointer leading-relaxed"
            >
              Acepto los Términos de Servicio y entiendo que son vinculantes
            </label>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Rechazar
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!accepted}
              className="flex-1"
            >
              Aceptar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Full Terms of Service Page
 */
export function TermsOfServicePage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Términos de Servicio</h1>
          <p className="text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <TermsContent />
        </div>

        <div className="mt-12 flex gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Button onClick={() => navigate('/privacy')}>
            Leer Política de Privacidad
          </Button>
        </div>
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <>
      <section>
        <h2 className="text-2xl font-bold mb-4">1. Uso Aceptable</h2>
        <p className="text-muted-foreground mb-3">
          Aceptas usar este servicio solo para propósitos legales y de acuerdo con estos términos.
          No puedes:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Usar el servicio de manera que viole leyes aplicables</li>
          <li>Harass, amenazar o abusar de otros usuarios</li>
          <li>Intentar acceder a sistemas sin autorización</li>
          <li>Compartir contenido que infrinja derechos de terceros</li>
          <li>Transmitir malware o código malicioso</li>
          <li>Realizar scraping o minería de datos sin consentimiento</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">2. Restricciones de Uso</h2>
        <p className="text-muted-foreground mb-3">
          No debes reproducir, distribuir, transmitir, mostrar, realizar o publicar ningún
          contenido del servicio sin nuestra autorización previa por escrito, excepto donde
          esté permitido por ley.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">3. Propiedad Intelectual</h2>
        <p className="text-muted-foreground mb-3">
          Todo contenido, características y funcionalidad (incluyendo pero no limitado a diseño,
          texto, gráficos, logos, imágenes, videos y software) es propiedad de Bot Irrigación,
          sus licenciantes u otros proveedores de contenido.
        </p>
        <p className="text-muted-foreground">
          Tu licencia se limita a un uso personal, no comercial y no transferible.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">4. Limitación de Responsabilidad</h2>
        <p className="text-muted-foreground mb-3">
          EN LA MEDIDA PERMITIDA POR LA LEY, BAJO NINGUNA CIRCUNSTANCIA BOT IRRIGACIÓN SERÁ
          RESPONSABLE POR:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Daños indirectos, incidentales, especiales o consecuentes</li>
          <li>Pérdida de datos, ganancias o ingresos</li>
          <li>Interrupción del servicio</li>
          <li>Daños causados por malware o accesos no autorizados</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">5. Modificaciones del Servicio</h2>
        <p className="text-muted-foreground">
          Nos reservamos el derecho de modificar o interrumpir el servicio (o cualquier parte)
          de manera temporal o permanente con o sin notificación previa. No seremos responsables
          ante ti ni ante terceros por modificaciones o interrupciones.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">6. Terminación</h2>
        <p className="text-muted-foreground mb-3">
          Podemos terminar o suspender tu cuenta de inmediato, sin previo aviso o responsabilidad,
          si:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Incumples cualquier disposición de estos términos</li>
          <li>Usas el servicio de manera que viole la ley</li>
          <li>Representas una amenaza para otros usuarios</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">7. Ley Aplicable</h2>
        <p className="text-muted-foreground">
          Estos términos se rigen por las leyes de Argentina, sin importar conflictos de
          disposiciones legales. Cualquier disputa se resolverá en los tribunales de Argentina.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">8. Contacto</h2>
        <p className="text-muted-foreground">
          Si tienes preguntas sobre estos términos, contacta: legal@bot-irrigacion.com
        </p>
      </section>
    </>
  );
}
