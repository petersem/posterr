const plexAPI = require("plex-api");
const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const core = require("./../core/cache");
const sizeOf = require("image-size");

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
  }

  /**
   * @desc Get raw results for now screening
   * @returns {object} JSON - Plex now screening results
   */
  async GetNowScreeningRawData() {
    try{
    this.nowScreening = await this.client.query("/status/sessions").then(
      function (result) {
        return result;
      },
      function (err) {
        throw err;
      }
    );
    }
    catch(err){
      console.log("*Now screening - Get titles: " + err);
      throw err;
    }
    return this.nowScreening;
  }

  /**
   * @desc Gets now screening cards
   * @param {string} playGenericThemes - will set movies to play a random generic theme fro the /randomthemes folder
   * @returns {object} mediaCard[] - Returns an array of mediaCards
   */
  async GetNowScreening(playGenenericThemes) {
    // get raw data first
    let nsCards = [];
    let nsRaw;
    try{
      nsRaw =await this.GetNowScreeningRawData();
    }
    catch(err){
      throw err;
    }
    // reutrn an empty array if no results
    if (
      nsRaw != [] &&
      nsRaw.MediaContainer != undefined &&
      nsRaw.MediaContainer.Metadata != undefined
    ) {
      // console.log(nsRaw.MediaContainer.Metadata[2]);

      // move through results and populate media cards
      await nsRaw.MediaContainer.Metadata.reduce(async (memo, md) => {
        await memo;
        const medCard = new mediaCard();
        let transcode = "direct";

        let result;
        let fileName;
        let prefix;
        let url;
        // modify inputs, based upon tv episode or movie result structures
        switch (md.type) {
          case "track":
            console.log(md);
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
              "&" +
              this.plexToken;
            await core.CacheImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;

            // get and save image aspect ratio for rendering later on - set to 1 until this is fixed
            // sizeOf('/imagecache/' + fileName, function (err, dimensions) {
            //   medCard.posterAR = (dimensions.height / dimensions.width);
            //   console.log(dimensions.width, dimensions.height);
            // });
            medCard.posterAR = 1;

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

            // download mp3 file to local server
            let mp3 = result[2] + ".mp3";
            await core.CacheMP3(mp3);
            medCard.theme = "/mp3cache/" + mp3;

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
              "&" +
              this.plexToken;
            await core.CacheImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;

            // get and save image aspect ratio for rendering later on - set to 1.5 until this is fixed
            // sizeOf('/imagecache/' + fileName, function (err, dimensions) {
            //   medCard.posterAR = (dimensions.height / dimensions.width);
            //   console.log(dimensions.width, dimensions.height);
            // });
            medCard.posterAR = 1.47;

            medCard.title = md.grandparentTitle;
            medCard.genre = md.genre;
            medCard.resCodec = md.Media[0].Part[0].Stream[0].displayTitle
              .replace("(", "")
              .replace(")", "");
            medCard.audioCodec = md.Media[0].Part[0].Stream[1].displayTitle
              .replace("Unknown ", "")
              .replace("(", "")
              .replace(")", "");
            medCard.cardType = cType.CardTypeEnum.NowScreening;
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
              "&" +
              this.plexToken;
            await core.CacheImage(movieUrl, movieFileName);
            medCard.posterURL = "/imagecache/" + movieFileName;

            // get and save image aspect ratio for rendering later on - set to 1.5 until this is fixed
            // sizeOf('/imagecache/' + movieFileName, function (err, dimensions) {
            //   medCard.posterAR = (dimensions.height / dimensions.width);
            //   console.log(dimensions.width, dimensions.height);
            // });
            medCard.posterAR = 1.47;

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
            break;
        }

        // populate common data
        medCard.mediaType = md.type;

        medCard.runTime = Math.round(md.Media[0].duration / 60000);
        medCard.progress = Math.round(md.viewOffset / 60000);
        medCard.progressPercent = Math.round(
          (md.viewOffset / md.Media[0].duration) * 100
        );
        if (md.Media[0].Part[0].decision == "transcode") {
          transcode = await util.emptyIfNull(md.Media[0].Part[0].decision);
          if (!(await util.isEmpty(md.TranscodeSession))) {
            let audioTranscode = await util.emptyIfNull(
              md.TranscodeSession.audioDecision
            );
          }
        }

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

        if (transcode == "transcode") {
          transcode = "bg-danger";
        } else {
          transcode = "bg-success";
        }
        medCard.decision = transcode;

        // add generic random theme if applicable
        if (medCard.theme == "" && playGenenericThemes == "true") {
          medCard.theme = "/randomthemes/" + (await core.GetRandomMP3());
        }

        medCard.year = md.year;
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
  async GetOnDemand(onDemandLibraries, numberOnDemand, playGenenericThemes) {
    // get library keys
    let odCards = [];
    let odRaw;
    try {
      odRaw = await this.GetOnDemandRawData(onDemandLibraries, numberOnDemand);
    } catch (err) {
      console.log("** ERROR: " + err);
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
            // console.log(md);
            medCard.tagLine = md.title;
            let result = md.guid.split("/");
            medCard.DBID = result[2].split("?")[0];

            // download mp3 from plex tv theme server
            let mp3 = result[2].split("?")[0] + ".mp3";
            await core.CacheMP3(mp3);
            medCard.theme = "/mp3cache/" + mp3;

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
              "&" +
              this.plexToken;
            await core.CacheImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;

            // get and save image aspect ratio for rendering later on - set to 1.5 until fixed
            // sizeOf('/imagecache/' + fileName, function (err, dimensions) {
            //   medCard.posterAR = (dimensions.height / dimensions.width);
            //   console.log(dimensions.width, dimensions.height);
            // });
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
              "&" +
              this.plexToken;
            await core.CacheImage(movieUrl, movieFileName);
            medCard.posterURL = "/imagecache/" + movieFileName;

            // get and save image aspect ratio for rendering later on - set to 1.5 until this is fixed
            sizeOf("/imagecache/" + movieFileName, function (err, dimensions) {
              medCard.posterAR = dimensions.height / dimensions.width;
              console.log(dimensions.width, dimensions.height);
            });
            medCard.posterAR = 1.47;

            // other data
            medCard.title = md.title;
            medCard.runTime = Math.round(md.Media[0].duration / 60000);
            medCard.resCodec =
              md.Media[0].videoResolution +
              " " +
              md.Media[0].videoCodec.toUpperCase();
            medCard.audioCodec =
              md.Media[0].audioCodec.toUpperCase() +
              " " +
              md.Media[0].audioChannels;
            medCard.tagLine = await util.emptyIfNull(md.tagline);
            if (await util.isEmpty(md.audienceRating)) {
              medCard.rating = "";
            } else {
              medCard.rating = md.audienceRating * 10 + "%";
            }
            break;
        }

        // populate common data
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

        // add generic random theme if applicable
        if (medCard.theme == "" && playGenenericThemes) {
          medCard.theme = "/randomthemes/" + core.GetRandomMP3();
        }

        // add media card to array
        odCards.push(medCard);
      }, undefined);
    }
    let now = new Date();
    if (odCards.length == 0) {
      console.log(now.toLocaleString() + " No On-demand titles available");
    } else {
      console.log(now.toLocaleString() + " On-demand titles refreshed");
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
      try {
      return await this.client.query("/library/sections/").then(
        function (result) {
          result.MediaContainer.Directory.forEach((lib) => {
            if (value.toLowerCase() == lib.title.toLowerCase()) {
              keys.push(lib.key);
              //console.log(" - " + lib.title + " - ID: " + lib.key);
            }
          });
          return keys;
        },
        function (err) {
          throw err;
        }
      );
    }
    catch(err){
      console.log("*On-demand - Get library key: " + err);    }
    }, Promise.resolve(0));
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
            // console.log(mt);
            mediaCards.push(mt);
          });
        }
        return mediaCards;
      },
      function (err) {
        console.log("*On-demand - Get titles: " + err);
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
    try {
      const keys = await this.GetLibraryKeys(onDemandLibraries);
      // console.log("Library key: " + keys);
      if (keys != undefined) {
        odSet = await keys.reduce(async (acc, value) => {
          const all = await acc;
          return await this.GetAllMediaForLibrary(value).then(async function (
            result
          ) {
            // TODO - need to address issue where only one library is getting returned (not concatenating results)
            return await util.build_random_od_set(numberOnDemand, result);
          },
          Promise.resolve(0));
        }, Promise.resolve(0));
      }
    } catch (err) {
      console.log("** ERROR!!: " + err);
    }
    //console.log(odSet);
    return await odSet;
  }
}

module.exports = Plex;
