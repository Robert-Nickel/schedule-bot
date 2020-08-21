"use strict";

const botBuilder = require("claudia-bot-builder");
const AWS = require("aws-sdk");

module.exports = botBuilder(function (message) {
  const documentClient = new AWS.DynamoDB.DocumentClient({
    region: "eu-central-1",
  });

  if (message.text == "/subjects") {
    var params = {
      TableName: "Users",
      Key: {
        id: message.sender + "",
      },
    };
    return documentClient
      .get(params)
      .promise()
      .then(function (data) {
        var subjects = [];
        data.Item.subjects.forEach((subject) => {
          subjects.push(subject.name + " bei " + subject.teacher);
        });
        return subjects;
      })
      .catch(function (err) {
        console.log(err);
        return "That didn‘t work :(";
      });
  } else {
    return "Unknown command, sorry.";
  }
});
