const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../config/logger');

// Cloudflare R2 (S3-compatible) image storage for support attachments.
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
//      R2_PUBLIC_URL (the bucket's public base URL — r2.dev subdomain or a
//      custom domain you connect to the bucket).
const enabled = () =>
  !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
     process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL);

let _client = null;
function client() {
  if (_client) return _client;
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

// Upload an image buffer to R2, return its public URL.
async function uploadImage(buffer, contentType, prefix = 'support') {
  if (!enabled()) throw new Error('R2 storage not configured');
  const ext = EXT[contentType] || 'bin';
  const key = `${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  await client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  const base = String(process.env.R2_PUBLIC_URL).replace(/\/$/, '');
  const url = `${base}/${key}`;
  logger.info(`R2: uploaded ${key} (${buffer.length}b)`);
  return url;
}

module.exports = { uploadImage, enabled };
