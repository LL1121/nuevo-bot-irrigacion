const fs = require('fs/promises');
const path = require('path');
const { fileTypeFromFile } = require('file-type');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];

/**
 * Valida la firma real del archivo y su extensión declarada.
 * Si falla, elimina el archivo y lanza error.
 * @param {string} filePath Ruta absoluta del archivo
 */
async function validateFileIntegrity(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const detected = await fileTypeFromFile(filePath);
  const realMime = detected?.mime;

  // Sin firma detectable -> tratar como sospechoso
  if (!realMime || !ALLOWED_MIME.includes(realMime)) {
    await safeUnlink(filePath);
    throw new Error('Intento de archivo malicioso detectado: tipo no permitido');
  }

  // Validar coherencia extensión vs mime
  const extFromMime = realMime === 'application/pdf'
    ? 'pdf'
    : realMime === 'image/png'
    ? 'png'
    : realMime === 'image/jpeg'
    ? 'jpg'
    : null;

  if (!extFromMime || (ext && ext !== extFromMime && !(ext === 'jpeg' && extFromMime === 'jpg'))) {
    await safeUnlink(filePath);
    throw new Error('Intento de archivo malicioso detectado: extensión no coincide con contenido');
  }

  return { mime: realMime, ext: extFromMime };
}

async function safeUnlink(target) {
  try {
    await fs.unlink(target);
  } catch (err) {
    // ignore
  }
}

module.exports = { validateFileIntegrity };
