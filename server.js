"use strict";

const botBuilder = require("claudia-bot-builder");
const AWS = require("aws-sdk");

module.exports = botBuilder(function (message) {
  const documentClient = new AWS.DynamoDB.DocumentClient({
    region: "eu-central-1",
  });
  const id = message.originalRequest.message.chat.id + "";
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

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
          "I will help you managing your schedule." +
          "\n\nCreate a /newsubject and enter details like the name of the subject, your teacher and the room." +
          " Don't enter the time or day here, the schedule will help you doing so afterwards." +
          "\nYou can see the list of all /subjects and delete one or all with /deletesubject." +
          "\n\nAfter having all your subjects defined, /config your schedule." +
          "\nYou can reset one or all days with /resetschedule." +
          "\n\nDisplay your full /schedule, or use /today or /tomorrow to be more specific."
        );
      } else if (userData.state == "addingSubject") {
        userData.subjects.push(text);
        userData.state = "neutral";
        return saveUserData(userData).then(() => {
          return (
            "Added " +
            text +
            " to /subjects. Use /newsubject to create another one. After creating all subjects, /config your schedule."
          );
        });
      } else if (text == "/newsubject") {
        userData.state = "addingSubject";
        return saveUserData(userData).then(() => {
          return "Which subject do you want to create?\nAdd details like the room or the teacher here, but not the time or day.";
        });
      } else if (text == "/subjects") {
        if (userData.subjects.length == 0) {
          return "You have no subjects created yet. Use /newsubject to create one.";
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
        userData.state = "resetschedule";
        var keyboard = getResetScheduleKeyboard("What do you want to reset?");
        return saveUserData(userData).then(() => {
          return keyboard;
        });
      } else if (userData.state == "config") {
        if (!userData.configCurrentWeekday) {
          if (isScheduledWeekday(text)) {
            userData.configCurrentWeekday = text;
            userData.schedule[text] = [];
            return saveUserData(userData).then(() => {
              return getSubjectsKeyboard(
                userData,
                "Select your subjects on " + text + " in the right order.",
                "That's it"
              );
            });
          } else {
            return getWeekdayKeyboard();
          }
        } else if (isScheduledWeekday(userData.configCurrentWeekday)) {
          if (userData.subjects.includes(text)) {
            userData.schedule[userData.configCurrentWeekday].push(text);
            return saveUserData(userData).then(() => {
              return getSubjectsKeyboard(
                userData,
                'What is your next subject? Select "That\'s it" when you are done.',
                "That's it"
              );
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
            return getSubjectsKeyboard(
              userData,
              'That is an unknown subject. Please select one of the following, or select "That\'s it"',
              "That's it"
            );
          }
        }
      } else if (userData.state == "resetschedule") {
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
              "Everything was reset. Use /newsubject to create a new subject and /config your schedule afterwards."
            );
          });
        } else if (isScheduledWeekday(text)) {
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
      } else if (text == "/deletesubject") {
        if (userData.subjects.length < 1) {
          return "Create a /newsubject first!";
        }
        userData.state = "deletingsubject";
        return saveUserData(userData).then(() => {
          return getSubjectsKeyboard(
            userData,
            "Which subject do you want to delete?",
            "All of them!"
          );
        });
      } else if (userData.state == "deletingsubject") {
        if (userData.subjects.includes(text)) {
          userData.state = "neutral";
          userData.subjects.splice(userData.subjects.indexOf(text), 1);
          return saveUserData(userData).then(() => {
            return getHideKeyboard(
              text +
                " deleted. Create a new one with /newsubject, or see all /subjects."
            );
          });
        } else if (text == "All of them!") {
          userData.state = "neutral";
          userData.subjects = [];
          return saveUserData(userData).then(() => {
            return getHideKeyboard(
              "All subjects deleted. Create a new one with /newsubject, or see all /subjects."
            );
          });
        } else {
          return getSubjectsKeyboard(
            userData,
            "That subject doesn't exist, so which subject would you like to delete?",
            "All of them!"
          );
        }
      } else if (text == "/config") {
        if (userData.subjects.length < 1) {
          return "You need to create your subjects first. Use /newsubject to create one.";
        }
        userData.state = "config";
        userData.configCurrentWeekday = null;
        return saveUserData(userData).then(() => {
          return getWeekdayKeyboard();
        });
      } else if (text == "/state") {
        return userData.state;
      } else if (text == "/today") {
        var date = new Date();
        var today = date.getDay();
        if (today == 0) {
          return [
            "Good news: It's sunday, but this is the schedule for tomorrow:",
          ].concat(userData.schedule[weekdays[1]]);
        } else {
          return userData.schedule[weekdays[today]];
        }
      } else if (text == "/tomorrow") {
        var date = new Date();
        var tomorrow = (date.getDay() + 1) % 6;
        if (tomorrow == 0) {
          return [
            "No school tomorrow, but this is your schedule on monday:",
          ].concat(userData.schedule[weekdays[1]]);
        } else {
          return userData.schedule[weekdays[tomorrow]];
        }
      } else {
        return "Unknown command: " + text;
      }
    });

  function saveUserData(userData) {
    return documentClient.put({ TableName: "Users", Item: userData }).promise();
  }

  function getSubjectsKeyboard(userData, text, additionalButton) {
    var setWeekdayActions = userData.subjects;
    setWeekdayActions.push(additionalButton);
    var subjectsKeyboard = [];
    while (setWeekdayActions.length > 0) {
      subjectsKeyboard.push(setWeekdayActions.splice(0, 2));
    }
    return {
      chat_id: id,
      text: text,
      reply_markup: {
        keyboard: subjectsKeyboard,
        resize_keyboard: true,
      },
    };
  }

  function getWeekdayKeyboard(text) {
    return {
      chat_id: id,
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

  function isScheduledWeekday(text) {
    return weekdays.includes(text) && text != "Sunday";
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
