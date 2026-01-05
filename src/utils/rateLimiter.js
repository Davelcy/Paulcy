// Lightweight per-user and per-IP rate limiting for bot actions (in-memory)
const userTimestamps = new Map();
const ipTimestamps = new Map();

function isRateLimitedUser(userId, seconds = 1) {
  const key = String(userId);
  const now = Date.now();
  const last = userTimestamps.get(key) || 0;
  if (now - last < seconds * 1000) return true;
  userTimestamps.set(key, now);
  return false;
}

function isRateLimitedIP(ip, seconds = 1) {
  if (!ip) return false;
  const key = String(ip);
  const now = Date.now();
  const last = ipTimestamps.get(key) || 0;
  if (now - last < seconds * 1000) return true;
  ipTimestamps.set(key, now);
  return false;
}

module.exports = {
  isRateLimitedUser,
  isRateLimitedIP
};
