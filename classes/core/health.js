const fs = require("fs");
const fsp = require("fs").promises;
const DEFAULT_SETTINGS = require("../../consts");
const util = require("../core/utility");
const ping = require("ping");

/**
 * @desc health object is used poster health checks
 * @returns {<object>} health
 */
class Health {
  constructor(settings) {
    // default values
    this.settings = settings;
    return;
  }

  /**
   * @desc Checks all services available
   * @returns nothing
   */
  TestAll() {
    this.PingSingleIP("Plex",this.settings.plexIP);
    this.PingSingleIP("Radarr", this.settings.radarrURL);
    this.PingSingleIP("Sonarr",this.settings.sonarrURL);
    this.PingSingleIP("TVDB", "artworks.thetvdb.com");
    this.PingSingleIP("Plex Themes","tvthemes.plexapp.com");
    this.PingSingleIP("IMDB", "https://image.tmdb.org");
    return Promise.resolve(0);
  }

  /**
   * @desc Checks if it can ping a server
   * @returns {boolean} true or false
   */
  PingSingleIP(label, host) {
    let saniHost = this.sanitiseUrl(host);
    ping.sys.probe(saniHost, function (isAlive) {
        let now = new Date();
  console.log(
    now.toLocaleString() + " Ping test - " + label +": " + host,isAlive ? true : false);
      return isAlive ? true : false;
    });

  }

  /**
   * @desc Takes a url and just eturns the address portion of the string
   * @returns {string} sanitised Url
   */
  sanitiseUrl(url) {
    // remove forward slashes
    let u = url.replace(/\//g, "");
    // remove https
    u = u.replace(/https:/i, "");
    // remove http
    u = u.replace(/http:/i, "");
    // get the address portion of string
    let parts = u.split(":");

    return parts[0];
  }
}

module.exports = Health;
