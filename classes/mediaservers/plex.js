const plexAPI = require("plex-api");
const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const core = require("./../core/cache");
const { CardTypeEnum } = require("./../cards/CardType");
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
    //this.client.timeout = 0;
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
      console.log(now.toLocaleString() + " *Now Scrn. - Get sessions: " + err);
      throw err;
    }
    return this.nowScreening;
  }

  /**
   * @desc Gets now screening cards
   * @returns {object} mediaCard[] - Returns an array of mediaCards
   */
    async GetNowScreening(playThemes, playGenenericThemes, hasArt, filterRemote, filterLocal, filterDevices, filterUsers, hideUser, excludeLibs) {
    // get raw data first
    let nsCards = [];
    let nsRaw;
    try {
      nsRaw = await this.GetNowScreeningRawData();
    } catch (err) {
      let now = new Date();
      console.log(now.toLocaleString() + " *Now Scrn. - Get raw data: " + err);
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
        let mediaId;

        // modify inputs, based upon tv episode or movie result structures
        switch (md.type) {
          case "track":
            contentRating = "";
            medCard.title = md.title;
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
            let guid = md.key.split("/")[3];
            fileName = guid + result[3] + ".jpg";
            prefix = "http://";
            if (this.https) prefix = "https://";
            let thumb = "";

            thumb = guid;
            if(md.parentThumb){
              thumb = md.parentThumb;
            }
            else{
              thumb = md.grandparentThumb;
            }
            url =
              prefix +
              this.plexIP +
              ":" +
              this.plexPort +
              thumb +
              "?X-Plex-Token=" +
              this.plexToken;
            await core.CacheImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;

            // download artist art image to local server
            // check art exists
            if (md.grandparentArt !== undefined && hasArt == "true") {
              fileName = guid + result[3] + "-art.jpg";
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

            medCard.resCodec = md.Media[0].bitrate + " Kbps"
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
            medCard.episodeName = md.title;
            result = md.guid.split("/");

            // Use TVDB ID if available, otherwise use GUID
            if (isNaN(result[2])) {
              mediaId = result[3];
            } else {
              mediaId = result[2];
            }

            medCard.DBID = mediaId;

            // only downlad mp3 if playThemes enabled
            if (playThemes == "true") {
              // download mp3 file to local server
              fileName = mediaId + ".mp3";
              prefix = "http://";
              if (this.https) prefix = "https://";
              url =
                prefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.grandparentTheme +
                "?X-Plex-Token=" +
                this.plexToken;
              await core.CachePlexMP3(url, fileName);
              medCard.theme = "/mp3cache/" + fileName;
            }

            if (await util.isEmpty(md.rating)) {
              medCard.rating = "";
            } else {
              medCard.rating = Math.round(md.rating * 10) + "%";
            }

            // download poster image to local server
            fileName = mediaId + ".jpg";
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
            if (md.art !== undefined && hasArt == "true") {
              fileName = mediaId + "-art.jpg";
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

            medCard.posterAR = 1.5;

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
            let movieFileName = md.ratingKey + ".jpg";
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
            if (md.art !== undefined && hasArt == "true") {
              movieFileName = md.ratingKey + "-art.jpg";
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

            medCard.posterAR = 1.5;
            // play movie theme or add generic random theme if applicable
            if (playGenenericThemes == "true") {
              if(await util.isEmpty(md.theme)){
              }
              else{
                // download mp3 file to local server
                fileName = md.ratingKey + ".mp3";
              prefix = "http://";
              if (this.https) prefix = "https://";
              url =
                prefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.theme +
                "?X-Plex-Token=" +
                this.plexToken;
              await core.CachePlexMP3(url, fileName);
              medCard.theme = "/mp3cache/" + fileName;
              }
            }

            medCard.title = md.title;
            medCard.tagLine = await util.emptyIfNull(md.tagline);
            if (await util.isEmpty(md.audienceRating)) {
              medCard.rating = "";
            } else {
              medCard.rating = Math.round(md.audienceRating * 10) + "%";
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
        //hide identifiable info if set
        if(hideUser !== "true") {
          medCard.user = md.User.title;
          medCard.device = md.Player.device;
        }

        medCard.runTime = Math.round(md.Media[0].duration / 60000);
        medCard.progress = Math.round(md.viewOffset / 60000);
        medCard.progressPercent = Math.round(
          (md.viewOffset / md.Media[0].duration) * 100
        );
        medCard.runDuration = Math.round(md.Media[0].duration / 600)/100;
        medCard.runProgress = Math.round(md.viewOffset/600) / 100;

        

        // set colours for rating badges
        if(contentRating==undefined) contentRating="nr";
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
          transcode = "transcode";  // bg-danger
        } else {
          transcode = "direct"; // bg-success
        }
        medCard.decision = transcode;

        //medCard.year = md.year;
        medCard.genre = await util.emptyIfNull(md.Genre);
        medCard.summary = md.summary;
        medCard.playerDevice = md.Player.title;
        medCard.playerIP = md.Player.address;
        medCard.playerLocal = md.Player.local;

        // console.log(" ");
        // console.log('Device Name: ' + medCard.playerDevice);
        // console.log('Playing: ' + medCard.title);
        // console.log('User: ' + medCard.user);
        // console.log('Device IP: ' + medCard.playerIP);
        // console.log('Local network: ' + medCard.playerLocal);
        // console.log("--------------------------------------------");

        let now = new Date();
        if (nsCards.length == 0) {
          // console.log(now.toLocaleString() + " Nothing playing");
        } else {
          // console.log(now.toLocaleString() + " Now showing titles refreshed");
        }

        // add media card to array
        if ((md.type == "episode" || md.type == "movie" || md.type == "track") && (md.live == undefined )) {
          // Sanitise inputs and apply filter checks
          let okToAdd = false;
          let devices = filterDevices !== undefined ? filterDevices : "";
          devices = devices.toLowerCase().replace(", ",",").replace(" ,",",").replace(/,+$/, "").split(",");
          let users = filterUsers !== undefined ? filterUsers : "";
          users = users.toLowerCase().replace(", ",",").replace(" ,",",").replace(/,+$/, "").split(",");
          // apply filter checks
          if(filterRemote=='true' && medCard.playerLocal == false) okToAdd = true;
          if(filterLocal=='true' && medCard.playerLocal == true) okToAdd = true;
          if(users.length > 0 && users.includes(md.User.title.toLowerCase())==false && users[0] !== "") okToAdd = false;
          if(devices.length > 0 && devices.includes(medCard.playerDevice.toLowerCase())==false && devices[0] !== "") okToAdd = false;
          if(excludeLibs !== undefined && excludeLibs !== "" && excludeLibs.includes(md.librarySectionTitle)) { 
            //console.log('Now Screening - Excluded library:', md.librarySectionTitle);
            okToAdd = false;
          }

          // add if all criteria matched
          if(okToAdd) {
            nsCards.push(medCard);
          }
        } else {
          // ignore movie trailers playing
          if (md.type !== "clip"){
            let medType = "";
            let d = new Date();
            if(md.live !== undefined) {
              medType="(Live stream)";
              //console.log(d.toLocaleString() + " *Ignoring unhandled media type: " + md.type + " " + medType);
            }
            else {
              console.log(d.toLocaleString() + " *Ignoring unhandled media type: " + md.type); 
            }
          }

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
   * @param {number} recentlyAdded days to  pull titles from added date
   * @param {number} contentRatings Hide titles with the specified ratings
   * @returns {object} mediaCard[] - Returns an array of mediaCards
   */
  async GetOnDemand(
    onDemandLibraries,
    numberOnDemand,
    playThemes,
    playGenenericThemes,
    hasArt,
    genres,
    recentlyAdded,
    contentRatings
  ) {
    let odCards = [];
    let odRaw;
    let mediaId;
    // sanitise genres input
    //genres = genres !== undefined ? genres : "";
    if(genres != undefined){
      genres = genres.replace(", ",",").replace(" ,",",").split(",");
    }
    // sanitise content ratings input
    //contentRatings = contentRatings !== undefined ? contentRatings : "";
    if(contentRatings !== undefined){
      contentRatings = contentRatings.replace(", ",",").replace(" ,",",").split(",");
    }
    let addOD;
//console.log(genres);
    //var recentlyAdded = false;
    try {
      //odRaw = await this.GetOnDemandRawData(onDemandLibraries, numberOnDemand, genres, recentlyAdded, contentRatings);

      if(recentlyAdded > 0){
        // if(addOD !== undefined){
          odRaw = await this.GetOnDemandRawData(onDemandLibraries, numberOnDemand, genres, recentlyAdded, contentRatings);  
          if(odRaw !== undefined){
            odRaw = odRaw.concat(await this.GetOnDemandRawData(onDemandLibraries, numberOnDemand, genres, 0, contentRatings));
          }
          else {
            odRaw = await this.GetOnDemandRawData(onDemandLibraries, numberOnDemand, genres, 0, contentRatings);
          }
      }
        else{
          odRaw = await this.GetOnDemandRawData(onDemandLibraries, numberOnDemand, genres, 0, contentRatings,true);
        }
    } catch (err) {
      let now = new Date();
      console.log(now.toLocaleString() + " *On-demand - Get raw data: " + err);
      throw err;
    }


  // odRaw.reduce((memo,m) => {
  //   console.log(m.title);
  // });

  if(JSON.stringify(odRaw) == "[null,null]"){
    odRaw = [];
    let now = new Date();
    console.log(now.toLocaleString() + " *On-demand - No results returned - check 'Genres' values");
  } 

    // reutrn an empty array if no results
    if (odRaw.length !== null && odRaw.length !== 0 && odRaw !== ",") {
      // move through results and populate media cards
      await odRaw.reduce(async (memo, md) => {
        await memo;
        const medCard = new mediaCard();
        // modify inputs, based upon tv episode or movie result structure
        switch (md.type) {
          case "show":
            medCard.tagLine = md.title;
            let result = md.guid.split("/");

            // Use TVDB ID if available, otherwise use GUID
            if (isNaN(result[2].split("?")[0])) {
              mediaId = result[3];
              //console.log(md.title, mediaId, md);
            } else {
              mediaId = result[2].split("?")[0];
            }

            medCard.DBID = mediaId;

            // include if playThemes is enabled
            medCard.theme = "";
            if (playThemes == "true" && md.theme !== undefined) {
              // download mp3 from plex tv theme server
              let fileName = mediaId + ".mp3";
              let prefix = "http://";
              if (this.https) prefix = "https://";
              let url =
                prefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.theme +
                "?X-Plex-Token=" +
                this.plexToken;
              await core.CachePlexMP3(url, fileName);
              medCard.theme = "/mp3cache/" + fileName;
            }
            if (await util.isEmpty(md.rating)) {
              medCard.rating = "";
            } else {
              medCard.rating = Math.round(md.rating * 10) + "%";
            }

            // download poster image from plex server
            let fileName = mediaId + ".jpg";

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
            if (md.art !== undefined && hasArt == "true") {
              fileName = mediaId + "-art.jpg";
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
            //     console.log(md);
            let movieFileName = md.ratingKey + ".jpg";
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
            if (md.art !== undefined && hasArt == "true") {
              movieFileName = md.ratingKey + "-art.jpg";
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

            // play movie theme or add generic random theme if applicable
            let themeFile;
            if (playGenenericThemes == "true") {
              if(await util.isEmpty(md.theme)){
                // medCard.theme =
                //   "/randomthemes/" + (await core.GetRandomMP3(odCards));
                // if(medCard.theme.includes("undefined")) medCard.theme="";
              }
              else{
                // download mp3 file to local server
                themeFile = md.ratingKey + ".mp3";
              let prefix = "http://";
              if (this.https) prefix = "https://";
              let url =
                prefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.theme +
                "?X-Plex-Token=" +
                this.plexToken;
              await core.CachePlexMP3(url, themeFile);
              medCard.theme = "/mp3cache/" + themeFile;
              }
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
              medCard.rating = Math.round(md.audienceRating * 10) + "%";
            }
            break;
        }

        // populate common data
        if (!(await util.isEmpty(md.studio))) {
          medCard.studio = md.studio;
        }

        if (medCard.tagLine == "") medCard.tagLine = medCard.title;
        medCard.mediaType = md.type;
        //medCard.cardType = cType.CardTypeEnum.OnDemand;

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


        // calculate for recently added (if set)
        var includeTitle = false;
        medCard.cardType = md.ctype;
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
        let now = new Date();
        console.log(
          now.toLocaleString() + " *On-demand - Get library key: " + err
        );
        throw err;
      }
    }, 0);
  }

  /**
   * @desc Get a mediaCard array for all titles in a given library (all is needed so random selections can be chosen later)
   * @param {number} libKey - The plex library key number
   * @returns {object} mediaCard[] - Returns an array of mediaCards
   */
  async GetAllMediaForLibrary(libKey, genres, recentlyAdded, contentRatings) {
    let mediaCards = [];
    var odQuery = "/library/sections/" + libKey + "/all";

    // modify query if recently added value added
    if(recentlyAdded > 0){
      // calculate date to search from
      var fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - recentlyAdded);
      // set to midnight
      fromDate.setHours(0,0,0,0);
      // convert to epoch time
      var fromEpochDate = fromDate.getTime()/1000;
      //console.log(fromDate);
      //console.log(fromEpochDate);
      odQuery = "/library/sections/" + libKey + "/all?sort=addedAt&addedAt>>=" + fromEpochDate;
    }
    //console.log(odQuery);
    try {
      return await this.client
        .query(odQuery)
        .then(
          function (result) {

            // populate a complete list of all titles into an array
            if (result.MediaContainer.size > 0) {
              let mediaResults = result.MediaContainer.Metadata;
              // ignore genre if recently added set
                if(recentlyAdded == 0){
                // if genre filters present, then filter results 
                const mapGenre = (arr, gs) => {
                  return gs.reduce((acc, val) => {
                    const libMatches = arr.filter(m => m.Genre !== undefined && JSON.stringify(m.Genre).toLowerCase().includes(val.toLowerCase()));
          //console.log("Library matches for genre '"+val+"':",libMatches.length);
                    if(libMatches.length > 0 ){
                      //return acc.concat(libMatches);
                      return acc.concat(libMatches);
                    }
                    else{
                      return acc;
                    }
                  }, []);
                };

                // if content rating filters present, then filter results (do not display)
                const mapContentRating = (arr, gs) => {
                  return gs.reduce((acc, val) => {
                    const libMatches = arr.filter(m => m.contentRating !== undefined && (m.contentRating).toLowerCase()===(val.toLowerCase()));
                    //console.log("Library '" + libKey + "' filter out for content rating '" + val + "': " + libMatches.length + " excluded");
                    // if no matches, then return content
                    let crArray;
                    if(libMatches.length > 0){
                      return acc.concat(libMatches);
                    }
                    else{
                      return acc;
                    }
                  }, []);
                };            

                
                // check if supplying genres, then filter
                if(genres !== undefined && genres.length > 0){
                  let mediaFiltered = result.MediaContainer.Metadata;
                  mediaResults = mapGenre(mediaFiltered, genres);
                }

               // check if supplying content ratings, then filter
                if(contentRatings !== undefined && contentRatings.length > 0){
                  let mediaFiltered = mediaResults;
                  let excludeArray = mapContentRating(mediaFiltered, contentRatings);

                  const itemsToDeleteSet = new Set(excludeArray);
                  const reducedArray = mediaResults.filter((c) => {
                    // return those elements not in the namesToDeleteSet
                    return !itemsToDeleteSet.has(c);
                  });
                  
                  mediaResults=reducedArray;

                }

            }
            else{
             // let mediaResults = result.MediaContainer.Metadata;
            }

              // send selected card to filtered array
              mediaResults.forEach((mt) => {
                  mediaCards.push(mt);
              });
            }
            return mediaCards;
          },
          function (err) {
            let now = new Date();
            console.log(
              now.toLocaleString() + " *On-demand - Get titles: " + err
            );
            throw err;
          },
          Promise.resolve(0)
        );
    } catch (err) {
      throw err;
    }
  }

  /**
   * @desc Gets the specified, random, number of titles from a specified set of libraries
   * @param {string} onDemandLibraries - a comma seperated lists of the libraries to pull on-demand titles from
   * @param {number} numberOnDemand - the number of results to return from each library
   * @returns {object} mediaCard[] - Returns an array of on-demand mediaCards
   */
  async GetOnDemandRawData(onDemandLibraries, numberOnDemand, genres, recentlyAdded, contentRating) {
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
            (await this.GetAllMediaForLibrary(value, genres, recentlyAdded, contentRating).then(async function (
              result
            ) {
              // get titles
              const od = await util.build_random_od_set(numberOnDemand, result, recentlyAdded);
              await od.reduce(async (cb, odc) => {
                if(recentlyAdded>0){
                  odc.ctype = CardTypeEnum.RecentlyAdded;
                }
                else{
                  odc.ctype = CardTypeEnum.OnDemand;
                }
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
      console.log(
        now.toLocaleString() + " *On-demand - Get library keys: " + err
      );
      throw err;
    }
    return odSet;
  }
}

module.exports = Plex;
