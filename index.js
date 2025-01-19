require('dotenv').config();
    const { Telegraf, Markup } = require('telegraf');
    const sqlite3 = require('sqlite3').verbose();
    const i18n = require('i18n');
    const fetch = require('node-fetch');
    const moment = require('moment');

    // Initialize database
    const db = new sqlite3.Database('./db/shopbots.db');

    // Initialize i18n
    i18n.configure({
      locales: ['en', 'es', 'fr'],
      directory: __dirname + '/locales',
      defaultLocale: 'en'
    });

    const bot = new Telegraf(process.env.BOT_TOKEN);

    // Middleware to set user language
    bot.use((ctx, next) => {
      const userId = ctx.from.id;
      db.get('SELECT language FROM users WHERE telegram_id = ?', [userId], (err, row) => {
        if (row) {
          i18n.setLocale(row.language);
        }
        next();
      });
    });

    // Start command
    bot.start(async (ctx) => {
      const userId = ctx.from.id;
      const username = ctx.from.username;
      
      // Check if user exists
      db.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, row) => {
        if (!row) {
          // Create new user
          db.run('INSERT INTO users (telegram_id) VALUES (?)', [userId]);
        }
      });

      // Show welcome message and menu
      ctx.reply(ctx.i18n.t('welcome'), Markup.keyboard([
        [ctx.i18n.t('menu.create_bot')],
        [ctx.i18n.t('menu.my_bots'), ctx.i18n.t('menu.language')],
        [ctx.i18n.t('menu.help'), ctx.i18n.t('menu.payments')]
      ]).resize());
    });

    // Handle bot creation
    bot.hears(ctx => ctx.i18n.t('menu.create_bot'), (ctx) => {
      ctx.reply(ctx.i18n.t('bot_creation.enter_token'));
      bot.on('text', async (ctx) => {
        const token = ctx.message.text;
        // Validate token
        try {
          const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
          const data = await response.json();
          if (data.ok) {
            const userId = ctx.from.id;
            db.run('INSERT INTO shop_bots (user_id, bot_token, bot_name) VALUES (?, ?, ?)', 
              [userId, token, data.result.username]);
            ctx.reply(ctx.i18n.t('bot_creation.success'));
          } else {
            ctx.reply(ctx.i18n.t('bot_creation.invalid_token'));
          }
        } catch (error) {
          ctx.reply(ctx.i18n.t('bot_creation.invalid_token'));
        }
      });
    });

    // Start the bot
    bot.launch();
    console.log('Bot started...');

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
