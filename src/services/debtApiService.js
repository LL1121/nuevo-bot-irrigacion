const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL_DEUDA_ATENCION = 'https://autogestion.cloud.irrigacion.gov.ar/services/ifinfogov/api/public/ctacte/deudaAtencion';
const BASE_URL_CUOTA = 'https://www.irrigacion.gov.ar/boletoonline/ctacte/cuota';
const BASE_URL_BOLETO_PDF = 'https://serviciosweb.cloud.irrigacion.gov.ar/services/presupuesto/api/public/boletos/boletoPDF';
const BASE_URL_SERVICIOS_ALTA = 'https://autogestion.cloud.irrigacion.gov.ar/services/presupuesto/api/public/servicios/getAllServiciosAlta';
const RECAPTCHA_TOKEN = process.env.IRRIGACION_RECAPTCHA_TOKEN || '0';
const DOWNLOAD_DIR = path.resolve(__dirname, '../../public/temp');
const FLOW_DEBUG = process.env.PAYMENTS_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

function debugLog(message, data) {
  if (!FLOW_DEBUG) return;
  if (typeof data === 'undefined') {
    console.log(`[DEBT_API] ${message}`);
    return;
  }
  console.log(`[DEBT_API] ${message}`, data);
}

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

function formatDateYmd(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatArs(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseAmount(value));
}

function formatDateToDisplay(value) {
  if (!value) {
    return 'No disponible';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No disponible';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function buildDeudaSummaryMessage(tipoPadron, deudaData) {
  return `📊 *Resumen de deuda del padrón ${String(tipoPadron || '').toUpperCase()}*\n\n` +
    `👤 *Titular:* ${deudaData.titular || 'No disponible'}\n` +
    `🆔 *CUIT:* ${deudaData.cuit || 'No disponible'}\n` +
    `🌾 *Hectáreas:* ${deudaData.hectareas || 'No disponible'}\n\n` +
    `🚜 *Hijuela:* ${deudaData.hijuela || 'No disponible'}\n\n` +
    `💰 *DEUDA:*\n` +
    `Capital: ${formatArs(deudaData.capital)}\n` +
    `Interés: ${formatArs(deudaData.interes)}\n` +
    `Apremio: ${formatArs(deudaData.apremio)}\n` +
    `Eventuales: ${formatArs(deudaData.eventuales)}\n\n` +
    `*💵 TOTAL A PAGAR: ${formatArs(deudaData.total)}*\n\n` +
    `_💡 Si pagás el total de la deuda, te descontamos el 50% de los intereses._`;
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || typeof value === 'undefined') continue;
    const normalized = String(value).trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return null;
}

function normalizeServicioCodigo(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

async function obtenerDatosServicioPorCodigo(codigoArmado) {
  try {
    debugLog('Buscando metadata de servicio por código', { codigoArmado });
    const response = await axios.get(BASE_URL_SERVICIOS_ALTA, {
      params: {
        'codigo_servicio.equals': normalizeServicioCodigo(codigoArmado),
        page: 0,
        size: 1
      },
      timeout: 20000,
      headers: {
        Accept: 'application/json'
      }
    });

    const items = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.content)
        ? response.data.content
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : [];

    const item = items[0] || null;

    if (!item) {
      debugLog('No se encontró coincidencia exacta de metadata para el código', {
        codigoArmado,
        cantidadResultados: items.length
      });
      return null;
    }

    return {
      titular: pickFirstNonEmpty(item?.persona?.nombre, item?.titular, item?.nombreTitular),
      cuit: pickFirstNonEmpty(item?.persona?.cuit, item?.persona?.cuil, item?.cuit),
      hectareas: pickFirstNonEmpty(item?.superficieEmpadronada, item?.hectareas, item?.superficie, item?.cantidadHectareas),
      hijuela: pickFirstNonEmpty(item?.hijuela, item?.mapaHidrico?.nombre, item?.canal, item?.padronParcial)
    };
  } catch (error) {
    debugLog('No se pudo obtener metadata de servicio por código', {
      codigoArmado,
      message: error?.message,
      status: error?.response?.status
    });
    return null;
  }
}

function parseCodigoToPadron(codigo) {
  const raw = String(codigo || '').trim();
  if (raw.length < 9) {
    return null;
  }

  const normalized = raw.replace(/\s+/g, '');
  const cuerpo = normalized.slice(1);
  if (cuerpo.length < 8) {
    return null;
  }

  const codigo1 = cuerpo.slice(0, 4);
  const codigo2 = cuerpo.slice(-4);
  if (!/^\d{4}$/.test(codigo1) || !/^\d{4}$/.test(codigo2)) {
    return null;
  }

  return `${codigo1}-${codigo2}`;
}

async function traducirDniAPadron(dni) {
  const normalizedDni = String(dni || '').trim();
  debugLog('Traduciendo DNI/CUIT a padrón', { dni: normalizedDni });

  if (!normalizedDni) {
    return {
      success: false,
      message: 'DNI/CUIT inválido.'
    };
  }

  try {
    const response = await axios.get(BASE_URL_SERVICIOS_ALTA, {
      params: {
        'cuit.contains': normalizedDni,
        'tipoServicioId.in': '1,2,3',
        page: 0,
        size: 20
      },
      timeout: 20000,
      headers: {
        Accept: 'application/json'
      }
    });

    const items = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.content)
        ? response.data.content
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : [];

    debugLog('Resultado de traducción DNI/CUIT', { cantidad: items.length });

    if (items.length === 0) {
      return {
        success: false,
        message: 'No se encontraron padrones para este DNI.'
      };
    }

    if (items.length === 1) {
      const item = items[0] || {};
      const padron = parseCodigoToPadron(item.codigo);

      if (!padron) {
        throw new Error(`No se pudo parsear el código de servicio: ${item.codigo || 'sin código'}`);
      }

      return {
        success: true,
        multiple: false,
        padron,
        titular: item?.persona?.nombre || 'No disponible'
      };
    }

    const opciones = items
      .map((item) => {
        const padron = parseCodigoToPadron(item?.codigo);
        if (!padron) {
          return null;
        }

        return {
          padron,
          descripcion: item?.mapaHidrico?.nombre || 'Sin descripción'
        };
      })
      .filter(Boolean);

    if (!opciones.length) {
      throw new Error('No se pudieron parsear los padrones devueltos por la API.');
    }

    return {
      success: true,
      multiple: true,
      opciones
    };
  } catch (error) {
    debugLog('Error en traducirDniAPadron', {
      message: error?.message,
      status: error?.response?.status
    });

    return {
      success: false,
      message: 'Error al consultar padrones para este DNI.'
    };
  }
}

async function obtenerDeudaPadronSuperficial(datos) {
  const padron1 = String(datos?.codigoCauce || '').trim();
  const padron2Raw = String(datos?.numeroPadron || '').trim();

  debugLog('Iniciando consulta deuda superficial', { padron1, padron2Raw });

  if (!padron1 || !padron2Raw) {
    return {
      success: false,
      error: 'Datos de padrón incompletos para consultar deuda.',
      userMessage: '⚠️ No pude procesar ese padrón. Revisá el formato e intentá nuevamente.'
    };
  }

  const padron2 = padron2Raw.padStart(4, '0');
  const codigoArmado = `A${padron1}${padron2}`;
  const fechaVencimiento = formatDateYmd(new Date());

  debugLog('Parámetros armados para deudaAtencion', { codigoArmado, fechaVencimiento });

  try {
    const datosServicio = await obtenerDatosServicioPorCodigo(codigoArmado);

    const response = await axios.get(BASE_URL_DEUDA_ATENCION, {
      params: {
        codigo: codigoArmado,
        tipoServicio: 'A',
        fechaVencimiento,
        recaptchaToken: RECAPTCHA_TOKEN,
        page: 0,
        size: 2000
      },
      timeout: 20000,
      headers: {
        Accept: 'application/json'
      }
    });

    const payload = response?.data?.data || response?.data?.result || response?.data || {};
    const detalles = Array.isArray(payload.ctacteDTODetalles)
      ? payload.ctacteDTODetalles
      : Array.isArray(payload.detalles)
        ? payload.detalles
        : [];

    debugLog('Snapshot payload deudaAtencion', {
      codigoArmado,
      total: payload.total,
      capital: payload.capital,
      interes: payload.interes,
      apremio: payload.apremio,
      eventuales: payload.eventuales,
      titular: payload.titular,
      cuit: payload.cuit,
      hectareas: payload.hectareas,
      hijuela: payload.hijuela,
      detalles: detalles.length
    });

    const deudaData = {
      total: payload.total ?? payload.totalDeuda ?? 0,
      capital: payload.capital ?? 0,
      capitalVencido: payload.capitalVencido ?? payload.vencido ?? 0,
      capitalVigente: payload.capitalVigente ?? payload.aVencer ?? 0,
      interes: payload.interes ?? 0,
      eventuales: payload.eventuales ?? 0,
      apremio: payload.apremio ?? 0,
      fechaCalculoDeuda: payload.fechaCalculoDeuda ?? null,
      titular: payload.titular ?? payload.nombreTitular ?? 'No disponible',
      cuit: payload.cuit ?? payload.cuitTitular ?? 'No disponible',
      hectareas: payload.hectareas ?? payload.superficie ?? 'No disponible',
      hijuela: payload.hijuela ?? payload.canal ?? 'No disponible',
      ctacteDTODetalles: detalles,
      codigoArmado
    };

    if (datosServicio) {
      deudaData.titular = pickFirstNonEmpty(
        datosServicio.titular,
        deudaData.titular !== 'No disponible' ? deudaData.titular : null,
        deudaData.titular
      ) || 'No disponible';

      deudaData.cuit = pickFirstNonEmpty(
        datosServicio.cuit,
        deudaData.cuit !== 'No disponible' ? deudaData.cuit : null,
        deudaData.cuit
      ) || 'No disponible';

      deudaData.hectareas = pickFirstNonEmpty(
        datosServicio.hectareas,
        deudaData.hectareas !== 'No disponible' ? deudaData.hectareas : null,
        deudaData.hectareas
      ) || 'No disponible';

      deudaData.hijuela = pickFirstNonEmpty(
        datosServicio.hijuela,
        deudaData.hijuela !== 'No disponible' ? deudaData.hijuela : null,
        deudaData.hijuela
      ) || 'No disponible';
    }

    const sinTotales = !deudaData.total && !deudaData.capitalVencido && !deudaData.capitalVigente;
    if (sinTotales && detalles.length === 0) {
      debugLog('Consulta sin deuda para código', codigoArmado);
      return {
        success: false,
        error: `Sin deuda para código ${codigoArmado}`,
        userMessage: '✅ No se encontró deuda para ese padrón en este momento.'
      };
    }

    return {
      success: true,
      data: {
        ...deudaData,
        formattedMessage: buildDeudaSummaryMessage('superficial', deudaData)
      },
      source: 'api-direct'
    };
  } catch (error) {
    debugLog('Error consultando deudaAtencion', {
      status: error?.response?.status,
      message: error?.message
    });
    const status = error?.response?.status;
    const userMessage = status === 404
      ? '✅ No se encontró deuda para ese padrón.'
      : '❌ No pude consultar la deuda ahora. Intentá de nuevo en unos minutos.';

    return {
      success: false,
      error: `Error consultando deudaAtencion (${status || 'sin status'}): ${error.message}`,
      userMessage
    };
  }
}

function mapTipoPadronToTipoServicio(tipoPadron) {
  if (tipoPadron === 'superficial') return 'A';
  if (tipoPadron === 'subterraneo') return 'B';
  if (tipoPadron === 'contaminacion') return 'C';
  return 'A';
}

function buildCodigosByTipoPadron(tipoPadron, datos) {
  if (tipoPadron === 'superficial') {
    return {
      codigo1: String(datos?.codigoCauce || '').trim(),
      codigo2: String(datos?.numeroPadron || '').trim()
    };
  }

  if (tipoPadron === 'subterraneo') {
    return {
      codigo1: String(datos?.codigoDepartamento || '').trim(),
      codigo2: String(datos?.numeroPozo || '').trim()
    };
  }

  if (tipoPadron === 'contaminacion') {
    return {
      codigo1: String(datos?.numeroContaminacion || '').trim(),
      codigo2: ''
    };
  }

  return {
    codigo1: String(datos?.codigo1 || '').trim(),
    codigo2: String(datos?.codigo2 || '').trim()
  };
}

async function descargarPdfBoleto(pdfUrl, tipoPadron, tipoCuota, codigo1, codigo2) {
  const fileName = [
    'boleto',
    tipoPadron || 'padron',
    tipoCuota || 'cuota',
    codigo1 || 'c1',
    codigo2 || 'c2',
    Date.now()
  ].join('_') + '.pdf';

  const pdfPath = path.join(DOWNLOAD_DIR, fileName);
  debugLog('Descargando PDF de boleto', { pdfUrl, pdfPath });
  const response = await axios.get(pdfUrl, {
    responseType: 'arraybuffer',
    timeout: 25000,
    headers: {
      Accept: 'application/pdf'
    }
  });

  await fs.promises.writeFile(pdfPath, response.data);
  debugLog('PDF de boleto descargado correctamente', { pdfPath });
  return pdfPath;
}

async function obtenerBoletoPadron(tipoPadron, datos, tipoBoleto) {
  const tipoServicio = mapTipoPadronToTipoServicio(tipoPadron);
  const { codigo1, codigo2 } = buildCodigosByTipoPadron(tipoPadron, datos);

  debugLog('Iniciando consulta de boletos por API', { tipoPadron, tipoBoleto, tipoServicio, codigo1, codigo2 });

  if (!codigo1 || (tipoServicio !== 'C' && !codigo2)) {
    return {
      success: false,
      error: 'Datos de padrón incompletos para consultar boletos.',
      userMessage: '⚠️ No pude procesar ese padrón para generar el boleto.'
    };
  }

  try {
    const response = await axios.post(
      BASE_URL_CUOTA,
      {
        tipo: tipoServicio,
        codigo1,
        codigo2
      },
      {
        timeout: 20000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    const cuotas = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.data)
        ? response.data.data
        : [];

    debugLog('Boletos obtenidos desde API', { cantidad: cuotas.length });

    if (!cuotas.length) {
      throw new Error('No se encontraron boletos para este padrón.');
    }

    const normalizedTipo = String(tipoBoleto || '').toLowerCase();
    const boletoSeleccionado = cuotas.find((item) => {
      const dataBole = String(item?.dataBole || '');
      const isAnual = /anual/i.test(dataBole);
      if (normalizedTipo === 'anual') {
        return isAnual;
      }
      if (normalizedTipo === 'bimestral') {
        return !isAnual;
      }
      return false;
    });

    if (!boletoSeleccionado) {
      const etiqueta = normalizedTipo === 'anual' ? 'anual' : 'bimestral';
      throw new Error(`No se encontró el boleto ${etiqueta} para este padrón.`);
    }

    const periBole = boletoSeleccionado.periBole;
    const numeBole = boletoSeleccionado.numeBole;

    debugLog('Boleto seleccionado', {
      tipo: normalizedTipo,
      periBole,
      numeBole,
      dataBole: boletoSeleccionado?.dataBole
    });

    if (!periBole || !numeBole) {
      throw new Error('No se pudo construir el PDF del boleto por datos incompletos de la API.');
    }

    const pdfUrl = `${BASE_URL_BOLETO_PDF}/${periBole}-${numeBole}`;
    const pdfPath = await descargarPdfBoleto(pdfUrl, tipoPadron, normalizedTipo, codigo1, codigo2);

    return {
      success: true,
      pdfPath,
      pdfUrl,
      data: boletoSeleccionado,
      source: 'api-direct'
    };
  } catch (error) {
    debugLog('Error en obtenerBoletoPadron', { message: error?.message });
    return {
      success: false,
      error: error.message || 'Error consultando boletos por API.',
      userMessage: '❌ No se pudo generar el boleto en este momento. Intentá nuevamente en unos minutos.'
    };
  }
}

module.exports = {
  obtenerDeudaPadronSuperficial,
  obtenerBoletoPadron,
  traducirDniAPadron
};
