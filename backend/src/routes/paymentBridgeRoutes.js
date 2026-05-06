const express = require('express');
const axios = require('axios');

const router = express.Router();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.get('/pagar-boleto/:periodo/:numero', async (req, res) => {
  try {
    const periodo = Number(req.params.periodo);
    const numero = Number(req.params.numero);
    console.log('🧭 [EPAGOS] Iniciando bridge /pagar-boleto', { periodo, numero });

    const response = await axios.post(
      'https://www.irrigacion.gov.ar/boletoonline/epagos/boleto',
      {
        periodo,
        numero
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const payload = response?.data?.data || response?.data || {};
    const token = payload.token;
    const id_organismo = payload.id_organismo;
    const numero_operacion = payload.numero_operacion;
    const monto_operacion = payload.monto_operacion;
    const ok_url = payload.ok_url;
    const error_url = payload.error_url;

    if (!token || !id_organismo || !numero_operacion || !monto_operacion || !ok_url || !error_url) {
      throw new Error('Respuesta incompleta de ePagos: faltan campos obligatorios para redirección.');
    }

    console.log('✅ [EPAGOS] Token recibido para operación', {
      hasToken: Boolean(token),
      id_organismo,
      numero_operacion,
      monto_operacion
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redirigiendo a ePagos</title>
</head>
<body>
  <p>Redirigiendo a la pasarela de pago seguro...</p>

  <form id="epagos-form" action="https://post.epagos.net/response.php" method="POST">
    <input type="hidden" name="token" value="${escapeHtml(token)}" />
    <input type="hidden" name="id_organismo" value="${escapeHtml(id_organismo)}" />
    <input type="hidden" name="numero_operacion" value="${escapeHtml(numero_operacion)}" />
    <input type="hidden" name="monto_operacion" value="${escapeHtml(monto_operacion)}" />
    <input type="hidden" name="ok_url" value="${escapeHtml(ok_url)}" />
    <input type="hidden" name="error_url" value="${escapeHtml(error_url)}" />
    <noscript>
      <button type="submit">Continuar a pago seguro</button>
    </noscript>
  </form>

  <script>
    document.getElementById('epagos-form').submit();
  </script>
</body>
</html>`;

    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; form-action https://post.epagos.net; base-uri 'self'");
    res.type('html').send(html);
  } catch (error) {
    console.error('❌ [EPAGOS] Error en /pagar-boleto/:periodo/:numero:', {
      message: error.message,
      status: error?.response?.status,
      data: error?.response?.data
    });
    res.status(500).send('Error al generar la orden de pago. Por favor, intente nuevamente desde WhatsApp.');
  }
});

module.exports = router;
