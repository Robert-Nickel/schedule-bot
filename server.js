"use strict";

const botBuilder = require("claudia-bot-builder");
const AWS = require("aws-sdk");

module.exports = botBuilder(function (message) {
  const documentClient = new AWS.DynamoDB.DocumentClient({
    region: "eu-central-1",
  });
  return documentClient.get({
    TableName: "Users",
    Key: {
      id: message.sender + "",
    },
  })
    .promise()
    .then(
      function (data) {
        const userData = data.Item
        const text = message.text

        if (text == "/help" || text == "/start") {
          return "I will help you managing your schedule.\nCreate a /newSubject and see the list of all /subjects."
        }

        else if (userData.state == "addingSubject") {
          userData.subjects.push(text)
          userData.state = "neutral"
          return saveUserData(userData)
            .then(() => { return "Added subject " + text + ". Use /subjects to see all subjects." })
        }

        else if (text == "/newSubject") {
          userData.state = "addingSubject"
          return saveUserData(userData)
            .then(() => { return "Which subject do you want to create?\nPro tip: You can also add details like the room or the teacher here." })
        }

        else if (text == "/subjects") {
          if (userData.subjects.length == 0) {
            return "You have no subjects created yet. Use /newSubject to create one."
          }
          return userData.subjects;
        }

        else {
          return "Unknown command, sorry.";
        }
      }
    )
    .catch(function (err) {
      // TODO: If the user doesn't exist yet, create and persist a new one with the given id
    });

  function saveUserData(userData) {
    return documentClient.put({ TableName: "Users", Item: userData })
      .promise()
  }
});
