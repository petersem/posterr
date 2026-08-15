const cache = require("./cache");

/**
 * @desc globalPage object is passed to poster.ejs and contains all browser settings and card data
 * @param {number} slideDuration - how long each slide will be visible for (seconds)
 * @param {string} fadeTransition - boolean - if true, will fade transition. false will slide.
 * @param {string} custBrand - string - Font name to use for slide titles.
 * @returns {<object>} globalPage
 */
class globalPage {
  constructor(
    slideDuration,
    fadeTransition,
    custBrand,
    titleColour,
    footColour,
    bgColour,
    hasArt,
    quizTime,
    hideSettingsLinks,
    rotate
  ) {
    this.slideDuration = slideDuration;
    this.fadeTransition = fadeTransition;
    this.custBrand = custBrand;
    this.titleColour = titleColour;
    this.footColour = footColour;
    this.bgColour = bgColour;
    this.cards = [];
    this.quizTime = quizTime;
    this.hideSettingsLinks = hideSettingsLinks;
    this.rotate = rotate;
    return;
  }

  /**
   * @desc Takes merged mediaCard set and applies card order number and active card slide, then generates the rendered HTML for each media card.
   * @returns nothing
   */
  async OrderAndRenderCards(baseUrl,hasArt, hideTitle, hideFooter) {
    if (this.cards.length != 0) {
      let webID = 0;
      // move through cards and update ID's and active, then render
      await this.cards.reduce(async (memo, card) => {
        await memo;
        webID++;
        card.ID = webID;
        // set first card to be active for web carousel
        if (card.ID == 1) {
          card.active = "active";
        } else {
          card.active = "";
        }
       // console.log(card);
        await card.Render(hasArt,baseUrl,hideTitle,hideFooter);
      }, undefined);
    }
    return;
  }
}

module.exports = globalPage;
