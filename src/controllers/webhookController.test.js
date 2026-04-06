// Mock all heavy dependencies before requiring webhookController
jest.mock('../services/whatsappService', () => ({
  sendMessage: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid_mock' }] }),
  sendText: jest.fn().mockResolvedValue({}),
  sendButtonReply: jest.fn().mockResolvedValue({}),
  sendInteractiveList: jest.fn().mockResolvedValue({}),
  sendInteractiveButtons: jest.fn().mockResolvedValue({}),
  sendTemplate: jest.fn().mockResolvedValue({}),
  sendDocument: jest.fn().mockResolvedValue({}),
  sendImage: jest.fn().mockResolvedValue({}),
  sendLocation: jest.fn().mockResolvedValue({}),
}));
jest.mock('../services/debtScraperService', () => ({}));
jest.mock('../services/debtApiService', () => ({}));
jest.mock('../services/turnadoScraperService', () => ({}));
jest.mock('../services/turnadoApiService', () => ({}));
jest.mock('../services/mensajeService', () => ({
  guardarMensaje: jest.fn().mockResolvedValue({ id: 1, fecha: new Date().toISOString() }),
}));
jest.mock('../services/clienteService', () => ({
  obtenerOCrearCliente: jest.fn(),
  obtenerCliente: jest.fn(),
  actualizarEstadoConversacion: jest.fn().mockResolvedValue(true),
  obtenerSubdelegacionInfo: jest.fn().mockResolvedValue(null),
  asignarSubdelegacionCliente: jest.fn(),
  resolverSubdelegacionDesdeEntrada: jest.fn(),
  actualizarNombreWhatsapp: jest.fn().mockResolvedValue(true),
  verificarDisponibilidadOperador: jest.fn().mockResolvedValue({ disponible: false, mensaje: 'Sin operadores' }),
  obtenerContextoOperador: jest.fn(),
  cambiarEstadoBot: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/pdfCompressionService', () => ({ compressPdfForFrontend: jest.fn() }));
jest.mock('fs');
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn((p) => '.' + p.split('.').pop()),
}));

const {
  _testHelpers: {
    extractLikelyNameFromInput,
    isLikelyValidPersonName,
    formatPersonName,
    normalizePersonName,
    handleOperatorSurveyResponse,
    handleOpinionChoice,
    handleOpinionText,
    handleOperatorPostFollowUp,
    userStates,
  }
} = require('./webhookController');

const TEST_PHONE = '5491112345678';

const whatsappService = require('../services/whatsappService');
const clienteService = require('../services/clienteService');
const mensajeService = require('../services/mensajeService');

// ─── formatPersonName ─────────────────────────────────────────────────────────

describe('formatPersonName', () => {
  it('capitaliza primera letra de cada palabra', () => {
    expect(formatPersonName('juan perez')).toBe('Juan Perez');
  });

  it('maneja mayúsculas mezcladas', () => {
    expect(formatPersonName('MARIA GONZALEZ')).toBe('Maria Gonzalez');
  });

  it('retorna vacío si la entrada está vacía', () => {
    expect(formatPersonName('')).toBe('');
  });

  it('maneja nombre con acentos', () => {
    expect(formatPersonName('maría')).toBe('María');
  });
});

// ─── normalizePersonName ──────────────────────────────────────────────────────

describe('normalizePersonName', () => {
  it('colapsa espacios múltiples', () => {
    expect(normalizePersonName('Juan   Perez')).toBe('Juan Perez');
  });

  it('hace trim de espacios', () => {
    expect(normalizePersonName('  Ana  ')).toBe('Ana');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizePersonName(null)).toBe('');
    expect(normalizePersonName(undefined)).toBe('');
  });
});

// ─── extractLikelyNameFromInput ───────────────────────────────────────────────

describe('extractLikelyNameFromInput', () => {
  it('extrae nombre simple', () => {
    expect(extractLikelyNameFromInput('Carlos')).toBe('Carlos');
  });

  it('extrae nombre desde "me llamo X"', () => {
    expect(extractLikelyNameFromInput('me llamo Laura')).toBe('Laura');
  });

  it('extrae nombre desde "mi nombre es X"', () => {
    expect(extractLikelyNameFromInput('mi nombre es Roberto')).toBe('Roberto');
  });

  it('extrae nombre desde "soy X"', () => {
    expect(extractLikelyNameFromInput('soy Ana Maria')).toBe('Ana Maria');
  });

  it('quita saludo inicial "hola X"', () => {
    expect(extractLikelyNameFromInput('hola Pedro')).toBe('Pedro');
  });

  it('elimina stopwords sueltos', () => {
    expect(extractLikelyNameFromInput('yo me llamo Lucia')).toBe('Lucia');
  });

  it('retorna vacío para entrada vacía', () => {
    expect(extractLikelyNameFromInput('')).toBe('');
  });

  it('toma hasta 3 tokens', () => {
    const result = extractLikelyNameFromInput('Maria Jose del Valle Lopez Garcia');
    // should be at most 3 tokens
    expect(result.split(' ').length).toBeLessThanOrEqual(3);
  });

  it('capitaliza el resultado', () => {
    const result = extractLikelyNameFromInput('juan carlos');
    expect(result).toBe('Juan Carlos');
  });
});

// ─── isLikelyValidPersonName ──────────────────────────────────────────────────

describe('isLikelyValidPersonName', () => {
  it('acepta nombre válido', () => {
    expect(isLikelyValidPersonName('Juan')).toBe(true);
  });

  it('acepta nombre con dos palabras', () => {
    expect(isLikelyValidPersonName('Ana Gomez')).toBe(true);
  });

  it('rechaza cadena vacía', () => {
    expect(isLikelyValidPersonName('')).toBe(false);
  });

  it('rechaza nombre demasiado corto (1 char)', () => {
    expect(isLikelyValidPersonName('A')).toBe(false);
  });

  it('rechaza nombres reservados: "sin nombre"', () => {
    expect(isLikelyValidPersonName('sin nombre')).toBe(false);
  });

  it('rechaza cadenas solo numéricas', () => {
    expect(isLikelyValidPersonName('12345')).toBe(false);
  });

  it('acepta nombre con acentos', () => {
    expect(isLikelyValidPersonName('María')).toBe(true);
  });

  it('acepta nombre con ñ', () => {
    expect(isLikelyValidPersonName('Muñoz')).toBe(true);
  });
});

// ─── handleOperatorSurveyResponse ─────────────────────────────────────────────

describe('handleOperatorSurveyResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userStates[TEST_PHONE] = { step: 'OPERATOR_SURVEY' };
  });

  it('envía mensaje de error si la opción no es válida', async () => {
    await handleOperatorSurveyResponse(TEST_PHONE, 'opcion_invalida');
    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.stringContaining('Por favor elegí una opción')
    );
  });

  it('acepta calificación válida (op_satisfaccion_3) y pregunta por opinión', async () => {
    await handleOperatorSurveyResponse(TEST_PHONE, 'op_satisfaccion_3');
    expect(clienteService.actualizarEstadoConversacion).toHaveBeenCalledWith(
      TEST_PHONE,
      'FOLLOWUP_POST_OPERADOR'
    );
    // Debe preguntar si quiere dejar opinión
    expect(whatsappService.sendButtonReply).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.stringContaining('opinión'),
      expect.arrayContaining([
        expect.objectContaining({ id: 'op_opinion_si' }),
        expect.objectContaining({ id: 'op_opinion_no' }),
      ])
    );
  });

  it('acepta calificación 5 estrellas', async () => {
    await handleOperatorSurveyResponse(TEST_PHONE, 'op_satisfaccion_5');
    expect(clienteService.actualizarEstadoConversacion).toHaveBeenCalled();
  });
});

// ─── handleOpinionChoice ──────────────────────────────────────────────────────

describe('handleOpinionChoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userStates[TEST_PHONE] = { step: 'AWAITING_OPINION_CHOICE' };
  });

  it('op_opinion_si: pide que escriba la opinión', async () => {
    await handleOpinionChoice(TEST_PHONE, 'op_opinion_si');
    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.stringContaining('opinión')
    );
  });

  it('op_opinion_no: pregunta si necesita más ayuda', async () => {
    await handleOpinionChoice(TEST_PHONE, 'op_opinion_no');
    expect(whatsappService.sendButtonReply).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ id: 'op_mas_ayuda_si' }),
        expect.objectContaining({ id: 'op_mas_ayuda_no' }),
      ])
    );
  });

  it('opción inválida: pide elegir Sí o No', async () => {
    await handleOpinionChoice(TEST_PHONE, 'algo_random');
    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.stringContaining('Sí')
    );
  });
});

// ─── handleOpinionText ────────────────────────────────────────────────────────

describe('handleOpinionText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userStates[TEST_PHONE] = { step: 'AWAITING_OPINION_TEXT' };
  });

  it('texto vacío: pide que escriba la opinión', async () => {
    await handleOpinionText(TEST_PHONE, '   ');
    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.stringContaining('opinión')
    );
    // guardarMensaje se llama desde sendMessageAndSave, pero no para guardar la opinión
    const opinionCalls = mensajeService.guardarMensaje.mock.calls.filter(
      (call) => call[0]?.cuerpo?.includes('[OPINIÓN')
    );
    expect(opinionCalls).toHaveLength(0);
  });

  it('texto válido: guarda opinión, agradece y pregunta si necesita más', async () => {
    await handleOpinionText(TEST_PHONE, 'Excelente atención');
    // Debe guardar la opinión como mensaje de tipo especial
    const opinionCall = mensajeService.guardarMensaje.mock.calls.find(
      (call) => call[0]?.cuerpo?.includes('Excelente atención')
    );
    expect(opinionCall).toBeDefined();
    expect(opinionCall[0].telefono).toBe(TEST_PHONE);
    // Debe agradecer
    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.stringContaining('mejorar')
    );
    // Debe preguntar si necesita más ayuda
    expect(whatsappService.sendButtonReply).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ id: 'op_mas_ayuda_si' }),
      ])
    );
  });
});

// ─── handleOperatorPostFollowUp ───────────────────────────────────────────────

describe('handleOperatorPostFollowUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userStates[TEST_PHONE] = { step: 'AWAITING_OPERATOR_FOLLOWUP' };
  });

  it('op_mas_ayuda_no: activa bot y manda despedida', async () => {
    await handleOperatorPostFollowUp(TEST_PHONE, 'op_mas_ayuda_no');
    expect(clienteService.actualizarEstadoConversacion).toHaveBeenCalledWith(
      TEST_PHONE,
      'BOT'
    );
    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.stringContaining('Gracias')
    );
  });

  it('opción inválida: pide elegir Sí o No', async () => {
    await handleOperatorPostFollowUp(TEST_PHONE, 'algo_raro');
    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      TEST_PHONE,
      expect.stringContaining('Sí')
    );
  });
});
