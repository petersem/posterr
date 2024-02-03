const mediaCard = require("../cards/MediaCard");
const cType = require("../cards/CardType");
const util = require('util');
const axios = require("axios");
const { CardTypeEnum } = require("../cards/CardType");
var playing = null;

 /**
 * @desc Used to get a list of custom pictures
 */
class Awtrix {
  constructor() { }

  /**
   * @desc Custom link slide array
   */
  async post(ip,payload) {
  try{
    await axios.post(
      ip + "/api/custom?name=posterr", null
    )

    await axios.post(
      ip + "/api/custom?name=posterr", payload
    )
  
    return 0;
    }
    catch(ex){
      let now = new Date();
      console.log(now.toLocaleString() + " * Awtrix post failed - " + ex);
    }
  }



}

module.exports = Awtrix;
