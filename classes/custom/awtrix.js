const mediaCard = require("../cards/MediaCard");
const cType = require("../cards/CardType");
const util = require("util");
const axios = require("axios");
const { CardTypeEnum } = require("../cards/CardType");
var playing = null;
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

/**
 * @desc Used to get a list of custom pictures
 */
class Awtrix {
  constructor() {}

  async reboot(ip){
    try {
      await axios.post(ip + "/api/reboot");
      let now = new Date();
      console.log(now.toLocaleString() + " *Awtrix reset");
      return 0;
    } catch (ex) {
      throw " Failed to reset Awtrix";
    } 

  }


  async stats(ip){
    try {
      // pause whilst Awtrix restarts
      await sleep(6000);
      const STATS = await axios.get(ip + "/api/stats");
      return STATS;
    } catch(ex) {
        throw " Awtrix failed connectivity test - " + ex;
    } 

  }

  /**
   * @desc Custom link slide array
   */
  async post(ip, payload) {
    if (payload !== null) {
      try {
        await axios.post(ip + "/api/custom?name=" + payload.unique, payload);

        return 0;
      } catch (ex) {
        throw " Awtrix add failed - " + ex;
      } 
    }
  }

  async delete(ip, appName) {
    try {
      await axios.post(ip + "/api/custom?name=" + appName, null);

      return 0;
    } catch (ex) {
      throw " Awtrix delete failed - " + ex;
    } 
  }

  async clear(ip) {
    try {
      await axios.get(ip + "/api/loop").then(function (response) {
        if (Object.keys(response.data).length > 0) {
          Object.keys(response.data).forEach((app) => {
            if (app.search(/posterr/i) !== -1) {
              axios.post(ip + "/api/custom?name=" + app, null);
              let now = new Date();
              console.log(now.toLocaleString() + " Awtrix Clearing " + app);
            }
          });
        }
      });
    } catch (ex) {
      throw " Awtrix initialisation failed";
    } 
  }

  async rtttl(ip,tune) {
    try {
      await axios.post(ip + "/api/rtttl",tune);
      return 0;
    } catch (ex) {
      throw "Awtrix greeting failed - " + ex;
    } 

  }

  async appFind(oldApps, uniqueValue) {
    const result = oldApps.find(({ unique }) => unique === uniqueValue);

    return result;
  }

  async appFindID(appsArray, value) {
    const result = oldApps.find((element) => element === value);

    return result;
  }
}

module.exports = Awtrix;
