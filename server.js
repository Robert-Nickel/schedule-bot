'use strict';

const botBuilder = require('claudia-bot-builder');

class Subject {

  constructor(name, teacher) {
    this.name = name;
    this.teacher = teacher;
  }

  toString() {
    return "Du hast: " + this.name + " bei: " + this.teacher;
  }
}


module.exports = botBuilder(function (request) {
  const music = new Subject("Musik", "Behrens");
  const social_studies = new Subject("Sozialwissenschaften", "Feldkämper");
  const sports = new Subject("Sport", "Kayser");
  const physics = new Subject("Physik", "Recker");
  //const computer_sciences = new Subject("Informatik", "Schmolke");
  //const mathematics = new Subject("Mathematik", "Gärtner");
  //const english = new Subject("Englisch", "Casper");
  //const religion = new Subject("Religion", "Taube");
  //const history = new Subject("Geschichte", "Taube");
  //const german = new Subject("Deutsch", "Konert");
  const monday = [music.toString];

  if (request.text == "/monday") {
    return "wenigstens etwas funktioniert";
  }
  return `Thank you for sending ${request.text}. Your message is very important to us.`
});

//, music.toString, social_studies.toString, social_studies,toString, sports.toString, physics.toString