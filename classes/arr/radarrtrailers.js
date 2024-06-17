const mediaCard = require("../cards/MediaCard");
const cType = require("../cards/CardType");
const util = require("../core/utility");
const core = require("../core/cache");
const axios = require("axios");

/**
 * @desc Used to communicate with Radarr to obtain a list of future releases
 * @param radarrCards
 * @param radarrToken
 */
class RadarrTrailers {
    constructor() {
    }

    async GetYoutubeTrailerID(tmdbId,tmdbApiKey, title){
        let response;
        try {
          response = await axios
            .get(
              "https://api.themoviedb.org/3/movie/" +
              tmdbId +
              "/videos?api_key=" +
              tmdbApiKey
            )
            .catch((err) => {
              throw err;
            });
        } catch (err) {
          let d = new Date();

          if(err.message == 'Request failed with status code 404'){
            console.log('Trailer not found: ' + title);
            return 0;
          } else {
            //console.log(d.toLocaleString() + " *Radarr - Get trailer data:", err.message);
            throw err;
          }
        }
        //console.log("<iframe width='979' height='551' src='https://www.youtube.com/embed/" + 
        //response.data.results[0].key + 
        //"?autoplay=1' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share' allowfullscreen autoplay></iframe>");
        if(response.data.results[0] != undefined){
          return response.data.results[0].key;
        }
        else{
          return;
        }
    }

    async AssembleRadarrTrailers(radarrCards,tmdbApiKey){
      let rtCards = [];
      await radarrCards.reduce(async (memo, md) => {
          await memo;
          const medCard = new mediaCard();
          medCard.title = md.title;
          medCard.DBID = md.DBID;
          medCard.youtubeKey = await this.GetYoutubeTrailerID(md.DBID, tmdbApiKey, md.title);
          medCard.posterAR = 1.47;
          // add media card to array, only if not released yet (caters to old movies being released digitally)
          if (medCard.youtubeKey != 0 ){ //} || medCard.youtubeKey != "" || medCard.youtubeKey != 0){
            console.log("Youtube trailer ID for " + medCard.title + ": " + medCard.youtubeKey);
            rtCards.push(medCard);
            }
          }, undefined);
                    
      let now = new Date();
      if (rtCards.length == 0) {
        console.log(
        now.toLocaleString() + " No Coming soon 'movie' trailers found"
        );
      } else {
        console.log(
        now.toLocaleString() + " Coming soon 'movie' trailers refreshed"
        );
      }
            
      return rtCards;
    }
}

module.exports = RadarrTrailers;