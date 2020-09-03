"use strict";

const botBuilder = require("claudia-bot-builder");
const AWS = require("aws-sdk");

module.exports = botBuilder(function (message) {
  const documentClient = new AWS.DynamoDB.DocumentClient({
    region: "eu-central-1",
  });
  if (message.text == "/start") {
    return documentClient
      .put({
        TableName: "Users",
        Item: {
          id: message.sender + "",
          state: "neutral",
          subjects: [],
          schedule: {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
          },
        },
      })
      .promise()
      .then(function () {
        return "Welcome, I am a schedule bot. To show you my features, select /help.";
      });
  }
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
        return (
          "I will help you managing your schedule.\nCreate a /newSubject and see the list of all /subjects." +
          "\nAfter having all your subjects defined, /config your schedule."
        );
      } else if (userData.state == "addingSubject") {
        userData.subjects.push(text);
        userData.state = "neutral";
        return saveUserData(userData).then(() => {
          return (
            "Added subject " + text + ". Use /newSubject to create another one and /subjects to list all subjects."
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
      } else if (text == "/schedule") {
        return (
          "Monday:\n" +
          userData.schedule.Monday +
          "\n\nTuesday:\n" +
          userData.schedule.Tuesday +
          "\n\nWednesday:\n" +
          userData.schedule.Wednesday +
          "\n\nThursday:\n" +
          userData.schedule.Thursday +
          "\n\nFriday:\n" +
          userData.schedule.Friday +
          "\n\nSaturday:\n" +
          userData.schedule.Saturday
        );
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
            userData.schedule[text] = [];
            return saveUserData(userData).then(() => {
              return {
                chat_id: message.originalRequest.message.chat.id + "",
                text:
                  "Select your subjects on " + text + " in the right order.",
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
                text:
                  'What is your next subject? Select "That\'s it" when you are done.',
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
              let configuredSubjects = "";
              userData.schedule[configCurrentWeekdayHolder].forEach(
                (subject) => {
                  configuredSubjects += subject + "\n";
                }
              );
              return {
                chat_id: message.originalRequest.message.chat.id + "",
                text:
                  "You configured " +
                  configCurrentWeekdayHolder +
                  "\n" +
                  configuredSubjects +
                  "\nYou can /config another day now or have a look at your /schedule.",
                reply_markup: {
                  hide_keyboard: true,
                },
              };
            });
          } else {
            return {
              chat_id: message.originalRequest.message.chat.id + "",
              text:
                'That is an unknown subject. Please select one of the following, or select "That\'s it"',
              reply_markup: {
                keyboard: buildSubjectsKeyboard(userData),
                resize_keyboard: true,
              },
            };
          }
        }
      } else if (text == "/config") {
        if (userData.subjects.length < 1) {
          return "You need to create your subjects first. Use /newSubject to create one.";
        }
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
// Reset a day
// After configuring a day, propose to configure the next day (therefore some shortcuts like /configMonday, /configTuesday etc.)
// Delete subject
