const fs = require("fs");
const fsp = require("fs").promises;

/**
 * @desc settings object is used to get and set all settings for poster
 * @returns {<object>} settings
 */
class Settings {
  constructor() {
    // default values
    this.password = "raidisnotabackup";
    this.slideDuration = 10;
    this.refreshPeriod = 120;
    this.playThemes = "true";
    this.genericThemes = "true";
    this.fade = "true";
    this.plexIP = "192.168.1.135";
    this.plexHTTPS = "false";
    this.plexPort = 32400;
    this.plexToken = "";
    this.onDemandLibraries = "";
    this.numberOnDemand = 2;
    this.onDemandRefresh = 120;
    this.sonarrURL = "http://192.168.1.135:8989";
    this.sonarrToken = "";
    this.sonarrCalDays = 175;
    this.sonarrPremieres = "true";
    this.radarrURL = "http://192.168.1.135:7878";
    this.radarrToken = "";
    this.radarrCalDays = 30;

    return;
  }

  async GetSettings() {
    // check if file exists before downloading
    if (!fs.existsSync("config/settings.json")) {
      //file not present, so create it with defaults

      this.SaveSettings();
      console.log("✅ Config file created");
    }
    const data = await fsp.readFile("config/settings.json", "utf-8");
    return JSON.parse(data.toString());
  }

  async SaveSettings() {
    // convert JSON object to string (pretty format)
    const data = JSON.stringify(this, null, 4);

    // write JSON string to a file
    fs.writeFile("config/settings.json", data, (err) => {
      if (err) {
        throw err;
      }
      // console.log("Settings saved.");
    });
    return;
  }
}

module.exports = Settings;
