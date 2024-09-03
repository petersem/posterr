const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const core = require("./../core/cache");
const axios = require("axios");
const { cache } = require("ejs");
const sizeOf = require('image-size');

/**
 * @desc Used to communicate with Radarr to obtain a list of future releases
 * @param radarrUrl
 * @param radarrToken
 */
class Radarr {
  constructor(radarrUrl, radarrToken) {
    this.radarrUrl = radarrUrl;
    this.radarrToken = radarrToken;
  }

  /**
   * @desc Gets the movie titles that fall within the range specified
   * @param {string} startDate - in yyyy-mm-dd format - Generally todays date
   * @param {string} endDate - in yyyy-mm-dd format - future date
   * @returns {Promise<object>} json results - results of search
   */
  async GetComingSoonRawData(startDate, endDate) {
    let response;
    try {
      //console.log(this.radarrUrl + "/api/v3/calendar?unmonitored=false&apikey=" + this.radarrToken + "&start=" + startDate + "&end=" + endDate);
      response = await axios
        .get(
          this.radarrUrl +
            "/api/v3/calendar?unmonitored=false&apikey=" +
            this.radarrToken +
            "&start=" +
            startDate +
            "&end=" +
            endDate
        )
        .catch((err) => {
          throw err;
        });
    } catch (err) {
      let d = new Date();
      console.log(d.toLocaleString() + " *Radarr - Get calendar data:", err.message);
      throw err;
    }
    return response;
  }


  /**
   * @desc Get Movie coming soon data and formats into mediaCard array
   * @param {string} startDate - in yyyy-mm-dd format - Generally todays date
   * @param {string} endDate - in yyyy-mm-dd format - future date
   * @returns {Promise<object>} mediaCards array - results of search
   */
  async GetComingSoon(startDate, endDate, playGenenericThemes, hasArt) {
    let csrCards = [];
    let raw;
    // get raw data first
    try{
      raw = await this.GetComingSoonRawData(startDate, endDate);
    }
    catch(err){
      let d = new Date();
      console.log(d.toLocaleString() + " *Radarr - Get Raw Data: " + err);
      throw err;
    }

    // reutrn an empty array if no results
    if (raw != null) {
      // move through results and populate media cards
      await raw.data.reduce(async (memo, md) => {
        let noReleaseDate = false;
        await memo;
        const medCard = new mediaCard();
        let releaseDate;
        if(!await util.isEmpty(md.digitalRelease)){
          let digitalRelease = new Date(md.digitalRelease);
          releaseDate = digitalRelease.toISOString().split("T")[0];
          noReleaseDate = true;
        }
        else {
          releaseDate = "No digital release date";
          noReleaseDate = false;
        }
        medCard.tagLine =
          md.title + " (" + releaseDate + ")";
        medCard.title = md.title;
        medCard.DBID = md.tmdbId;
        medCard.runTime = md.runtime;
        medCard.genre = md.genres;
        medCard.summary = await util.emptyIfNull(md.overview);
        medCard.mediaType = "movie";
        medCard.cardType = cType.CardTypeEnum.ComingSoon;
        medCard.studio = md.studio;

        medCard.theme = "";

      // cache image
      let fileName;
      let url;
      // cache poster
      fileName = md.tmdbId + ".jpg";
      // check art exists
      md.images.forEach(i => {
        if(i.coverType == "poster"){
          url = i.remoteUrl;
        }
      });

      if (url !== undefined) {
        await core.CacheImage(url, fileName);
        medCard.posterURL = "/imagecache/" + fileName;
      } else {
        // if no poster available, use the generic one
        medCard.posterURL = "/images/no-poster-available.png";
      }

      // cache art image
      if(hasArt=='true'){
        fileName = md.tmdbId + "-art.jpg";
        // check art exists
        md.images.forEach(i => {
          if(i.coverType == "fanart"){
            url = i.remoteUrl;
          }
        });
        if (url !== undefined) {
          await core.CacheImage(url, fileName);
          medCard.posterArtURL = "/imagecache/" + fileName;
        }
      }


        medCard.posterAR = 1.47;

        // content rating and colour
        let contentRating = "NR";
        if (!(await util.isEmpty(md.certification))) {
          contentRating = md.certification;
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
        
        // add generic random theme if applicable

        // if (playGenenericThemes == 'true') {
        //   medCard.theme = "/randomthemes/" + (await core.GetRandomMP3(csrCards));
        //   if(medCard.theme.includes("undefined")) medCard.theme="";
        // }

        // add media card to array, only if not released yet (caters to old movies being released digitally)
        if (md.hasFile == false && md.status != "released" && noReleaseDate != false){ //&& !await util.isEmpty(md.digitalRelease) ) {
          csrCards.push(medCard);
        }

      }, undefined);
    }
    let now = new Date();
    if (csrCards.length == 0) {
      console.log(
        now.toLocaleString() + " No Coming soon 'movie' titles found"
      );
    } else {
      console.log(
        now.toLocaleString() + " Coming soon 'movie' titles refreshed"
      );
    }

    return csrCards;
  }
}

module.exports = Radarr;
