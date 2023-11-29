/**
 * @desc A card type enum
 * @returns nothing
 */
class CardType {

  static CardTypeEnum = { 
    NowScreening: ["Now Screening", ""], 
    OnDemand: ["On-demand", ""], 
    ComingSoon: ["Coming Soon", ""], 
    Playing: ["Playing", ""], 
    IFrame: ["", ""], 
    Picture: ["Picture", ""], 
    EBook: ["E-Book Release", ""],
    Trivia: ["Trivia Question", ""],
    RecentlyAdded: ["Recently Added", ""],
    WebURL: ["WebURL", ""]
  };
}

module.exports = CardType;
