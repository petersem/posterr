const fs = require("fs");
const fsp = require("fs").promises;
const DEFAULT_SETTINGS = require("../../consts");
const util = require("../core/utility");
const ping = require("ping");
const pms = require("../mediaservers/plex");
const axios = require("axios");

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

  async PlexNSCheck() {
    let ms = new pms({
      plexHTTPS: this.settings.plexHTTPS,
      plexIP: this.settings.plexIP,
      plexPort: this.settings.plexPort,
      plexToken: this.settings.plexToken,
    });

    try {
      let result = await Promise.resolve(ms.client.query("/status/sessions"));
      if(result.MediaContainer.size == 0){
        console.log("Nothing returned as playing. Please verify this is correct");
      }
      else{
        console.log(result.MediaContainer.size + " media item(s) playing.");
      }
    } catch (err) {
      console.log(err);
    }
  }

  async PlexODCheck() {
    let ms = new pms({
      plexHTTPS: this.settings.plexHTTPS,
      plexIP: this.settings.plexIP,
      plexPort: this.settings.plexPort,
      plexToken: this.settings.plexToken,
    });

    // return first movie library found
    // let key;
    // ms.client
    //   .query("/library/sections")
    //   .then(function (result) {
    //     const children = result.MediaContainer.Directory;
    //     return children.filter((dir) => (dir.type = "movie"));
    //   })
    //   .then(
    //     function (result) {
    //       // list directory objects
    //       //for (let d=0; d < result.length; d++){
    //       console.log(
    //         "Library Name:",
    //         result[0].title,
    //         ", Key:",
    //         result[0].key,
    //         "(first 5 titles)"
    //       );
    //       key = parseInt(result[0].key);
    //       //}
    //       return;
    //     },
    //     function (err) {
    //       let now = new Date();
    //       console.log(
    //         now.toLocaleString() + " *On-demand - get a library key:" + err
    //       );
    //     }
    //   );

    // return first 5 titles in library

    ms.client.query("/library/sections/" + 1 + "/all").then(
      function (result) {
        let now = new Date();
        console.log(
          now.toLocaleString() + " *On-demand - get 5 titles from first library");
        for (let x = 0; x < 5; x++) {
          console.log(" -", result.MediaContainer.Metadata[x].title);
        }
      },
      function (err) {
        let now = new Date();
        console.log(
          now.toLocaleString() + " *On-demand - title retrieval: " + err
        );
      }
    );
  }

async SonarrCheck() {
  let response;
  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  later.setDate(later.getDate() + 7);
  let startDate = today.toISOString().split("T")[0];
  let endDate = later.toISOString().split("T")[0];
  // call sonarr API and return results
  try {
    response = await axios
      .get(
        this.settings.sonarrURL +
          "/api/v3/calendar?apikey=" +
          this.settings.sonarrToken +
          "&start=" +
          startDate +
          "&end=" +
          endDate
      )
      .catch((err) => {
        throw err;
      });
  } catch (err) {
    // displpay error if call failed
    let d = new Date();
    console.log(
      d.toLocaleString() + " *SONARR CHECK - Get calendar data:",
      err.message
    );
    throw err;
  }
  // console.log(response.data);
  response.data.forEach(tvShow => {
    console.log(tvShow.title,tvShow.airDate);
  });
  return;
}

async TriviaCheck() {
  let resp;
  // call trivia API and return results
  try {
    resp = await axios
      .get("https://opentdb.com/api.php?amount=5&category=11")
      .catch((err) => {
        throw err;
      });
  } catch (err) {
    // displpay error if call failed
    let d = new Date();
    console.log(
      d.toLocaleString() + " *Trivia check failed - :",
      err.message
    );
    throw err;
  }
  let cnt = 0;
  resp.data.results.forEach(question => {
    cnt++;
    console.log(cnt + " - " + question.question);
  });
  return;
}

async ReadarrCheck() {
  let resp;
  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  later.setDate(later.getDate() + 30);
  let startDate = today.toISOString().split("T")[0];
  let endDate = later.toISOString().split("T")[0];
  // call readarr API and return results
  try {
    resp = await axios
      .get(
        this.settings.readarrURL +
          "/api/v1/calendar?apikey=" +
          this.settings.readarrToken +
          "&start=" +
          startDate +
          "&end=" +
          endDate
      )
      .catch((err) => {
        throw err;
      });
  } catch (err) {
    // displpay error if call failed
    let d = new Date();
    console.log(
      d.toLocaleString() + " *READARR CHECK- Get calendar data:",
      err.message
    );
    throw err;
  }

  resp.data.forEach(book => {
    console.log(book.title);
  });
  return;
}



async RadarrCheck() {
  let resp;
  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  later.setDate(later.getDate() + 30);
  let startDate = today.toISOString().split("T")[0];
  let endDate = later.toISOString().split("T")[0];
  // call sonarr API and return results
  try {
    resp = await axios
      .get(
        this.settings.radarrURL +
          "/api/v3/calendar?apikey=" +
          this.settings.radarrToken +
          "&start=" +
          startDate +
          "&end=" +
          endDate
      )
      .catch((err) => {
        throw err;
      });
  } catch (err) {
    // displpay error if call failed
    let d = new Date();
    console.log(
      d.toLocaleString() + " *RADARR CHECK- Get calendar data:",
      err.message
    );
    throw err;
  }

  resp.data.forEach(movie => {
    console.log(movie.title);
  });
  return;
}
  /**
   * @desc Checks all services available
   * @returns nothing
   */
  async TestPing() {
    this.PingSingleIP("Plex", this.settings.plexIP);
    if (this.settings.radarrURL !== undefined)
      this.PingSingleIP("Radarr", this.settings.radarrURL);
    if (this.settings.sonarrURL !== undefined)
      this.PingSingleIP("Sonarr", this.settings.sonarrURL);
    if (this.settings.readarrURL !== undefined)
      this.PingSingleIP("Readarr", this.settings.readarrURL);
    this.PingSingleIP("TVDB", "artworks.thetvdb.com");
    this.PingSingleIP("Plex Themes", "tvthemes.plexapp.com");
    this.PingSingleIP("TMDB", "https://image.tmdb.org");
    this.PingSingleIP("Open Trivia DB", "https://opentdb.com");
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
        now.toLocaleString() + " Ping test - " + label + ": " + host,
        isAlive ? true : false
      );
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
