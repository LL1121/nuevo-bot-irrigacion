const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL_TURNADO = 'https://irrigacionmalargue.com/login_g/turno.php';
const TURNADO_API_DEBUG = process.env.TURNADO_API_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

function debugLog(message, data) {
  if (!TURNADO_API_DEBUG) return;
  if (typeof data === 'undefined') {
    console.log(`[TURNADO_API] ${message}`);
    return;
  }
  console.log(`[TURNADO_API] ${message}`, data);
}

async function obtenerDetalleTurnoCompleto(ccpp) {
  debugLog('Iniciando búsqueda de turno por CCPP', { ccpp });

  if (!ccpp) {
    return {
      success: false,
      error: 'CCPP no proporcionado',
      userMessage: '⚠️ Padrón inválido. Por favor ingresá el servicio en formato CC-PP (Ej: 8234-1).'
    };
  }

  const agent = new (require('http').Agent)({ keepAlive: true });
  const httpsAgent = new (require('https').Agent)({ keepAlive: true });

  try {
    debugLog('Paso 1: POST con buscar_ccpp', { ccpp });

    // Paso 1: POST para obtener el ID de hijuela
    const step1Response = await axios.post(
      BASE_URL_TURNADO,
      {
        buscar_ccpp: ccpp
      },
      {
        httpAgent: agent,
        httpsAgent: httpsAgent,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 25000,
        maxRedirects: 5
      }
    );

    const html1 = step1Response.data;
    debugLog('Paso 1 completado, parseando HTML para extraer idhijuela');

    // Parsear HTML con Cheerio para extraer idhijuela
    const $ = cheerio.load(html1);
    const hiddenInputs = $('input[type="hidden"]');
    let idhijuela = null;

    for (let i = 0; i < hiddenInputs.length; i++) {
      const input = hiddenInputs.eq(i);
      const name = input.attr('name');
      const value = input.attr('value');

      if (name && name.toLowerCase().includes('hij')) {
        idhijuela = value;
        break;
      }
    }

    // Alternativa: buscar en cualquier input con nombre que contenga "id"
    if (!idhijuela) {
      for (let i = 0; i < hiddenInputs.length; i++) {
        const input = hiddenInputs.eq(i);
        const name = input.attr('name');
        if (name === 'idhijselecionada' || name === 'id_hij') {
          idhijuela = input.attr('value');
          if (idhijuela) break;
        }
      }
    }

    // Si aún no tenemos idhijuela, intentar buscar en todos los inputs visibles
    if (!idhijuela) {
      const allInputs = $('input');
      for (let i = 0; i < allInputs.length; i++) {
        const input = allInputs.eq(i);
        const name = input.attr('name');
        const value = input.attr('value');
        if (name && /hij|id/.test(name.toLowerCase()) && value) {
          idhijuela = value;
          break;
        }
      }
    }

    if (!idhijuela) {
      debugLog('Error: idhijuela no encontrado en respuesta');
      return {
        success: false,
        error: 'No se encontró hijuela para este CCPP',
        userMessage: '✅ No se encontró turno para ese padrón. Verificá el número de servicio.'
      };
    }

    debugLog('idhijuela extraído', { idhijuela });

    // Paso 2: POST con idhijuela para obtener detalle del turno
    debugLog('Paso 2: POST con idhijselecionada', { idhijuela });

    const step2Response = await axios.post(
      BASE_URL_TURNADO,
      {
        idhijselecionada: idhijuela
      },
      {
        httpAgent: agent,
        httpsAgent: httpsAgent,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 25000,
        maxRedirects: 5
      }
    );

    const html2 = step2Response.data;
    debugLog('Paso 2 completado, parseando HTML de turno detallado');

    // Paso 3: Parsing detallado del HTML
    const $h = cheerio.load(html2);

    // Estado: buscar .celda_restrinjida
    const restringido = $h('.celda_restrinjida').length > 0;
    let estado = restringido ? 'RESTRINGIDO' : 'DISPONIBLE';
    debugLog('Estado extraído', { estado });

    // Hijuela: .planilla_grid_hijuela_turno
    let hijuela = 'No disponible';
    const hijuelaElement = $h('.planilla_grid_hijuela_turno').first();
    if (hijuelaElement.length > 0) {
      hijuela = hijuelaElement.text().trim();
    }
    debugLog('Hijuela extraído', { hijuela });

    // CCPP
    let ccppExtracted = ccpp;

    // Tomeros: buscar en .planilla_grid_tom1_turno
    let tomeros = {
      amaya: { nombre: 'No disponible', telefono: 'No disponible' },
      contreras: { nombre: 'No disponible', telefono: 'No disponible' }
    };

    const tomerosElement = $h('.planilla_grid_tom1_turno');
    if (tomerosElement.length > 0) {
      const tomerosText = tomerosElement.text();
      const allText = $h('.planilla_grid_tom1_turno, .planilla_grid_tom2_turno').text();

      // Buscar patrones de nombres y teléfonos
      const lines = allText.split(/\n/).map(l => l.trim()).filter(l => l);

      // Simple heuristic: buscar nombres y números de teléfono
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toUpperCase();

        if (line.includes('AMAYA')) {
          tomeros.amaya.nombre = lines[i];
          if (i + 1 < lines.length && /^\d/.test(lines[i + 1])) {
            tomeros.amaya.telefono = lines[i + 1];
          }
        }

        if (line.includes('CONTRERAS')) {
          tomeros.contreras.nombre = lines[i];
          if (i + 1 < lines.length && /^\d/.test(lines[i + 1])) {
            tomeros.contreras.telefono = lines[i + 1];
          }
        }
      }
    }

    debugLog('Tomeros extraídos', tomeros);

    // Horarios: fecha y hora exacta de inicio
    let fechaInicio = 'No disponible';
    let horaInicio = 'No disponible';
    let fechaFin = 'No disponible';
    let horaFin = 'No disponible';

    // Buscar patrones de fecha/hora en el HTML
    const dateTimePattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})/g;
    const allText = $h('body').text();
    const matches = allText.matchAll(dateTimePattern);

    let matchCount = 0;
    for (const match of matches) {
      if (matchCount === 0) {
        fechaInicio = match[1];
        horaInicio = match[2];
      } else if (matchCount === 1) {
        fechaFin = match[1];
        horaFin = match[2];
      }
      matchCount++;
    }

    debugLog('Horarios extraídos', {
      fechaInicio,
      horaInicio,
      fechaFin,
      horaFin
    });

    // Titular: buscar en elementos comunes
    let titular = 'No disponible';
    const titularPatterns = ['.titular_turno', '.nombre_titular', '[data-titular]'];
    for (const selector of titularPatterns) {
      const element = $h(selector).first();
      if (element.length > 0) {
        titular = element.text().trim();
        if (titular) break;
      }
    }

    const resultado = {
      success: true,
      data: {
        titular,
        hijuela,
        ccpp: ccppExtracted,
        estado,
        fechaInicio,
        horaInicio,
        fechaFin,
        horaFin,
        telAmaya: tomeros.amaya.telefono,
        telContreras: tomeros.contreras.telefono
      },
      source: 'api-direct'
    };

    debugLog('Turno extraído correctamente', resultado.data);
    return resultado;
  } catch (error) {
    debugLog('Error en obtenerDetalleTurnoCompleto', {
      message: error.message,
      status: error?.response?.status
    });

    return {
      success: false,
      error: error.message || 'Error consultando turno por API',
      userMessage: '❌ No se pudo consultar el turno en este momento. Intentá nuevamente más tarde.'
    };
  }
}

module.exports = {
  obtenerDetalleTurnoCompleto
};
