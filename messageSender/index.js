"use strict";

const AWS = require("aws-sdk");
const TelegramBot = require('node-telegram-bot-api');

exports.handler = async(event) => {
    const bot = new TelegramBot(process.env.BOT_TOKEN)

    const documentClient = new AWS.DynamoDB.DocumentClient({
        region: "eu-central-1",
    });

    var params = {
        TableName: 'Users',
        FilterExpression: 'daily = :this_daily',
        ExpressionAttributeValues: { ':this_daily': '07:00' }
    };

    await documentClient.scan(params)
        .promise()
        .then(data => {
            // TODO: This is not a good state. Keep working on it.
            const user = data.Items[0]
            const text = 'Mondays subjects are:\n' + user.schedule["Monday"]
            return bot.sendMessage(user.id, text)
        })

    return { "status": 200 }
}
