// Mock de redis antes de importar el módulo
jest.mock('redis', () => {
  const mockClient = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    setEx: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    flushAll: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    isReady: true
  };

  return {
    createClient: jest.fn(() => mockClient)
  };
});

const redis = require('redis');
const {
  initRedis,
  getRedis,
  cacheSet,
  cacheGet,
  cacheDel,
  cacheFlush,
  cacheExists,
  cacheTTL,
  cacheAside
} = require('./cacheService');

describe('cacheService', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = redis.createClient();
    mockClient.isReady = true;
  });

  describe('initRedis', () => {
    it('debe inicializar conexión a Redis exitosamente', async () => {
      mockClient.connect.mockResolvedValue();

      await initRedis();

      expect(redis.createClient).toHaveBeenCalled();
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('debe manejar error de timeout en conexión', async () => {
      mockClient.connect.mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 2000))
      );

      await initRedis();

      // Debe continuar sin crash
      expect(redis.createClient).toHaveBeenCalled();
    });

    it('debe usar variables de entorno para configuración', async () => {
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret';

      mockClient.connect.mockResolvedValue();

      await initRedis();

      expect(redis.createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          socket: expect.objectContaining({
            host: 'redis.example.com',
            port: '6380'
          }),
          password: 'secret'
        })
      );

      // Cleanup
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
    });
  });

  describe('cacheSet', () => {
    it('debe guardar valor con TTL', async () => {
      mockClient.setEx.mockResolvedValue('OK');

      const result = await cacheSet('test:key', { data: 'value' }, 300);

      expect(result).toBe(true);
      expect(mockClient.setEx).toHaveBeenCalledWith(
        'test:key',
        300,
        JSON.stringify({ data: 'value' })
      );
    });

    it('debe guardar valor sin TTL', async () => {
      mockClient.set.mockResolvedValue('OK');

      const result = await cacheSet('test:key', { data: 'value' }, 0);

      expect(result).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify({ data: 'value' })
      );
    });

    it('debe manejar error y retornar false', async () => {
      mockClient.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await cacheSet('test:key', { data: 'value' });

      expect(result).toBe(false);
    });

    it('debe retornar false si Redis no está ready', async () => {
      mockClient.isReady = false;

      const result = await cacheSet('test:key', { data: 'value' });

      expect(result).toBe(false);
      expect(mockClient.setEx).not.toHaveBeenCalled();
    });

    it('debe serializar objetos complejos correctamente', async () => {
      mockClient.setEx.mockResolvedValue('OK');

      const complexData = {
        id: 123,
        name: 'Test',
        metadata: {
          created: new Date().toISOString(),
          tags: ['tag1', 'tag2']
        }
      };

      await cacheSet('complex:key', complexData, 600);

      expect(mockClient.setEx).toHaveBeenCalledWith(
        'complex:key',
        600,
        JSON.stringify(complexData)
      );
    });
  });

  describe('cacheGet', () => {
    it('debe obtener valor del cache', async () => {
      const testData = { id: 1, name: 'Test' };
      mockClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheGet('test:key');

      expect(result).toEqual(testData);
      expect(mockClient.get).toHaveBeenCalledWith('test:key');
    });

    it('debe retornar null si clave no existe', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await cacheGet('nonexistent:key');

      expect(result).toBeNull();
    });

    it('debe manejar error y retornar null', async () => {
      mockClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheGet('test:key');

      expect(result).toBeNull();
    });

    it('debe retornar null si Redis no está ready', async () => {
      mockClient.isReady = false;

      const result = await cacheGet('test:key');

      expect(result).toBeNull();
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it('debe deserializar JSON correctamente', async () => {
      const complexData = {
        users: [
          { id: 1, name: 'User1' },
          { id: 2, name: 'User2' }
        ],
        total: 2
      };
      
      mockClient.get.mockResolvedValue(JSON.stringify(complexData));

      const result = await cacheGet('users:list');

      expect(result).toEqual(complexData);
      expect(result.users).toHaveLength(2);
    });
  });

  describe('cacheDel', () => {
    it('debe eliminar clave del cache', async () => {
      mockClient.del.mockResolvedValue(1);

      const result = await cacheDel('test:key');

      expect(result).toBe(true);
      expect(mockClient.del).toHaveBeenCalledWith('test:key');
    });

    it('debe manejar error y retornar false', async () => {
      mockClient.del.mockRejectedValue(new Error('Redis error'));

      const result = await cacheDel('test:key');

      expect(result).toBe(false);
    });

    it('debe retornar false si Redis no está ready', async () => {
      mockClient.isReady = false;

      const result = await cacheDel('test:key');

      expect(result).toBe(false);
      expect(mockClient.del).not.toHaveBeenCalled();
    });
  });

  describe('cacheFlush', () => {
    it('debe limpiar todo el cache', async () => {
      mockClient.flushAll.mockResolvedValue('OK');

      const result = await cacheFlush();

      expect(result).toBe(true);
      expect(mockClient.flushAll).toHaveBeenCalled();
    });

    it('debe manejar error y retornar false', async () => {
      mockClient.flushAll.mockRejectedValue(new Error('Redis error'));

      const result = await cacheFlush();

      expect(result).toBe(false);
    });
  });

  describe('cacheExists', () => {
    it('debe retornar true si clave existe', async () => {
      mockClient.exists.mockResolvedValue(1);

      const result = await cacheExists('test:key');

      expect(result).toBe(true);
      expect(mockClient.exists).toHaveBeenCalledWith('test:key');
    });

    it('debe retornar false si clave no existe', async () => {
      mockClient.exists.mockResolvedValue(0);

      const result = await cacheExists('nonexistent:key');

      expect(result).toBe(false);
    });

    it('debe retornar false si Redis no está ready', async () => {
      mockClient.isReady = false;

      const result = await cacheExists('test:key');

      expect(result).toBe(false);
      expect(mockClient.exists).not.toHaveBeenCalled();
    });
  });

  describe('cacheTTL', () => {
    it('debe retornar TTL restante', async () => {
      mockClient.ttl.mockResolvedValue(300);

      const result = await cacheTTL('test:key');

      expect(result).toBe(300);
      expect(mockClient.ttl).toHaveBeenCalledWith('test:key');
    });

    it('debe retornar -1 si no tiene expiry', async () => {
      mockClient.ttl.mockResolvedValue(-1);

      const result = await cacheTTL('test:key');

      expect(result).toBe(-1);
    });

    it('debe retornar -2 si clave no existe', async () => {
      mockClient.ttl.mockResolvedValue(-2);

      const result = await cacheTTL('nonexistent:key');

      expect(result).toBe(-2);
    });

    it('debe retornar -2 si Redis no está ready', async () => {
      mockClient.isReady = false;

      const result = await cacheTTL('test:key');

      expect(result).toBe(-2);
      expect(mockClient.ttl).not.toHaveBeenCalled();
    });
  });

  describe('cacheAside', () => {
    it('debe retornar del cache si existe (HIT)', async () => {
      const cachedData = { id: 1, name: 'Cached' };
      mockClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const loader = jest.fn();
      const result = await cacheAside('test:key', loader, 300);

      expect(result).toEqual(cachedData);
      expect(mockClient.get).toHaveBeenCalledWith('test:key');
      expect(loader).not.toHaveBeenCalled(); // No se llamó al loader
    });

    it('debe cargar de BD y cachear si no existe (MISS)', async () => {
      const dbData = { id: 1, name: 'From DB' };
      mockClient.get.mockResolvedValue(null); // Cache MISS
      mockClient.setEx.mockResolvedValue('OK');

      const loader = jest.fn().mockResolvedValue(dbData);
      const result = await cacheAside('test:key', loader, 300);

      expect(result).toEqual(dbData);
      expect(mockClient.get).toHaveBeenCalledWith('test:key');
      expect(loader).toHaveBeenCalled(); // Se llamó al loader
      expect(mockClient.setEx).toHaveBeenCalledWith(
        'test:key',
        300,
        JSON.stringify(dbData)
      );
    });

    it('debe usar TTL por defecto de 3600s', async () => {
      const dbData = { id: 1 };
      mockClient.get.mockResolvedValue(null);
      mockClient.setEx.mockResolvedValue('OK');

      const loader = jest.fn().mockResolvedValue(dbData);
      await cacheAside('test:key', loader); // Sin TTL

      expect(mockClient.setEx).toHaveBeenCalledWith(
        'test:key',
        3600, // TTL por defecto
        JSON.stringify(dbData)
      );
    });

    it('debe hacer fallback a loader si cache falla', async () => {
      const dbData = { id: 1 };
      mockClient.get.mockRejectedValue(new Error('Redis error'));

      const loader = jest.fn().mockResolvedValue(dbData);
      const result = await cacheAside('test:key', loader);

      expect(result).toEqual(dbData);
      expect(loader).toHaveBeenCalled();
    });

    it('no debe cachear si loader retorna null', async () => {
      mockClient.get.mockResolvedValue(null);

      const loader = jest.fn().mockResolvedValue(null);
      const result = await cacheAside('test:key', loader);

      expect(result).toBeNull();
      expect(mockClient.setEx).not.toHaveBeenCalled();
      expect(mockClient.set).not.toHaveBeenCalled();
    });
  });

});
