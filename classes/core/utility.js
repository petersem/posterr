class utility {
  // return true if null
  static async isEmpty(val) {
    if (val == undefined || val == "" || val == null) {
      return true;
    } else {
      return false;
    }
  }

  // return empty string if null
  static async emptyIfNull(val) {
    if (val == undefined || val == null || val == "") {
      return "";
    } else {
      return val;
    }
  }

  // gets a random item from an array
  static async random_item(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  // builds random set of on-demand cards
  static async build_random_od_set(numberOnDemand,mediaCards) {
    
    var onDemandCards = [];
    for await (let i of Array(numberOnDemand).keys()) {
      var odc;
      odc = await this.random_item(mediaCards);
      onDemandCards.push(odc);
    }
    return onDemandCards;
  }
}

module.exports = utility;