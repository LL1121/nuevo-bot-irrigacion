const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage with unique filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = mime.extension(file.mimetype) || path.extname(file.originalname).replace('.', '') || 'bin';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    cb(null, uniqueName);
  }
});

// File filter: allow images and pdfs only
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Tipo de archivo no permitido. Solo jpg, png o pdf.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

module.exports = upload;
