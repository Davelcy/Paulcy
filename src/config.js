// Centralized configuration and constants
require('dotenv').config();

const services = [
  { id: 3036, name: "Tiktok Followers (Average Quality)", points: 2, min: 12 },
  { id: 3048, name: "Tiktok Likes (Average Quality)", points: 2, min: 12 },
  { id: 3047, name: "Tiktok Views (Average Quality)", points: 1, min: 12 },
  { id: 3051, name: "Video Saves", points: 3, min: 112 },
  { id: 3054, name: "Video Shares", points: 3, min: 112 },
  { id: 3102, name: "Tiktok Live Likes High Quality", points: 3, min: 5 },
  { id: 3103, name: "Tiktok Livestream Viewers (30 Mins WatchTime)", points: 5000, min: 50 },
  { id: 3106, name: "Instagram Followers (Average Quality)", points: 300, min: 20 },
  { id: 2997, name: "Instagram Likes (Average Quality)", points: 250, min: 20 },
  { id: 3108, name: "Instagram Video/Reel Views (Average Quality)", points: 2, min: 20 },
  { id: 3017, name: "Instagram Story Views (High Quality)", points: 300, min: 112 },
  { id: 3123, name: "Facebook Page Followers (Average Quality)", points: 0, min: 0 },
  { id: 3125, name: "Facebook Profile Followers (Average Quality)", points: 50, min: 112 },
  { id: 3129, name: "Facebook Post Likes (Average Quality)", points: 60, min: 12 },
  { id: 3131, name: "Facebook Post Reaction (Love❤️)", points: 60, min: 10 },
  { id: 3133, name: "Facebook Post Reaction (Haha😂)", points: 60, min: 10 },
  { id: 3132, name: "Facebook Post Reaction (Wow😲)", points: 60, min: 10 },
  { id: 3134, name: "Facebook Post Reaction (Sad😥)", points: 60, min: 10 },
  { id: 3135, name: "Facebook Post Reaction (Angry😡)", points: 60, min: 10 },
  { id: 2932, name: "Facebook Group Members (Average Quality)", points: 80, min: 100 },
  { id: 3137, name: "Facebook Video/Reel Views (Average Quality)", points: 20, min: 100 },
  { id: 3143, name: "Telegram Members (Average Quality)", points: 1000, min: 500 },
  { id: 2801, name: "Telegram Views (High quality)", points: 20, min: 10 },
  { id: 2804, name: "Telegram Auto Views (New & Old Posts)", points: 10, min: 20 },
  { id: 2733, name: "Telegram - Positive reactions (👍 ❤️ 🔥 🎉)", points: 40, min: 10 },
  { id: 2734, name: "Telegram - Negative reactions (👎 😢 🤯 😱 🤬 🤮 💩 🤔)", points: 40, min: 10 },
  { id: 3146, name: "Twitter Likes (Average Quality)", points: 100, min: 20 },
  { id: 3080, name: "YouTube Likes (Average Quality)", points: 40, min: 25 },
  { id: 2891, name: "Whatsapp Channel Emoji Reactions (👍❤️😂😲😥🙏)", points: 5000, min: 20 }
];

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
const FORCE_JOIN_CHANNELS = (process.env.FORCE_JOIN_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const EXO_API_KEY = process.env.EXO_API_KEY || '';
const EXO_API_BASE = process.env.EXO_API_BASE || 'https://exosupplier.com/api/v2';
const PORT = parseInt(process.env.PORT || '3000', 10);

module.exports = {
  services,
  BOT_TOKEN,
  MONGODB_URI,
  ADMIN_IDS,
  FORCE_JOIN_CHANNELS,
  BASE_URL,
  ADMIN_TOKEN,
  EXO_API_KEY,
  EXO_API_BASE,
  PORT
};
