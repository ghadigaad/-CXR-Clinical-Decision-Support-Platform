import multer from 'multer';

import { env } from '../config/env.js';
import { unsupportedMediaType } from '../lib/errors.js';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from '../services/imageService.js';

/**
 * Memory storage keeps X-ray pixels out of the filesystem entirely. Retention is decided
 * later by imageService, based on the STORE_* flags.
 */
const storage = multer.memoryStorage();

export const uploadCxrImage = multer({
  storage,
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 1,
    // Bound the non-file portion of the multipart body as well.
    fields: 20,
    fieldSize: 64 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const mimeAllowed = ALLOWED_MIME_TYPES.includes(
      file.mimetype as (typeof ALLOWED_MIME_TYPES)[number],
    );
    // A declared MIME type is only a hint; imageService re-checks the actual bytes.
    const extensionAllowed = ALLOWED_EXTENSIONS.some((extension) =>
      file.originalname.toLowerCase().endsWith(extension),
    );

    if (!mimeAllowed || !extensionAllowed) {
      callback(unsupportedMediaType('Only JPG, JPEG, and PNG chest X-ray images are accepted.'));
      return;
    }
    callback(null, true);
  },
}).single('image');
