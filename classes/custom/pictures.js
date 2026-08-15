const mediaCard = require("../cards/MediaCard");
const cType = require("../cards/CardType");
const path = require('path');
const fs = require('fs');
const util = require('util');
const fsPromises = fs.promises;

/**
 * @desc Used to get a list of custom pictures
 */
class Pictures {
  constructor() { }

  async GetFiles(directoryPath) {
    let pictures = [];

    //passsing directoryPath and callback function
    return await fsPromises.readdir('public/custom/pictures/' + directoryPath).then(
      function (result) {
        // get suitable posters
        let posters = [];
        let remainder = [];
        result.forEach(function (file) {
          // Do whatever you want to do with the file
          if ((!file.toLowerCase().includes('-art') && !file.toLocaleLowerCase().includes('.mp3')) && (file.toLocaleLowerCase().includes('.jpg') || file.toLocaleLowerCase().includes('.png') || file.toLocaleLowerCase().includes('.gif')) ) {
            posters.push(file);
          }
          else {
            remainder.push(file);
          }
        });

        // now seperate art from mp3
        let art = [];
        let mp3 = [];
        remainder.forEach(function (file) {
          // Do whatever you want to do with the file
          if (file.toLowerCase().includes('-art')) {
            art.push(file);
          }
          else {
            mp3.push(file);
          }
        });

        // now assemble to file objects
        posters.forEach(function (file) {
          let firstPart = file.split('.')[0].toLowerCase();
          let fn = file;
          let artFn = "";
          let mp3Fn = "";
          let fileFn = '/custom/pictures/' + directoryPath + '/' + file;
          artFn = art.find(rem => rem.toLocaleLowerCase().includes(firstPart));
          if (artFn == undefined) {
            artFn = '';
          }
          else {
            artFn = '/custom/pictures/' + directoryPath + '/' + artFn;
          }

          mp3Fn = mp3.find(rem => rem.toLocaleLowerCase().includes(firstPart));
          if (mp3Fn == undefined) {
            mp3Fn = '';
          }
          else {
            mp3Fn = '/custom/pictures/' + directoryPath + '/' + mp3Fn;
          }

          let pic = {
            "url": fileFn,
            "theme": mp3Fn,
            "art": artFn
          }
          pictures.push(pic);
        });
        // shuffle pictures array
        //pictures = pictures.sort((a, b) => 0.5 - Math.random());
        // pictures.forEach(p => {
        //   console.log(p.url);
          
        // });
        
        return pictures;

      });
  }
    

/**
 * @desc Custom picture slide array
 */
async GetPictures(theme, hasThemes, hasArt) {
  const pics = await this.GetFiles(theme);

  let picCards = [];
  // Example format needed for pictures object
  // let pics = [
  //   {url: '/custom/posterr1.jpg', theme: '/custom/posterr1.mp3', art: '/custom/posterr1-art.jpg'},
  //   {url: '/custom/posterr2.jpg', theme: '/custom/posterr2.mp3', art: '/custom/posterr2-art.jpg'},
  //   {url: '/custom/texas.gif', theme: '/custom/texas.mp3', art: '/custom/texas.jpg'},
  //   {url: '/custom/300.gif', theme: '', art: ''},
  //   {url: '/custom/thebirds.gif', theme: '/custom/thebirds.mp3', art: ''},
  //   {url: '/custom/matrix.png', theme: '/custom/matrix.mp3', art: '/custom/matrix.gif'}
  // ];

  // reutrn an empty array if no results
  if (pics !== undefined && pics.length !== 0) {
    // move through results and populate media cards
    await pics.reduce(async (memo, md) => {
      await memo;
      const medCard = new mediaCard();
      medCard.releaseDate = "";
      medCard.tagLine = "";
      medCard.title = "";
      medCard.DBID = "";
      medCard.runTime = "";
      medCard.genre = "";
      medCard.summary = "";
      medCard.mediaType = "picture";
      medCard.cardType = cType.CardTypeEnum.Picture;
      medCard.studio = "";
      if (hasThemes == "true") {
        medCard.theme = md.theme;
      }
      else {
        medCard.theme = "";
      }
      medCard.posterURL = md.url;
      if (hasArt == "true") {
        medCard.posterArtURL = md.art;
      }
      else {
        medCard.posterArtURL = "";
      }
      medCard.posterAR = 1.47;
      medCard.contentRating = "";
      medCard.ratingColour = "";

      // add picture card to array
      picCards.push(medCard);
    }, undefined);
  }
  let now = new Date();
  if (picCards.length == 0) {
    console.log(
      now.toLocaleString() + " No custom pictures found");
  } else {
    console.log(
      now.toLocaleString() + " Custom pictures added");
  }

  return picCards;
}
}

module.exports = Pictures;
