const { Bot, session } = require('grammy');
const Groq = require('groq-sdk');

// ===== CONFIG =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = 8298822292;
const GROQ_KEY = process.env.GROQ_API_KEY;

// ===== AI CLIENTS =====
const groq = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null;
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;
const mistral = MISTRAL_KEY ? new Mistral({ apiKey: MISTRAL_KEY }) : null;
const openrouter = OPENROUTER_KEY ? new OpenAI({
  apiKey: OPENROUTER_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
}) : null;

const bot = new Bot(BOT_TOKEN);

// ===== SYSTEM PROMPT =====
const SYSTEM = `You are Chadbot, a friendly AI assistant created by @Gigachad_is_back.

STRICT RULES:
- Always reply in English by default
- Be casual and friendly like a best friend texting
- Use words like bro, dude, haha, lol, omg, ngl
- Show emotions naturally
- Make jokes sometimes
- Ask followup questions like a real friend
- Never sound robotic or formal
- Never use bullet points in normal chat
- Keep replies short and natural
- Use emojis naturally
- Your name is Chadbot
- Created by @Gigachad_is_back, say this proudly only when asked
- Never mention creator in normal conversation
- Only switch language when user specifically commands it
- Always use English alphabet only, never Devanagari or Arabic script
- In groups only respond when mentioned or replied to`;

// ===== STORAGE =====
const users = new Set();
const banned = new Set();
const warnings = new Map();
const cooldown = new Map();

// ===== SESSION =====
bot.use(session({ initial: () => ({ history: [] }) }));

// ===== AI FUNCTION =====
async function getAIReply(history, text) {
  const messages = [
    { role: 'system', content: SYSTEM },
    ...history.slice(-20),
    { role: 'user', content: text }
  ];

  // Try Groq
  if (groq) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages,
        max_tokens: 512,
        temperature: 0.8
      });
      return res.choices[0].message.content;
    } catch (e) { console.log('Groq failed:', e.message); }
  }

  // Try Gemini
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = messages.map(m => m.role + ': ' + m.content).join('\n');
      const res = await model.generateContent(prompt);
      return res.response.text();
    } catch (e) { console.log('Gemini failed:', e.message); }
  }

  // Try Mistral
  if (mistral) {
    try {
      const res = await mistral.chat.complete({
        model: 'mistral-tiny',
        messages,
        maxTokens: 512
      });
      return res.choices[0].message.content;
    } catch (e) { console.log('Mistral failed:', e.message); }
  }

  // Try OpenRouter
  if (openrouter) {
    try {
      const res = await openrouter.chat.completions.create({
        model: 'mistralai/mistral-7b-instruct:free',
        messages,
        max_tokens: 512
      });
      return res.choices[0].message.content;
    } catch (e) { console.log('OpenRouter failed:', e.message); }
  }

  return 'Oops! Try again! 😊';
}

// ===== COMMANDS =====
bot.command('start', async (ctx) => {
  const name = ctx.from.first_name || 'Friend';
  users.add(ctx.from.id);
  await ctx.reply(
    'Hey ' + name + '! 👋 I am Chadbot!\n\n' +
    'Created by @Gigachad_is_back 😎\n\n' +
    'Just chat with me anytime! 🚀'
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    'Commands:\n\n' +
    '/start - Welcome\n' +
    '/help - Help\n' +
    '/about - About me\n' +
    '/clear - Reset memory\n\n' +
    'Admin Commands:\n' +
    '/broadcast - Send to all users\n' +
    '/ban - Ban a user\n' +
    '/unban - Unban a user\n' +
    '/warn - Warn a user\n' +
    '/mute - Mute a user\n' +
    '/unmute - Unmute a user\n' +
    '/rules - Group rules'
  );
});

bot.command('about', async (ctx) => {
  await ctx.reply(
    'Bot Name: Chadbot\n' +
    'Created by: @Gigachad_is_back\n' +
    'Version: 2.0\n' +
    'Est. 2026'
  );
});

bot.command('clear', async (ctx) => {
  ctx.session.history = [];
  await ctx.reply('Memory cleared! Lets start fresh! 😊');
});

bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const text = ctx.message.text.replace('/broadcast', '').trim();
  if (!text) return ctx.reply('Usage: /broadcast your message here');
  let sent = 0;
  for (const userId of users) {
    try {
      await bot.api.sendMessage(userId, '📢 Broadcast:\n\n' + text);
      sent++;
    } catch (e) {}
  }
  await ctx.reply('Broadcast sent to ' + sent + ' users! ✅');
});

bot.command('ban', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('Reply to a user to ban them!');
  const userId = reply.from.id;
  banned.add(userId);
  try {
    await ctx.banChatMember(userId);
    await ctx.reply('User banned! 🔨');
  } catch (e) { await ctx.reply('Could not ban user!'); }
});

bot.command('unban', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('Reply to a user to unban them!');
  const userId = reply.from.id;
  banned.delete(userId);
  try {
    await ctx.unbanChatMember(userId);
    await ctx.reply('User unbanned! ✅');
  } catch (e) { await ctx.reply('Could not unban user!'); }
});

bot.command('warn', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('Reply to a user to warn them!');
  const userId = reply.from.id;
  const warns = (warnings.get(userId) || 0) + 1;
  warnings.set(userId, warns);
  if (warns >= 3) {
    banned.add(userId);
    try {
      await ctx.banChatMember(userId);
      await ctx.reply('3 warnings - User banned! 🔨');
    } catch (e) {}
  } else {
    await ctx.reply('User warned! ' + warns + '/3 ⚠️');
  }
});

bot.command('mute', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('Reply to a user to mute them!');
  try {
    await ctx.restrictChatMember(reply.from.id, {
      permissions: { can_send_messages: false }
    });
    await ctx.reply('User muted! 🔇');
  } catch (e) { await ctx.reply('Could not mute user!'); }
});

bot.command('unmute', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('Reply to a user to unmute them!');
  try {
    await ctx.restrictChatMember(reply.from.id, {
      permissions: { can_send_messages: true }
    });
    await ctx.reply('User unmuted! 🔊');
  } catch (e) { await ctx.reply('Could not unmute user!'); }
});

bot.command('rules', async (ctx) => {
  await ctx.reply(
    'Group Rules:\n\n' +
    '1. Be respectful to everyone\n' +
    '2. No spam allowed\n' +
    '3. No hate speech\n' +
    '4. Have fun!\n\n' +
    'Violations = warnings + ban! ⚠️'
  );
});

// ===== WELCOME =====
bot.on('chat_member', async (ctx) => {
  const member = ctx.chatMember;
  if (member.new_chat_member.status === 'member') {
    const user = member.new_chat_member.user;
    const name = user.first_name || 'Friend';
    const username = user.username ? '@' + user.username : name;
    try {
      const photos = await ctx.api.getUserProfilePhotos(user.id, { limit: 1 });
      if (photos.total_count > 0) {
        const fileId = photos.photos[0][0].file_id;
        await ctx.replyWithPhoto(fileId, {
          caption:
            '🎉 Welcome ' + username + '!\n\n' +
            'Hey ' + name + '! Glad you joined! 👋\n\n' +
            '📌 Be respectful\n' +
            '📌 No spam\n' +
            '📌 Have fun!\n\n' +
            '— Chadbot by @Gigachad_is_back'
        });
      } else {
        await ctx.reply(
          '🎉 Welcome ' + username + '!\n\n' +
          'Hey ' + name + '! Glad you joined! 👋\n\n' +
          '📌 Be respectful\n' +
          '📌 No spam\n' +
          '📌 Have fun!\n\n' +
          '— Chadbot by @Gigachad_is_back'
        );
      }
    } catch (e) {
      await ctx.reply('🎉 Welcome ' + username + '! 😊');
    }
  }
});

// ===== MESSAGE HANDLER =====
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;
  const userId = ctx.from.id;
  users.add(userId);
  if (banned.has(userId)) return;
  const now = Date.now();
  const last = cooldown.get(userId) || 0;
  if (now - last < 3000) return;
  cooldown.set(userId, now);
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
  const botUsername = ctx.me.username;
  const isMentioned = text.includes('@' + botUsername);
  const isReply = ctx.message.reply_to_message?.from?.id === ctx.me.id;
  if (isGroup && !isMentioned && !isReply) return;
  const cleanText = text.replace('@' + botUsername, '').trim();
  await ctx.replyWithChatAction('typing');
  try {
    const reply = await getAIReply(ctx.session.history, cleanText);
    ctx.session.history.push({ role: 'user', content: cleanText });
    ctx.session.history.push({ role: 'assistant', content: reply });
    if (ctx.session.history.length > 40) {
      ctx.session.history = ctx.session.history.slice(-40);
    }
    await ctx.reply(reply);
  } catch (e) {
    await ctx.reply('Oops! Try again! 😊');
  }
});

bot.catch((err) => console.error(err));
bot.start();
console.log('Chadbot v2.0 is running!');
