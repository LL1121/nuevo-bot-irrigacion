const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const GS_BINARIES = ['gs', 'gswin64c', 'gswin32c'];
const PDFSETTINGS_ALLOWED = new Set(['screen', 'ebook', 'printer', 'prepress', 'default']);

const runExecFile = (command, args) => new Promise((resolve, reject) => {
  execFile(command, args, (error) => {
    if (error) {
      reject(error);
      return;
    }
    resolve();
  });
});

const ensureDir = (targetPath) => {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const compressWithGhostscript = async (inputPath, outputPath, preset = 'ebook') => {
  const safePreset = PDFSETTINGS_ALLOWED.has(preset) ? preset : 'ebook';

  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    `-dPDFSETTINGS=/${safePreset}`,
    `-sOutputFile=${outputPath}`,
    inputPath
  ];

  let lastError = null;
  for (const bin of GS_BINARIES) {
    try {
      await runExecFile(bin, args);
      return { success: true, binary: bin };
    } catch (error) {
      lastError = error;
    }
  }

  return { success: false, error: lastError };
};

const compressPdfForFrontend = async ({ inputPath, outputPath, preset = 'ebook' }) => {
  if (!inputPath || !outputPath) {
    throw new Error('compressPdfForFrontend requiere inputPath y outputPath');
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`No existe el PDF de entrada: ${inputPath}`);
  }

  ensureDir(outputPath);

  const gsResult = await compressWithGhostscript(inputPath, outputPath, preset);
  if (gsResult.success) {
    try {
      const sourceSize = fs.statSync(inputPath).size;
      const outputSize = fs.statSync(outputPath).size;

      // Si la compresion no mejora el tamano, dejamos el archivo original como fallback.
      if (outputSize >= sourceSize) {
        fs.copyFileSync(inputPath, outputPath);
        return {
          compressed: false,
          reason: 'no-size-gain',
          sourceSize,
          outputSize,
          method: 'copy-fallback'
        };
      }

      return {
        compressed: true,
        sourceSize,
        outputSize,
        method: `ghostscript:${gsResult.binary}`
      };
    } catch (statError) {
      return {
        compressed: true,
        method: `ghostscript:${gsResult.binary}`,
        warning: statError.message
      };
    }
  }

  // Fallback robusto: copiar original si Ghostscript no esta disponible o falla.
  fs.copyFileSync(inputPath, outputPath);
  return {
    compressed: false,
    method: 'copy-fallback',
    reason: gsResult.error?.message || 'ghostscript-unavailable'
  };
};

module.exports = {
  compressPdfForFrontend
};
