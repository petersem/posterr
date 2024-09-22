const mediaCard = require("../cards/MediaCard");
const cType = require("../cards/CardType");
const util = require('util');
const axios = require("axios");
const { CardTypeEnum } = require("../cards/CardType");

 /**
 * @desc Used to get a list of custom pictures
 */
class Links {
  constructor() { }

  /**
   * @desc Custom link slide array
   */
  async GetAllLinks(linksArray) {
    let allLinkCards = [];
    // get link cards
    for (const lnk of linksArray) {
    //console.log('process link', lnk);
      const linkSet = await this.GetLinkCard(lnk);
      //console.log(linkSet);
      if(linkSet.length !== 0) {
        allLinkCards = allLinkCards.concat(linkSet);
      }
    }

    let now = new Date();
    if (allLinkCards.length == 0) {
      console.log(
        now.toLocaleString() + " No links found");
    } else {
      console.log(
        now.toLocaleString() + " Links added");
    }
    return allLinkCards;
  }


  /**
   * @desc Custom link card
   */
  async GetLinkCard(url) {
    let linkCards = [];
    // reutrn an empty array if no results
    if (url !== null) {
      // move through results and populate media cards
      const medCard = new mediaCard();
      medCard.cardType = cType.CardTypeEnum.WebURL;
      medCard.mediaType = "WebURL";
      medCard.linkUrl = url;
      medCard.posterAR = 1.47;
      medCard.theme = "";
      medCard.posterURL = "";
      medCard.posterArtURL = "";
      //console.log(medCard);
      linkCards.push(medCard);
    }

    let now = new Date();
//console.log(linkCards);
    return linkCards;
  }
}

module.exports = Links;
