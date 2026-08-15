/**
 * @desc utility class for string and object handling
 * @returns {<object>} utility
 */
class utility {
  /**
   * @desc Returns true is null, empty or undefined
   * @param {string} val
   * @returns {Promise<boolean>} boolean - true empty, undefined or null
   */
  static async isEmpty(val) {
    if (val == undefined || val == "" || val == null) {
      return true;
    } else {
      return false;
    }
  }

  static createUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
       var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
       return v.toString(16);
    });
  }


  /**
   * @desc Returns an empty string if undefined, null or empty, else the submitted value
   * @param {string} val
   * @returns {Promise<string>} string - either an empty string or the submitted string value
   */
  static async emptyIfNull(val) {
    if (val == undefined || val == null || val == "") {
      return "";
    } else {
      return val;
    }
  }

  /**
   * @desc Gets a random item from an array
   * @param {Array} items - a given array of anything
   * @returns {Promise<object>} object - returns one random item
   */
  static async random_item(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * @desc builds random set of on-demand cards
   * @param {number} numberOnDemand - the number of on-demand cards to return
   * @param {object} mediaCards - an array of on-demand mediaCards
   * @returns {Promise<object>} mediaCard[] - an array of mediaCards
   */
  static async build_random_od_set(numberOnDemand, mediaCards, recentlyAdded) {
    let onDemandCards = [];
    let libTooSmall = false;
    if(recentlyAdded > 0) {
      return mediaCards;
    }
    else{
      for await (let i of Array(numberOnDemand).keys()) {
        let odc;
        odc = await this.random_item(mediaCards);
        let tryCount = 0;
        // try at least five times to get unique random titles. If not, then ommit
        while(onDemandCards.includes(odc) && tryCount < 5){
          //console.log('Dupe found:' + odc.title);
          tryCount++;
          odc = await this.random_item(mediaCards);
        }
        // finally, if card still a duplicate, then ommit from display
        if(!onDemandCards.includes(odc)){
          onDemandCards.push(odc);
        }
        else{
          libTooSmall = true;
        }
      }
      // display a warning if 'number to display' was too large for library size.
      if(libTooSmall && mediaCards.length !== 0){
        let d = new Date();
        console.log(d.toLocaleString() + " ✘✘ WARNING ✘✘ On-demand library too small to get consistent unique titles. Requested titles reduced. (Reduce the 'number to display')");
      }
      return onDemandCards;
    }
  
    }
}

module.exports = utility;
