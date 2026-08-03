const multer = require('multer');

// In-memory image upload (buffer goes straight to R2). 5 MB cap, images only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (png, jpg, webp, gif) are allowed'));
  },
});

module.exports = upload;
