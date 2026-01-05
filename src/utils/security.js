// Utilities for IP extraction and device fingerprinting
const crypto = require('crypto');

function extractIP(req) {
  // Robust extraction from headers
  const headers = req.headers || {};
  const ip = headers['cf-connecting-ip'] ||
             (headers['x-forwarded-for'] ? headers['x-forwarded-for'].split(',')[0].trim() : null) ||
             req.connection && req.connection.remoteAddress ||
             req.socket && req.socket.remoteAddress ||
             req.ip || null;
  return ip;
}

// Simple device fingerprint using UA + accept-language + timezone
function deviceFingerprint(req) {
  const ua = req.headers['user-agent'] || '';
  const lang = req.headers['accept-language'] || '';
  const tz = req.query.tz || ''; // optional timezone from client
  const raw = `${ua}||${lang}||${tz}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = {
  extractIP,
  deviceFingerprint
};
