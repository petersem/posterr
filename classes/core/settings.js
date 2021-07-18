const fs = require("fs");
const fsp = require("fs").promises;
const DEFAULT_SETTINGS = require("../../consts");
const util = require("../core/utility");

/**
 * @desc settings object is used to get and set all settings for poster
 * @returns {<object>} settings
 */
class Settings {
  constructor() {
    // default values
    this.password = DEFAULT_SETTINGS.password;
    this.slideDuration = DEFAULT_SETTINGS.slideDuration;
    this.playThemes = DEFAULT_SETTINGS.playThemes;
    this.genericThemes = DEFAULT_SETTINGS.genericThemes;
    this.fade = DEFAULT_SETTINGS.fade;
    this.plexIP = DEFAULT_SETTINGS.plexIP;
    this.plexHTTPS = DEFAULT_SETTINGS.plexHTTPS;
    this.plexPort = DEFAULT_SETTINGS.plexPort;
    this.plexToken = DEFAULT_SETTINGS.plexToken;
    this.onDemandLibraries = DEFAULT_SETTINGS.onDemandLibraries;
    this.numberOnDemand = DEFAULT_SETTINGS.numberOnDemand;
    this.onDemandRefresh = DEFAULT_SETTINGS.onDemandRefresh;
    this.sonarrURL = DEFAULT_SETTINGS.sonarrURL;
    this.sonarrToken = DEFAULT_SETTINGS.sonarrToken;
    this.sonarrCalDays = DEFAULT_SETTINGS.sonarrCalDays;
    this.sonarrPremieres = DEFAULT_SETTINGS.sonarrPremieres;
    this.radarrURL = DEFAULT_SETTINGS.radarrURL;
    this.radarrToken = DEFAULT_SETTINGS.radarrToken;
    this.radarrCalDays = DEFAULT_SETTINGS.radarrCalDays;
    this.hasArt = DEFAULT_SETTINGS.hasArt;
    this.shuffleSlides = DEFAULT_SETTINGS.shuffleSlides;
    this.genres = DEFAULT_SETTINGS.genres;
    this.custBrand = DEFAULT_SETTINGS.custBrand;
    this.nowScreening = DEFAULT_SETTINGS.nowScreening;
    this.comingSoon = DEFAULT_SETTINGS.comingSoon;
    this.onDemand = DEFAULT_SETTINGS.onDemand;
    this.iframe = DEFAULT_SETTINGS.iframe;
    this.playing = DEFAULT_SETTINGS.playing;
    this.picture = DEFAULT_SETTINGS.picture;
    this.titleColour = DEFAULT_SETTINGS.titleColour;
    this.footColour = DEFAULT_SETTINGS.footColour;
    this.bgColour = DEFAULT_SETTINGS.bgColour;
    this.enableNS = DEFAULT_SETTINGS.enableNS;
    this.enableOD = DEFAULT_SETTINGS.enableOD;
    this.enableSonarr = DEFAULT_SETTINGS.enableSonarr;
    this.enableRadarr = DEFAULT_SETTINGS.enableRadarr;
    this.filterRemote = DEFAULT_SETTINGS.filterRemote;
    this.filterLocal = DEFAULT_SETTINGS.filterLocal;
    this.filterDevices = DEFAULT_SETTINGS.filterDevices;
    this.filterUsers = DEFAULT_SETTINGS.filterUsers;
    return;
  }

  /**
   * @desc Returns if settings have been changed from default values
   * @returns {<boolean>} true / false if any value is changed
   */
  GetChanged() {
    let hasChanged = false;
    let SettingChanged;
    try {
      // only worry about required Plex settings. (other settings can remain default or be blank)
      if (this.plexIP !== "" && this.plexPort !== "" && this.plexToken !== "") {
        hasChanged = true;
        throw SettingChanged;
      } else {
        let now = new Date();
        console.log(
          now.toISOString().split("T")[0] +
            " INVALID PLEX SERVER SETTINGS - Please visit setup page to resolve"
        );
      }
    } catch (e) {
      if (e !== SettingChanged) throw e;
    }

    return hasChanged;
  }

  /**
   * @desc Gets all Poster settings
   * @returns {<object>} json - json object for all settings
   */
  async GetSettings() {
    // check if file exists before downloading
    if (!fs.existsSync("config/settings.json")) {
      //file not present, so create it with defaults
      await this.SaveSettings();
      console.log("✅ Config file created");
    }

    const data = fs.readFileSync("config/settings.json", "utf-8");

    let readSettings;
    try {
      readSettings = await JSON.parse(data.toString());
    } catch (ex) {
      // do nothing if error as it reads ok anyhow
      let d = new Date();
      console.log(d.toLocaleString() + " *Failed to load settings - GetSettings:", ex);
    }

    // populate settings object with settings from json file
    await Object.assign(this, readSettings);

    // ensure settings loaded before returning
    return new Promise((resolve) => {
      setTimeout(function () {
        resolve(readSettings);
      }, 2000);
    });
  }

  /**
   * @desc Saves settings if no settings file exists
   * @returns nothing
   */
  async SaveSettings() {
    // convert JSON object to string (pretty format)
    const data = JSON.stringify(this, null, 4);

    // write JSON string to a file
    fs.writeFileSync("config/settings.json", data, (err) => {
      if (err) {
        console.log('ERROR: failed to write settings file',err);
        throw err;
      }
      console.log(`✅ New settings file saved
      `);
    });
    return;
  }

  /**
   * @desc Saves settings after changes from settings page
   * @param {object} json - takes a json object from the submitted form
   * @returns nothing
   */
  async SaveSettingsJSON(jsonObject) {
    // check object passed
    if (typeof jsonObject == "undefined") {
      throw error("JSON object not passed");
    }

    // load existing values
    const cs = this.GetSettings();
    // set passed in values from object. if value not passed, then use current settings
    if (jsonObject.password) this.password = jsonObject.password;
    else this.password = cs.password;
    if (jsonObject.slideDuration) this.slideDuration = jsonObject.slideDuration;
    else this.slideDuration = cs.slideDuration;
    if (jsonObject.themeSwitch) this.playThemes = jsonObject.themeSwitch;
    else this.playThemes = "false";
    if (jsonObject.genericSwitch) this.genericThemes = jsonObject.genericSwitch;
    else this.genericThemes = "false";
    if (jsonObject.fadeOption) this.fade = jsonObject.fadeOption;
    else this.fade = cs.fade;
    if (jsonObject.plexIP) this.plexIP = jsonObject.plexIP;
    else this.plexIP = cs.plexIP;
    if (jsonObject.plexHTTPSSwitch) this.plexHTTPS = jsonObject.plexHTTPSSwitch;
    else this.plexHTTPS = "false";
    if (jsonObject.plexPort) this.plexPort = jsonObject.plexPort;
    else this.plexPort = cs.plexPort;
    if (jsonObject.plexToken) this.plexToken = jsonObject.plexToken;
    else this.plexToken = cs.plexToken;
    if (jsonObject.plexLibraries)
      this.onDemandLibraries = jsonObject.plexLibraries;
    else this.onDemandLibraries = cs.onDemandLibraries;
    if (jsonObject.numberOnDemand || jsonObject.numberOnDemand==0) 
      this.numberOnDemand = jsonObject.numberOnDemand;
    else this.numberOnDemand = cs.numberOnDemand;
    if (jsonObject.onDemandRefresh)
      this.onDemandRefresh = jsonObject.onDemandRefresh;
    else this.onDemandRefresh = cs.onDemandRefresh;
    if (jsonObject.sonarrUrl) this.sonarrURL = jsonObject.sonarrUrl;
    else this.sonarrURL = cs.sonarrURL;
    if (jsonObject.sonarrToken) this.sonarrToken = jsonObject.sonarrToken;
    else this.sonarrToken = cs.sonarrToken;
    if (jsonObject.sonarrDays) this.sonarrCalDays = jsonObject.sonarrDays;
    else this.sonarrCalDays = cs.sonarrCalDays;
    if (jsonObject.premiereSwitch)
      this.sonarrPremieres = jsonObject.premiereSwitch;
    else this.sonarrPremieres = cs.sonarrPremieres;
    if (jsonObject.radarrUrl) this.radarrURL = jsonObject.radarrUrl;
    else this.radarrURL = cs.radarrURL;
    if (jsonObject.radarrToken) this.radarrToken = jsonObject.radarrToken;
    else this.radarrToken = cs.radarrToken;
    if (jsonObject.radarrDays) this.radarrCalDays = jsonObject.radarrDays;
    else this.radarrCalDays = cs.radarrCalDays;
    if (jsonObject.artSwitch) this.hasArt = jsonObject.artSwitch;
    else this.hasArt = cs.hasArt;
    if (jsonObject.shuffleSwitch) this.shuffleSlides = jsonObject.shuffleSwitch;
    else this.shuffleSlides = cs.shuffleSlides;
    if (jsonObject.genres) this.genres = jsonObject.genres;
    else this.genres = cs.genres;
    if (jsonObject.pinNSSwitch) this.pinNS = jsonObject.pinNSSwitch;
    else this.pinNS = cs.pinNS;
    if (jsonObject.titleFont) this.custBrand = jsonObject.titleFont;
    else this.custBrand = cs.custBrand;
    if (jsonObject.nowScreening) this.nowScreening = jsonObject.nowScreening;
    else this.nowScreening = cs.nowScreening;
    if (jsonObject.onDemand) this.onDemand = jsonObject.onDemand;
    else this.onDemand = cs.onDemand;
    if (jsonObject.comingSoon) this.comingSoon = jsonObject.comingSoon;
    else this.comingSoon = cs.comingSoon;
    if (jsonObject.playing) this.playing = jsonObject.playing;
    else this.playing = cs.playing;
    if (jsonObject.iframe) this.iframe = jsonObject.iframe;
    else this.iframe = cs.iframe;
    if (jsonObject.picture) this.picture = jsonObject.picture;
    else this.picture = cs.picture;
    if (jsonObject.titleColour) this.titleColour = jsonObject.titleColour;
    else this.titleColour = cs.titleColour;
    if (jsonObject.footColour) this.footColour = jsonObject.footColour;
    else this.footColour = cs.footColour;
    if (jsonObject.bgColour) this.bgColour = jsonObject.bgColour;
    else this.bgColour = cs.bgColour;
    if (jsonObject.enableNS) this.enableNS = jsonObject.enableNS;
    else this.enableNS = cs.enableNS;
    if (jsonObject.enableOD) this.enableOD = jsonObject.enableOD;
    else this.enableOD = cs.enableOD;
    if (jsonObject.enableSonarr) this.enableSonarr = jsonObject.enableSonarr;
    else this.enableSonarr = cs.enableSonarr;
    if (jsonObject.enableRadarr) this.enableRadarr = jsonObject.enableRadarr;
    else this.enableRadarr = cs.enableRadarr;
    if (jsonObject.filterRemote) this.filterRemote = jsonObject.filterRemote;
    else this.filterRemote = cs.filterRemote;
    if (jsonObject.filterLocal) this.filterLocal = jsonObject.filterLocal;
    else this.filterLocal = cs.filterLocal;
    if (jsonObject.filterDevices) this.filterDevices = jsonObject.filterDevices;
    else this.filterDevices = cs.filterDevices;
    if (jsonObject.filterUsers) this.filterUsers = jsonObject.filterUsers;
    else this.filterUsers = cs.filterUsers;




    // convert JSON object to string (pretty format)
    const data = JSON.stringify(this, null, 4);

    
    // write JSON string to a file
    fs.writeFileSync("config/settings.json", data, (err) => {
      if (err) {
        console.log('Error - writing to settings file',err);
        throw err;
      }
    });
    console.log(`✅ Settings saved
    `);

    return;
  }
}

module.exports = Settings;
