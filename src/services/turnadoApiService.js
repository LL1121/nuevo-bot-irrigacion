const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL_TURNADO = 'https://irrigacionmalargue.com/login_g/turno.php';
const TURNADO_API_DEBUG = process.env.TURNADO_API_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

function buildFormBody(payload) {
  const params = new URLSearchParams();
  Object.entries(payload || {}).forEach(([key, value]) => {
    params.append(key, String(value ?? ''));
  });
  return params.toString();
}

async function postTurnadoForm(payload, extraConfig = {}) {
  return axios.post(
    BASE_URL_TURNADO,
    buildFormBody(payload),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 25000,
      maxRedirects: 5,
      ...extraConfig
    }
  );
}

function debugLog(message, data) {
  if (!TURNADO_API_DEBUG) return;
  if (typeof data === 'undefined') {
    console.log(`[TURNADO_API] ${message}`);
    return;
  }
  console.log(`[TURNADO_API] ${message}`, data);
}

function normalizeCCPP(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function extractFirstText($, selectors = []) {
  for (const selector of selectors) {
    const value = $(selector).first().text().trim();
    if (value) return value;
  }
  return '';
}

function cleanInlineText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPayloadBusquedaTurnos(tipoBusqueda, valor) {
  const tipo = String(tipoBusqueda || '').trim().toLowerCase();
  const valorNormalizado = String(valor || '').trim();

  if (!valorNormalizado) {
    return {
      error: 'El valor de búsqueda es obligatorio.'
    };
  }

  if (tipo === 'ccpp') {
    return {
      payload: {
        buscar_ccpp: valorNormalizado,
        bccpp: 'Buscar'
      }
    };
  }

  if (tipo === 'titular') {
    return {
      payload: {
        buscar_titular: valorNormalizado,
        boton: 'Buscar',
        btitular: 'Buscar'
      }
    };
  }

  return {
    error: "Tipo de búsqueda inválido. Use 'ccpp' o 'titular'."
  };
}

function extraerOpcionesTurnosDesdeHtml(html) {
  const $ = cheerio.load(html || '');
  const resultados = [];

  $('.planillas_info-grid-selection-container form').each((_, form) => {
    const $form = $(form);

    const titularRaw = $form
      .find('.planilla_grid_selection_hijuela .planillas_info-title')
      .first()
      .text();

    const ccppRaw = $form
      .find('.planilla_grid_selection_ccpp .planillas_info-title')
      .first()
      .text();

    const canalHijuelaRaw = $form
      .find('.planilla_grid_selection_titular .planillas_info-title')
      .first()
      .text();

    const idHijuelaOculto = cleanInlineText($form.find('input[name="idhijselecionada"]').val());
    const ccppOculto = cleanInlineText($form.find('input[name="ccpp_seleccionado"]').val());

    const titular = cleanInlineText(titularRaw).replace(/^Titular:\s*/i, '').trim();
    const ccpp = cleanInlineText(ccppRaw).replace(/^CC-PP:\s*/i, '').trim();
    const canalHijuela = cleanInlineText(canalHijuelaRaw);

    if (!titular && !ccpp && !canalHijuela && !idHijuelaOculto && !ccppOculto) {
      return;
    }

    resultados.push({
      titular,
      ccpp,
      canal_hijuela: canalHijuela,
      id_hijuela_oculto: idHijuelaOculto,
      ccpp_oculto: ccppOculto
    });
  });

  return resultados;
}

async function buscarTurnos(tipoBusqueda, valor) {
  const config = buildPayloadBusquedaTurnos(tipoBusqueda, valor);
  if (config.error) {
    return {
      success: false,
      message: config.error
    };
  }

  try {
    debugLog('Iniciando búsqueda unificada de turnos', {
      tipoBusqueda,
      valor
    });

    const response = await postTurnadoForm(config.payload);
    const resultados = extraerOpcionesTurnosDesdeHtml(response.data);

    if (!resultados.length) {
      return {
        success: false,
        message: 'No se encontraron turnos para esta búsqueda.'
      };
    }

    return {
      success: true,
      cantidad: resultados.length,
      resultados
    };
  } catch (error) {
    debugLog('Error en búsqueda unificada de turnos', {
      message: error?.message,
      status: error?.response?.status
    });

    return {
      success: false,
      message: 'No se pudieron consultar turnos en este momento.',
      error: error?.message || 'Error de red en consulta de turnos.'
    };
  }
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
    debugLog('Paso 1: POST con buscar_ccpp + bccpp', { ccpp });

    const listadoCcpp = await buscarTurnos('ccpp', ccpp);
    if (!listadoCcpp.success || !Array.isArray(listadoCcpp.resultados) || !listadoCcpp.resultados.length) {
      debugLog('Paso 1 sin resultados para CCPP', { ccpp, message: listadoCcpp.message });
      return {
        success: false,
        error: listadoCcpp.message || 'No se encontraron opciones de turno para ese CCPP.',
        userMessage: '✅ No se encontró turno para ese padrón. Verificá el número de servicio.'
      };
    }

    const ccppNormalized = normalizeCCPP(ccpp);
    const opcion = listadoCcpp.resultados.find((entry) => {
      const visibleNorm = normalizeCCPP(entry?.ccpp);
      const hiddenNorm = normalizeCCPP(entry?.ccpp_oculto);
      return visibleNorm === ccppNormalized || hiddenNorm === ccppNormalized;
    }) || listadoCcpp.resultados[0];

    const idhijuela = cleanInlineText(opcion?.id_hijuela_oculto);
    const ccppSeleccionado = cleanInlineText(opcion?.ccpp_oculto || opcion?.ccpp || ccpp);

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

    const step2Payload = { idhijselecionada: idhijuela };
    if (ccppSeleccionado) {
      step2Payload.ccpp_seleccionado = ccppSeleccionado;
    }

    const step2Response = await postTurnadoForm(
      step2Payload,
      { httpAgent: agent, httpsAgent: httpsAgent }
    );

    const html2 = step2Response.data;
    debugLog('Paso 2 completado, parseando HTML de turno detallado');

    // Paso 3: Parsing detallado del HTML
    const $h = cheerio.load(html2);

    // Estado: buscar .celda_restrinjida
    const restringido = $h('.celda_restrinjida').length > 0;
    debugLog('Estado extraído', { restringido: restringido ? 'RESTRINGIDO' : 'DISPONIBLE' });

    // Hijuela: .planilla_grid_hijuela_turno
    let hijuela = 'No disponible';
    const hijuelaElement = $h('.planilla_grid_hijuela_turno').first();
    if (hijuelaElement.length > 0) {
      hijuela = hijuelaElement.text().trim();
    }
    debugLog('Hijuela extraído', { hijuela });

    const ccppExtracted =
      extractFirstText($h, ['.planilla_grid_ccpp_turno', '.planilla_grid_selection_ccpp .planillas_info-title'])
        .replace(/^CC-PP:\s*/i, '')
        .trim() || ccppSeleccionado || ccpp;

    const inspeccion = extractFirstText($h, [
      '.planilla_grid_inspeccion_turno',
      '.planilla_grid_cauce_turno',
      '.planilla_grid_selection_titular .planillas_info-title'
    ]) || 'No disponible';

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

    // Horarios
    let fechaInicio = '';
    let horaInicio = '';
    let fechaFin = '';
    let horaFin = '';

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

    const titular = extractFirstText($h, [
      '.titular_turno',
      '.nombre_titular',
      '.planilla_grid_titular_turno',
      '.planilla_grid_selection_hijuela .planillas_info-title'
    ])
      .replace(/^Titular:\s*/i, '')
      .trim() || 'No disponible';

    const inicioTurno = horaInicio || (restringido ? 'RESTRINGIDO' : 'No disponible');
    const finTurno = horaFin || (restringido ? 'RESTRINGIDO' : 'No disponible');
    const fechaInicioCompleta = fechaInicio
      ? `${fechaInicio}${horaInicio ? ` ${horaInicio}` : ''}`.trim()
      : null;

    const resultado = {
      success: true,
      data: {
        inspeccion: inspeccion || 'No disponible',
        titular,
        hijuela: hijuela || 'No disponible',
        ccpp: ccppExtracted,
        inicioTurno,
        finTurno,
        fechaInicioCompleta,
        restringido,
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

async function buscarTurnosPorNombre(nombre) {
  const result = await buscarTurnos('titular', nombre);
  if (!result.success) {
    return {
      success: false,
      message: result.message || 'No se encontraron turnos'
    };
  }

  return result.resultados;
}

module.exports = {
  obtenerDetalleTurnoCompleto,
  buscarTurnos,
  buscarTurnosPorNombre
};
