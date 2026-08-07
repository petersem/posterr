const plexAPI = require("plex-api");
const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const core = require("./../core/cache");
const tmdbBackdropFallback = require("./../core/tmdbBackdropFallback");
const posterSyncLib = require("./../core/posterSyncProgress");
const posterSyncRetry = require("./../core/posterSyncRetry");
const posterMetadataDb = require("./../core/posterMetadataDb");
const {
  PosterSyncAbortedError,
  checkPosterSyncAborted,
} = require("./../core/posterSyncAbort");
const { CardTypeEnum } = require("./../cards/CardType");
const { error } = require("jquery");
const POSTER_SYNC_BATCH_SIZE = 100;
// const sizeOf = require("image-size");

/** Plex clear logo path from metadata field or Image[] (provider clearLogo). */
function plexClearLogoPathFromMetadata(md) {
  if (!md) return "";
  const d = md.clearLogo || md.clearlogo;
  if (d && String(d).trim()) return String(d).trim();
  const arr = md.Image || md.image;
  if (!Array.isArray(arr)) return "";
  for (const im of arr) {
    if (!im) continue;
    const typ = String(im.type || im.Type || "").toLowerCase();
    if (typ !== "clearlogo") continue;
    const u = im.url || im.URL || im.path || im.Path || "";
    if (u) return String(u).trim();
  }
  return "";
}

/**
 * Download Plex clear logo into imagecache as `{idForFile}-logo.png`.
 */
async function plexCacheClearLogo(core, self, md, idForFile, medCard) {
  const rel = plexClearLogoPathFromMetadata(md);
  if (!rel || !idForFile) return;
  const logoFile = `${idForFile}-logo.png`;
  try {
    let fetchUrl;
    if (/^https?:\/\//i.test(rel)) {
      fetchUrl = rel;
    } else {
      const pre = self.https ? "https://" : "http://";
      const sep = rel.includes("?") ? "&" : "?";
      fetchUrl = `${pre}${self.plexIP}:${self.plexPort}${rel}${sep}X-Plex-Token=${self.plexToken}`;
    }
    await core.CacheImage(fetchUrl, logoFile);
    medCard.posterLogoURL = "/imagecache/" + logoFile;
  } catch (e) {
    /* optional */
  }
}

function extractPlexTags(md) {
  if (!md || typeof md !== "object") return "";
  const out = [];
  const add = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const it of v) add(it);
      return;
    }
    if (typeof v === "object") {
      add(v.tag || v.Tag || v.title || v.Title || v.label || v.Label || "");
      return;
    }
    const s = String(v).trim();
    if (!s) return;
    out.push(s);
  };
  add(md.Tag);
  add(md.tag);
  add(md.Label);
  add(md.label);
  add(md.Collection);
  add(md.collection);
  add(md.Genre);
  add(md.genre);
  const uniq = [];
  const seen = new Set();
  for (const s of out) {
    const lc = s.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    uniq.push(s);
  }
  return uniq.join(", ");
}

/**
 * @desc Used to communicate with Plex
 * @param {string} HTTPS - set this to true if Plex only allows secure connections
 * @param {string} plexIP - the IP or fqdn of the plex server
 * @param {number} plexPort - the port number used by Plex
 * @param {string} plexToken - the Plex token
 * @returns {object} Plex API client object
 */
class Plex {
  constructor({ HTTPS, plexHTTPS, plexIP, plexPort, plexToken }) {
    const useHttps = HTTPS !== undefined && HTTPS !== null ? HTTPS : plexHTTPS;
    this.https = useHttps;
    this.plexIP = plexIP;
    this.plexPort = plexPort;
    this.plexToken = plexToken;
    this.libraryKeys = [];

    // create connection to use
    this.client = new plexAPI({
      hostname: plexIP,
      port: plexPort,
      https: useHttps === true || useHttps === "true",
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
            // Album-first: title = album, tagLine = artist — track
            medCard.title = md.parentTitle || md.title;
            medCard.tagLine = [md.grandparentTitle, md.title]
              .filter(Boolean)
              .join(" — ");
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
            medCard.posterDownloadURL = url;
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
            } else if (md.parentArt !== undefined && hasArt == "true") {
              fileName = guid + result[3] + "-art.jpg";
              prefix = "http://";
              if (this.https) prefix = "https://";
              url =
                prefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.parentArt +
                "?X-Plex-Token=" +
                this.plexToken;
              await core.CacheImage(url, fileName);
              medCard.posterArtURL = "/imagecache/" + fileName;
            } else if (md.art !== undefined && hasArt == "true") {
              fileName = guid + result[3] + "-art.jpg";
              prefix = "http://";
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

            medCard.posterAR = 1;

            medCard.resCodec = md.Media[0].bitrate + " Kbps"
            medCard.audioCodec = md.Media[0].audioCodec;
            medCard.runTime = Math.round(md.Media[0].duration / 60000);
            medCard.cardType = cType.CardTypeEnum.NowScreening;
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
            medCard.posterDownloadURL = url;
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
            medCard.posterDownloadURL = movieUrl;
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
            if (playGenenericThemes == "true" && !(await util.isEmpty(md.theme))) {
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
        medCard.tags = extractPlexTags(md);
        medCard.summary = md.summary;
        medCard.cast = util.formatCastFromPlexRole(md.Role);
        medCard.directors = util.formatDirectorsFromPlexDirector(md.Director);
        {
          const cp = String(medCard.cast || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          medCard.actor1 = cp[0] || "";
          medCard.actor2 = cp[1] || "";
        }
        if (md.type === "track") {
          medCard.albumArtist = (md.grandparentTitle || "").trim();
        }
        await this.populatePlexPersonPosters(medCard, md);
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
          if (md.ratingKey != null && md.ratingKey !== undefined) {
            medCard.posterApiItemId = String(md.ratingKey);
          }
          // Sanitise inputs and apply filter checks
          let okToAdd = false;
          let devices = filterDevices !== undefined ? filterDevices : "";
          devices = devices.toLowerCase().replace(", ",",").replace(" ,",",").replace(/,+$/, "").split(",");
          let users = filterUsers !== undefined ? filterUsers : "";
          users = users.toLowerCase().replace(", ",",").replace(" ,",",").replace(/,+$/, "").split(",");
          // apply filter checks
          if(filterRemote=='true' && medCard.playerLocal == false) okToAdd = true;
          if(filterLocal=='true' && medCard.playerLocal == true) okToAdd = true;
          if(users.length > 0 && md.User.title !== undefined && users.includes(md.User.title.toLowerCase())==false && users[0] !== "") okToAdd = false;
          if(devices.length > 0 && !util.isEmpty(medCard.playerDevice) && devices.includes(medCard.playerDevice.toLowerCase())==false && devices[0] !== "") okToAdd = false;
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
    contentRatings,
    opts
  ) {
    const posterSyncFull = opts && opts.posterSyncFullLibrary === true;
    const sp = opts && opts.syncProgress;
    const imagePull = (opts && opts.imagePull) || {};
    if (posterSyncFull && sp) {
      sp.phase = "fetching";
      sp.label = "Fetching library from media server…";
      sp.processed = 0;
      sp.total = 0;
    }
    // Full poster sync: cache all image extras (fanart, cast, album artist, etc.); skip theme MP3s to limit I/O.
    const effPlayThemes = posterSyncFull ? "false" : playThemes;
    const effPlayGenenericThemes = posterSyncFull ? "false" : playGenenericThemes;
    const effHasArt = posterSyncFull ? "true" : hasArt;
    const metadataOnlySync = posterSyncFull && opts && opts.metadataOnlySync === true;
    const pullBackground = effHasArt == "true" && imagePull.background !== false;
    const pullLogo = effHasArt == "true" && imagePull.logo !== false;
    const pullVideoPoster = imagePull.videoPoster !== false;
    const pullAlbumPoster = imagePull.albumPoster !== false;

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
      if (posterSyncFull) {
        if (sp) {
          const now = new Date();
          console.log(
            now.toLocaleString() +
              " [poster sync] Plex — fetching full library list…"
          );
        }
        odRaw = await this.GetOnDemandRawData(
          onDemandLibraries,
          numberOnDemand,
          genres,
          0,
          contentRatings,
          true,
          sp
        );
      } else if (recentlyAdded > 0) {
        odRaw = await this.GetOnDemandRawData(
          onDemandLibraries,
          numberOnDemand,
          genres,
          recentlyAdded,
          contentRatings,
          false
        );
        if (odRaw !== undefined) {
          odRaw = odRaw.concat(
            await this.GetOnDemandRawData(
              onDemandLibraries,
              numberOnDemand,
              genres,
              0,
              contentRatings,
              false
            )
          );
        } else {
          odRaw = await this.GetOnDemandRawData(
            onDemandLibraries,
            numberOnDemand,
            genres,
            0,
            contentRatings,
            false
          );
        }
      } else {
        odRaw = await this.GetOnDemandRawData(
          onDemandLibraries,
          numberOnDemand,
          genres,
          0,
          contentRatings,
          false
        );
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

    if (posterSyncFull && sp && (!odRaw || odRaw.length === 0)) {
      sp.total = 0;
      sp.processed = 0;
      sp.phase = "complete";
      sp.label = "No titles to sync";
      if (sp.libraries) {
        for (const row of sp.libraries) {
          row.cacheTotal = 0;
          row.itemsCached = 0;
          row.cacheStatus =
            row.fetchStatus === "skipped" ? "skipped" : "done";
        }
      }
    }

    if (
      posterSyncFull &&
      opts &&
      Array.isArray(opts.retryLibraryKeysFromLastSync) &&
      opts.retryLibraryKeysFromLastSync.length &&
      odRaw &&
      odRaw.length > 0
    ) {
      odRaw = posterSyncRetry.prioritizeOdRaw(
        odRaw,
        opts.retryLibraryKeysFromLastSync,
        "plex"
      );
      const nowP = new Date();
      console.log(
        nowP.toLocaleString() +
          " [poster sync] Plex — prioritizing " +
          opts.retryLibraryKeysFromLastSync.length +
          " id(s) from last sync (missing images/metadata)"
      );
    }

    // reutrn an empty array if no results
    if (odRaw.length !== null && odRaw.length !== 0 && odRaw !== ",") {
      if (posterSyncFull && sp) {
        sp.total = odRaw.length;
        sp.phase = "caching";
        sp.label = "Caching posters and images…";
        const counts = posterSyncLib.countItemsByLibraryFields(odRaw, [
          "_plexLibraryTitle",
        ]);
        for (const row of sp.libraries || []) {
          row.cacheTotal = counts[row.name] || 0;
          row.itemsCached = 0;
          if (row.fetchStatus === "skipped") {
            row.cacheStatus = "skipped";
          } else {
            row.cacheStatus = row.cacheTotal > 0 ? "pending" : "done";
          }
        }
        const now = new Date();
        console.log(
          now.toLocaleString() +
            " [poster sync] Plex — " +
            odRaw.length +
            " item(s) to download (" +
            onDemandLibraries +
            ")"
        );
      }
      const odBatches = posterSyncFull
        ? Array.from(
            { length: Math.ceil(odRaw.length / POSTER_SYNC_BATCH_SIZE) },
            (_, i) =>
              odRaw.slice(
                i * POSTER_SYNC_BATCH_SIZE,
                (i + 1) * POSTER_SYNC_BATCH_SIZE
              )
          )
        : [odRaw];
      const totalBatches = odBatches.length;
      const retrySet =
        posterSyncFull &&
        opts &&
        Array.isArray(opts.retryLibraryKeysFromLastSync)
          ? new Set(opts.retryLibraryKeysFromLastSync.map((k) => String(k)))
          : null;
      // move through results and populate media cards
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batch = odBatches[batchIdx];
        if (posterSyncFull && sp) {
          sp.label =
            "Caching posters and images… batch " +
            (batchIdx + 1) +
            "/" +
            totalBatches;
          console.log(
            new Date().toLocaleString() +
              " [poster sync] Plex — processing batch " +
              (batchIdx + 1) +
              "/" +
              totalBatches +
              " (" +
              batch.length +
              " items)"
          );
        }
        try {
        checkPosterSyncAborted(opts, posterSyncFull, sp);
        await batch.reduce(async (memo, md) => {
          await memo;
        if (posterSyncFull) {
          const rawApiId = String((md && md.ratingKey) || "").trim();
          const sourceUpdatedAt =
            (md && md.updatedAt) ||
            (md && md.updated_at) ||
            (md && md.addedAt) ||
            "";
          const mustRetry = !!(retrySet && rawApiId && retrySet.has(rawApiId));
          if (
            rawApiId &&
            !mustRetry &&
            posterMetadataDb.shouldSkipSyncItem("plex", rawApiId, sourceUpdatedAt)
          ) {
            if (sp) {
              sp.processed = Math.min(sp.total || 0, (sp.processed || 0) + 1);
            }
            return;
          }
        }
        const medCard = new mediaCard();
        // modify inputs, based upon tv episode or movie result structure
        switch (md.type) {
          case "show":
            medCard.tagLine = await util.emptyIfNull(md.tagline);
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
            if (effPlayThemes == "true" &&  !(await util.isEmpty(md.theme))) {
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

            if (pullVideoPoster && md.thumb) {
              medCard.posterDownloadURL = url;
              await core.CacheImage(url, fileName);
              medCard.posterURL = "/imagecache/" + fileName;
            } else if (metadataOnlySync && md.thumb) {
              medCard.posterDownloadURL = url;
              medCard.posterURL = "/imagecache/" + fileName;
            } else {
              medCard.posterURL = "/images/no-poster-available.png";
            }

            //download poster art + optional Plex banner (wide)
            let showHasBackdrop = false;
            if (md.art !== undefined && pullBackground) {
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
              showHasBackdrop = true;
            }
            let showServerBannerOk = false;
            if (pullBackground && md.banner) {
              fileName = mediaId + "-banner.jpg";
              if (this.https) prefix = "https://";
              url =
                prefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.banner +
                "?X-Plex-Token=" +
                this.plexToken;
              try {
                await core.CacheImage(url, fileName);
                showServerBannerOk = true;
                if (!showHasBackdrop) {
                  medCard.posterArtURL = "/imagecache/" + fileName;
                }
              } catch (e) {
                /* optional */
              }
            }
            await tmdbBackdropFallback.cacheTmdbBannerIfNeeded({
              tmdbApiKey: opts && opts.tmdbApiKey,
              pullBackground,
              serverBannerOk: showServerBannerOk,
              mediaType: "show",
              title: md.title || md.grandparentTitle,
              year: md.year,
              ...tmdbBackdropFallback.collectPlexExternalIds(md),
              bannerFileName: mediaId + "-banner.jpg",
              medCard,
              cacheImage: (u, f) => core.CacheImage(u, f),
            });
            if (pullLogo) {
              await plexCacheClearLogo(core, this, md, mediaId, medCard);
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
            if (pullVideoPoster && md.thumb) {
              medCard.posterDownloadURL = movieUrl;
              await core.CacheImage(movieUrl, movieFileName);
              medCard.posterURL = "/imagecache/" + movieFileName;
            } else if (metadataOnlySync && md.thumb) {
              medCard.posterDownloadURL = movieUrl;
              medCard.posterURL = "/imagecache/" + movieFileName;
            } else {
              medCard.posterURL = "/images/no-poster-available.png";
            }

            //download poster art + optional Plex banner (wide)
            let movieHasBackdrop = false;
            if (md.art !== undefined && pullBackground) {
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
              movieHasBackdrop = true;
            }
            let movieServerBannerOk = false;
            if (pullBackground && md.banner) {
              movieFileName = md.ratingKey + "-banner.jpg";
              if (this.https) moviePlexPrefix = "https://";
              movieUrl =
                moviePlexPrefix +
                this.plexIP +
                ":" +
                this.plexPort +
                md.banner +
                "?X-Plex-Token=" +
                this.plexToken;
              try {
                await core.CacheImage(movieUrl, movieFileName);
                movieServerBannerOk = true;
                if (!movieHasBackdrop) {
                  medCard.posterArtURL = "/imagecache/" + movieFileName;
                }
              } catch (e) {
                /* optional */
              }
            }
            await tmdbBackdropFallback.cacheTmdbBannerIfNeeded({
              tmdbApiKey: opts && opts.tmdbApiKey,
              pullBackground,
              serverBannerOk: movieServerBannerOk,
              mediaType: "movie",
              title: md.title,
              year: md.year,
              ...tmdbBackdropFallback.collectPlexExternalIds(md),
              bannerFileName: md.ratingKey + "-banner.jpg",
              medCard,
              cacheImage: (u, f) => core.CacheImage(u, f),
            });
            if (pullLogo) {
              await plexCacheClearLogo(core, this, md, String(md.ratingKey), medCard);
            }

            // play movie theme or add generic random theme if applicable
            let themeFile;
            if (effPlayGenenericThemes == "true") {
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
          case "album":
            {
              let albPoster = md.ratingKey + ".jpg";
              let albPre = "http://";
              if (this.https) albPre = "https://";
              let albImgUrl =
                albPre +
                this.plexIP +
                ":" +
                this.plexPort +
                md.thumb +
                "?X-Plex-Token=" +
                this.plexToken;
              if (pullAlbumPoster && md.thumb) {
                medCard.posterDownloadURL = albImgUrl;
                await core.CacheImage(albImgUrl, albPoster);
                medCard.posterURL = "/imagecache/" + albPoster;
              } else if (metadataOnlySync && md.thumb) {
                medCard.posterDownloadURL = albImgUrl;
                medCard.posterURL = "/imagecache/" + albPoster;
              } else {
                medCard.posterURL = "/images/no-poster-available.png";
              }
              let albHasBackdrop = false;
              if (md.art !== undefined && pullBackground) {
                let albArtFile = md.ratingKey + "-art.jpg";
                let albArtUrl =
                  albPre +
                  this.plexIP +
                  ":" +
                  this.plexPort +
                  md.art +
                  "?X-Plex-Token=" +
                  this.plexToken;
                await core.CacheImage(albArtUrl, albArtFile);
                medCard.posterArtURL = "/imagecache/" + albArtFile;
                albHasBackdrop = true;
              } else if (md.grandparentArt !== undefined && pullBackground) {
                let albArtFile = md.ratingKey + "-art.jpg";
                let albArtUrl =
                  albPre +
                  this.plexIP +
                  ":" +
                  this.plexPort +
                  md.grandparentArt +
                  "?X-Plex-Token=" +
                  this.plexToken;
                await core.CacheImage(albArtUrl, albArtFile);
                medCard.posterArtURL = "/imagecache/" + albArtFile;
                albHasBackdrop = true;
              }
              if (pullBackground && md.banner) {
                let albBnFile = md.ratingKey + "-banner.jpg";
                let albBnUrl =
                  albPre +
                  this.plexIP +
                  ":" +
                  this.plexPort +
                  md.banner +
                  "?X-Plex-Token=" +
                  this.plexToken;
                try {
                  await core.CacheImage(albBnUrl, albBnFile);
                  if (!albHasBackdrop) {
                    medCard.posterArtURL = "/imagecache/" + albBnFile;
                  }
                } catch (e) {
                  /* optional */
                }
              }
              if (pullLogo) {
                await plexCacheClearLogo(
                  core,
                  this,
                  md,
                  String(md.ratingKey != null ? md.ratingKey : ""),
                  medCard
                );
              }
              medCard.posterAR = 1;
              medCard.title = md.title || "";
              medCard.DBID = String(md.ratingKey != null ? md.ratingKey : "");
              const albArtist =
                md.parentTitle || md.grandparentTitle || "";
              medCard.albumArtist = albArtist;
              medCard.tagLine = albArtist
                ? albArtist + " — " + medCard.title
                : medCard.title;
              medCard.runTime = md.duration
                ? Math.round(md.duration / 60000)
                : 0;
              if (await util.isEmpty(md.audienceRating)) {
                medCard.rating = "";
              } else {
                medCard.rating = Math.round(md.audienceRating * 10) + "%";
              }
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
        medCard.tags = extractPlexTags(md);
        medCard.summary = md.summary;
        medCard.cast = util.formatCastFromPlexRole(md.Role);
        medCard.directors = util.formatDirectorsFromPlexDirector(md.Director);
        {
          const cp = String(medCard.cast || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          medCard.actor1 = cp[0] || "";
          medCard.actor2 = cp[1] || "";
        }
        await this.populatePlexPersonPosters(medCard, md, imagePull);

        // calculate for recently added (if set)
        var includeTitle = false;
        medCard.cardType = md.ctype;
        if (md.ratingKey != null && md.ratingKey !== undefined) {
          medCard.posterApiItemId = String(md.ratingKey);
        }
        medCard.posterLibraryLabel = String(md._plexLibraryTitle || "").trim();
        // add media card to array
        odCards.push(medCard);
        if (sp) {
          sp.processed = Math.min(sp.total || 0, (sp.processed || 0) + 1);
        }
        if (posterSyncFull && sp && sp.libraries) {
          const lr = posterSyncLib.findLibraryRow(
            sp.libraries,
            medCard.posterLibraryLabel
          );
          if (lr && lr.cacheStatus !== "skipped") {
            lr.cacheStatus = "running";
            lr.itemsCached = (lr.itemsCached || 0) + 1;
            if (lr.cacheTotal > 0 && lr.itemsCached >= lr.cacheTotal) {
              lr.cacheStatus = "done";
            }
          }
        }
        if (posterSyncFull && sp) {
          const n = odCards.length;
          const total = sp.total || odRaw.length;
          const step = Math.max(25, Math.min(500, Math.floor(total / 15) || 1));
          if (n === 1 || n >= total || n % step === 0) {
            const t = medCard.mediaType || md.type || "?";
            const title = String(medCard.title || md.title || "").slice(0, 72);
            console.log(
              new Date().toLocaleString() +
                " [poster sync] " +
                n +
                "/" +
                total +
                " " +
                t +
                ' — "' +
                title +
                '"'
            );
          }
        }

        checkPosterSyncAborted(opts, posterSyncFull, sp);

        }, undefined);
        } catch (e) {
          if (e instanceof PosterSyncAbortedError) {
            break;
          }
          throw e;
        }
      }
    }
    let now = new Date();
    if (odCards.length == 0) {
      console.log(now.toLocaleString() + " No On-demand titles available");
    } else if (posterSyncFull) {
      console.log(
        now.toLocaleString() +
          " [poster sync] Plex — finished caching " +
          odCards.length +
          " item(s) from (" +
          onDemandLibraries +
          ")" +
          (opts &&
          typeof opts.posterSyncAbortCheck === "function" &&
          opts.posterSyncAbortCheck()
            ? " (aborted)"
            : "")
      );
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
    const pageSize = 200;
    let baseQuery = "/library/sections/" + libKey + "/all";
    if (recentlyAdded > 0) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - recentlyAdded);
      fromDate.setHours(0, 0, 0, 0);
      const fromEpochDate = fromDate.getTime() / 1000;
      baseQuery =
        "/library/sections/" +
        libKey +
        "/all?sort=addedAt&addedAt>>=" +
        fromEpochDate;
    }

    let allMetadata = [];
    let start = 0;
    try {
      while (true) {
        const join = baseQuery.includes("?") ? "&" : "?";
        const odQuery = `${baseQuery}${join}X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`;
        const result = await this.client.query(odQuery);
        const mc = result.MediaContainer;
        const batch = mc.Metadata || [];
        const totalSize =
          mc.totalSize != null
            ? mc.totalSize
            : mc.size != null
              ? mc.size
              : start + batch.length;
        if (batch.length === 0) break;
        allMetadata = allMetadata.concat(batch);
        start += batch.length;
        if (start >= totalSize || batch.length < pageSize) break;
      }
    } catch (err) {
      const now = new Date();
      console.log(now.toLocaleString() + " *On-demand - Get titles: " + err);
      throw err;
    }

    const mediaCards = [];
    if (allMetadata.length === 0) return mediaCards;

    let mediaResults = allMetadata;
    if (recentlyAdded == 0) {
      const mapGenre = (arr, gs) => {
        return gs.reduce((acc, val) => {
          const libMatches = arr.filter(
            (m) =>
              m.Genre !== undefined &&
              JSON.stringify(m.Genre).toLowerCase().includes(val.toLowerCase())
          );
          if (libMatches.length > 0) return acc.concat(libMatches);
          return acc;
        }, []);
      };

      const mapContentRating = (arr, gs) => {
        return gs.reduce((acc, val) => {
          const libMatches = arr.filter(
            (m) =>
              m.contentRating !== undefined &&
              m.contentRating.toLowerCase() === val.toLowerCase()
          );
          if (libMatches.length > 0) return acc.concat(libMatches);
          return acc;
        }, []);
      };

      if (genres !== undefined && genres.length > 0) {
        mediaResults = mapGenre(allMetadata, genres);
      }

      if (contentRatings !== undefined && contentRatings.length > 0) {
        const excludeArray = mapContentRating(mediaResults, contentRatings);
        const itemsToDeleteSet = new Set(excludeArray);
        mediaResults = mediaResults.filter((c) => !itemsToDeleteSet.has(c));
      }
    }

    mediaResults.forEach((mt) => {
      mediaCards.push(mt);
    });
    return mediaCards;
  }

  /**
   * @desc Gets the specified, random, number of titles from a specified set of libraries
   * @param {string} onDemandLibraries - a comma seperated lists of the libraries to pull on-demand titles from
   * @param {number} numberOnDemand - the number of results to return from each library
   * @returns {object} mediaCard[] - Returns an array of on-demand mediaCards
   */
  /**
   * @returns {Promise<{ key: string|number, title: string }[]>}
   */
  async getLibraryDescriptorsForOnDemand(onDemandLibraries) {
    if (!onDemandLibraries || onDemandLibraries.length == 0) {
      onDemandLibraries = " ";
    }
    const wanted = onDemandLibraries
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    const out = [];
    const result = await this.client.query("/library/sections/");
    const dirs = (result.MediaContainer && result.MediaContainer.Directory) || [];
    for (const want of wanted) {
      let found = false;
      for (const lib of dirs) {
        if ((lib.title || "").toLowerCase() === want) {
          out.push({ key: lib.key, title: String(lib.title || want) });
          found = true;
          break;
        }
      }
      if (!found) {
        const d = new Date();
        console.log(
          d.toLocaleString() +
            " ✘✘ WARNING ✘✘ - On-demand library '" +
            want +
            "' not found"
        );
      }
    }
    return out;
  }

  async GetOnDemandRawData(
    onDemandLibraries,
    numberOnDemand,
    genres,
    recentlyAdded,
    contentRating,
    fullLibraryForPosterSync,
    syncProgress
  ) {
    const odSet = [];
    try {
      const descriptors = await this.getLibraryDescriptorsForOnDemand(
        onDemandLibraries
      );
      if (syncProgress) {
        syncProgress.libraries = posterSyncLib.buildLibraryProgressRows(
          onDemandLibraries,
          descriptors,
          (e) => e.title,
          (e) => e.title
        );
      }
      for (const { key: value, title: libTitle } of descriptors) {
        const row =
          syncProgress &&
          syncProgress.libraries &&
          posterSyncLib.findLibraryRow(syncProgress.libraries, libTitle);
        if (row && row.fetchStatus !== "skipped") {
          row.fetchStatus = "loading";
        }
        const result = await this.GetAllMediaForLibrary(
          value,
          genres,
          recentlyAdded,
          contentRating
        );
        if (row && row.fetchStatus !== "skipped") {
          row.fetchStatus = "done";
          row.itemsFound = result.length;
        }
        const od = await util.build_random_od_set(
          numberOnDemand,
          result,
          recentlyAdded,
          fullLibraryForPosterSync ? { includeAll: true } : undefined
        );
        for (const odc of od) {
          if (recentlyAdded > 0) {
            odc.ctype = CardTypeEnum.RecentlyAdded;
          } else {
            odc.ctype = CardTypeEnum.OnDemand;
          }
          odc._plexLibraryTitle = libTitle;
          odSet.push(odc);
        }
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

  _plexThumbToUrl(relPath) {
    if (!relPath || typeof relPath !== "string") return "";
    const prefix =
      this.https === true || this.https === "true" ? "https://" : "http://";
    return (
      prefix +
      this.plexIP +
      ":" +
      this.plexPort +
      relPath +
      "?X-Plex-Token=" +
      this.plexToken
    );
  }

  async _cachePlexThumb(relPath, cacheFileName) {
    if (!relPath || !cacheFileName) return "";
    try {
      await core.CacheImage(this._plexThumbToUrl(relPath), cacheFileName);
      return "/imagecache/" + cacheFileName;
    } catch (e) {
      return "";
    }
  }

  _plexTaggedList(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  /**
   * Caches Role / Director / Writer / music artist thumbs for display-poster settings.
   */
  async populatePlexPersonPosters(medCard, md, imagePull) {
    const rk = md.ratingKey != null ? String(md.ratingKey) : "x";
    const safeRk = rk.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pull = imagePull || {};
    const pullCast = pull.castPortrait !== false;
    const pullDirector = pull.directorPortrait !== false;
    const pullAuthor = pull.authorPortrait !== false;
    const pullArtist = pull.artistPortrait !== false;

    if (pullCast) {
      const roles = this._plexTaggedList(md.Role);
      let actorDone = false;
      for (const r of roles) {
        const th = r.thumb || r.Thumb;
        if (!th) continue;
        if (!actorDone) {
          medCard.portraitActorURL = await this._cachePlexThumb(
            th,
            `${safeRk}-actor.jpg`
          );
          medCard.featuredActorName = (r.tag || r.Tag || "").toString();
          medCard.featuredActorCredits = this._fallbackPlexCredits(md);
          actorDone = true;
        } else {
          medCard.portraitActressURL = await this._cachePlexThumb(
            th,
            `${safeRk}-actress.jpg`
          );
          medCard.featuredActressName = (r.tag || r.Tag || "").toString();
          medCard.featuredActressCredits = this._fallbackPlexCredits(md);
          break;
        }
      }
    }

    if (pullDirector) {
      for (const d of this._plexTaggedList(md.Director)) {
        const th = d.thumb || d.Thumb;
        if (th) {
          medCard.portraitDirectorURL = await this._cachePlexThumb(
            th,
            `${safeRk}-director.jpg`
          );
          medCard.featuredDirectorName = (d.tag || d.Tag || "").toString();
          medCard.featuredDirectorCredits = this._fallbackPlexCredits(md);
          break;
        }
      }
    }

    if (pullAuthor) {
      for (const w of this._plexTaggedList(md.Writer)) {
        const th = w.thumb || w.Thumb;
        if (th) {
          medCard.portraitAuthorURL = await this._cachePlexThumb(
            th,
            `${safeRk}-author.jpg`
          );
          medCard.featuredAuthorName = (w.tag || w.Tag || "").toString();
          medCard.featuredAuthorCredits = this._fallbackPlexAuthorCredits(md);
          break;
        }
      }
    }

    if (pullArtist && md.type === "track" && md.grandparentThumb) {
      medCard.portraitArtistURL = await this._cachePlexThumb(
        md.grandparentThumb,
        `${safeRk}-artist.jpg`
      );
      medCard.featuredArtistName = (md.grandparentTitle || "").toString();
      medCard.featuredArtistCredits = this._fallbackPlexArtistCredits(md);
    } else if (pullArtist && md.type === "album") {
      const ath =
        md.parentThumb && md.parentThumb !== md.thumb
          ? md.parentThumb
          : md.grandparentThumb;
      if (ath) {
        medCard.portraitArtistURL = await this._cachePlexThumb(
          ath,
          `${safeRk}-artist.jpg`
        );
        medCard.featuredArtistName = (
          md.parentTitle || md.grandparentTitle || ""
        ).toString();
        medCard.featuredArtistCredits = this._fallbackPlexArtistCredits(md);
      }
    }
  }

  _fallbackPlexCredits(md) {
    const items = [];
    if (md && md.grandparentTitle) items.push(String(md.grandparentTitle));
    if (md && md.parentTitle) items.push(String(md.parentTitle));
    if (md && md.title) items.push(String(md.title));
    return Array.from(new Set(items)).slice(0, 5);
  }

  _fallbackPlexAuthorCredits(md) {
    return this._fallbackPlexCredits(md);
  }

  _fallbackPlexArtistCredits(md) {
    const items = [];
    if (md && md.parentTitle) items.push(String(md.parentTitle));
    if (md && md.title) items.push(String(md.title));
    if (md && md.grandparentTitle && items.length === 0) {
      items.push(String(md.grandparentTitle));
    }
    return Array.from(new Set(items)).slice(0, 5);
  }

  /**
   * True if a cached poster row's Plex library item no longer exists.
   * @param {{ apiItemId?: string, sourceUrl?: string }} entry
   */
  async posterMetadataEntryGone(entry) {
    const axios = require("axios");
    const { probeImageUrlGone } = require("../core/posterMetadataProbe");
    const apiId = String(entry.apiItemId || "").trim();
    if (apiId) {
      const prefix =
        this.https === true || this.https === "true" ? "https" : "http";
      const url =
        `${prefix}://${this.plexIP}:${this.plexPort}/library/metadata/${encodeURIComponent(apiId)}?X-Plex-Token=${encodeURIComponent(this.plexToken)}`;
      try {
        const res = await axios.get(url, {
          headers: { Accept: "application/json" },
          timeout: 12000,
          validateStatus: () => true,
        });
        if (res.status === 404 || res.status === 410) return true;
        const mc = res.data && res.data.MediaContainer;
        const sz = mc && mc.size != null ? Number(mc.size) : null;
        if (sz === 0) return true;
        if (mc && Array.isArray(mc.Metadata) && mc.Metadata.length === 0) {
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    }
    return probeImageUrlGone(entry.sourceUrl);
  }
}

module.exports = Plex;
