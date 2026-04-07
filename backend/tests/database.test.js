/**
 * Tests de Conexión a Base de Datos
 * Verifica que el pool de conexiones MySQL funcione correctamente
 */

const { initializeDB, getPool } = require('../src/config/db');

describe('Database Connection Pool', () => {
  let pool;

  beforeAll(async () => {
    await initializeDB();
    pool = getPool();
  });

  test('Debe conectar a la base de datos', async () => {
    expect(pool).toBeDefined();
    
    const [rows] = await pool.query('SELECT 1 as test');
    expect(rows[0].test).toBe(1);
  });

  test('Pool debe tener 50 conexiones configuradas', async () => {
    const poolConfig = pool.pool.config;
    expect(poolConfig.connectionLimit).toBe(50);
  });

  test('Debe manejar múltiples queries simultáneas', async () => {
    const queries = [];
    
    // Crear 10 queries simultáneas
    for (let i = 0; i < 10; i++) {
      queries.push(pool.query('SELECT ? as number', [i]));
    }
    
    const results = await Promise.all(queries);
    
    expect(results.length).toBe(10);
    results.forEach((result, index) => {
      expect(result[0][0].number).toBe(index);
    });
  });

  test('Debe listar tablas de la base de datos', async () => {
    const [tables] = await pool.query('SHOW TABLES');
    
    expect(tables.length).toBeGreaterThan(0);
    
    // Verificar que existan tablas importantes
    const tableNames = tables.map(t => Object.values(t)[0]);
    expect(tableNames).toContain('clientes');
    expect(tableNames).toContain('mensajes');
  });

  test('Tabla clientes debe tener columnas de padrón', async () => {
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'clientes' 
      AND TABLE_SCHEMA = DATABASE()
    `);
    
    const columnNames = columns.map(c => c.COLUMN_NAME);
    
    expect(columnNames).toContain('padron_superficial');
    expect(columnNames).toContain('padron_subterraneo');
    expect(columnNames).toContain('padron_contaminacion');
    expect(columnNames).toContain('tipo_consulta_preferido');
  });

  test('Debe poder insertar y eliminar un cliente de prueba', async () => {
    const testPhone = '999999999999';
    
    // Insertar
    await pool.query(
      'INSERT INTO clientes (telefono, nombre_whatsapp) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre_whatsapp = ?',
      [testPhone, 'Test User', 'Test User']
    );
    
    // Verificar que existe
    const [rows] = await pool.query('SELECT * FROM clientes WHERE telefono = ?', [testPhone]);
    expect(rows.length).toBe(1);
    expect(rows[0].nombre_whatsapp).toBe('Test User');
    
    // Eliminar
    await pool.query('DELETE FROM clientes WHERE telefono = ?', [testPhone]);
    
    // Verificar que se eliminó
    const [rows2] = await pool.query('SELECT * FROM clientes WHERE telefono = ?', [testPhone]);
    expect(rows2.length).toBe(0);
  });

  test('Debe manejar transacciones correctamente', async () => {
    const connection = await pool.getConnection();
    const testPhone = '888888888888';
    
    try {
      await connection.beginTransaction();
      
      // Insertar en transacción
      await connection.query(
        'INSERT INTO clientes (telefono, nombre_whatsapp) VALUES (?, ?)',
        [testPhone, 'Transaction Test']
      );
      
      // Verificar antes del commit
      const [rows1] = await connection.query('SELECT * FROM clientes WHERE telefono = ?', [testPhone]);
      expect(rows1.length).toBe(1);
      
      // Rollback
      await connection.rollback();
      
      // Verificar después del rollback
      const [rows2] = await pool.query('SELECT * FROM clientes WHERE telefono = ?', [testPhone]);
      expect(rows2.length).toBe(0);
      
    } finally {
      connection.release();
    }
  });
});
