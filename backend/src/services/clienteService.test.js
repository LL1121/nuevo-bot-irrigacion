// Mock all DB dependencies before requiring the service
jest.mock('../config/db', () => ({
  query: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
  getPool: jest.fn(() => ({ query: jest.fn() })),
  withTransaction: jest.fn((fn) => fn()),
}));
jest.mock('./transactionService', () => ({ withTransaction: jest.fn((fn) => fn()) }));
jest.mock('./auditService', () => ({ registrarCambio: jest.fn() }));

const { query, get, run } = require('../config/db');
const clienteService = require('./clienteService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUBDELEGACIONES_DB = [
  { id: 1, nombre: 'Sede Central', codigo: 'SC', display_phone_number: 'loc_sede_central' },
  { id: 2, nombre: 'Subdelegación Río Tunuyán Superior', codigo: 'RTS', display_phone_number: 'loc_rio_tunyuan_superior' },
  { id: 3, nombre: 'Subdelegación Río Mendoza', codigo: 'RM', display_phone_number: 'loc_rio_mendoza' },
  { id: 4, nombre: 'Subdelegación Río Atuel', codigo: 'RA', display_phone_number: 'loc_rio_atuel' },
  { id: 5, nombre: 'Zona de Riego Malargüe', codigo: 'ZRM', display_phone_number: 'loc_zona_riego_malargue' },
  { id: 6, nombre: 'Subdelegación Río Diamante', codigo: 'RD', display_phone_number: 'loc_rio_diamante' },
  { id: 7, nombre: 'Subdelegación Río Tunuyán Inferior', codigo: 'RTI', display_phone_number: 'loc_rio_tunyuan_inferior' },
];

beforeEach(() => {
  jest.clearAllMocks();
  // listarSubdelegaciones uses `query`
  query.mockResolvedValue(SUBDELEGACIONES_DB);
});

// ─── resolverSubdelegacionDesdeEntrada ───────────────────────────────────────

describe('resolverSubdelegacionDesdeEntrada', () => {
  it('devuelve null si la entrada está vacía', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('');
    expect(result).toBeNull();
  });

  it('resuelve por nombre exacto: Sede Central', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('Sede Central');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Sede Central');
    expect(result.id).toBe(1);
  });

  it('resuelve por ID de lista interactiva: sede_central', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('sede_central');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Sede Central');
  });

  it('resuelve Río Mendoza por alias: rio mendoza', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('rio mendoza');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Subdelegación Río Mendoza');
  });

  it('resuelve Río Mendoza por ID de lista: rio_mendoza', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('rio_mendoza');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Subdelegación Río Mendoza');
  });

  it('resuelve Zona de Riego Malargüe por alias: malargue', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('malargue');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Zona de Riego Malargüe');
  });

  it('resuelve Zona de Riego Malargüe con tilde: malargüe', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('malargüe');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Zona de Riego Malargüe');
  });

  it('resuelve Río Tunuyán Superior por ID de lista', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('rio_tunyuan_superior');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Subdelegación Río Tunuyán Superior');
  });

  it('resuelve Río Tunuyán Inferior por ID de lista', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('rio_tunyuan_inferior');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Subdelegación Río Tunuyán Inferior');
  });

  it('resuelve Río Diamante por alias: diamante', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('diamante');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Subdelegación Río Diamante');
  });

  it('resuelve Río Atuel por alias: atuel', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('atuel');
    expect(result).toBeTruthy();
    expect(result.nombre).toBe('Subdelegación Río Atuel');
  });

  it('resuelve por código exacto: SC', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('SC');
    expect(result).toBeTruthy();
    expect(result.codigo).toBe('SC');
  });

  it('resuelve por número de ID: "3"', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('3');
    expect(result).toBeTruthy();
    expect(result.id).toBe(3);
  });

  it('devuelve null para entrada irreconocible', async () => {
    const result = await clienteService.resolverSubdelegacionDesdeEntrada('xxxx_invalido_yyyy');
    expect(result).toBeNull();
  });
});

// ─── obtenerContextoOperador ──────────────────────────────────────────────────

describe('obtenerContextoOperador', () => {
  it('devuelve null si no hay id en el token', async () => {
    const pool = require('../config/db').getPool();
    pool.query = jest.fn().mockResolvedValue({ rows: [] });
    const result = await clienteService.obtenerContextoOperador({});
    expect(result).toBeNull();
  });

  it('devuelve datos del operador cuando existe', async () => {
    const operadorData = {
      id: 1, username: 'admin', email: 'admin@test.com',
      role: 'admin', subdelegacion_id: null,
      subdelegacion_nombre: null, subdelegacion_codigo: null
    };
    // obtenerContextoOperador uses get(), not pool.query()
    get.mockResolvedValueOnce(operadorData);
    const result = await clienteService.obtenerContextoOperador({ id: 1 });
    expect(result).toBeTruthy();
    expect(result.username).toBe('admin');
    expect(result.role).toBe('admin');
  });
});

// ─── obtenerOCrearCliente ─────────────────────────────────────────────────────

describe('obtenerOCrearCliente', () => {
  it('retorna el cliente existente y actualiza ultima_interaccion', async () => {
    const clienteExistente = {
      telefono: '5491112345678',
      nombre_whatsapp: 'Juan',
      nombre_validado: 1,
      bot_activo: 1
    };
    // obtenerOCrearCliente uses query() for SELECT, run() for UPDATE, get() for final SELECT
    query.mockResolvedValueOnce([clienteExistente]);
    run.mockResolvedValueOnce({ changes: 1 });
    get.mockResolvedValueOnce(clienteExistente);

    const result = await clienteService.obtenerOCrearCliente('5491112345678', 'Juan');
    expect(result).toEqual(clienteExistente);
    // run() is called for UPDATE ultima_interaccion
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('crea un nuevo cliente si no existe', async () => {
    const newCliente = { telefono: '5491199999999', nombre_whatsapp: 'Maria', nombre_validado: 0, bot_activo: 1 };
    // First query() returns empty (client not found)
    query.mockResolvedValueOnce([]);
    // run() for INSERT
    run.mockResolvedValueOnce({ changes: 1 });
    // get() returns the newly created client
    get.mockResolvedValueOnce(newCliente);

    const result = await clienteService.obtenerOCrearCliente('5491199999999', 'Maria');
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.nombre_whatsapp).toBe('Maria');
  });
});

// ─── actualizarNombreWhatsapp ─────────────────────────────────────────────────

describe('actualizarNombreWhatsapp', () => {
  it('retorna true cuando actualiza correctamente', async () => {
    run.mockResolvedValue({ changes: 1 });
    const result = await clienteService.actualizarNombreWhatsapp('5491112345678', 'Carlos', true);
    expect(result).toBe(true);
    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE clientes'),
      expect.arrayContaining(['Carlos', 1, '5491112345678'])
    );
  });

  it('retorna false si no hay filas afectadas', async () => {
    run.mockResolvedValue({ changes: 0 });
    const result = await clienteService.actualizarNombreWhatsapp('5491199999999', 'Nadie', false);
    expect(result).toBe(false);
  });
});
