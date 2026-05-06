'use strict';

// JWT_SECRET must be set before the module is loaded (it throws if missing)
process.env.JWT_SECRET = 'test_jwt_secret_for_unit_tests';
process.env.JWT_EXPIRY = '8h';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockQuery = jest.fn();
jest.mock('../config/db', () => ({
  getPool: jest.fn(() => ({ query: mockQuery })),
}));

const mockObtenerContextoOperador = jest.fn();
jest.mock('../services/clienteService', () => ({
  obtenerContextoOperador: mockObtenerContextoOperador,
}));

// Load module under test after mocks are registered
const { login, me } = require('./authController');

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('authController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('devuelve 400 si faltan username o password', async () => {
      const req = { body: { username: '', password: '' } };
      const res = makeRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('devuelve 400 si body está vacío', async () => {
      const req = { body: {} };
      const res = makeRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devuelve 401 si el usuario no existe en DB', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const req = { body: { username: 'inexistente', password: 'pass123' } };
      const res = makeRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('devuelve 401 si la contraseña no coincide', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 1,
          username: 'juan',
          email: 'juan@test.com',
          password_hash: '$2b$10$fakehashedpassword',
          role: 'operador',
          subdelegacion_id: 2,
          subdelegacion_nombre: 'Río Mendoza',
          subdelegacion_codigo: 'RM',
        },
      ]);
      bcrypt.compare.mockResolvedValueOnce(false);

      const req = { body: { username: 'juan', password: 'clave_incorrecta' } };
      const res = makeRes();
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('devuelve 200 con token y datos de usuario en login exitoso', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 5,
          username: 'admin',
          email: 'admin@irrigacion.mendoza.gov.ar',
          password_hash: '$2b$10$fakehashedpassword',
          role: 'admin',
          subdelegacion_id: null,
          subdelegacion_nombre: null,
          subdelegacion_codigo: null,
        },
      ]);
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce('mocked_jwt_token_abc123');

      const req = { body: { username: 'admin', password: 'clave_correcta' } };
      const res = makeRes();
      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.token).toBe('mocked_jwt_token_abc123');
      expect(body.user.username).toBe('admin');
      expect(body.user.role).toBe('admin');
      expect(body.user.subdelegacion_id).toBeNull();
    });

    it('incluye subdelegacion_nombre en la respuesta de login', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 3,
          username: 'operador1',
          email: 'op@test.com',
          password_hash: '$2b$10$fakehashedpassword',
          role: 'operador',
          subdelegacion_id: 3,
          subdelegacion_nombre: 'Río Atuel',
          subdelegacion_codigo: 'RA',
        },
      ]);
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce('token_op');

      const req = { body: { username: 'operador1', password: 'clave_ok' } };
      const res = makeRes();
      await login(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.user.subdelegacion_nombre).toBe('Río Atuel');
      expect(body.user.subdelegacion_codigo).toBe('RA');
    });
  });

  // ─── me ───────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('devuelve 404 si el operador no se encuentra', async () => {
      mockObtenerContextoOperador.mockResolvedValueOnce(null);
      const req = { user: { id: 99 } };
      const res = makeRes();
      await me(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('devuelve 404 si el operador no tiene id', async () => {
      mockObtenerContextoOperador.mockResolvedValueOnce({ username: 'ghost' });
      const req = { user: {} };
      const res = makeRes();
      await me(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('admin recibe canViewAllQueues=true y queueScope="all"', async () => {
      mockObtenerContextoOperador.mockResolvedValueOnce({
        id: 1,
        username: 'admin',
        email: 'admin@test.com',
        role: 'admin',
        subdelegacion_id: null,
        subdelegacion_nombre: null,
        subdelegacion_codigo: null,
      });
      const req = { user: { id: 1 } };
      const res = makeRes();
      await me(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.user.permissions.canViewAllQueues).toBe(true);
      expect(body.user.permissions.canAssignSubdelegacion).toBe(true);
      expect(body.user.permissions.queueScope).toBe('all');
    });

    it('operador recibe canViewAllQueues=false y queueScope="subdelegacion"', async () => {
      mockObtenerContextoOperador.mockResolvedValueOnce({
        id: 3,
        username: 'operador1',
        email: 'op@test.com',
        role: 'operador',
        subdelegacion_id: 2,
        subdelegacion_nombre: 'Río Mendoza',
        subdelegacion_codigo: 'RM',
      });
      const req = { user: { id: 3 } };
      const res = makeRes();
      await me(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.user.permissions.canViewAllQueues).toBe(false);
      expect(body.user.permissions.queueScope).toBe('subdelegacion');
      expect(body.data.subdelegacion_nombre).toBe('Río Mendoza');
    });

    it('la respuesta incluye campos en la raíz, en user{} y en data{}', async () => {
      mockObtenerContextoOperador.mockResolvedValueOnce({
        id: 2,
        username: 'operador2',
        email: 'op2@test.com',
        role: 'operador',
        subdelegacion_id: 4,
        subdelegacion_nombre: 'Río Diamante',
        subdelegacion_codigo: 'RD',
      });
      const req = { user: { id: 2 } };
      const res = makeRes();
      await me(req, res);

      const body = res.json.mock.calls[0][0];
      // Campos en la raíz (spread de userData)
      expect(body.id).toBe(2);
      expect(body.username).toBe('operador2');
      // Dentro de user{}
      expect(body.user.id).toBe(2);
      expect(body.user.email).toBe('op2@test.com');
      // Dentro de data{}
      expect(body.data.id).toBe(2);
      expect(body.data.subdelegacion_codigo).toBe('RD');
    });
  });
});
