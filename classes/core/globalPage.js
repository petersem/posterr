const cache = require("./cache");

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
