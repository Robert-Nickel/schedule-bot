const user_id = process.env.USER_ID;
const token = process.env.BOT_TOKEN;
const TelegramBot = require('node-telegram-bot-api');

module.exports.handler = async (event) =>{
    const bot = new TelegramBot(token);
    return await bot.sendMessage(user_id, 'This test message worked I guess');
};
