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
    this.hideSettingsLinks = DEFAULT_SETTINGS.hideSettingsLinks;
    this.theaterRoomMode = DEFAULT_SETTINGS.theaterRoomMode;
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
    this.readarrURL = DEFAULT_SETTINGS.readarrURL;
    this.readarrToken = DEFAULT_SETTINGS.readarrToken;
    this.readarrCalDays = DEFAULT_SETTINGS.readarrCalDays;
    this.hasArt = DEFAULT_SETTINGS.hasArt;
    this.shuffleSlides = DEFAULT_SETTINGS.shuffleSlides;
    this.genres = DEFAULT_SETTINGS.genres;
    this.custBrand = DEFAULT_SETTINGS.custBrand;
    this.nowScreening = DEFAULT_SETTINGS.nowScreening;
    this.comingSoon = DEFAULT_SETTINGS.comingSoon;
    this.onDemand = DEFAULT_SETTINGS.onDemand;
    this.recentlyAddedDays = DEFAULT_SETTINGS.recentlyAddedDays;
    this.recentlyAdded = DEFAULT_SETTINGS.recentlyAdded;
    this.iframe = DEFAULT_SETTINGS.iframe;
    this.playing = DEFAULT_SETTINGS.playing;
    this.picture = DEFAULT_SETTINGS.picture;
    this.ebook = DEFAULT_SETTINGS.ebook;
    this.trivia = DEFAULT_SETTINGS.trivia;
    this.titleColour = DEFAULT_SETTINGS.titleColour;
    this.footColour = DEFAULT_SETTINGS.footColour;
    this.bgColour = DEFAULT_SETTINGS.bgColour;
    this.enableNS = DEFAULT_SETTINGS.enableNS;
    this.enableOD = DEFAULT_SETTINGS.enableOD;
    this.enableSonarr = DEFAULT_SETTINGS.enableSonarr;
    this.enableRadarr = DEFAULT_SETTINGS.enableRadarr;
    this.enableReadarr = DEFAULT_SETTINGS.enableReadarr;
    this.filterRemote = DEFAULT_SETTINGS.filterRemote;
    this.filterLocal = DEFAULT_SETTINGS.filterLocal;
    this.filterDevices = DEFAULT_SETTINGS.filterDevices;
    this.filterUsers = DEFAULT_SETTINGS.filterUsers;
    this.odHideTitle = DEFAULT_SETTINGS.odHideTitle;
    this.odHideFooter = DEFAULT_SETTINGS.odHideFooter;
    this.enableCustomPictures = DEFAULT_SETTINGS.enableCustomPictures;
    this.enableCustomPictureThemes = DEFAULT_SETTINGS.enableCustomPictureThemes;
    this.customPictureTheme = DEFAULT_SETTINGS.customPictureTheme;
    this.serverID = DEFAULT_SETTINGS.serverID;
    this.sleepStart = DEFAULT_SETTINGS.sleepStart;
    this.sleepEnd = DEFAULT_SETTINGS.sleepEnd;
    this.enableSleep = DEFAULT_SETTINGS.enableSleep;
    this.triviaTimer = DEFAULT_SETTINGS.triviaTimer;
    this.triviaCategories = DEFAULT_SETTINGS.triviaCategories;
    this.enableTrivia = DEFAULT_SETTINGS.enableTrivia;
    this.triviaNumber = DEFAULT_SETTINGS.triviaNumber;
    this.triviaFrequency = DEFAULT_SETTINGS.triviaFrequency;
    this.pinNS = DEFAULT_SETTINGS.pinNS;
    this.hideUser = DEFAULT_SETTINGS.hideUser;
    this.contentRatings = DEFAULT_SETTINGS.contentRatings;
    this.links = DEFAULT_SETTINGS.links;
    this.enableAwtrix = DEFAULT_SETTINGS.enableAwtrix;
    this.awtrixIP = DEFAULT_SETTINGS.awtrixIP;
    this.enableLinks = DEFAULT_SETTINGS.enableLinks;
    this.links = DEFAULT_SETTINGS.links;
    this.rotate = DEFAULT_SETTINGS.rotate;
    this.excludeLibs = DEFAULT_SETTINGS.excludeLibs;
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

      // if needed settings values missing, then add them to the object, pending a future save. This is for settings file upgrades of exisitng installs. (when default state should be true)
      if(readSettings.enableNS==undefined) readSettings.enableNS = 'true';
      if(readSettings.enableOD==undefined) readSettings.enableOD = 'true';
      if(readSettings.enableSonarr==undefined) readSettings.enableSonarr = 'true';
      if(readSettings.enableReadarr==undefined) readSettings.enableReadarr = 'true';
      if(readSettings.enableRadarr==undefined) readSettings.enableRadarr = 'true';
      if(readSettings.enableLinks==undefined) readSettings.enableLinks = "false";
      if(readSettings.filterRemote==undefined) readSettings.filterRemote = 'true';
      if(readSettings.filterLocal==undefined) readSettings.filterLocal = 'true';
      if(readSettings.enableCustomPictures==undefined) readSettings.enableCustomPictures = 'false';
      if(readSettings.customPictureTheme==undefined) readSettings.customPictureTheme = 'default';
      if(readSettings.enableSleep==undefined) readSettings.enableSleep = 'false';
      if(readSettings.enableTrivia==undefined) readSettings.enableTrivia = 'false';
      if(readSettings.enableLinks==undefined) readSettings.enableLinks = 'false';
      if(readSettings.recentlyAddedDays==undefined) readSettings.recentlyAddedDays = 0;
      if(readSettings.enableAwtrix==undefined) readSettings.enableAwtrix = 'false';
      if(readSettings.rotate==undefined) readSettings.rotate = 'false';
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
    this.serverID = util.createUUID();
    this.enableNS = 'false';
    this.enableOD = 'false';
    this.enableSonarr = 'false';
    this.enableRadarr = 'false';
    this.enableReadarr = 'false';
    this.enableTrivia = 'false';
    this.enableLinks = 'false';
    this.enableAwtrix = 'false';

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

  async UpdateSettings(settings){

    if(fs.existsSync("config/settings.json")){
    // convert JSON object to string (pretty format)
    const data = JSON.stringify(settings, null, 4);

    
    // write JSON string to a file
    fs.writeFileSync("config/settings.json", data, (err) => {
      if (err) {
        console.log('Error - writing to settings file',err);
        throw err;
      }
    });
  }
  console.log(`✅ Upgraded settings file
  `);

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
    if (jsonObject.hideSettingsLinks) this.hideSettingsLinks = jsonObject.hideSettingsLinks;
    else this.hideSettingsLinks = "false";
    if (jsonObject.theaterRoomMode) this.theaterRoomMode = jsonObject.theaterRoomMode;
    else this.theaterRoomMode = "false";
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
    if (jsonObject.readarrUrl) this.readarrURL = jsonObject.readarrUrl;
    else this.readarrURL = cs.readarrURL;
    if (jsonObject.readarrToken) this.readarrToken = jsonObject.readarrToken;
    else this.readarrToken = cs.readarrToken;
    if (jsonObject.readarrDays) this.readarrCalDays = jsonObject.readarrDays;
    else this.readarrCalDays = cs.readarrCalDays;
    if (jsonObject.artSwitch) this.hasArt = jsonObject.artSwitch;
    else this.hasArt = cs.hasArt;
    if (jsonObject.shuffleSwitch) this.shuffleSlides = jsonObject.shuffleSwitch;
    else this.shuffleSlides = cs.shuffleSlides;
    if (jsonObject.genres) this.genres = jsonObject.genres;
    else this.genres = cs.genres;
    if (jsonObject.pinNSSwitch) this.pinNS = jsonObject.pinNSSwitch;
    else this.pinNS = cs.pinNS;
    if (jsonObject.hideUser) this.hideUser = jsonObject.hideUser;
    else this.hideUser = cs.hideUser;
    if (jsonObject.titleFont) this.custBrand = jsonObject.titleFont;
    else this.custBrand = cs.custBrand;
    if (jsonObject.nowScreening) this.nowScreening = jsonObject.nowScreening;
    else this.nowScreening = cs.nowScreening;
    if (jsonObject.recentlyAddedDays) this.recentlyAddedDays = jsonObject.recentlyAddedDays;
    else this.recentlyAddedDays = cs.recentlyAddedDays;
    if (jsonObject.recentlyAdded) this.recentlyAdded = jsonObject.recentlyAdded;
    else this.recentlyAdded = cs.recentlyAdded;
    if (jsonObject.onDemand) this.onDemand = jsonObject.onDemand;
    else this.onDemand = cs.onDemand;
    if (jsonObject.comingSoon) this.comingSoon = jsonObject.comingSoon;
    else this.comingSoon = cs.comingSoon;
    if (jsonObject.playing) this.playing = jsonObject.playing;
    else this.playing = cs.playing;
    if (jsonObject.iframe) this.iframe = jsonObject.iframe;
    else this.iframe = cs.iframe;
    if (jsonObject.ebook) this.ebook = jsonObject.ebook;
    else this.ebook = cs.ebook;
    if (jsonObject.picture) this.picture = jsonObject.picture;
    else this.picture = cs.picture;
    if (jsonObject.trivia) this.trivia = jsonObject.trivia;
    else this.trivia = cs.trivia;
    if (jsonObject.titleColour) this.titleColour = jsonObject.titleColour;
    else this.titleColour = cs.titleColour;
    if (jsonObject.footColour) this.footColour = jsonObject.footColour;
    else this.footColour = cs.footColour;
    if (jsonObject.bgColour) this.bgColour = jsonObject.bgColour;
    else this.bgColour = cs.bgColour;
    if (jsonObject.enableNS) this.enableNS = jsonObject.enableNS;
    else this.enableNS = "false";
    if (jsonObject.enableOD) this.enableOD = jsonObject.enableOD;
    else this.enableOD = "false";
    if (jsonObject.enableSonarr) this.enableSonarr = jsonObject.enableSonarr;
    else this.enableSonarr = "false";
    if (jsonObject.enableReadarr) this.enableReadarr = jsonObject.enableReadarr;
    else this.enableReadarr = "false";
    if (jsonObject.enableRadarr) this.enableRadarr = jsonObject.enableRadarr;
    else this.enableRadarr = "false";
    if (jsonObject.filterRemote) this.filterRemote = jsonObject.filterRemote;
    else this.filterRemote = "false";
    if (jsonObject.filterLocal) this.filterLocal = jsonObject.filterLocal;
    else this.filterLocal = "false";
    if (jsonObject.filterDevices) this.filterDevices = jsonObject.filterDevices;
    else this.filterDevices = "";
    if (jsonObject.filterUsers) this.filterUsers = jsonObject.filterUsers;
    else this.filterUsers = "";
    if (jsonObject.odHideTitle) this.odHideTitle = jsonObject.odHideTitle;
    else this.odHideTitle = cs.odHideTitle;
    if (jsonObject.odHideFooter) this.odHideFooter = jsonObject.odHideFooter;
    else this.odHideFooter = cs.odHideFooter;
    if (jsonObject.enableCustomPictures) this.enableCustomPictures = jsonObject.enableCustomPictures;
    else this.enableCustomPictures = cs.enableCustomPictures;
    if (jsonObject.enableCustomPictureThemes) this.enableCustomPictureThemes = jsonObject.enableCustomPictureThemes;
    else this.enableCustomPictureThemes = cs.enableCustomPictureThemes;
    if (jsonObject.customPictureTheme) this.customPictureTheme = jsonObject.customPictureTheme;
    else this.customPictureTheme = cs.customPictureTheme;
    if (jsonObject.serverID) this.serverID = jsonObject.serverID;
    else this.serverID = cs.serverID;
    if (jsonObject.sleepStart) this.sleepStart = jsonObject.sleepStart;
    else this.sleepStart = cs.sleepStart;
    if (jsonObject.sleepEnd) this.sleepEnd = jsonObject.sleepEnd;
    else this.sleepEnd = cs.sleepEnd;
    if (jsonObject.enableSleep) this.enableSleep = jsonObject.enableSleep;
    else this.enableSleep = cs.enableSleep;
    if (jsonObject.enableTrivia) this.enableTrivia = jsonObject.enableTrivia;
    else this.enableTrivia = cs.enableTrivia;
    if (jsonObject.triviaCategories) this.triviaCategories = jsonObject.triviaCategories;
    else this.triviaCategories = cs.triviaCategories;
    if (jsonObject.triviaTimer) this.triviaTimer = jsonObject.triviaTimer;
    else this.triviaTimer = cs.triviaTimer;
    if (jsonObject.triviaNumber) this.triviaNumber = jsonObject.triviaNumber;
    else this.triviaNumber = cs.triviaNumber;
    if (jsonObject.triviaFrequency) this.triviaFrequency = jsonObject.triviaFrequency;
    else this.triviaFrequency = cs.triviaFrequency;
    if (jsonObject.contentRatings) this.contentRatings = jsonObject.contentRatings;
    else this.contentRatings = cs.contentRatings;
    if (jsonObject.links) this.links = jsonObject.links;
    else this.links = cs.links;
    if (jsonObject.enableLinks) this.enableLinks = jsonObject.enableLinks;
    else this.enableLinks = cs.enableLinks;
    if (jsonObject.enableAwtrix) this.enableAwtrix = jsonObject.enableAwtrix;
    else this.enableAwtrix = cs.enableAwtrix;
    if (jsonObject.awtrixIP) this.awtrixIP = jsonObject.awtrixIP;
    else this.awtrixIP = cs.awtrixIP;
    if (jsonObject.rotate) this.rotate = jsonObject.rotate;
    else this.rotate = cs.rotate;
    if (jsonObject.excludeLibs) this.excludeLibs = jsonObject.excludeLibs;
    else this.excludeLibs = cs.excludeLibs;

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
