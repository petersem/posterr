const plexAPI = require("plex-api");
const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const core = require("./../core/cache");
// const sizeOf = require("image-size");

/**
 * @desc Used to communicate with Plex
 * @param {string} HTTPS - set this to true if Plex only allows secure connections
 * @param {string} plexIP - the IP or fqdn of the plex server
 * @param {number} plexPort - the port number used by Plex
 * @param {string} plexToken - the Plex token
 * @returns {object} Plex API client object
 */
class Plex {
  constructor({ HTTPS, plexIP, plexPort, plexToken }) {
    this.https = HTTPS;
    this.plexIP = plexIP;
    this.plexPort = plexPort;
    this.plexToken = plexToken;
    this.libraryKeys = [];

    // create connection to use
    this.client = new plexAPI({
      hostname: plexIP,
      port: plexPort,
      https: HTTPS,
      token: plexToken,
    });
    this.client.timeout = 0;
    this.client.options = { product: "Poster" };
  }

  /**
   * @desc Get raw results for now screening
   * @returns {object} JSON - Plex now screening results
   */
  async GetNowScreeningRawData() {
    try {
      this.nowScreening = await this.client.query("/status/sessions").then(
        function (result) {
          return result;
        },
        function (err) {
          throw err;
        }
      );
    } catch (err) {
      let now = new Date();
      console.log(
        now.toLocaleString() + " *Now screening - Get titles: " + err
      );
      throw err;
    }
    return this.nowScreening;
  }

  /**
   * @desc Gets now screening cards
   * @param {string} playGenericThemes - will set movies to play a random generic theme fro the /randomthemes folder
   * @returns {object} mediaCard[] - Returns an array of mediaCards
   */
  async GetNowScreening(playThemes, playGenenericThemes) {
    // get raw data first
    let nsCards = [];
    let nsRaw;
    try {
      nsRaw = await this.GetNowScreeningRawData();
    } catch (err) {
      throw err;
    }
    // reutrn an empty array if no results
    if (
      nsRaw != [] &&
      nsRaw.MediaContainer != undefined &&
      nsRaw.MediaContainer.Metadata != undefined
    ) {
      // move through results and populate media cards
      await nsRaw.MediaContainer.Metadata.reduce(async (memo, md) => {
        await memo;
        const medCard = new mediaCard();
        let transcode = "direct";

        let result;
        let fileName;
        let prefix;
        let url;
        let contentRating;

        // modify inputs, based upon tv episode or movie result structures
        switch (md.type) {
          case "track":
            contentRating = "";
            medCard.tagLine =
              md.title +
              ", " +
              md.grandparentTitle +
              " (" +
              md.parentTitle +
              ")";
            result = md.guid.split("/");
            medCard.DBID = result[2];

            // download poster image to local server
            fileName = result[3] + ".jpg";
            prefix = "http://";
            if (this.https) prefix = "https://";
            url =
              prefix +
              this.plexIP +
              ":" +
              this.plexPort +
              md.parentThumb +
              "?X-Plex-Token=" +
              this.plexToken;
            await core.CacheImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;

            // download artist art image to local server
            // check art exists
            if(md.grandparentArt !== undefined){
              fileName = result[3] + "-art.jpg";
              prefix = "http://";
              if (this.https) prefix = "https://";
              url =
                prefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.grandparentArt +
                "?X-Plex-Token=" +
                this.plexToken;
              await core.CacheImage(url, fileName);
              medCard.posterArtURL = "/imagecache/" + fileName;
            }
              
            medCard.posterAR = 1;

            medCard.audioCodec = md.Media[0].audioCodec;
            medCard.runTime = Math.round(md.Media[0].duration / 60000);
            medCard.cardType = cType.CardTypeEnum.Playing;
            // resize image to fit aspect ratio of 680x1000

            break;
          case "episode":
            medCard.tagLine =
              md.parentTitle +
              ", Episode " +
              md.index +
              " - '" +
              md.title +
              "'";
            result = md.guid.split("/");
            medCard.DBID = result[2];

            // only downlad mp3 if playThemes enabled
            if (playThemes == "true") {
              // download mp3 file to local server
              let mp3 = result[2] + ".mp3";
              await core.CacheMP3(mp3);
              medCard.theme = "/mp3cache/" + mp3;
            }

            if (await util.isEmpty(md.rating)) {
              medCard.rating = "";
            } else {
              medCard.rating = md.rating * 10 + "%";
            }

            // download poster image to local server
            fileName = result[2] + ".jpg";
            prefix = "http://";
            if (this.https) prefix = "https://";
            url =
              prefix +
              this.plexIP +
              ":" +
              this.plexPort +
              md.grandparentThumb +
              "?X-Plex-Token=" +
              this.plexToken;
            await core.CacheImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;

            //download poster 
            // check art exists
            if(md.art !== undefined){
              fileName = result[2].split("?")[0] + "-art.jpg";
              if (this.https) prefix = "https://";
              url =
                prefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.art +
                "?X-Plex-Token=" +
                this.plexToken;

              await core.CacheImage(url, fileName);
              medCard.posterArtURL = "/imagecache/" + fileName;
            }

            medCard.posterAR = 1.47;

            medCard.title = md.grandparentTitle;
            medCard.genre = md.genre;

            // work out where transcode data is in the returned media item
            let mediaPart = 0;

            if (md.Media[0] !== undefined) {
              if (md.Media[0].Part[0].Stream != undefined) {
                mediaPart = 0;
              }
            }

            if (md.Media[1] !== undefined) {
              if (md.Media[1].Part[0].Stream != undefined) {
                mediaPart = 1;
              }
            }

            medCard.resCodec = md.Media[
              mediaPart
            ].Part[0].Stream[0].displayTitle
              .replace("(", "")
              .replace(")", "");

            medCard.audioCodec = md.Media[
              mediaPart
            ].Part[0].Stream[1].displayTitle
              .replace("Unknown ", "")
              .replace("(", "")
              .replace(")", "");

            medCard.cardType = cType.CardTypeEnum.NowScreening;

            contentRating = "NR";
            if (!(await util.isEmpty(md.contentRating))) {
              contentRating = md.contentRating;
            }
            medCard.contentRating = contentRating;

            // check transcode status (set transcode if audio or video transcoding)
            if (md.Media[mediaPart].Part[0].decision == "transcode") {
              transcode = "transcode";
            }
            break;
          case "movie":
            // cache movie poster
            let movieFileName = md.updatedAt + ".jpg";
            medCard.genre = md.Genre;
            let moviePlexPrefix = "http://";
            if (this.https) moviePlexPrefix = "https://";
            let movieUrl =
              moviePlexPrefix +
              this.plexIP +
              ":" +
              this.plexPort +
              md.thumb +
              "?X-Plex-Token=" +
              this.plexToken;
            await core.CacheImage(movieUrl, movieFileName);
            medCard.posterURL = "/imagecache/" + movieFileName;

            //download poster 
            // check art exists
            if(md.art !== undefined){
              movieFileName = md.updatedAt + "-art.jpg";
              if (this.https) moviePlexPrefix = "https://";
                movieUrl =
                  moviePlexPrefix +
                  this.plexIP +
                  ":" +
                  this.plexPort +
                  md.art +
                  "?X-Plex-Token=" +
                  this.plexToken;
            
              await core.CacheImage(movieUrl, movieFileName);
              medCard.posterArtURL = "/imagecache/" + movieFileName;
            }

            medCard.posterAR = 1.47;
            // add generic random theme if applicable
            if (playGenenericThemes == "true") {
              medCard.theme =
                "/randomthemes/" + (await core.GetRandomMP3(nsCards));
            }

            medCard.title = md.title;
            medCard.tagLine = await util.emptyIfNull(md.tagline);
            if (await util.isEmpty(md.audienceRating)) {
              medCard.rating = "";
            } else {
              medCard.rating = md.audienceRating * 10 + "%";
            }

            medCard.resCodec = md.Media[0].Part[0].Stream[0].displayTitle
              .replace("(", "")
              .replace(")", "");
            medCard.audioCodec = md.Media[0].Part[0].Stream[1].displayTitle
              .replace("Unknown ", "")
              .replace("(", "")
              .replace(")", "");
            medCard.cardType = cType.CardTypeEnum.NowScreening;

            contentRating = "NR";
            if (!(await util.isEmpty(md.contentRating))) {
              contentRating = md.contentRating;
            }
            medCard.contentRating = contentRating;

            if (md.Media[0].Part[0].decision == "transcode") {
              transcode = "transcode";
            }
            break;
        }

        // populate common data
        medCard.mediaType = md.type;
        medCard.user = md.User.title;
        medCard.device = md.Player.device;

        medCard.runTime = Math.round(md.Media[0].duration / 60000);
        medCard.progress = Math.round(md.viewOffset / 60000);
        medCard.progressPercent = Math.round(
          (md.viewOffset / md.Media[0].duration) * 100
        );

        // set colours for rating badges
        let ratingColour = "";
        switch (contentRating.toLowerCase()) {
          case "nr":
            ratingColour = "badge-dark";
            break;
          case "unrated":
            ratingColour = "badge-dark";
            contentRating = "NR";
            break;
          case "g":
            ratingColour = "badge-success";
            break;
          case "g":
            ratingColour = "badge-success";
            break;
          case "tv-g":
            ratingColour = "badge-success";
            break;
          case "tv-y":
            ratingColour = "badge-success";
            break;
          case "pg":
            ratingColour = "badge-info";
            break;
          case "tv-pg":
            ratingColour = "badge-info";
            break;
          case "tv-y7":
            ratingColour = "badge-info";
            break;
          case "pg-13":
            ratingColour = "badge-warning";
            break;
          case "tv-14":
            ratingColour = "badge-warning";
            break;
          case "tv-ma":
            ratingColour = "badge-danger";
            break;
          case "r":
            ratingColour = "badge-danger";
            break;
          default:
            ratingColour = "badge-dark";
            break;
        }
        medCard.ratingColour = ratingColour;

        if (transcode == "transcode") {
          transcode = "bg-danger";
        } else {
          transcode = "bg-success";
        }
        medCard.decision = transcode;

        //medCard.year = md.year;
        medCard.genre = await util.emptyIfNull(md.Genre);
        medCard.summary = md.summary;
        medCard.playerDevice = md.Player.title;
        medCard.playerIP = md.Player.address;
        medCard.playerLocal = md.Player.local;
        medCard.user = md.User.title;

        let now = new Date();
        if (nsCards.length == 0) {
          // console.log(now.toLocaleString() + " Nothing playing");
        } else {
          // console.log(now.toLocaleString() + " Now showing titles refreshed");
        }

        // add media card to array
        if (md.type == "episode" || md.type == "movie" || md.type == "track") {
          nsCards.push(medCard);
        } else {
          console.log("Unknown media type playing: " + md.type);
        }
      }, undefined);
    }

    // return populated array
    return nsCards;
  }

  /**
   * @desc Gets random on-demand cards
   * @param {string} onDemandLibraries - a comma seperated lists of the libraries to pull on-demand titles from
   * @param {number} The number of titles to pull from each library
   * @param {string} playGenericThemes - will set movies to play a random generic theme fro the /randomthemes folder
   * @returns {object} mediaCard[] - Returns an array of mediaCards
   */
  async GetOnDemand(
    onDemandLibraries,
    numberOnDemand,
    playThemes,
    playGenenericThemes
  ) {
    // get library keys
    let odCards = [];
    let odRaw;
    try {
      odRaw = await this.GetOnDemandRawData(onDemandLibraries, numberOnDemand);
    } catch (err) {
      let now = new Date();
      console.log(now.toLocaleString() + " ** ERROR: " + err);
    }

    // reutrn an empty array if no results
    if (odRaw.length != null) {
      // move through results and populate media cards
      await odRaw.reduce(async (memo, md) => {
        await memo;
        const medCard = new mediaCard();
        // modify inputs, based upon tv episode or movie result structures
        switch (md.type) {
          case "show":
            medCard.tagLine = md.title;
            let result = md.guid.split("/");
            medCard.DBID = result[2].split("?")[0];

            // include if playThemes is enabled
            if (playThemes == "true") {
              // download mp3 from plex tv theme server
              let mp3 = result[2].split("?")[0] + ".mp3";
              await core.CacheMP3(mp3);
              medCard.theme = "/mp3cache/" + mp3;
            }

            if (await util.isEmpty(md.rating)) {
              medCard.rating = "";
            } else {
              medCard.rating = md.rating * 10 + "%";
            }

            // download poster image from plex server
            let fileName = result[2].split("?")[0] + ".jpg";
            let prefix = "http://";
            if (this.https) prefix = "https://";
            let url =
              prefix +
              this.plexIP +
              ":" +
              this.plexPort +
              md.thumb +
              "?X-Plex-Token=" +
              this.plexToken;

            await core.CacheImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;

            //download poster art
            // check art exists
            if(md.art !== undefined){
              fileName = result[2].split("?")[0] + "-art.jpg";
              if (this.https) prefix = "https://";
                url =
                  prefix +
                  this.plexIP +
                  ":" +
                  this.plexPort +
                  md.art +
                  "?X-Plex-Token=" +
                  this.plexToken;

              await core.CacheImage(url, fileName);
              medCard.posterArtURL = "/imagecache/" + fileName;
            }

            medCard.posterAR = 1.47;

            medCard.runTime = Math.round(md.duration / 60000);
            medCard.title = md.grandparentTitle;

            break;
          case "movie":
            // cache movie poster
            let movieFileName = md.updatedAt + ".jpg";
            let moviePlexPrefix = "http://";
            if (this.https) moviePlexPrefix = "https://";
            let movieUrl =
              moviePlexPrefix +
              this.plexIP +
              ":" +
              this.plexPort +
              md.thumb +
              "?X-Plex-Token=" +
              this.plexToken;
            await core.CacheImage(movieUrl, movieFileName);
            medCard.posterURL = "/imagecache/" + movieFileName;

            //download poster 
            // check art exists
            if(md.art !== undefined){
              movieFileName = md.updatedAt + "-art.jpg";
              if (this.https) moviePlexPrefix = "https://";
                movieUrl =
                moviePlexPrefix +
                  this.plexIP +
                  ":" +
                  this.plexPort +
                  md.art +
                  "?X-Plex-Token=" +
                  this.plexToken;

              await core.CacheImage(movieUrl, movieFileName);
              medCard.posterArtURL = "/imagecache/" + movieFileName;
            }

            if (playGenenericThemes == "true") {
              medCard.theme =
                "/randomthemes/" + (await core.GetRandomMP3(odCards));
            }

            medCard.posterAR = 1.47;
            
            // other data
            medCard.title = md.title;
            medCard.runTime = Math.round(md.Media[0].duration / 60000);

            if (!(await util.isEmpty(medCard.resCodec))) {
              medCard.resCodec =
                md.Media[0].videoResolution +
                " " +
                md.Media[0].videoCodec.toUpperCase();
            }
            if (!(await util.isEmpty(medCard.audioCodec))) {
              medCard.audioCodec =
                md.Media[0].audioCodec.toUpperCase() +
                " " +
                md.Media[0].audioChannels;
            }

            medCard.tagLine = await util.emptyIfNull(md.tagline);
            if (await util.isEmpty(md.audienceRating)) {
              medCard.rating = "";
            } else {
              medCard.rating = md.audienceRating * 10 + "%";
            }
            break;
        }

        // populate common data
        if (!(await util.isEmpty(md.studio))) {
          medCard.studio = md.studio;
        }

        medCard.mediaType = md.type;
        medCard.cardType = cType.CardTypeEnum.OnDemand;

        let contentRating = "NR";
        if (!(await util.isEmpty(md.contentRating))) {
          contentRating = md.contentRating;
        }
        medCard.contentRating = contentRating;

        // set colours for rating badges
        let ratingColour = "";
        switch (contentRating.toLowerCase()) {
          case "nr":
            ratingColour = "badge-dark";
            break;
          case "unrated":
            ratingColour = "badge-dark";
            contentRating = "NR";
            break;
          case "g":
            ratingColour = "badge-success";
            break;
          case "g":
            ratingColour = "badge-success";
            break;
          case "tv-g":
            ratingColour = "badge-success";
            break;
          case "tv-y":
            ratingColour = "badge-success";
            break;
          case "pg":
            ratingColour = "badge-info";
            break;
          case "tv-pg":
            ratingColour = "badge-info";
            break;
          case "tv-y7":
            ratingColour = "badge-info";
            break;
          case "pg-13":
            ratingColour = "badge-warning";
            break;
          case "tv-14":
            ratingColour = "badge-warning";
            break;
          case "tv-ma":
            ratingColour = "badge-danger";
            break;
          case "r":
            ratingColour = "badge-danger";
            break;
          default:
            ratingColour = "badge-dark";
            break;
        }
        medCard.ratingColour = ratingColour;

        medCard.year = md.year;
        medCard.genre = await util.emptyIfNull(md.Genre);
        medCard.summary = md.summary;

        // add media card to array
        odCards.push(medCard);
      }, undefined);
    }
    let now = new Date();
    if (odCards.length == 0) {
      console.log(now.toLocaleString() + " No On-demand titles available");
    } else {
      console.log(
        now.toLocaleString() +
          " On-demand titles refreshed (" +
          onDemandLibraries +
          ")"
      );
    }
    // return populated array
    return odCards;
  }

  /**
   * @desc Get Plex library keys for selected on-demand libraries
   * @param {string} onDemandLibraries - a comma seperated lists of the libraries to pull on-demand titles from
   * @returns {object} number[] - Returns an array of library key numbers
   */
  async GetLibraryKeys(onDemandLibraries) {
    if (!onDemandLibraries || onDemandLibraries.length == 0) {
      onDemandLibraries = " ";
    }

    // Get the key for each library and push into an array
    let keys = [];
    return onDemandLibraries.split(",").reduce(async (acc, value) => {
      await acc;
      try {
        return await this.client.query("/library/sections/").then(
          function (result) {
            let found = false;
            result.MediaContainer.Directory.forEach((lib) => {
              if (value.trim().toLowerCase() == lib.title.toLowerCase()) {
                keys.push(lib.key);
                found = true;
                //console.log(" - " + lib.title + " - ID: " + lib.key);
              }
            });
            if (!found) {
              let d = new Date();
              console.log(
                "✘✘ WARNING ✘✘ - On-demand library '" + value + "' not found"
              );
            }
            return keys;
          },
          function (err) {
            throw err;
          }
        );
      } catch (err) {
        let now = new Data();
        console.log(
          now.toLocaleString() + " *On-demand - Get library key: " + err
        );
      }
    }, 0);
  }

  /**
   * @desc Get a mediaCard array for all titles in a given library (all is needed so random selections can be chosen later)
   * @param {number} libKey - The plex library key number
   * @returns {object} mediaCard[] - Returns an array of mediaCards
   */
  async GetAllMediaForLibrary(libKey) {
    let mediaCards = [];
    return await this.client.query("/library/sections/" + libKey + "/all").then(
      function (result) {
        // populate a complete list of all titles into an array
        if (result.MediaContainer.size > 0) {
          result.MediaContainer.Metadata.forEach((mt) => {
            mediaCards.push(mt);
          });
        }
        return mediaCards;
      },
      function (err) {
        let now = new Date();
        console.log(now.toLocaleString() + " *On-demand - Get titles: " + err);
        throw err;
      },
      Promise.resolve(0)
    );
  }

  /**
   * @desc Gets the specified, random, number of titles from a specified set of libraries
   * @param {string} onDemandLibraries - a comma seperated lists of the libraries to pull on-demand titles from
   * @param {number} numberOnDemand - the number of results to return from each library
   * @returns {object} mediaCard[] - Returns an array of on-demand mediaCards
   */
  async GetOnDemandRawData(onDemandLibraries, numberOnDemand) {
    // Get a list of random titles from selected libraries
    let odSet = [];

    //const sleep = (n) => new Promise((res) => setTimeout(res, n));

    try {
      const keys = await this.GetLibraryKeys(onDemandLibraries);
      // console.log("Library key: " + keys);
      if (keys !== undefined) {
        const p = await keys.reduce(async (acc, value) => {
          return (
            (await acc) +
            (await this.GetAllMediaForLibrary(value).then(async function (
              result
            ) {
              const od = await util.build_random_od_set(numberOnDemand, result);
              await od.reduce(async (cb, odc) => {
                odSet.push(odc);
                return await cb;
              }, Promise.resolve(0));
            },
            Promise.resolve(0)))
          );
        }, Promise.resolve(0));
      }
    } catch (err) {
      let now = new Date();
      console.log(now.toLocaleString() + " *On-demand - Get raw data: " + err);
    }

    return odSet;
  }
}

module.exports = Plex;
