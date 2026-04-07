/**
 * Privacy Policy Page
 * Comprehensive data privacy and GDPR compliance
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  hasUserAcceptedLatestPolicy,
  getLatestPrivacyPolicyVersion,
  saveUserAcceptedPolicyVersion,
} from '@/utils/legal';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface PrivacyDialogProps {
  open?: boolean;
  onClose?: () => void;
  onAccept?: () => void;
}

export function PrivacyDialog({ open = true, onClose, onAccept }: PrivacyDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const latestVersion = getLatestPrivacyPolicyVersion();

  const handleAccept = () => {
    saveUserAcceptedPolicyVersion(latestVersion.version);
    setAccepted(true);
    onAccept?.();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="max-h-screen max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Política de Privacidad</DialogTitle>
          <DialogDescription>
            Por favor, lee y acepta nuestra política de privacidad
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <PrivacyContent />

          <div className="flex items-start gap-3 pt-4 border-t">
            <Checkbox
              id="accept-privacy"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked as boolean)}
              aria-label="Acepto la política de privacidad"
            />
            <label
              htmlFor="accept-privacy"
              className="text-sm font-medium cursor-pointer leading-relaxed"
            >
              Acepto la Política de Privacidad y autorizo el procesamiento de mis datos
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
 * Full Privacy Policy Page
 */
export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Política de Privacidad</h1>
          <p className="text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <PrivacyContent />
        </div>

        <div className="mt-12 flex gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Button onClick={() => navigate('/terms')}>
            Leer Términos de Servicio
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable Privacy Content
 */
function PrivacyContent() {
  return (
    <>
      <section>
        <h2 className="text-2xl font-bold mb-4">1. Información que Recopilamos</h2>
        <div className="space-y-3 text-muted-foreground">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Información de Registro</h3>
            <p>Nombre, email, contraseña y perfil de usuario</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Información de Uso</h3>
            <p>Acciones en el servicio, dispositivo, navegador e información de IP</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Información de Cookies</h3>
            <p>Identificadores de sesión, preferencias y datos de seguimiento</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">2. Cómo Usamos Tu Información</h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Proporcionar y mantener el servicio</li>
          <li>Mejorar y personalizar tu experiencia</li>
          <li>Comunicarnos contigo sobre actualizaciones y cambios</li>
          <li>Analizar patrones de uso para mejorar el servicio</li>
          <li>Detectar y prevenir fraude o abusos</li>
          <li>Cumplir con obligaciones legales</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">3. Compartir Información</h2>
        <p className="text-muted-foreground mb-3">
          No compartimos tu información personal con terceros, excepto:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Con proveedores de servicios que necesitan acceso (con acuerdos de confidencialidad)</li>
          <li>Cuando sea requerido por ley</li>
          <li>Para proteger nuestros derechos o seguridad</li>
          <li>Con tu consentimiento explícito</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">4. Tus Derechos GDPR</h2>
        <p className="text-muted-foreground mb-3">
          Si eres residente de la UE, tienes derecho a:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>
            <strong>Acceso:</strong> Obtener una copia de tus datos personales
          </li>
          <li>
            <strong>Rectificación:</strong> Corregir datos inexactos o incompletos
          </li>
          <li>
            <strong>Eliminación:</strong> Solicitar la eliminación de tus datos ("derecho al olvido")
          </li>
          <li>
            <strong>Restricción:</strong> Limitar el procesamiento de tus datos
          </li>
          <li>
            <strong>Portabilidad:</strong> Recibir tus datos en un formato estructurado
          </li>
          <li>
            <strong>Objeción:</strong> Oponerme al procesamiento de datos
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">5. Seguridad</h2>
        <p className="text-muted-foreground">
          Implementamos medidas técnicas y organizativas para proteger tu información:
          encriptación TLS/SSL, autenticación de dos factores, auditorías de seguridad regulares
          y almacenamiento seguro de contraseñas. Sin embargo, ningún sistema es 100% seguro.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">6. Retención de Datos</h2>
        <p className="text-muted-foreground mb-3">
          Retenemos tu información personal mientras sea necesario para proporcionarte el servicio:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Datos de cuenta: Mientras tu cuenta esté activa</li>
          <li>Registros de acceso: 90 días</li>
          <li>Datos después de eliminar cuenta: 30 días (período de gracia)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">7. Cookies</h2>
        <p className="text-muted-foreground mb-3">
          Usamos cookies y tecnologías similares para:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Mantener sesiones de usuario</li>
          <li>Recordar preferencias</li>
          <li>Analizar el uso del servicio</li>
          <li>Mejorar la seguridad</li>
        </ul>
        <p className="text-muted-foreground mt-3">
          Puedes controlar las cookies a través de tu navegador o nuestro panel de consentimiento.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">8. Cambios en Esta Política</h2>
        <p className="text-muted-foreground">
          Podemos actualizar esta política ocasionalmente. Los cambios significativos serán
          notificados por email o mediante un aviso destacado en el servicio.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">9. Contacto</h2>
        <div className="text-muted-foreground space-y-2">
          <p>
            Si tienes preguntas sobre esta política o tus datos personales:
          </p>
          <p>
            Email: <a href="mailto:privacy@bot-irrigacion.com" className="underline hover:text-foreground">
              privacy@bot-irrigacion.com
            </a>
          </p>
          <p>
            También puedes solicitar acceso, corrección o eliminación de datos completando
            un formulario de solicitud de acceso a información.
          </p>
        </div>
      </section>

      <section className="bg-muted p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Datos de Contacto del DPO</h3>
        <p className="text-muted-foreground text-sm">
          Oficial de Protección de Datos: dpo@bot-irrigacion.com
        </p>
      </section>
    </>
  );
}
