const multer = require('multer');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

fs.mkdirSync(config.UPLOAD_PATH, { recursive: true });
const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const allowedExtensions = { 'application/pdf': ['.pdf'], 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] };
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.UPLOAD_PATH),
  filename: (_req, _file, cb) => cb(null, `${randomUUID()}.upload`)
});
const upload = multer({
  storage,
  limits: { fileSize: config.MAX_UPLOAD_BYTES, files: 1, fields: 10 },
  fileFilter(_req, file, cb) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowed.has(file.mimetype) || !allowedExtensions[file.mimetype]?.includes(extension)) return cb(new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'File extension and MIME type must match an allowed PDF, PNG, JPEG, DOCX, or XLSX type'));
    cb(null, true);
  }
});
function singleEvidence(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the configured size limit'));
    if (error instanceof multer.MulterError) return next(new ApiError(400, 'VALIDATION_ERROR', error.message));
    return next(error);
  });
}
module.exports = { singleEvidence, allowed };
