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
      const weekdays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      if (text == "/help" || text == "/start") {
        return (
          "I will help you managing your schedule.\nCreate a /newSubject and enter details like the name of the subject, your teacher and the room." +
          " Don't enter the time or day you have a subject here, the schedule will help you doing so afterwards." +
          "\nYou can see the list of all /subjects." +
          "\nAfter having all your subjects defined, /config your schedule." + 
          "\nYou can reset one or all days of your schedule by using /resetSchedule."
        );
      } else if (userData.state == "addingSubject") {
        userData.subjects.push(text);
        userData.state = "neutral";
        return saveUserData(userData).then(() => {
          return (
            "Added subject " +
            text +
            ". Use /newSubject to create another one and /subjects to list all subjects. If you created all subjects, /config your schedule."
          );
        });
      } else if (text == "/newsubject") {
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
          getNewLineSeperatedList(userData.schedule.Monday) +
          "\nTuesday:\n" +
          getNewLineSeperatedList(userData.schedule.Tuesday) +
          "\nWednesday:\n" +
          getNewLineSeperatedList(userData.schedule.Wednesday) +
          "\nThursday:\n" +
          getNewLineSeperatedList(userData.schedule.Thursday) +
          "\nFriday:\n" +
          getNewLineSeperatedList(userData.schedule.Friday) +
          "\nSaturday:\n" +
          getNewLineSeperatedList(userData.schedule.Saturday)
        );
      } else if (text == "/resetschedule") {
        userData.state = "resetSchedule";
        var keyboard = getResetScheduleKeyboard("What do you want to reset?");
        return saveUserData(userData).then(() => {
          return keyboard;
        });
      } else if (userData.state == "config") {
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
            return getWeekdayKeyboard();
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
              return getHideKeyboard(
                "You configured " +
                  configCurrentWeekdayHolder +
                  "\n" +
                  getNewLineSeperatedList(
                    userData.schedule[configCurrentWeekdayHolder]
                  ) +
                  "\nYou can /config another day now or have a look at your /schedule."
              );
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
      } else if (userData.state == "resetSchedule") {
        if (text == "Everything") {
          userData.schedule.Monday = [];
          userData.schedule.Tuesday = [];
          userData.schedule.Wednesday = [];
          userData.schedule.Thursday = [];
          userData.schedule.Friday = [];
          userData.schedule.Saturday = [];
          userData.state = "neutral";
          return saveUserData(userData).then(() => {
            return getHideKeyboard(
              "Everything was reset. Use /newSubject to create a new subject and /config your schedule afterwards."
            );
          });
        } else if (weekdays.includes(text)) {
          userData.schedule[text] = [];
          userData.state = "neutral";
          return saveUserData(userData).then(() => {
            return getHideKeyboard(
              text + " was reset. Use /config to reconfigure it."
            );
          });
        } else {
          return getResetScheduleKeyboard(
            "That is nothing I can reset. Please chose one of the buttons below."
          );
        }
      } else if (text == "/config") {
        if (userData.subjects.length < 1) {
          return "You need to create your subjects first. Use /newSubject to create one.";
        }
        userData.state = "config";
        userData.configCurrentWeekday = null;
        return saveUserData(userData).then(() => {
          return getWeekdayKeyboard();
        });
      } else if (text == "/state") {
        return userData.state;
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

  function getWeekdayKeyboard(text) {
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

  function getNewLineSeperatedList(list) {
    var newList = "";
    list.forEach((item) => {
      newList += item + "\n";
    });
    return newList;
  }

  function getResetScheduleKeyboard(text) {
    var keyboard = getWeekdayKeyboard();
    keyboard.reply_markup.keyboard.push(["Everything"]);
    keyboard.text = text;
    return keyboard;
  }

  function getHideKeyboard(text) {
    return {
      chat_id: message.originalRequest.message.chat.id + "",
      text: text,
      reply_markup: {
        hide_keyboard: true,
      },
    };
  }
});

// TODOs:
// /deleteSubject command that provides a button for each subject and a "Delete all" button.
// After configuring a day, propose to configure the next day (therefore some shortcuts like /configMonday, /configTuesday etc.)
// Delete subject
// Current time related stuff like:
//    /now -> gives you the current and the next subject
//    /configTimes -> lets you configure at which time which hours are (e.g. 1st lessons always goes from 8:00 until 8:45)
//    /today -> gives you all the subjects of today
