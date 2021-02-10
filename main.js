"use strict";

const botBuilder = require("claudia-bot-builder");
const telegramTemplate = botBuilder.telegramTemplate;
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
    "Saturday"
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
            Sunday: []
          },
          timeslots: [],
        },
      })
      .promise()
      .then(function () {
        return "Welcome, I am your Schedule Secretary. Please follow this 3 simple steps to configure your schedule:" +
          "\n\n 1. Tell me which subjects you have by selecting /newsubject." +
          "\n 2. Configure your schedule with those subjects by selecting /config" +
          "\n 3. Look at your /schedule." +
          "\n\nIf you are in trouble or want to know, what else I can do for you, select /help.";
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

      if (userData.state == "addingSubject") {
        if (userData.subjects.length < 21) {
          userData.subjects.push(text);
          userData.state = "neutral";
          return saveUserData(userData).then(() => {
            return (
              "Added '" +
              text +
              "' to /subjects. Use /newsubject to create another one. After creating all subjects, /config your schedule."
            );
          });
        } else {
          userData.state = "neutral";
          return saveUserData(userData).then(() => {
            return "You cannot have more than 20 subjects. Use /deletesubject to do that."
          });
        }
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
      } else if (userData.state == "resettingschedule") {
        if (text == "Everything") {
          userData.schedule.Monday = [];
          userData.schedule.Tuesday = [];
          userData.schedule.Wednesday = [];
          userData.schedule.Thursday = [];
          userData.schedule.Friday = [];
          userData.schedule.Saturday = [];
          userData.schedule.Sunday = [];
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
      } else if (userData.state == "settingTimezone") {
        let floatText = parseFloat(text)
        if (!isNaN(floatText) && floatText >= -11 && floatText <= 12) {
          userData.state = "neutral";
          userData.timezone = Math.round(floatText * 10) / 10;
          return saveUserData(userData).then(() => {
            return "Good, your timezone is set to " + userData.timezone + ".";
          });
        } else {
          return "Please tell me your timezone as a number between -11 and 12.";
        }
      } else if (userData.state == "settingTimeslots") {
        var timeslots = text.split("\n");
        if (validateTimeslots(timeslots)) {
          userData.state = "neutral";
          userData.timeslots = timeslots;
          return saveUserData(userData).then(() => {
            return (
              "Good, your timeslots are defined:\n" +
              getNewLineSeperatedList(userData.timeslots)
            );
          });
        } else {
          return "This is a wrong format.\n\nPlease tell me the start & end of your timeslots in the following format:" +
            "\n8:00-8:45\n8:50-9:35\n...";
        }
      } else if (text == "/help") {
        return (
          "I will help you managing your schedule." +
          "\n\nCreate a /newsubject and enter details like the name of the subject, your teacher and the room." +
          " Don't enter the time or day here, the schedule will help you doing so afterwards." +
          "\nYou can see the list of all /subjects and delete one or all with /deletesubject." +
          "\n\nAfter having all your subjects defined, /config your schedule." +
          "\nYou can reset one or all days with /resetschedule." +
          "\n\nDisplay your full /schedule, or use /today or /tomorrow to be more specific." +
          "\n\nYou can define the time your lessons start and end with /settimeslots and display all /timeslots." +
          "\nConfigure your timezone with /settimezone, in order to use /now to get your current subject." +
          "\n\nUse /start to flush all of your data and start over from scratch." +
          "\n\nFor feedback and bug reporting contact @RobertNickel." +
          "\nIf you enjoy the bot, please /tip me a coffee. It's easy!"
        );
      } else if (text == "/newsubject") {
        userData.state = "addingSubject";
        return saveUserData(userData).then(() => {
          return "Which subject do you want to create?\nAdd details like the room or the teacher here, but not the time or day." +
            " If you have one subject alternating in two rooms, create two seperate subjects, one for each.";
        });
      } else if (text == "/subjects") {
        if (userData.subjects.length == 0) {
          return "You have no subjects created yet. Use /newsubject to create one.";
        }
        return userData.subjects;
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
      } else if (text == "/config") {
        if (userData.subjects.length < 1) {
          return "You need to create your subjects first. Use /newsubject to create one.";
        }
        userData.state = "config";
        userData.configCurrentWeekday = null;
        return saveUserData(userData).then(() => {
          return getWeekdayKeyboard();
        });
      } else if (text == "/schedule") {
        var schedule = "Monday:\n" +
          getNewLineSeperatedList(prefixWithOrdinals(userData.schedule.Monday)) +
          "\nTuesday:\n" +
          getNewLineSeperatedList(prefixWithOrdinals(userData.schedule.Tuesday)) +
          "\nWednesday:\n" +
          getNewLineSeperatedList(prefixWithOrdinals(userData.schedule.Wednesday)) +
          "\nThursday:\n" +
          getNewLineSeperatedList(prefixWithOrdinals(userData.schedule.Thursday)) +
          "\nFriday:\n" +
          getNewLineSeperatedList(prefixWithOrdinals(userData.schedule.Friday)) +
          "\nSaturday:\n" +
          getNewLineSeperatedList(prefixWithOrdinals(userData.schedule.Saturday));
        let sunday = userData.schedule.Sunday
        if (sunday) {
          schedule = schedule + "\nSunday:\n" +
            getNewLineSeperatedList(prefixWithOrdinals(sunday))
        }
        return ("Your timeslots:\n" + getNewLineSeperatedList(userData.timeslots) + "\n" + schedule);
      } else if (text == "/today") {
        var date = new Date();
        var today = date.getDay();
        if (userData.schedule[weekdays[today]].length < 1) {
          return "You haven‘t defined anything for today. You can use /config to do so.";
        } else {
          return getScheduleWithTimeslots(
            userData.schedule[weekdays[today]],
            userData.timeslots
          );
        }
      } else if (text == "/tomorrow") {
        var date = new Date();
        var tomorrow = (date.getDay() + 1) % 6;
        if (tomorrow == 0) {
          return [
            "No school tomorrow, but this is your schedule on monday:",
          ].concat(
            getScheduleWithTimeslots(
              userData.schedule[weekdays[1]],
              userData.timeslots
            )
          );
        } else if (userData.schedule[weekdays[tomorrow]].length < 1) {
          return "You haven‘t defined anything for tomorrow. You can use /config to do so.";
        } else {
          return getScheduleWithTimeslots(
            userData.schedule[weekdays[tomorrow]],
            userData.timeslots
          );
        }
      } else if (text == "/resetschedule") {
        userData.state = "resettingschedule";
        var keyboard = getResetScheduleKeyboard("What do you want to reset?");
        return saveUserData(userData).then(() => {
          return keyboard;
        });
      } else if (text == "/settimeslots") {
        userData.state = "settingTimeslots";
        return saveUserData(userData).then(() => {
          return (
            "Alright, let's configure your timeslots." +
            "\nPlease tell me the start & end of your timeslots in the following format:" +
            "\n8:00-8:45\n8:50-9:35\n..."
          );
        });
      } else if (text == "/timeslots") {
        return getNewLineSeperatedList(userData.timeslots);
      } else if (text == "/now") {
        if (!userData.timezone) {
          return "Please /settimezone first.";
        } else {
          var nowSubject;

          userData.timeslots.forEach((timeslot, index) => {
            var start = timeslot.split("-")[0];
            var timeslotStartDate = new Date();
            timeslotStartDate.setUTCHours(
              parseInt(start.split(":")[0]),
              start.split(":")[1],
              0
            );

            var end = timeslot.split("-")[1];
            var timeslotEndDate = new Date();
            timeslotEndDate.setUTCHours(
              parseInt(end.split(":")[0]),
              end.split(":")[1],
              0
            );

            var nowMillis = Date.now() + userData.timezone * 1000 * 60 * 60; // milliseconds to seconds to minutes to hours
            if (
              timeslotStartDate.getTime() < nowMillis &&
              nowMillis < timeslotEndDate.getTime()
            ) {
              nowSubject =
                userData.schedule[weekdays[new Date().getUTCDay()]][index];
            }
          });
          if (nowSubject) {
            return "You have " + nowSubject + " now.";
          } else {
            return "You currently have nothing. Take a break.";
          }
        }
      } else if (text == "/settimezone") {
        userData.state = "settingTimezone";
        return saveUserData(userData).then(() => {
          return [
            "In which timezone do you live? (Berlin = 2 in summer and 1 in winter, New York = -5, India 5.5 etc)",
            new telegramTemplate.Photo(
              "http://www.fungeo.de/images/Zeitzonen/all_e.png"
            ).get(),
          ];
        });
      } else if (text == "/tip") {
        return {
          chat_id: id,
          parse_mode: "HTML",
          text: "Thanks a lot for <a href=\"https://ko-fi.com/robertnickel\">buying me a coffee</a>!"
        }
      } else {
        return (
          "Unknown command: " +
          text +
          "\n\nUse /help to understand what I am about."
        );
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
          ["Sunday"]
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
    return weekdays.includes(text);
  }

  function getScheduleWithTimeslots(schedule, timeslots) {
    var scheduleWithTimeslots = [];
    schedule.forEach((s, index) => {
      var timeslot = "";
      if (timeslots[index]) {
        timeslot = timeslots[index] + ": ";
      }
      scheduleWithTimeslots.push(timeslot + s);
    });
    return scheduleWithTimeslots;
  }

  function validateTimeslots(timeslots) {
    var matches = true;
    timeslots.forEach((timeslot) => {
      console.log('timeslot' + timeslot)
      if (
        !timeslot.match(
          "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
        )
      ) {
        matches = false;
      }
    });
    return matches;
  }

  function prefixWithOrdinals(list) {
    var prefixedWithOrdinals = [];
    list.forEach((entry, index) => {
      prefixedWithOrdinals.push((index + 1) + ". " + entry);
    })
    return prefixedWithOrdinals;
  }
});

// TODOs:
// be more tolerant on "/now", e.g. if it is in the break BEFORE that class, and also display the next class
// After configuring a day, propose to configure the next day (therefore some shortcuts like /configMonday, /configTuesday etc.)
