const { query, run, get } = require('../config/db');
const { withTransaction } = require('./transactionService');
const { registrarCambio } = require('./auditService');

const DEFAULT_SUBDELEGACION_NOMBRE = process.env.DEFAULT_SUBDELEGACION_NOMBRE || 'Mendoza Central';
const DEFAULT_SUBDELEGACION_CODIGO = process.env.DEFAULT_SUBDELEGACION_CODIGO || 'MZA_CENTRAL';
const DEFAULT_SUBDELEGACION_DISPLAY_PHONE = process.env.DEFAULT_SUBDELEGACION_DISPLAY_PHONE || 'MENDOZA_CENTRAL_DEFAULT';
const OPERATOR_SCHEDULE_TIMEZONE = process.env.OPERATOR_SCHEDULE_TIMEZONE || 'America/Argentina/Mendoza';
const DEFAULT_FUERA_HORARIO_MSG = '👤 En este momento no hay operadores disponibles. Probá mañana de 8:00 a 13:30.';

const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '');

const parseTimeToMinutes = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return (hour * 60) + minute;
};

const getCurrentWeekdayAndMinutes = (date = new Date()) => {
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATOR_SCHEDULE_TIMEZONE,
    weekday: 'short'
  }).format(date);

  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATOR_SCHEDULE_TIMEZONE,
    hour: '2-digit',
    hour12: false
  }).format(date));

  const minute = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATOR_SCHEDULE_TIMEZONE,
    minute: '2-digit'
  }).format(date));

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    diaSemana: dayMap[weekdayShort] ?? 0,
    minutosActuales: (Number.isNaN(hour) ? 0 : hour * 60) + (Number.isNaN(minute) ? 0 : minute)
  };
};

/**
 * Servicio para gestión de clientes (auto-registro)
 */

/**
 * Obtener o crear cliente desde WhatsApp
 * @param {string} telefono - Número de WhatsApp
 * @param {string} nombre - Nombre de perfil (pushName)
 * @param {string} fotoPerfil - URL de foto de perfil (opcional)
 * @returns {Object} Datos del cliente
 */
const obtenerOCrearCliente = async (telefono, nombre = 'Sin Nombre', fotoPerfil = null) => {
  try {
    // Buscar cliente existente
    const rows = await query(
      'SELECT * FROM clientes WHERE telefono = ?',
      [telefono]
    );

    if (rows && rows.length > 0) {
      // Cliente existe - actualizar ultima_interaccion, nombre y foto si están vacíos
      await run(
        "UPDATE clientes SET ultima_interaccion = CURRENT_TIMESTAMP, nombre_whatsapp = COALESCE(nombre_whatsapp, ?), foto_perfil = COALESCE(foto_perfil, ?), estado_conversacion = COALESCE(estado_conversacion, 'BOT') WHERE telefono = ?",
        [nombre, fotoPerfil, telefono]
      );
      
      console.log(`👤 Cliente existente: ${telefono} - ${nombre}`);
      // Retornar cliente actualizado
      const updatedClient = await get(
        'SELECT * FROM clientes WHERE telefono = ?',
        [telefono]
      );
      return updatedClient;
    }

    // Cliente nuevo - crear registro
    await run(
      "INSERT INTO clientes (telefono, nombre_whatsapp, foto_perfil, bot_activo, estado_conversacion, fecha_registro, ultima_interaccion) VALUES (?, ?, ?, 1, 'BOT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      [telefono, nombre, fotoPerfil]
    );

    console.log(`✨ Nuevo cliente registrado: ${telefono} - ${nombre}`);

    // Retornar el cliente recién creado
    const newClient = await get(
      'SELECT * FROM clientes WHERE telefono = ?',
      [telefono]
    );

    return newClient;
  } catch (error) {
    console.error('❌ Error en obtenerOCrearCliente:', error);
    throw error;
  }
};

/**
 * Obtener todos los clientes con su último mensaje
 * @returns {Array} Lista de clientes con último mensaje
 */
const obtenerTodosLosClientes = async () => {
  try {
    const rows = await query(`
      SELECT 
        c.telefono,
        c.nombre_whatsapp,
        c.nombre_asignado,
        c.foto_perfil,
        c.padron,
        c.estado_deuda,
        c.bot_activo,
        c.ultima_interaccion,
        c.fecha_registro,
        (SELECT cuerpo FROM mensajes WHERE cliente_telefono = c.telefono ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje,
        (SELECT fecha FROM mensajes WHERE cliente_telefono = c.telefono ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje_fecha,
        (SELECT COUNT(*) FROM mensajes WHERE cliente_telefono = c.telefono) as total_mensajes
      FROM clientes c
      ORDER BY c.ultima_interaccion DESC
    `);

    console.log(`📋 ${rows && rows.length ? rows.length : 0} clientes obtenidos`);
    return rows || [];
  } catch (error) {
    console.error('❌ Error en obtenerTodosLosClientes:', error);
    throw error;
  }
};

/**
 * Actualizar DNI del cliente
 * TRANSACCIÓN: Actualiza DNI + timestamp en una sola operación atómica
 * AUDITORÍA: Registra el cambio en audit_log
 * @param {string} telefono - Número de teléfono
 * @param {string} dni - DNI del cliente
 * @param {string} usuario - Usuario que realizó el cambio (para auditoría)
 */
const actualizarDni = async (telefono, dni, usuario = 'SYSTEM') => {
  return withTransaction(async () => {
    try {
      console.log(`📝 Actualizando DNI en TRANSACCIÓN...`);
      
      // Obtener valor anterior para auditoría
      const clienteActual = await get(
        'SELECT padron FROM clientes WHERE telefono = ?',
        [telefono]
      );
      const valoresAnteriores = clienteActual ? { padron: clienteActual.padron } : null;

      // OPERACIÓN 1: Actualizar DNI
      const result = await run(
        'UPDATE clientes SET padron = ?, ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
        [dni, telefono]
      );
      console.log(`   ✅ DNI ${dni} actualizado para ${telefono}`);

      // AUDITORÍA: Registrar el cambio
      await registrarCambio(
        usuario,
        'UPDATE',
        'clientes',
        telefono,
        valoresAnteriores,
        { padron: dni }
      );

      return result.changes > 0;
    } catch (error) {
      console.error('❌ Error en transacción de DNI:', error.message);
      throw error;
    }
  });
};

/**
 * Obtener DNI de un cliente
 * @param {string} telefono - Número de teléfono
 * @returns {string|null} DNI o null
 */
const obtenerDni = async (telefono) => {
  try {
    const row = await get(
      'SELECT padron FROM clientes WHERE telefono = ?',
      [telefono]
    );
    return row && row.padron ? row.padron : null;
  } catch (error) {
    console.error('❌ Error obteniendo DNI:', error);
    return null;
  }
};

/**
 * Cambiar estado del bot para un cliente
 * AUDITORÍA: Registra el cambio en audit_log
 * @param {string} telefono - Número de teléfono
 * @param {boolean} activo - Estado del bot (true/false)
 * @param {string} usuario - Usuario que realizó el cambio (para auditoría)
 */
const cambiarEstadoBot = async (telefono, activo, usuario = 'SYSTEM') => {
  try {
    // Obtener estado anterior para auditoría
    const clienteActual = await get(
      'SELECT bot_activo FROM clientes WHERE telefono = ?',
      [telefono]
    );
    const valoresAnteriores = clienteActual ? { bot_activo: clienteActual.bot_activo } : null;

    await run(
      'UPDATE clientes SET bot_activo = ? WHERE telefono = ?',
      [activo ? 1 : 0, telefono]
    );

    // AUDITORÍA: Registrar el cambio
    await registrarCambio(
      usuario,
      'UPDATE',
      'clientes',
      telefono,
      valoresAnteriores,
      { bot_activo: activo }
    );

    console.log(`🤖 Bot ${activo ? 'activado' : 'pausado'} para ${telefono}`);
    return true;
  } catch (error) {
    console.error('❌ Error cambiando estado bot:', error);
    throw error;
  }
};

/**
 * Verificar si el bot está activo para un cliente
 * @param {string} telefono - Número de teléfono
 * @returns {boolean} Estado del bot
 */
const esBotActivo = async (telefono) => {
  try {
    const row = await get(
      'SELECT bot_activo FROM clientes WHERE telefono = ?',
      [telefono]
    );
    return row ? Boolean(row.bot_activo) : true;
  } catch (error) {
    console.error('❌ Error verificando estado bot:', error);
    return true; // Por defecto activo
  }
};

/**
 * Obtener cliente con todos sus datos
 * @param {string} telefono - Número de teléfono
 * @returns {Object} Datos completos del cliente
 */
const obtenerCliente = async (telefono) => {
  try {
    const row = await get(
      'SELECT * FROM clientes WHERE telefono = ?',
      [telefono]
    );
    return row || null;
  } catch (error) {
    console.error('❌ Error obteniendo cliente:', error);
    throw error;
  }
};

/**
 * Actualizar padrón superficial
 * @param {string} telefono - Número de teléfono
 * @param {string} codigoCauce - Código de cauce
 * @param {string} numeroPadron - Número de padrón
 */
const actualizarPadronSuperficial = async (telefono, codigoCauce, numeroPadron) => {
  try {
    const padronData = `${codigoCauce} ${numeroPadron}`;
    
    await run(
      'UPDATE clientes SET padron_superficial = ?, tipo_consulta_preferido = ? WHERE telefono = ?',
      [padronData, 'superficial', telefono]
    );
    
    console.log(`✅ Padrón superficial actualizado para ${telefono}: ${padronData}`);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando padrón superficial:', error);
    throw error;
  }
};

/**
 * Actualizar padrón subterráneo
 * @param {string} telefono - Número de teléfono
 * @param {string} codigoDepartamento - Código de departamento
 * @param {string} numeroPozo - Número de pozo
 */
const actualizarPadronSubterraneo = async (telefono, codigoDepartamento, numeroPozo) => {
  try {
    const padronData = `${codigoDepartamento} ${numeroPozo}`;
    
    await run(
      'UPDATE clientes SET padron_subterraneo = ?, tipo_consulta_preferido = ? WHERE telefono = ?',
      [padronData, 'subterraneo', telefono]
    );
    
    console.log(`✅ Padrón subterráneo actualizado para ${telefono}: ${padronData}`);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando padrón subterráneo:', error);
    throw error;
  }
};

/**
 * Actualizar padrón contaminación
 * @param {string} telefono - Número de teléfono
 * @param {string} numeroContaminacion - Número de contaminación
 */
const actualizarPadronContaminacion = async (telefono, numeroContaminacion) => {
  try {
    await run(
      'UPDATE clientes SET padron_contaminacion = ?, tipo_consulta_preferido = ? WHERE telefono = ?',
      [numeroContaminacion, 'contaminacion', telefono]
    );
    
    console.log(`✅ Padrón contaminación actualizado para ${telefono}: ${numeroContaminacion}`);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando padrón contaminación:', error);
    throw error;
  }
};

/**
 * Guardar último titular buscado en turnos
 * @param {string} telefono - Número de teléfono
 * @param {string} titular - Nombre del titular
 */
const guardarUltimoTitular = async (telefono, titular) => {
  try {
    await run(
      'UPDATE clientes SET last_titular = ? WHERE telefono = ?',
      [titular, telefono]
    );
    console.log(`💾 Último titular guardado: ${telefono} -> ${titular}`);
    return true;
  } catch (error) {
    console.error('❌ Error guardando último titular:', error);
    throw error;
  }
};

/**
 * Obtener último titular buscado
 * @param {string} telefono - Número de teléfono
 * @returns {string|null} Último titular o null
 */
const obtenerUltimoTitular = async (telefono) => {
  try {
    const cliente = await get(
      'SELECT last_titular FROM clientes WHERE telefono = ?',
      [telefono]
    );
    return cliente?.last_titular || null;
  } catch (error) {
    console.error('❌ Error obteniendo último titular:', error);
    return null;
  }
};

/**
 * Guardar último C.C.-P.P. buscado en turnos
 * @param {string} telefono - Número de teléfono
 * @param {string} ccpp - C.C.-P.P.
 */
const guardarUltimoCCPP = async (telefono, ccpp) => {
  try {
    await run(
      'UPDATE clientes SET last_ccpp = ? WHERE telefono = ?',
      [ccpp, telefono]
    );
    console.log(`💾 Último C.C.-P.P. guardado: ${telefono} -> ${ccpp}`);
    return true;
  } catch (error) {
    console.error('❌ Error guardando último C.C.-P.P.:', error);
    throw error;
  }
};

/**
 * Obtener último C.C.-P.P. buscado
 * @param {string} telefono - Número de teléfono
 * @returns {string|null} Último C.C.-P.P. o null
 */
const obtenerUltimoCCPP = async (telefono) => {
  try {
    const cliente = await get(
      'SELECT last_ccpp FROM clientes WHERE telefono = ?',
      [telefono]
    );
    return cliente?.last_ccpp || null;
  } catch (error) {
    console.error('❌ Error obteniendo último C.C.-P.P.:', error);
    return null;
  }
};

const ensureDefaultSubdelegacion = async () => {
  const existing = await get(
    'SELECT id, nombre, codigo, display_phone_number FROM subdelegaciones WHERE nombre = ? LIMIT 1',
    [DEFAULT_SUBDELEGACION_NOMBRE]
  );

  if (existing?.id) return existing;

  await run(
    'INSERT INTO subdelegaciones (nombre, codigo, display_phone_number, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    [DEFAULT_SUBDELEGACION_NOMBRE, DEFAULT_SUBDELEGACION_CODIGO, DEFAULT_SUBDELEGACION_DISPLAY_PHONE]
  );

  return get(
    'SELECT id, nombre, codigo, display_phone_number FROM subdelegaciones WHERE nombre = ? LIMIT 1',
    [DEFAULT_SUBDELEGACION_NOMBRE]
  );
};

const actualizarSubdelegacion = async (telefono, subdelegacion) => {
  await run(
    'UPDATE clientes SET subdelegacion = ?, ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
    [subdelegacion, telefono]
  );
  return true;
};

const actualizarEstadoConversacion = async (telefono, estado = 'BOT') => {
  await run(
    'UPDATE clientes SET estado_conversacion = ?, ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
    [estado, telefono]
  );
  return true;
};

const obtenerSubdelegacion = async (telefono) => {
  const row = await get('SELECT subdelegacion FROM clientes WHERE telefono = ? LIMIT 1', [telefono]);
  return row?.subdelegacion || null;
};

const resolverSubdelegacionPorNumeroEntrada = async (displayPhoneNumber = '') => {
  const normalizedInput = normalizePhone(displayPhoneNumber);
  if (!normalizedInput) return ensureDefaultSubdelegacion();

  const rows = await query('SELECT id, nombre, codigo, display_phone_number FROM subdelegaciones', []);
  const matched = (rows || []).find((row) => normalizePhone(row.display_phone_number) === normalizedInput);
  return matched || ensureDefaultSubdelegacion();
};

const asignarSubdelegacionPorEntradaSiFalta = async (telefono, displayPhoneNumber = '') => {
  const actual = await obtenerSubdelegacion(telefono);
  if (actual) {
    return get('SELECT id, nombre, codigo, display_phone_number FROM subdelegaciones WHERE nombre = ? LIMIT 1', [actual]);
  }

  const resolved = await resolverSubdelegacionPorNumeroEntrada(displayPhoneNumber);
  await actualizarSubdelegacion(telefono, resolved.nombre);
  return resolved;
};

const resolverSubdelegacionCliente = async (telefono) => {
  const subdelegacionNombre = await obtenerSubdelegacion(telefono);
  if (!subdelegacionNombre) {
    const fallback = await ensureDefaultSubdelegacion();
    await run(
      'UPDATE clientes SET subdelegacion = ?, ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
      [fallback.nombre, telefono]
    );
    return {
      ...fallback,
      usedFallback: true
    };
  }

  const found = await get(
    'SELECT id, nombre, codigo, display_phone_number FROM subdelegaciones WHERE nombre = ? LIMIT 1',
    [subdelegacionNombre]
  );

  if (found?.id) {
    return {
      ...found,
      usedFallback: false
    };
  }

  const fallback = await ensureDefaultSubdelegacion();
  await run(
    'UPDATE clientes SET subdelegacion = ?, ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
    [fallback.nombre, telefono]
  );
  return {
    ...fallback,
    usedFallback: true
  };
};

const crearTicketHumano = async (telefono, subdelegacionId, motivo = 'DERIVACION_HUMANO') => {
  const abierto = await get(
    `SELECT id, cliente_telefono, subdelegacion_id, estado, motivo, created_at
     FROM tickets
     WHERE cliente_telefono = ? AND estado = 'ABIERTO'
     ORDER BY created_at DESC
     LIMIT 1`,
    [telefono]
  );

  if (abierto?.id) {
    return {
      ...abierto,
      created: false
    };
  }

  const result = await run(
    `INSERT INTO tickets (cliente_telefono, subdelegacion_id, estado, motivo, created_at, updated_at)
     VALUES (?, ?, 'ABIERTO', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [telefono, subdelegacionId || null, motivo]
  );

  const ticket = await get(
    `SELECT id, cliente_telefono, subdelegacion_id, estado, motivo, created_at
     FROM tickets
     WHERE id = ? LIMIT 1`,
    [result.lastID]
  );

  return {
    ...ticket,
    created: true
  };
};

const obtenerSubdelegacionInfo = async (telefono) => {
  const subdelegacionNombre = await obtenerSubdelegacion(telefono);
  if (!subdelegacionNombre) {
    const fallback = await ensureDefaultSubdelegacion();
    return {
      id: fallback?.id || null,
      nombre: fallback?.nombre || DEFAULT_SUBDELEGACION_NOMBRE,
      usedFallback: true
    };
  }

  const found = await get('SELECT id, nombre FROM subdelegaciones WHERE nombre = ? LIMIT 1', [subdelegacionNombre]);
  if (found?.id) {
    return {
      id: found.id,
      nombre: found.nombre,
      usedFallback: false
    };
  }

  const fallback = await ensureDefaultSubdelegacion();
  return {
    id: fallback?.id || null,
    nombre: fallback?.nombre || DEFAULT_SUBDELEGACION_NOMBRE,
    usedFallback: true
  };
};

const listarTicketsPorSubdelegacion = async (subdelegacionId) => {
  if (!subdelegacionId) return [];

  const rows = await query(
    `SELECT
      t.id,
      t.cliente_telefono,
      t.subdelegacion_id,
      t.estado AS ticket_estado,
      t.motivo,
      t.created_at AS ticket_created_at,
      c.telefono,
      c.nombre_whatsapp,
      c.nombre_asignado,
      c.foto_perfil,
      c.padron,
      c.subdelegacion,
      c.estado_conversacion,
      c.estado_deuda,
      c.bot_activo,
      c.ultima_interaccion,
      c.fecha_registro,
      (SELECT cuerpo FROM mensajes WHERE cliente_telefono = c.telefono ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje,
      (SELECT fecha FROM mensajes WHERE cliente_telefono = c.telefono ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje_fecha,
      (SELECT COUNT(*) FROM mensajes WHERE cliente_telefono = c.telefono) as total_mensajes,
      (SELECT COUNT(*) FROM mensajes WHERE cliente_telefono = c.telefono AND leido = 0 AND emisor = 'usuario') as mensajes_no_leidos
    FROM tickets t
    INNER JOIN clientes c ON c.telefono = t.cliente_telefono
    WHERE t.subdelegacion_id = ?
      AND t.estado = 'ABIERTO'
    ORDER BY t.created_at DESC`,
    [subdelegacionId]
  );

  return rows || [];
};

const validarHorarioAtencionOperador = async (subdelegacionId = null, now = new Date()) => {
  const { diaSemana, minutosActuales } = getCurrentWeekdayAndMinutes(now);

  const row = await get(
    `SELECT id, subdelegacion_id, dia_semana, hora_inicio, hora_fin, habilitado, mensaje_fuera_horario
     FROM horarios_atencion
     WHERE dia_semana = ?
       AND habilitado = 1
       AND (subdelegacion_id = ? OR subdelegacion_id IS NULL)
     ORDER BY CASE WHEN subdelegacion_id = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [diaSemana, subdelegacionId, subdelegacionId]
  );

  if (!row) {
    return {
      disponible: false,
      mensaje: DEFAULT_FUERA_HORARIO_MSG,
      horario: null
    };
  }

  const inicio = parseTimeToMinutes(row.hora_inicio);
  const fin = parseTimeToMinutes(row.hora_fin);
  if (inicio === null || fin === null || fin <= inicio) {
    return {
      disponible: false,
      mensaje: row.mensaje_fuera_horario || DEFAULT_FUERA_HORARIO_MSG,
      horario: row
    };
  }

  const disponible = minutosActuales >= inicio && minutosActuales < fin;
  return {
    disponible,
    mensaje: disponible ? null : (row.mensaje_fuera_horario || DEFAULT_FUERA_HORARIO_MSG),
    horario: row
  };
};

module.exports = {
  obtenerOCrearCliente,
  obtenerTodosLosClientes,
  actualizarDni,
  obtenerDni,
  cambiarEstadoBot,
  esBotActivo,
  obtenerCliente,
  actualizarPadronSuperficial,
  actualizarPadronSubterraneo,
  actualizarPadronContaminacion,
  guardarUltimoTitular,
  obtenerUltimoTitular,
  guardarUltimoCCPP,
  obtenerUltimoCCPP,
  actualizarSubdelegacion,
  actualizarEstadoConversacion,
  obtenerSubdelegacion,
  resolverSubdelegacionPorNumeroEntrada,
  asignarSubdelegacionPorEntradaSiFalta,
  resolverSubdelegacionCliente,
  crearTicketHumano,
  obtenerSubdelegacionInfo,
  listarTicketsPorSubdelegacion,
  validarHorarioAtencionOperador
};
