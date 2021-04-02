const cache = require("./cache");

/**
 * @desc globalPage object is passed to poster.ejs and contains all browser settings and card data
 * @param {number} slideDuration - how long each slide will be visible for (seconds)
 * @param {number} refreshPeriod - how long before the brpwser does a refresh and data is refreshed (seconds)
 * @param {string} playThemesIfAvailable - boolean - will enable theme music wherever it is set
 * @param {string} playGenericThemes - boolean - will play random themes from the /randomthemes directory for movies
 * @param {string} fadeTransition - boolean - if true, will fade transition. false will slide.
 * @returns {<object>} globalPage
 */
class globalPage {
  constructor(
    slideDuration,
    refreshPeriod,
    playThemesIfAvailable,
    playGenericThemes,
    fadeTransition
  ) {
    this.slideDuration = slideDuration;
    this.refreshPeriod = refreshPeriod;
    this.playThemes = playThemesIfAvailable;
    this.playGenericThemes = playGenericThemes;
    this.fadeTransition = fadeTransition;

    this.cards = [];
    return;
  }

  /**
   * @desc Takes merged mediaCard set and applies card order number and active card slide, then generates the rendered HTML for each media card.
   * @returns nothing
   */
  async OrderAndRenderCards() {
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
        await card.Render();
      }, undefined);
    }
    return;
  }
}

module.exports = globalPage;
