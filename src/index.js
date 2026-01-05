/**
 * Main entry: sets up Telegraf bot, minimal Express verification endpoint,
 * MongoDB connection, and all bot commands / admin-only commands.
 *
 * Admin UI is handled entirely inside the Telegram bot.
 */
const express = require('express');
const http = require('http');
const morgan = require('morgan');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const uuid = require('uuid');
const path = require('path');

const {
  BOT_TOKEN, MONGODB_URI, ADMIN_IDS, FORCE_JOIN_CHANNELS,
  BASE_URL, PORT
} = require('./config');

const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Referral = require('./models/Referral');
const Order = require('./models/Order');
const AdminLog = require('./models/AdminLog');
const Task = require('./models/Task');

const { extractIP, deviceFingerprint } = require('./utils/security');
const { isRateLimitedUser } = require('./utils/rateLimiter');
const exo = require('./api/exosupplier');
const servicesList = require('./config').services;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error', err);
  process.exit(1);
});

// Initialize Telegraf bot
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN missing in environment');
  process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);

// Simple middleware: ensure user exists in DB
bot.use(async (ctx, next) => {
  try {
    if (!ctx.from) return next();
    const userId = ctx.from.id;
    let user = await User.findOne({ user_id: userId });
    if (!user) {
      const referral_code = uuid.v4();
      user = await User.create({
        user_id: userId,
        username: ctx.from.username || `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`,
        referral_code
      });
    }
    ctx.dbUser = user;
    if (user.status === 'banned' || user.status === 'blocked') {
      return ctx.reply('Your account is restricted. Contact support.');
    }
  } catch (err) {
    console.error('Middleware user init error', err);
  }
  return next();
});

// Force join checker
async function checkForceJoin(ctx) {
  try {
    for (const ch of FORCE_JOIN_CHANNELS) {
      try {
        const res = await ctx.telegram.getChatMember(ch, ctx.from.id);
        if (res && (res.status === 'left' || res.status === 'kicked' || res.status === 'restricted')) {
          return { ok: false, channel: ch };
        }
      } catch (err) {
        // If getChatMember fails (e.g. bot not admin), treat as not joined
        return { ok: false, channel: ch, error: err.message };
      }
    }
    return { ok: true };
  } catch (err) {
    console.error('checkForceJoin error', err);
    return { ok: true }; // fail-open on unexpected error to avoid blocking users
  }
}

// Helper: isAdmin
function isAdmin(id) {
  if (!id) return false;
  if (ADMIN_IDS && ADMIN_IDS.length && ADMIN_IDS.includes(id)) return true;
  return false;
}

// Build services pagination
function buildServicesPage(page = 0, pageSize = 8) {
  const start = page * pageSize;
  const slice = servicesList.slice(start, start + pageSize);
  const keyboard = slice.map(s => [Markup.button.callback(`${s.id} | ${s.name} — ${s.points}pts (min ${s.min})`, `svc_${s.id}`)]);
  const nav = [];
  if (start > 0) nav.push(Markup.button.callback('⬅️ Prev', `svc_page_${page - 1}`));
  if (start + pageSize < servicesList.length) nav.push(Markup.button.callback('Next ➡️', `svc_page_${page + 1}`));
  if (nav.length) keyboard.push(nav);
  return Markup.inlineKeyboard(keyboard);
}

// /start with referral handling and force-join
bot.start(async (ctx) => {
  try {
    // Referral handling
    const payload = (ctx.startPayload || '').trim();
    if (payload && payload.startsWith('ref_')) {
      const refId = parseInt(payload.split('_')[1], 10);
      const existing = await Referral.findOne({ referred_id: ctx.from.id });
      if (!existing && refId && refId !== ctx.from.id) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const refUser = await User.findOne({ user_id: refId }).session(session);
          if (refUser) {
            refUser.balance += 20; // referral bonus
            refUser.referrals += 1;
            await refUser.save({ session });
            await Transaction.create([{ user_id: refId, amount: 20, type: 'referral', service_id: null, details: `Referral of ${ctx.from.id}` }], { session });
            await Referral.create([{ referrer_id: refId, referred_id: ctx.from.id, points_earned: 20 }], { session });
            await session.commitTransaction();
            session.endSession();
          } else {
            await session.abortTransaction();
            session.endSession();
          }
        } catch (err) {
          await session.abortTransaction();
          session.endSession();
        }
      }
    }

    // Force join check
    const fj = await checkForceJoin(ctx);
    if (!fj.ok) {
      const joinBtn = Markup.inlineKeyboard([
        [Markup.button.url('Join Channel', `https://t.me/${String(fj.channel).replace('@', '')}`)],
        [Markup.button.callback('I joined ✅', 'check_join')]
      ]);
      return ctx.reply(`Welcome! To use this bot you must join ${fj.channel}. Click below to join then press "I joined".`, joinBtn);
    }

    // Normal welcome
    const welcome = `Welcome ${ctx.from.first_name || ''}!\nUse the menu or commands to interact.\n\nCommands:\n/balance - Check points\n/services - View services\n/tasks - Daily tasks\n/referral - Get your referral link\n/order [service_id] [quantity] - Place order\n/history - View orders\n/help - Bot instructions\n\nAdmins: use /admin for admin commands.`;
    return ctx.reply(welcome, Markup.inlineKeyboard([
      [Markup.button.callback('Services', 'menu_services'), Markup.button.callback('Balance', 'menu_balance')],
      [Markup.button.callback('Tasks', 'menu_tasks'), Markup.button.callback('Referral', 'menu_referral')]
    ]));
  } catch (err) {
    console.error('/start error', err);
    return ctx.reply('An unexpected error occurred. Please try again later.');
  }
});

// Button callback: check join
bot.action('check_join', async (ctx) => {
  try {
    const fj = await checkForceJoin(ctx);
    if (fj.ok) {
      return ctx.editMessageText('Thank you for joining! Use the menu or /help to continue.');
    } else {
      return ctx.answerCbQuery('You still have not joined the required channel.', { show_alert: true });
    }
  } catch (err) {
    console.error('check_join error', err);
    return ctx.answerCbQuery('Error checking join status.');
  }
});

// Menu handlers
bot.action('menu_services', async (ctx) => {
  await ctx.editMessageText('Available services:', buildServicesPage(0));
});

bot.action(/svc_page_(\d+)/, async (ctx) => {
  const page = parseInt(ctx.match[1], 10);
  await ctx.editMessageText('Available services:', buildServicesPage(page));
});

bot.action(/svc_(\d+)/, async (ctx) => {
  const sid = parseInt(ctx.match[1], 10);
  const svc = servicesList.find(s => s.id === sid);
  if (!svc) return ctx.answerCbQuery('Service not found');
  await ctx.answerCbQuery();
  await ctx.reply(`Service: ${svc.name}\nID: ${svc.id}\nPoints per unit: ${svc.points}\nMinimum: ${svc.min}\n\nPlace order with /order ${svc.id} [quantity]`);
});

// /services command
bot.command('services', async (ctx) => {
  try {
    await ctx.reply('Choose a service:', buildServicesPage(0));
  } catch (err) {
    console.error('/services error', err);
    await ctx.reply('Error fetching services.');
  }
});

// /balance
bot.command('balance', async (ctx) => {
  const user = ctx.dbUser;
  await ctx.reply(`Your balance: ${user.balance} points`);
});

// /referral
bot.command('referral', async (ctx) => {
  const user = ctx.dbUser;
  const botInfo = await ctx.telegram.getMe();
  const botRef = `https://t.me/${botInfo.username}?start=ref_${user.user_id}`;
  const link = `${BASE_URL}/verify?u=${user.user_id}`;
  await ctx.reply(`Your referral link (Telegram): ${botRef}\n\nVerification link (open once to capture IP/device): ${link}`);
});

// /tasks - show tasks
bot.command('tasks', async (ctx) => {
  const tasks = await Task.find({ active: true });
  if (!tasks.length) return ctx.reply('No active tasks currently. Admins will add tasks soon.');
  const keyboard = tasks.map(t => [Markup.button.callback(`${t.title} (+${t.points} pts)`, `task_${t._id}`)]);
  await ctx.reply('Tasks:', Markup.inlineKeyboard(keyboard));
});

bot.action(/task_(.+)/, async (ctx) => {
  try {
    const taskId = ctx.match[1];
    const task = await Task.findById(taskId);
    if (!task || !task.active) return ctx.answerCbQuery('Task not available.');
    if (task.claimed_by.includes(ctx.from.id)) {
      return ctx.answerCbQuery('You already claimed this task.');
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      task.claimed_by.push(ctx.from.id);
      await task.save({ session });
      await Transaction.create([{ user_id: ctx.from.id, amount: task.points, type: 'task', details: `Task ${task.title}` }], { session });
      const user = await User.findOne({ user_id: ctx.from.id }).session(session);
      user.balance += task.points;
      await user.save({ session });
      await session.commitTransaction();
      session.endSession();
      await ctx.answerCbQuery(`Task claimed +${task.points} points`);
      await ctx.reply(`You earned +${task.points} points for: ${task.title}`);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error('task claim error', err);
      await ctx.answerCbQuery('Task claim failed.');
    }
  } catch (err) {
    console.error('task action error', err);
    await ctx.answerCbQuery('Error');
  }
});

// /order [service_id] [quantity]
bot.command('order', async (ctx) => {
  try {
    if (isRateLimitedUser(ctx.from.id, 1)) return ctx.reply('Slow down a bit.');

    const args = ctx.message.text.split(' ').filter(Boolean);
    if (args.length < 3) return ctx.reply('Usage: /order [service_id] [quantity]');

    const serviceId = parseInt(args[1], 10);
    const quantity = parseInt(args[2], 10);
    const svc = servicesList.find(s => s.id === serviceId);
    if (!svc) return ctx.reply('Service not found.');
    if (quantity < svc.min) return ctx.reply(`Minimum order for this service is ${svc.min}.`);

    const total = svc.points * quantity;
    const user = await User.findOne({ user_id: ctx.from.id });
    if (user.balance < total) return ctx.reply('Insufficient balance.');

    // Deduct and create order using transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    let order;
    try {
      user.balance -= total;
      await user.save({ session });
      await Transaction.create([{ user_id: user.user_id, amount: total, type: 'debit', service_id: serviceId, details: `Order ${serviceId} x ${quantity}` }], { session });

      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      order = await Order.create([{
        order_id: orderId,
        user_id: user.user_id,
        service_id: serviceId,
        quantity,
        total_points: total,
        status: 'pending'
      }], { session });
      await session.commitTransaction();
      session.endSession();
      order = order[0];
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error('order DB transaction error', err);
      return ctx.reply('Failed to create order.');
    }

    // In a production flow you should ask the user for the target link. For now we use a placeholder.
    try {
      const fakeLink = 'http://placeholder.link';
      const apiRes = await exo.createOrder(serviceId, fakeLink, quantity);
      order.external_id = apiRes && (apiRes.id || apiRes.order_id || String(apiRes));
      order.status = 'processing';
      await order.save();
      await ctx.reply(`Order created: ${order.order_id}\nStatus: ${order.status}`);
    } catch (err) {
      console.error('External API order error', err);
      order.status = 'failed';
      await order.save();
      await ctx.reply(`Order created but failed to process with supplier. Order ID: ${order.order_id}. Support will review.`);
    }
  } catch (err) {
    console.error('/order error', err);
    await ctx.reply('Error placing order.');
  }
});

// /history
bot.command('history', async (ctx) => {
  const orders = await Order.find({ user_id: ctx.from.id }).sort({ timestamp: -1 }).limit(20);
  if (!orders.length) return ctx.reply('No orders found.');
  const lines = orders.map(o => `${o.order_id} | ${o.service_id} x${o.quantity} | ${o.total_points}pts | ${o.status}`);
  await ctx.reply(lines.join('\n'));
});

// /help
bot.command('help', async (ctx) => {
  await ctx.reply('Bot instructions:\n- Use /services to see available services\n- Use /order [service_id] [quantity] to order\n- You must join required channels before using the bot\n- Use /referral to get your referral link and earn points\n- Use /tasks to claim tasks\n- Admins have restricted commands via /admin');
});

// Admin-only bot commands
bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Unauthorized');
  await ctx.reply('Admin Panel (bot):\n- /broadcast [message]\n- /addpoints [user_id] [amount]\n- /users\n- /orders\n- /ban [user_id]\n- /logs\n- /addtask\nUse these commands directly in chat.');
});

bot.command('broadcast', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Unauthorized');
  const msg = ctx.message.text.replace(/^\/broadcast\s*/, '').trim();
  if (!msg) return ctx.reply('Usage: /broadcast [message]');
  // broadcast to all users (be careful in production to batch and rate limit)
  const users = await User.find({ status: 'active' });
  let sent = 0;
  for (const u of users) {
    try {
      await ctx.telegram.sendMessage(u.user_id, msg);
      sent++;
    } catch (err) {
      // ignore individual send errors
    }
  }
  await AdminLog.create({ admin_id: ctx.from.id, action: 'broadcast', details: `message: ${msg}`, timestamp: new Date() });
  await ctx.reply(`Broadcast sent to ${sent} users (attempted ${users.length}).`);
});

bot.command('addpoints', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Unauthorized');
  const args = ctx.message.text.split(/\s+/);
  if (args.length < 3) return ctx.reply('Usage: /addpoints [user_id] [amount]');
  const uid = parseInt(args[1], 10);
  const amt = parseInt(args[2], 10);
  if (!uid || !amt) return ctx.reply('Invalid args');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findOne({ user_id: uid }).session(session);
    if (!user) throw new Error('User not found');
    user.balance += amt;
    await user.save({ session });
    await Transaction.create([{ user_id: uid, amount: amt, type: 'admin', details: `Admin ${ctx.from.id} added points` }], { session });
    await session.commitTransaction();
    session.endSession();
    await AdminLog.create({ admin_id: ctx.from.id, action: 'addpoints', details: `to ${uid} amount ${amt}` });
    await ctx.reply(`Added ${amt} points to ${uid}`);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('addpoints error', err);
    await ctx.reply('Failed to add points.');
  }
});

bot.command('users', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Unauthorized');
  const users = await User.find().limit(100).sort({ joined_date: -1 });
  const lines = users.map(u => `${u.user_id} | ${u.username || ''} | ${u.balance}pts | ${u.status}`);
  await ctx.reply(lines.join('\n') || 'No users');
});

bot.command('orders', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Unauthorized');
  const orders = await Order.find().sort({ timestamp: -1 }).limit(200);
  const lines = orders.map(o => `${o.order_id} | UID: ${o.user_id} | ${o.service_id} x${o.quantity} | ${o.total_points} | ${o.status}`);
  await ctx.reply(lines.join('\n') || 'No orders');
});

bot.command('ban', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Unauthorized');
  const args = ctx.message.text.split(/\s+/);
  if (args.length < 2) return ctx.reply('Usage: /ban [user_id]');
  const uid = parseInt(args[1], 10);
  if (!uid) return ctx.reply('Invalid user id');
  await User.updateOne({ user_id: uid }, { status: 'banned' });
  await AdminLog.create({ admin_id: ctx.from.id, action: 'ban', details: `banned ${uid}` });
  await ctx.reply(`User ${uid} banned.`);
});

bot.command('logs', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Unauthorized');
  const logs = await AdminLog.find().sort({ timestamp: -1 }).limit(200);
  const lines = logs.map(l => `${l.timestamp.toISOString()} | ${l.admin_id} | ${l.action} | ${l.details}`);
  await ctx.reply(lines.join('\n') || 'No logs');
});

bot.command('addtask', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Unauthorized');
  // Usage: /addtask [points] [title...]
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 3) return ctx.reply('Usage: /addtask [points] [title]');
  const pts = parseInt(parts[1], 10);
  const title = parts.slice(2).join(' ');
  const t = await Task.create({ title, points: isNaN(pts) ? 10 : pts, created_by: ctx.from.id });
  await AdminLog.create({ admin_id: ctx.from.id, action: 'addtask', details: `task ${t._id} ${title}` });
  await ctx.reply(`Task added: ${title} (+${t.points} pts)`);
});

// Inline handler for verification instructions
bot.action(/verify_(.+)/, async (ctx) => {
  await ctx.reply('To finish verification please open the verification link sent by the bot to capture IP/device.');
});

// Bot error handling
bot.catch((err) => {
  console.error('Bot error', err);
});

// Minimal Express server for verification endpoint only
const app = express();
app.use(helmet());
app.use(morgan('combined'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Rate limiter for verification endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300
});
app.use(limiter);

// Verification endpoint: captures IP and UA for device fingerprinting and links to user account
app.get('/verify', async (req, res) => {
  try {
    const uid = parseInt(req.query.u || req.query.user || req.query.uid, 10);
    if (!uid) return res.status(400).send('Missing user id');
    const ip = extractIP(req);
    const device = deviceFingerprint(req);
    // Detect duplicates
    const usersWithIP = await User.find({ ip_address: ip, user_id: { $ne: uid }, status: 'active' });
    const usersWithDevice = await User.find({ device_id: device, user_id: { $ne: uid }, status: 'active' });
    if (usersWithIP.length > 0 || usersWithDevice.length > 0) {
      // Block the new account and alert admins
      await User.updateOne({ user_id: uid }, { status: 'blocked', ip_address: ip, device_id: device, verified: true });
      await AdminLog.create({ admin_id: 0, action: 'anti_cheat_block', details: `User ${uid} blocked due to duplicate IP/device` });
      return res.send('Your account has been flagged due to IP/device duplication and blocked. Contact support.');
    }
    // Save and mark verified
    await User.updateOne({ user_id: uid }, { ip_address: ip, device_id: device, verified: true });
    res.send('Verification successful. You may return to Telegram.');
  } catch (err) {
    console.error('/verify error', err);
    res.status(500).send('Server error');
  }
});

// Start HTTP server and bot
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Verification server listening on ${PORT}`);
  bot.launch().then(() => console.log('Bot started'));
});

// Graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  server.close(() => process.exit(0));
});
