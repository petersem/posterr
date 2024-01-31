const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const core = require("./../core/cache");
const axios = require("axios");
const sizeOf = require("image-size");

/**
 * @desc Used to communicate with Sonarr to obtain a list of future releases
 * @param sonarrUrl
 * @param sonarrToken
 */
class Sonarr {
  constructor(sonarrUrl, sonarrToken) {
    this.sonarrUrl = sonarrUrl;
    this.sonarrToken = sonarrToken;
  }

  /**
   * @desc Gets the tv titles that fall within the range specified
   * @param {string} startDate - in yyyy-mm-dd format - Generally todays date
   * @param {string} endDate - in yyyy-mm-dd format - future date
   * @returns {Promise<object>} json results - results of search
   */
  async GetComingSoonRawData(startDate, endDate) {
    let response;

// console.log(          this.sonarrUrl + 
//   "/api/v3/calendar?apikey=" + 
//   this.sonarrToken + 
//   "&start=" + 
//   startDate + 
//   "&end=" + endDate
// );

    // call sonarr API and return results
    try {
      response = await axios
        .get(
          this.sonarrUrl + 
            "/api/v3/calendar?apikey=" + 
            this.sonarrToken + 
            "&start=" + 
            startDate + 
            "&end=" + endDate
        )
        .catch((err) => {
          throw err;
        });
    } catch (err) {
      // displpay error if call failed
      let d = new Date();
      console.log(
        d.toLocaleString() + " *Sonarr - Get calendar data:",
        err.message
      );
      throw err;
    }
    return await response;
  }

  /**
   * @desc Gets the tv titles that fall within the range specified
   * @param {object} calendarEpisode - calendar instance of episode
   * @returns {Promise<object>} json results - results of search
   */
  async GetSeriesRawData(seriesID) {
    let response;

    // call sonarr API and return results
    try {
      response = await axios
        .get(
          this.sonarrUrl +
            "/api/v3/series/" + 
            seriesID + 
            "?apikey=" +
            this.sonarrToken
        )
        .catch((err) => {
          throw err;
        });
    } catch (err) {
      // displpay error if call failed
      let d = new Date();
      console.log(
        d.toLocaleString() + " *Sonarr - Get episode data:",
        err.message
      );
      throw err;
    }
    return await response;
  }

  /**
   * @desc Get TV coming soon data and formats into mediaCard array
   * @param {string} startDate - in yyyy-mm-dd format - Generally todays date
   * @param {string} endDate - in yyyy-mm-dd format - future date
   * @param {string} premieres - boolean (string format) to show only season premieres
   * @returns {Promise<object>} mediaCards array - results of search
   */
  async GetComingSoon(startDate, endDate, premieres, playThemes, hasArt) {
    let csCards = [];
    // get raw data first
    let raw;
    try {
      raw = await this.GetComingSoonRawData(startDate, endDate);
    } catch (err) {
      let d = new Date();
      console.log(d.toLocaleString() + " *Sonarr - Get raw data: " + err);
      throw err;
    }
    // reutrn an empty array if no results
    if (raw != null) {
      // move through results and populate media cards
      await raw.data.reduce(async (memo, md) => {
        await memo;

        // get series raw data
        let rawSeries;
        try {
          rawSeries = await this.GetSeriesRawData(md.seriesId);
        } catch (err) {
          let d = new Date();
          console.log(d.toLocaleString() + " *Sonarr - Get series raw data: " + err);
          throw err;
        }
    

        // populate cards
        const medCard = new mediaCard();

        medCard.tagLine =
          "Season " +
          md.seasonNumber +
          ", Episode " +
          md.episodeNumber +
          " - '" +
          md.title +
          "' (" +
          md.airDate +
          ")";
        medCard.title = md.title;
        medCard.DBID = rawSeries.data.tvdbId;
        medCard.year = md.airDate;
        medCard.runTime = rawSeries.data.runtime;
        medCard.genre = rawSeries.data.genres;
        medCard.summary = await util.emptyIfNull(rawSeries.data.overview);
        medCard.mediaType = "episode";
        medCard.cardType = cType.CardTypeEnum.ComingSoon;
        medCard.network = rawSeries.data.network;

        let fileName;
        // dont bother to download if only looking for premiers
        if (premieres == "true" && md.episodeNumber != 1) {
          // dont get cached files
        } else {
          // only downlad mp3 if playThemes enabled
          if (playThemes == "true") {
            // cache mp3 file
            let mp3 = rawSeries.data.tvdbId + ".mp3";
            await core.CacheMP3(mp3);
            medCard.theme = "/mp3cache/" + mp3;
          }

          let url;
          // cache poster
          fileName = rawSeries.data.tvdbId + ".jpg";
          // check art exists
          rawSeries.data.images.forEach(i => {
            if(i.coverType == "poster"){
              url = i.remoteUrl;
            }
          });
          if (url !== undefined) {
            await core.CacheImage(url, fileName);
            medCard.posterURL = "/imagecache/" + fileName;
          } else {
            medCard.posterURL = "/images/no-poster-available.png";
          }

          // cache art image
          if(hasArt=='true'){
            fileName = rawSeries.data.tvdbId + "-art.jpg";
            // check art exists
            rawSeries.data.images.forEach(i => {
              if(i.coverType == "fanart"){
                url = i.remoteUrl;
              }
            });
            if (url !== undefined) {
              await core.CacheImage(url, fileName);
              medCard.posterArtURL = "/imagecache/" + fileName;
            }
          }
        }

        // content rating and colour
        let contentRating = "NR";
        if (!(await util.isEmpty(rawSeries.data.certification))) {
          contentRating = rawSeries.data.certification;
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

        medCard.posterAR = 1.47;

        // add media card to array (taking into account premieres option)
        if (md.hasFile == false && premieres && md.episodeNumber == 1) {
          csCards.push(medCard);
        } else {
          if (!premieres) {
            csCards.push(medCard);
          }
        }
      }, undefined);
    }
    let now = new Date();
    if (csCards.length == 0) {
      console.log(now.toLocaleString() + " No Coming soon 'tv' titles found");
    } else {
      console.log(now.toLocaleString() + " Coming soon 'tv' titles refreshed");
    }
    return csCards;
  }
}

module.exports = Sonarr;
