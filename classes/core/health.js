const fs = require("fs");
const fsp = require("fs").promises;
const DEFAULT_SETTINGS = require("../../consts");
const util = require("../core/utility");
const ping = require("ping");
const pms = require("../mediaservers/plex");
const Jellyfin = require("../mediaservers/jellyfin");
const Emby = require("../mediaservers/emby");
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

  /** Plex API client rejects empty hostname; skip debug checks when not using Plex. */
  plexServerConfigured() {
    const ip = this.settings.plexIP;
    return ip !== undefined && ip !== null && String(ip).trim() !== "";
  }

  async PlexNSCheck() {
    if (!this.plexServerConfigured()) {
      const now = new Date();
      console.log(
        now.toLocaleString() +
          " Plex Now Screening check skipped: no Plex IP/hostname configured (this test is for Plex only)."
      );
      return;
    }
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

  /** Runs Plex, Jellyfin, and Emby Now Screening checks in one pass (see server log). */
  async AllNowScreeningCheck() {
    console.log(" ");
    console.log("** NOW SCREENING CHECKS (Plex, Jellyfin, Emby) **");
    console.log("-------------------------------------------------------");
    console.log(" ");
    console.log("** PLEX **");
    console.log("-------------------------------------------------------");
    await this.PlexNSCheck();
    console.log(" ");
    console.log("** JELLYFIN **");
    console.log("-------------------------------------------------------");
    await this.JellyfinNSCheck();
    console.log(" ");
    console.log("** EMBY **");
    console.log("-------------------------------------------------------");
    await this.EmbyNSCheck();
  }

  async PlexODCheck() {
    if (!this.plexServerConfigured()) {
      const now = new Date();
      console.log(
        now.toLocaleString() +
          " Plex On-demand check skipped: no Plex IP/hostname configured (this test is for Plex only)."
      );
      return;
    }
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

    try {
      const result = await Promise.resolve(
        ms.client.query("/library/sections/" + 1 + "/all")
      );
      const now = new Date();
      console.log(
        now.toLocaleString() + " Plex on-demand: up to 5 titles from first library"
      );
      const meta = (result.MediaContainer && result.MediaContainer.Metadata) || [];
      const limit = Math.min(5, meta.length);
      for (let x = 0; x < limit; x++) {
        console.log(" -", meta[x].title);
      }
      if (!meta.length) {
        console.log(" - (no items in first library)");
      }
    } catch (err) {
      const now = new Date();
      console.log(
        now.toLocaleString() + " Plex on-demand - title retrieval: " + err
      );
    }
  }

  /** Runs Plex, Jellyfin, and Emby on-demand checks in one pass (see server log). */
  async AllOnDemandCheck() {
    console.log(" ");
    console.log("** ON-DEMAND CHECKS (Plex, Jellyfin, Emby) **");
    console.log("-------------------------------------------------------");
    console.log(" ");
    console.log("** PLEX **");
    console.log("-------------------------------------------------------");
    await this.PlexODCheck();
    console.log(" ");
    console.log("** JELLYFIN **");
    console.log("-------------------------------------------------------");
    await this.JellyfinODCheck();
    console.log(" ");
    console.log("** EMBY **");
    console.log("-------------------------------------------------------");
    await this.EmbyODCheck();
  }

  excludeLibsArray() {
    const ex = this.settings.excludeLibs;
    if (ex === undefined || ex === null || String(ex).trim() === "") {
      return undefined;
    }
    return String(ex)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async jellyfinEmbyGetNowCards(ms) {
    const excludeLibraries = this.excludeLibsArray();
    return ms.GetNowScreening(
      this.settings.playThemes,
      this.settings.genericThemes,
      this.settings.hasArt,
      this.settings.filterRemote,
      this.settings.filterLocal,
      this.settings.filterDevices,
      this.settings.filterUsers,
      this.settings.hideUser,
      excludeLibraries,
      this.settings.seriesPosterForEpisodes
    );
  }

  logJfEmbyNsResult(label, cards) {
    const list = Array.isArray(cards) ? cards : [];
    if (!list.length) {
      console.log(
        label +
          ": no Now Screening cards after filters (nothing playing, or filters excluded all sessions)."
      );
      return;
    }
    console.log(label + ": " + list.length + " Now Screening card(s) returned:");
    list.forEach((c, i) => {
      const u = c.user ? " [user: " + c.user + "]" : "";
      const dev = c.device ? " [device: " + c.device + "]" : "";
      console.log(
        "  " +
          (i + 1) +
          ". " +
          (c.title || "(no title)") +
          " (" +
          (c.mediaType || "?") +
          ")" +
          u +
          dev
      );
    });
  }

  async JellyfinNSCheck() {
    const ip = this.settings.jfIP;
    const token = this.settings.jfToken;
    if (!ip || !String(ip).trim() || !token || !String(token).trim()) {
      const now = new Date();
      console.log(
        now.toLocaleString() +
          " Jellyfin Now Screening check skipped: set Jellyfin address, port, and API key in settings."
      );
      return;
    }
    const ms = new Jellyfin({
      HTTPS: this.settings.jfHTTPS,
      jfIP: this.settings.jfIP,
      jfPort: this.settings.jfPort,
      jfToken: this.settings.jfToken,
    });
    try {
      const cards = await this.jellyfinEmbyGetNowCards(ms);
      this.logJfEmbyNsResult("Jellyfin", cards);
    } catch (err) {
      console.log("Jellyfin Now Screening check error:", err.message || err);
    }
  }

  async EmbyNSCheck() {
    const ip = this.settings.embyIP;
    const token = this.settings.embyToken;
    if (!ip || !String(ip).trim() || !token || !String(token).trim()) {
      const now = new Date();
      console.log(
        now.toLocaleString() +
          " Emby Now Screening check skipped: set Emby address, port, and API key in settings."
      );
      return;
    }
    const ms = new Emby({
      HTTPS: this.settings.embyHTTPS,
      embyIP: this.settings.embyIP,
      embyPort: this.settings.embyPort,
      embyToken: this.settings.embyToken,
    });
    try {
      const cards = await this.jellyfinEmbyGetNowCards(ms);
      this.logJfEmbyNsResult("Emby", cards);
    } catch (err) {
      console.log("Emby Now Screening check error:", err.message || err);
    }
  }

  async jellyfinEmbyGetOnDemandCards(ms) {
    return ms.GetOnDemand(
      this.settings.onDemandLibraries,
      this.settings.numberOnDemand,
      this.settings.playThemes,
      this.settings.genericThemes,
      this.settings.hasArt,
      this.settings.genres,
      this.settings.recentlyAddedDays,
      this.settings.contentRatings
    );
  }

  logJfEmbyOdResult(label, cards) {
    const list = Array.isArray(cards) ? cards : [];
    if (!list.length) {
      console.log(
        label +
          ": no on-demand cards. Check On-demand library names (must match Jellyfin/Emby folder names), genre/rating filters, 'Number to display', and 'Recently added' days."
      );
      return;
    }
    console.log(label + ": " + list.length + " on-demand card(s) built:");
    list.forEach((c, i) => {
      const sub =
        c.tagLine && String(c.tagLine).trim() && c.tagLine !== c.title
          ? " — " + c.tagLine
          : "";
      console.log(
        "  " +
          (i + 1) +
          ". " +
          (c.title || "(no title)") +
          sub +
          " (" +
          (c.mediaType || "?") +
          ")"
      );
    });
  }

  async JellyfinODCheck() {
    const ip = this.settings.jfIP;
    const token = this.settings.jfToken;
    if (!ip || !String(ip).trim() || !token || !String(token).trim()) {
      const now = new Date();
      console.log(
        now.toLocaleString() +
          " Jellyfin On-demand check skipped: set Jellyfin address, port, and API key in settings."
      );
      return;
    }
    const ms = new Jellyfin({
      HTTPS: this.settings.jfHTTPS,
      jfIP: this.settings.jfIP,
      jfPort: this.settings.jfPort,
      jfToken: this.settings.jfToken,
    });
    try {
      const cards = await this.jellyfinEmbyGetOnDemandCards(ms);
      this.logJfEmbyOdResult("Jellyfin", cards);
    } catch (err) {
      console.log("Jellyfin On-demand check error:", err.message || err);
    }
  }

  async EmbyODCheck() {
    const ip = this.settings.embyIP;
    const token = this.settings.embyToken;
    if (!ip || !String(ip).trim() || !token || !String(token).trim()) {
      const now = new Date();
      console.log(
        now.toLocaleString() +
          " Emby On-demand check skipped: set Emby address, port, and API key in settings."
      );
      return;
    }
    const ms = new Emby({
      HTTPS: this.settings.embyHTTPS,
      embyIP: this.settings.embyIP,
      embyPort: this.settings.embyPort,
      embyToken: this.settings.embyToken,
    });
    try {
      const cards = await this.jellyfinEmbyGetOnDemandCards(ms);
      this.logJfEmbyOdResult("Emby", cards);
    } catch (err) {
      console.log("Emby On-demand check error:", err.message || err);
    }
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
    if (this.settings.plexIP) {
      this.PingSingleIP("Plex", this.settings.plexIP);
    }
    const media = this.settings.mediaServer;
    if ((media === "jellyfin" || media === "emby") && this.settings.jfIP) {
      this.PingSingleIP(media === "emby" ? "Emby" : "Jellyfin", this.settings.jfIP);
    }
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
    if (host === undefined || host === null || String(host).trim() === "") {
      const now = new Date();
      console.log(
        now.toLocaleString() +
          " Ping test - " +
          label +
          ": (skipped - no host / URL configured)"
      );
      return;
    }
    let saniHost = this.sanitiseUrl(host);
    if (!saniHost) {
      const now = new Date();
      console.log(
        now.toLocaleString() +
          " Ping test - " +
          label +
          ": (skipped - could not parse host)"
      );
      return;
    }
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
    if (url === undefined || url === null) {
      return "";
    }
    // remove forward slashes
    let u = String(url).replace(/\//g, "");
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
