const mediaCard = require("../cards/MediaCard");
const cType = require("../cards/CardType");
const util = require('util');
const axios = require("axios");
const { CardTypeEnum } = require("../cards/CardType");
const { triviaCategories } = require("../../consts");

 /**
 * @desc Used to get a list of custom pictures
 */
class Trivia {
  constructor() { }

  /**
   * @desc Gets results from triviadb api call
   */
  async GetRawData(numberOfQuestions, category){
    let response;

    // call sonarr API and return results
    try {
      response = await axios
        .get(
          this.sonarrUrl +
            "https://opentdb.com/api.php?amount=" +
            numberOfQuestions +
            "&category=" +
            category
        )
        .catch((err) => {
          throw err;
        });
    } catch (err) {
      // displpay error if call failed
      let d = new Date();
      console.log(
        d.toLocaleString() + " *Trivia - Get raw data:",
        err.message
      );
      throw err;
    }

    return response;
  }

  /**
   * @desc Custom trivia question slide array
   */
  async GetAllQuestions(hasThemes, hasArt, numberOfQuestions, questionCategories) {
    let categories = [].concat(questionCategories);
    let allTrivCards = [];

    // get questions for specific category
    await categories.reduce(async (memo, md) => {
        await memo;
        let trivSet = await this.GetQuestions(hasThemes, hasArt, numberOfQuestions, md);
        if(trivSet.length !== 0) {
          allTrivCards = allTrivCards.concat(trivSet);
        }
      }, undefined);

    let now = new Date();
    if (allTrivCards.length == 0) {
      console.log(
        now.toLocaleString() + " No trivia questions found for any category");
    } else {
      console.log(
        now.toLocaleString() + " Trivia categories and questions added");
    }

    return allTrivCards;
  }


  /**
   * @desc Custom trivia question slide array
   */
  async GetQuestions(hasThemes, hasArt, numberOfQuestions, questionCategory) {
    let trivCards = [];

    // get questions for specific category
    const raw = await this.GetRawData(numberOfQuestions,questionCategory, hasThemes);
    // reutrn an empty array if no results
    if (raw !== null) {
      // move through results and populate media cards
      await raw.data.results.reduce(async (memo, md) => {
        await memo;
        const medCard = new mediaCard();
        medCard.cardType = cType.CardTypeEnum.Trivia;
        medCard.triviaQuestion = md.question;
        medCard.triviaType = md.type;
        medCard.triviaOptions =  md.incorrect_answers;
        medCard.triviaAnswer = md.correct_answer;
        medCard.mediaType = "trivia";
        medCard.triviaCategory = md.category;
        medCard.triviaDifficulty = "easy"

        // prepare options output
        
        if(md.type=="boolean"){
          medCard.triviaOptions = ["True", "False"];
        }
        else{
          medCard.triviaOptions = md.incorrect_answers.concat(md.correct_answer).sort(() => Math.random() - 0.5);
          //medCard = medCard.triviaOptions.sort(() => Math.random() - 0.5);
        }

        if (hasThemes == "true") {
          //medCard.theme = md.theme;
          medCard.theme = "";
        }
        else {
          medCard.theme = "";
        }
        medCard.posterURL = "/images/trivia.png";
        if (hasArt == "true") {
          medCard.posterArtURL = "/images/bricks.jpg";
        }
        else {
          medCard.posterArtURL = "";
        }
        medCard.posterAR = 1.47;

        // add picture card to array if questions/answer are not too long
        if(medCard.triviaOptions.join().toString().length <= 300 && md.question.length < 130 ) trivCards.push(medCard);
      }, undefined);
    }
    let now = new Date();
    if (trivCards.length == 0) {
      // console.log(
      //   now.toLocaleString() + " No trivia questions found");
    } else {
      // console.log(
      //   now.toLocaleString() + " Trivia questions added");
    }

    return trivCards;
  }
}

module.exports = Trivia;
