"use strict";

const botBuilder = require("claudia-bot-builder");
const AWS = require("aws-sdk");

module.exports = botBuilder(function (message) {
  const documentClient = new AWS.DynamoDB.DocumentClient({
    region: "eu-central-1",
  });
  return documentClient
    .get({
      TableName: "Users",
      Key: {
        id: message.sender + "",
      },
    })
    .promise()
    .then(function (data) {
      const userData = data.Item;
      const text = message.text;

      if (text == "/help" || text == "/start") {
        return "I will help you managing your schedule.\nCreate a /newSubject and see the list of all /subjects.";
      } else if (userData.state == "addingSubject") {
        userData.subjects.push(text);
        userData.state = "neutral";
        return saveUserData(userData).then(() => {
          return (
            "Added subject " + text + ". Use /subjects to see all subjects."
          );
        });
      } else if (text == "/newSubject") {
        userData.state = "addingSubject";
        return saveUserData(userData).then(() => {
          return "Which subject do you want to create?\nPro tip: You can also add details like the room or the teacher here.";
        });
      } else if (text == "/subjects") {
        if (userData.subjects.length == 0) {
          return "You have no subjects created yet. Use /newSubject to create one.";
        }
        return userData.subjects;
      } else if (userData.state == "config") {
        const weekdays = [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        if (!userData.configCurrentWeekday) {
          if (weekdays.includes(text)) {
            userData.configCurrentWeekday = text;
            return saveUserData(userData).then(() => {
              return {
                chat_id: message.originalRequest.message.chat.id + "",
                text: "Enter your subjects on " + text + " in the right order.",
                reply_markup: {
                  keyboard: buildSubjectsKeyboard(userData),
                  resize_keyboard: true,
                },
              };
            });
          } else {
            return whichWeekdayConfig();
          }
        } else if (weekdays.includes(userData.configCurrentWeekday)) {
          if (userData.subjects.includes(text)) {
            userData.schedule[userData.configCurrentWeekday].push(text);
            return saveUserData(userData).then(() => {
              return {
                chat_id: message.originalRequest.message.chat.id + "",
                text: "Enter your next subject.",
                reply_markup: {
                  keyboard: buildSubjectsKeyboard(userData),
                  resize_keyboard: true,
                },
              };
            });
          } else if (text == "That's it") {
            userData.state = "neutral";
            var configCurrentWeekdayHolder = userData.configCurrentWeekday;
            delete userData.configCurrentWeekday;
            return saveUserData(userData).then(() => {
              return {
                chat_id: message.originalRequest.message.chat.id + "",
                text:
                  "You configured " +
                  configCurrentWeekdayHolder +
                  " to contain: " +
                  userData.schedule[configCurrentWeekdayHolder] +
                  ". You can configure another day now.",
                reply_markup: {
                  hide_keyboard: true
                },
              };
            });
          } else {
            return {
              chat_id: message.originalRequest.message.chat.id + "",
              text:
                "That is an unknown subject. Please enter one of the following, or select That's it",
              reply_markup: {
                keyboard: buildSubjectsKeyboard(userData),
                resize_keyboard: true,
              },
            };
          }
        }
      } else if (text == "/config") {
        userData.state = "config";
        userData.configCurrentWeekday = null;
        return saveUserData(userData).then(() => {
          return whichWeekdayConfig();
        });
      } else if (text == "/state") {
        return "Current state: " + userData.state;
      } else {
        return "Unknown command: " + text;
      }
    })
    .catch(function (err) {
      // TODO: If the user doesn't exist yet, create and persist a new one with the given id
    });

  function saveUserData(userData) {
    return documentClient.put({ TableName: "Users", Item: userData }).promise();
  }

  function buildSubjectsKeyboard(userData) {
    var setWeekdayActions = userData.subjects;
    setWeekdayActions.push("That's it");
    var subjectsKeyboard = [];
    while (setWeekdayActions.length > 0) {
      subjectsKeyboard.push(setWeekdayActions.splice(0, 2));
    }
    return subjectsKeyboard;
  }

  function whichWeekdayConfig() {
    return {
      chat_id: message.originalRequest.message.chat.id + "",
      text: "Which weekday do you want to configure?",
      reply_markup: {
        keyboard: [
          ["Monday", "Tuesday"],
          ["Wednesday", "Thursday"],
          ["Friday", "Saturday"],
        ],
        resize_keyboard: true,
      },
    };
  }
});

// TODOs:
// Show the user his schedule, e.g. when he sends /schedule
// If the user doesn't exist yet, create and persist a new one with the given id
// Reset a day
// After configuring a day, propose to configure the next day
// Delete subject
