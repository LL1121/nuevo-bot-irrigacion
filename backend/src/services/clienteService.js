const { query, run, get } = require('../config/db');
const { withTransaction } = require('./transactionService');
const { registrarCambio } = require('./auditService');

const OPERATOR_SCHEDULE_TIMEZONE = process.env.OPERATOR_SCHEDULE_TIMEZONE || 'America/Argentina/Mendoza';
const OPERATOR_SCHEDULE_ENABLED = String(process.env.OPERATOR_SCHEDULE_ENABLED || 'true').toLowerCase() !== 'false';
const DEFAULT_FUERA_HORARIO_MSG = '👤 En este momento no hay operadores disponibles. Probá mañana de 8:00 a 13:30.';

const normalizeText = (value = '') => String(value || '').trim().toLowerCase();

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
        "UPDATE clientes SET ultima_interaccion = CURRENT_TIMESTAMP, nombre_whatsapp = CASE WHEN (nombre_whatsapp IS NULL OR trim(nombre_whatsapp) = '' OR nombre_whatsapp = 'Sin Nombre') AND COALESCE(nombre_validado, 0) = 0 THEN ? ELSE nombre_whatsapp END, foto_perfil = COALESCE(foto_perfil, ?), estado_conversacion = COALESCE(estado_conversacion, 'BOT') WHERE telefono = ?",
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
      "INSERT INTO clientes (telefono, nombre_whatsapp, nombre_validado, foto_perfil, bot_activo, estado_conversacion, fecha_registro, ultima_interaccion) VALUES (?, ?, 0, ?, 1, 'BOT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
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
        c.subdelegacion,
        c.estado_deuda,
        c.estado_conversacion AS estado,
        c.bot_activo,
        c.ultima_interaccion,
        c.fecha_registro,
        (SELECT cuerpo FROM mensajes WHERE cliente_telefono = c.telefono ORDER BY fecha DESC LIMIT 1) AS ultimo_mensaje,
        (SELECT fecha FROM mensajes WHERE cliente_telefono = c.telefono ORDER BY fecha DESC LIMIT 1) AS ultimo_mensaje_fecha,
        (SELECT COUNT(*) FROM mensajes WHERE cliente_telefono = c.telefono) AS total_mensajes,
        (SELECT COUNT(*) FROM mensajes WHERE cliente_telefono = c.telefono AND leido = 0 AND emisor != 'operador') AS mensajes_no_leidos,
        (SELECT assigned_operator_username FROM tickets WHERE cliente_telefono = c.telefono AND estado = 'ABIERTO' ORDER BY created_at DESC LIMIT 1) AS operador,
        (SELECT assigned_operator_id FROM tickets WHERE cliente_telefono = c.telefono AND estado = 'ABIERTO' ORDER BY created_at DESC LIMIT 1) AS operador_id
      FROM clientes c
      ORDER BY c.ultima_interaccion DESC
    `);

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
 * Actualizar nombre visible del cliente
 * @param {string} telefono - Número de teléfono
 * @param {string} nombre - Nombre validado provisto por el usuario
 * @returns {boolean} true si se actualizó
 */
const actualizarNombreWhatsapp = async (telefono, nombre, nombreValidado = false) => {
  try {
    const result = await run(
      'UPDATE clientes SET nombre_whatsapp = ?, nombre_validado = ?, ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
      [nombre, nombreValidado ? 1 : 0, telefono]
    );

    return result.changes > 0;
  } catch (error) {
    console.error('❌ Error actualizando nombre_whatsapp:', error);
    throw error;
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

const actualizarSubdelegacion = async (telefono, subdelegacion) => {
  await run(
    'UPDATE clientes SET subdelegacion = ?, ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
    [subdelegacion, telefono]
  );
  return true;
};

const listarSubdelegaciones = async () => {
  const rows = await query(
    'SELECT id, nombre, codigo, display_phone_number FROM subdelegaciones ORDER BY nombre ASC',
    []
  );
  return rows || [];
};

const LOCALIDADES_ALIASES = {
  sede_central: ['sede central', 'sede_central', 'central', 'sc'],
  rio_tunyuan_superior: ['rio tunyuan superior', 'rio tunuyan superior', 'tunuyan superior', 'tunuyan sup', 'rts', 'sub. río tunuyán superior', 'subdelegacion rio tunuyan superior'],
  rio_mendoza: ['rio mendoza', 'mendoza', 'rm', 'sub. río mendoza', 'subdelegacion rio mendoza'],
  rio_atuel: ['rio atuel', 'atuel', 'ra', 'sub. río atuel', 'subdelegacion rio atuel'],
  zona_riego_malargue: ['zona de riego malargue', 'zona de riego malargüe', 'zona riego malargue', 'zona riego malargüe', 'malargue', 'malargüe', 'zrm'],
  rio_diamante: ['rio diamante', 'diamante', 'rd', 'sub. río diamante', 'subdelegacion rio diamante'],
  rio_tunyuan_inferior: ['rio tunyuan inferior', 'rio tunuyan inferior', 'tunuyan inferior', 'tunuyan inf', 'rti', 'sub. río tunuyán inferior', 'subdelegacion rio tunuyan inferior']
};

const LOCALIDADES_CANONICAS = {
  sede_central: 'Sede Central',
  rio_tunyuan_superior: 'Subdelegación Río Tunuyán Superior',
  rio_mendoza: 'Subdelegación Río Mendoza',
  rio_atuel: 'Subdelegación Río Atuel',
  zona_riego_malargue: 'Zona de Riego Malargüe',
  rio_diamante: 'Subdelegación Río Diamante',
  rio_tunyuan_inferior: 'Subdelegación Río Tunuyán Inferior'
};

const toLookupKey = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const resolverSubdelegacionDesdeEntrada = async (entrada = '') => {
  const normalizedInput = normalizeText(entrada);
  if (!normalizedInput) return null;

  const rows = await listarSubdelegaciones();
  const normalizedSlug = toLookupKey(entrada);
  const numericMatch = normalizedInput.match(/^subdelegacion_(\d+)$/) || normalizedInput.match(/^(\d+)$/);
  const numericId = numericMatch ? Number(numericMatch[1]) : null;

  const aliasMatch = Object.entries(LOCALIDADES_ALIASES).find(([aliasKey, aliases]) => {
    const candidates = [aliasKey, ...aliases].map((value) => toLookupKey(value));
    return candidates.some((candidate) => (
      normalizedSlug === candidate ||
      normalizedSlug.includes(candidate) ||
      normalizedSlug.endsWith(`_${candidate}`)
    ));
  });
  const aliasKey = aliasMatch ? aliasMatch[0] : null;

  const keyMatches = (sourceKey, targetKey) => {
    if (!sourceKey || !targetKey) return false;
    return sourceKey === targetKey || sourceKey.includes(targetKey) || targetKey.includes(sourceKey);
  };

  const matchedRow = rows.find((row) => {
    if (numericId && Number(row.id) === numericId) {
      return true;
    }

    const nombre = normalizeText(row.nombre);
    const nombreKey = toLookupKey(nombre);
    const codigo = normalizeText(row.codigo);
    const rowKey = toLookupKey(row.nombre);
    const codigoKey = toLookupKey(row.codigo);
    return (
      nombre === normalizedInput ||
      nombreKey === normalizedSlug ||
      codigo === normalizedInput ||
      nombre.includes(normalizedInput) ||
      nombreKey.includes(normalizedSlug) ||
      keyMatches(rowKey, normalizedSlug) ||
      keyMatches(codigoKey, normalizedSlug) ||
      (aliasKey && (keyMatches(rowKey, aliasKey) || keyMatches(codigoKey, aliasKey)))
    );
  }) || null;

  if (matchedRow) {
    return matchedRow;
  }

  if (aliasKey) {
    const canonicalName = LOCALIDADES_CANONICAS[aliasKey] || aliasKey.replace(/_/g, ' ');
    const dbMatchByCanonical = rows.find((row) => toLookupKey(row.nombre) === toLookupKey(canonicalName));
    if (dbMatchByCanonical) {
      return dbMatchByCanonical;
    }

    return {
      id: null,
      nombre: canonicalName,
      codigo: aliasKey,
      display_phone_number: null,
      fallback: true
    };
  }

  return null;
};

const asignarSubdelegacionCliente = async (telefono, subdelegacionRef) => {
  if (!subdelegacionRef) return null;

  const ref = typeof subdelegacionRef === 'object'
    ? subdelegacionRef
    : { id: subdelegacionRef };

  let subdelegacion = null;

  if (ref.id) {
    subdelegacion = await get(
      'SELECT id, nombre, codigo, display_phone_number FROM subdelegaciones WHERE id = ? LIMIT 1',
      [ref.id]
    );
  }

  if (!subdelegacion?.nombre && ref.nombre) {
    subdelegacion = {
      id: null,
      nombre: ref.nombre,
      codigo: ref.codigo || null,
      display_phone_number: null,
      fallback: true
    };
  }

  if (!subdelegacion?.nombre) {
    return null;
  }

  await actualizarSubdelegacion(telefono, subdelegacion.nombre);
  return subdelegacion;
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

const resolverSubdelegacionCliente = async (telefono) => {
  const subdelegacionNombre = await obtenerSubdelegacion(telefono);
  if (!subdelegacionNombre) return null;

  return get(
    'SELECT id, nombre, codigo, display_phone_number FROM subdelegaciones WHERE nombre = ? LIMIT 1',
    [subdelegacionNombre]
  );
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

const obtenerTicketAbiertoPorTelefono = async (telefono) => {
  if (!telefono) return null;

  return get(
    `SELECT id, cliente_telefono, subdelegacion_id, estado, motivo, assigned_operator_id, assigned_operator_username, assigned_at, created_at, updated_at
     FROM tickets
     WHERE cliente_telefono = ? AND estado = 'ABIERTO'
     ORDER BY created_at DESC
     LIMIT 1`,
    [telefono]
  );
};

const cerrarTicketHumano = async (telefono, motivoCierre = 'FINALIZADO_OPERADOR') => {
  if (!telefono) return null;

  const ticketAbierto = await obtenerTicketAbiertoPorTelefono(telefono);
  if (!ticketAbierto?.id) return null;

  await run(
    `UPDATE tickets
     SET estado = 'CERRADO',
         motivo = COALESCE(?, motivo),
         updated_at = CURRENT_TIMESTAMP,
         closed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [motivoCierre || null, ticketAbierto.id]
  );

  return get(
    `SELECT id, cliente_telefono, subdelegacion_id, estado, motivo, assigned_operator_id, assigned_operator_username, assigned_at, created_at, updated_at, closed_at
     FROM tickets
     WHERE id = ?
     LIMIT 1`,
    [ticketAbierto.id]
  );
};

const obtenerContextoOperador = async (user = {}) => {
  if (!user?.id && !user?.username && !user?.email) {
    return null;
  }

  return get(
    `SELECT
      o.id,
      o.username,
      o.email,
      o.role,
      o.subdelegacion_id,
      s.nombre AS subdelegacion_nombre,
      s.codigo AS subdelegacion_codigo
    FROM operadores o
    LEFT JOIN subdelegaciones s ON s.id = o.subdelegacion_id
    WHERE o.id = ? OR o.username = ? OR o.email = ?
    LIMIT 1`,
    [user.id || null, user.username || null, user.email || null]
  );
};

const tomarTicketEnEspera = async ({
  telefono,
  operadorId,
  operadorNombre,
  subdelegacionId,
  isAdmin = false
}) => {
  if (!telefono || !operadorId) return null;

  return get(
    `UPDATE tickets t
     SET
       assigned_operator_id = ?,
       assigned_operator_username = ?,
       assigned_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     FROM clientes c
     WHERE c.telefono = t.cliente_telefono
       AND t.cliente_telefono = ?
       AND t.estado = 'ABIERTO'
       AND c.estado_conversacion = 'ESPERA_OPERADOR'
       AND (t.assigned_operator_id IS NULL OR t.assigned_operator_id = ?)
       AND (? = 1 OR t.subdelegacion_id = ?)
     RETURNING
       t.id,
       t.cliente_telefono,
       t.subdelegacion_id,
       t.estado,
       t.motivo,
       t.assigned_operator_id,
       t.assigned_operator_username,
       t.assigned_at,
       t.created_at,
       t.updated_at`,
    [
      operadorId,
      operadorNombre || null,
      telefono,
      operadorId,
      isAdmin ? 1 : 0,
      subdelegacionId || null
    ]
  );
};

const transferirTicketSubdelegacion = async ({
  telefono,
  targetSubdelegacionId,
  sourceSubdelegacionId,
  actorOperatorId,
  actorOperatorUsername,
  motivo = '',
  isAdmin = false
}) => {
  if (!telefono || !targetSubdelegacionId) return null;

  return get(
    `UPDATE tickets t
     SET
       subdelegacion_id = ?,
       assigned_operator_id = NULL,
       assigned_operator_username = NULL,
       assigned_at = NULL,
       motivo = CASE
         WHEN COALESCE(?, '') <> '' THEN CONCAT(COALESCE(t.motivo, ''), CASE WHEN COALESCE(t.motivo, '') = '' THEN '' ELSE ' | ' END, ?)
         ELSE t.motivo
       END,
       updated_at = CURRENT_TIMESTAMP
     FROM clientes c
     WHERE c.telefono = t.cliente_telefono
       AND t.cliente_telefono = ?
       AND t.estado = 'ABIERTO'
       AND (? = 1 OR t.subdelegacion_id = ?)
       AND (
         ? = 1
         OR t.assigned_operator_id IS NULL
         OR t.assigned_operator_id = ?
       )
     RETURNING
       t.id,
       t.cliente_telefono,
       t.subdelegacion_id,
       t.estado,
       t.motivo,
       t.assigned_operator_id,
       t.assigned_operator_username,
       t.assigned_at,
       t.created_at,
       t.updated_at`,
    [
      targetSubdelegacionId,
      motivo,
      motivo,
      telefono,
      isAdmin ? 1 : 0,
      sourceSubdelegacionId || null,
      isAdmin ? 1 : 0,
      actorOperatorId || null
    ]
  );
};

const obtenerSubdelegacionInfo = async (telefono) => {
  const subdelegacionNombre = await obtenerSubdelegacion(telefono);
  if (!subdelegacionNombre) return null;

  const found = await get('SELECT id, nombre FROM subdelegaciones WHERE nombre = ? LIMIT 1', [subdelegacionNombre]);
  if (found?.id) {
    return {
      id: found.id,
      nombre: found.nombre,
      usedFallback: false
    };
  }

  return null;
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
      t.assigned_operator_id,
      t.assigned_operator_username,
      t.assigned_at,
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
      AND t.assigned_operator_id IS NULL
      AND c.estado_conversacion = 'ESPERA_OPERADOR'
    ORDER BY t.created_at DESC`,
    [subdelegacionId]
  );

  return rows || [];
};

const listarTicketsEnEspera = async () => {
  const rows = await query(
    `SELECT
      t.id,
      t.cliente_telefono,
      t.subdelegacion_id,
      t.estado AS ticket_estado,
      t.motivo,
      t.assigned_operator_id,
      t.assigned_operator_username,
      t.assigned_at,
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
    WHERE t.estado = 'ABIERTO'
      AND t.assigned_operator_id IS NULL
      AND c.estado_conversacion = 'ESPERA_OPERADOR'
    ORDER BY t.created_at DESC`,
    []
  );

  return rows || [];
};

const validarHorarioAtencionOperador = async (subdelegacionId = null, now = new Date()) => {
  if (!OPERATOR_SCHEDULE_ENABLED) {
    return {
      disponible: true,
      mensaje: null,
      horario: null,
      bypass: true
    };
  }

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

const obtenerUltimoTicketCerrado = async (telefono) => {
  if (!telefono) return null;
  return get(
    `SELECT id
     FROM tickets
     WHERE cliente_telefono = ?
       AND estado = 'CERRADO'
     ORDER BY COALESCE(closed_at, updated_at, created_at) DESC
     LIMIT 1`,
    [telefono]
  );
};

const guardarEncuestaSatisfaccionOperador = async (telefono, calificacion, canal = 'whatsapp') => {
  const calificacionNum = Number(calificacion);
  if (!telefono || Number.isNaN(calificacionNum) || calificacionNum < 1 || calificacionNum > 5) {
    return null;
  }

  const ultimoTicket = await obtenerUltimoTicketCerrado(telefono);
  const result = await run(
    `INSERT INTO encuestas_operador (cliente_telefono, ticket_id, calificacion, canal, created_at, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [telefono, ultimoTicket?.id || null, calificacionNum, canal]
  );

  if (!result?.lastID) return null;
  return get('SELECT * FROM encuestas_operador WHERE id = ? LIMIT 1', [result.lastID]);
};

const guardarOpinionEncuestaOperador = async (telefono, opinion) => {
  const texto = String(opinion || '').trim();
  if (!telefono || !texto) return null;

  const ultimaEncuestaSinOpinion = await get(
    `SELECT id
     FROM encuestas_operador
     WHERE cliente_telefono = ?
       AND (opinion IS NULL OR trim(opinion) = '')
     ORDER BY created_at DESC
     LIMIT 1`,
    [telefono]
  );

  if (ultimaEncuestaSinOpinion?.id) {
    await run(
      `UPDATE encuestas_operador
       SET opinion = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [texto, ultimaEncuestaSinOpinion.id]
    );
    return get('SELECT * FROM encuestas_operador WHERE id = ? LIMIT 1', [ultimaEncuestaSinOpinion.id]);
  }

  const ultimoTicket = await obtenerUltimoTicketCerrado(telefono);
  const result = await run(
    `INSERT INTO encuestas_operador (cliente_telefono, ticket_id, opinion, canal, created_at, updated_at)
     VALUES (?, ?, ?, 'whatsapp', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [telefono, ultimoTicket?.id || null, texto]
  );

  if (!result?.lastID) return null;
  return get('SELECT * FROM encuestas_operador WHERE id = ? LIMIT 1', [result.lastID]);
};

module.exports = {
  obtenerOCrearCliente,
  obtenerTodosLosClientes,
  actualizarNombreWhatsapp,
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
  listarSubdelegaciones,
  resolverSubdelegacionDesdeEntrada,
  asignarSubdelegacionCliente,
  actualizarEstadoConversacion,
  obtenerSubdelegacion,
  resolverSubdelegacionCliente,
  crearTicketHumano,
  obtenerTicketAbiertoPorTelefono,
  cerrarTicketHumano,
  obtenerContextoOperador,
  tomarTicketEnEspera,
  transferirTicketSubdelegacion,
  obtenerSubdelegacionInfo,
  listarTicketsPorSubdelegacion,
  listarTicketsEnEspera,
  validarHorarioAtencionOperador,
  guardarEncuestaSatisfaccionOperador,
  guardarOpinionEncuestaOperador
};
