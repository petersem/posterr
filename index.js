const express = require("express");
const path = require("path");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { check, validationResult } = require("express-validator");
//const user = require('./routes/user.routes');
const pms = require("./classes/mediaservers/plex");
const vers = require("./classes/core/ver");
const glb = require("./classes/core/globalPage");
const core = require("./classes/core/cache");
const sonr = require("./classes/arr/sonarr");
const radr = require("./classes/arr/radarr");
const readr = require("./classes/arr/readarr");
const trivQ = require("./classes/custom/trivia");
const pics = require("./classes/custom/pictures");
const settings = require("./classes/core/settings");
const MemoryStore = require("memorystore")(session);
const util = require("./classes/core/utility");
const DEFAULT_SETTINGS = require("./consts");
const health = require("./classes/core/health");
const pjson = require("./package.json");
const MAX_OD_SLIDES = 150;  // this is with themes. Will be double this if tv and movie themes are off
const triv = require("./classes/custom/trivia");
const links = require("./classes/custom/links");
const awtrix = require("./classes/custom/awtrix");
const movieTrailers = require("./classes/arr/radarrtrailers");

// just in case someone puts in a / for the basepath value
if (process.env.BASEPATH == "/") process.env.BASEPATH = "";
let BASEURL = process.env.BASEPATH || "";
let PORT = process.env.PORT || 3000;

// parse any input parameters for binaries.
let args = process.argv.slice(2)

// parse port number
if(args.length !== 0){
  try{
    PORT = parseInt(args[0]);
  }
  catch{
    console.log("Cannot set port: " + args[0] + ". Setting default port 3000");
    PORT = 3000
  }
}

// parse base path
if(args.length == 2){
    BASEURL = args[1];
}

console.log("-------------------------------------------------------");
console.log(" POSTERR - Your media display");
console.log(" Developed by Matt Petersen - Brisbane Australia");
console.log(" ");
console.log(" Version: " + pjson.version);
console.log("-------------------------------------------------------");

// global variables
let odCards = [];
let nsCards = [];
let csCards = [];
let csrCards = [];
let rtCards = [];
let picCards = [];
let csbCards = [];
let trivCards = [];
let linkCards = [];
let globalPage = new glb();
let nowScreeningClock;
let onDemandClock;
let triviaClock;
let sonarrClock;
let radarrClock;
let readarrClock;
let houseKeepingClock;
let picturesClock;
let linksClock;
let setng = new settings();
let loadedSettings;
//let endPoint = "https://logz-dev.nesretep.net/pstr";
let endPoint = "https://logz.nesretep.net/pstr";
let nsCheckSeconds = 10000; // how often now screening checks are performed. (not available in setup screen as running too often can cause network issues)
let isSonarrEnabled = false;
let isNowShowingEnabled = false;
let isRadarrEnabled = false;
let isTriviaEnabled = false;
let isReadarrEnabled = false;
let isOnDemandEnabled = false;
let isSleepEnabled = false;
let isPicturesEnabled = false;
let isPlexEnabled = false;
let isPlexUnavailable = false;
let isSonarrUnavailable = false;
let isRadarrUnavailable = false;
let isReadarrUnavailable = false;
let isTriviaUnavailable = false;
let isLinksEnabled = false;
let isLinksUnavailable = false;
let hasReported = false;
let cold_start_time = new Date();
let customPicFolders = [];
let serverID = "";
let pinnedMode = false;
let message = "";
let latestVersion = "";
let updateAvailable = false
let sleep = "false";
let apiSleep = false;
let sleepClock;
let triviaToken = "";
let theaterMode = false;
let sleepAPI = false;
let tmpSleepStart;
let tmpSleepEnd;
let recentlyAddedDays;
let contentRatings;
let oldAwtrixApps = [];
let isAwtrixEnabled = false;
let awtrixIP = "";
let restartSeconds = 86400000; 
let excludeLibs = "";

// create working folders if they do not exist
// needed for package binaries
var fs = require('fs');
const { CardTypeEnum } = require("./classes/cards/CardType");
const { titleColour, enableSleep, sleepStart, sleepEnd, numberOnDemand } = require("./consts");
const CardType = require("./classes/cards/CardType");
const MediaCard = require("./classes/cards/MediaCard");
const Links = require("./classes/custom/links");
const { now } = require("jquery");

var dir = './config';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

var dir = './saved';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

var dir = './public';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

var dir = './public/custom';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

var dir = './public/custom/pictures';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

var dir = './public/custom/pictures/default';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

function checkTime(i) {
  try{
    if (i < 10) {
      i = "0" + i;
    }
    return i;
  }
  catch(ex){
    console.log('*ERROR ' + ex);
    return i;
  }
}
loadLinks
/**
 * @desc Wrapper function to call links.
 * @returns {Promise<object>} mediaCards array - LINKS
 */
async function loadLinks() {
  // stop the clock
  clearInterval(linksClock);
  let linkTicks = 86400000; //loadedSettings.linkFrequency * 1000 * 60; // convert to seconds and then minutes

  // stop timers and dont run if disabled
  if (!isLinksEnabled) {
    return linkCards;
  }

  // instatntiate link class
  let linkArray = loadedSettings.links.split(";");
  let links = new Links();
  // call links
  try {
    linkCards = await links.GetAllLinks(linkArray);
    //console.log(linkCards);
  } catch (err) {
    let now = new Date();
    console.log(now.toLocaleString() + " *Links: " + err);
    console.log("✘✘ WARNING ✘✘ - Next links query will run in 1 minute.");
    isLinksUnavailable = true;
  }
  // restart the 24 hour timer
  linksClock = setInterval(loadLinks, linkTicks); // daily
  const lc = linkCards;
  return linkCards;
}

/**
 * @desc Wrapper function to call Trivia.
 * @returns {Promise<object>} mediaCards array - trivia
 */
 async function loadTrivia() {
  // stop the clock
  clearInterval(triviaClock);
  let triviaTicks = loadedSettings.triviaFrequency * 1000 * 60; // convert to seconds and then minutes

  // stop timers and dont run if disabled
  if (!isTriviaEnabled) {
    return trivCards;
  }

  // instatntiate trivia class
  let trivia = new triv();

  // get trivia token
  if(triviaToken == ""){
    try {
      triviaToken = await trivia.GetToken();
    }
    catch(ex){
      let now = new Date();
      console.log(now.toLocaleString() + " *Trivia - get token: " + err);
      triviaToken = "";
      triviaTicks = 60000;
      console.log("✘✘ WARNING ✘✘ - Next Trivia query will run in 1 minute.");
      isTriviaUnavailable = true;
      }
  }

  // call trivia
  try {
    trivCards = await trivia.GetAllQuestions('false',loadedSettings.hasArt, loadedSettings.triviaNumber, loadedSettings.triviaCategories, triviaToken);
    if (isTriviaUnavailable) {
      console.log(
        "✅ Trivia connection restored - defualt poll timers restored"
      );
      isTriviaUnavailable = false;
      triviaTicks = loadedSettings.triviaFrequency * 1000 * 60; // convert to seconds and then minutes
    }
  } catch (err) {
    let now = new Date();
    console.log(now.toLocaleString() + " *Trivia questions: " + err);
    triviaToken = "";
    triviaTicks = 60000;
    console.log("✘✘ WARNING ✘✘ - Next Trivia query will run in 1 minute.");
    isTriviaUnavailable = true;
  }
  // restart the 24 hour timer
  triviaClock = setInterval(loadTrivia, triviaTicks); // daily

  return trivCards;
}



/**
 * @desc Wrapper function to call Readarr coming soon.
 * @returns {Promise<object>} mediaCards array - coming soon
 */
async function loadReadarrComingSoon() {
  // stop the clock
  clearInterval(readarrClock);
  let readarrTicks = 86400000; // daily

  // stop timers and dont run if disabled
  if (!isReadarrEnabled) {
    return csbCards;
  }

  // instatntiate radarr class
  let readarr = new readr(
    loadedSettings.readarrURL,
    loadedSettings.readarrToken,
    loadedSettings.hasArt
  );

  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  later.setDate(later.getDate() + loadedSettings.readarrCalDays);
  let now = today.toISOString().split("T")[0];
  let ltr = later.toISOString().split("T")[0];

  // call radarr coming soon
  try {
    csbCards = await readarr.GetComingSoon(now, ltr, loadedSettings.hasArt);
    if (isReadarrUnavailable) {
      console.log(
        "✅ Readarr connection restored - defualt poll timers restored"
      );
      isReadarrUnavailable = false;
      readarrTicks = 86400000; // daily
    }
  } catch (err) {
    let now = new Date();
    console.log(now.toLocaleString() + " *Coming Soon - Books: " + err);
    radarrTicks = 60000;
    console.log("✘✘ WARNING ✘✘ - Next Readarr query will run in 1 minute.");
    isReadarrUnavailable = true;
  }
  // restart the 24 hour timer
  readarrClock = setInterval(loadReadarrComingSoon, readarrTicks); // daily

  return csbCards;
}


/**
 * @desc Wrapper function to call Radarr coming soon.
 * @returns {Promise<object>} mediaCards array - coming soon
 */
async function loadRadarrComingSoon() {
  // stop the clock
  clearInterval(radarrClock);
  let radarrTicks = 86400000; // daily

  // stop timers and dont run if disabled
  if (!isRadarrEnabled) {
    return csrCards;
  }

  // instatntiate radarr class
  let radarr = new radr(
    loadedSettings.radarrURL,
    loadedSettings.radarrToken,
    loadedSettings.radarrPremieres,
    loadedSettings.hasArt
  );

  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  later.setDate(later.getDate() + loadedSettings.radarrCalDays);
  let now = today.toISOString().split("T")[0];
  let ltr = later.toISOString().split("T")[0];

  // call radarr coming soon
  try {
    csrCards = await radarr.GetComingSoon(now, ltr, loadedSettings.genericThemes, loadedSettings.hasArt);
    if (isRadarrUnavailable) {
      console.log(
        "✅ Radarr connection restored - defualt poll timers restored"
      );
      isRadarrUnavailable = false;
      radarrTicks = 86400000; // daily
    }
  } catch (err) {
    let now = new Date();
    console.log(now.toLocaleString() + " *Coming Soon - Movies: " + err);
    radarrTicks = 60000;
    console.log("✘✘ WARNING ✘✘ - Next Radarr query will run in 1 minute.");
    isRadarrUnavailable = true;
  }
  // restart the 24 hour timer
  radarrClock = setInterval(loadRadarrComingSoon, radarrTicks); // daily

// Temporarily do the radarr trailer call
    
//let mt = new movieTrailers()
//  rtCards = await mt.AssembleRadarrTrailers(csrCards,"xx")

  return csrCards;
}

/**
 * @desc Wrapper function to call Sonarr coming soon.
 * @returns {Promise<object>} mediaCards array - coming soon
 */
async function loadSonarrComingSoon() {
  // stop the clock
  clearInterval(sonarrClock);
  let sonarrTicks = 86400000; // daily

  // stop timers and dont run if disabled
  if (!isSonarrEnabled) {
    return csCards;
  }

  // instatntiate sonarr class
  let sonarr = new sonr(
    loadedSettings.sonarrURL,
    loadedSettings.sonarrToken,
    loadedSettings.sonarrPremieres
  );
  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  later.setDate(later.getDate() + loadedSettings.sonarrCalDays);
  let now = today.toISOString().split("T")[0];
  let ltr = later.toISOString().split("T")[0];

  // call sonarr coming soon
  try {
    csCards = await sonarr.GetComingSoon(
      now,
      ltr,
      loadedSettings.sonarrPremieres,
      loadedSettings.playThemes,
      loadedSettings.hasArt
    );

    if (isSonarrUnavailable) {
      console.log(
        "✅ Sonarr connection restored - defualt poll timers restored"
      );
      isSonarrUnavailable = false;
      sonarrTicks = 86400000; // daily
    }
  } catch (err) {
    let now = new Date();
    console.log(now.toLocaleString() + " *Coming Soon - TV: " + err);
    sonarrTicks = 60000;
    console.log("✘✘ WARNING ✘✘ - Next Sonarr query will run in 1 minute.");
    isSonarrUnavailable = true;
  }

  // restart the 24 hour timer
  sonarrClock = setInterval(loadSonarrComingSoon, sonarrTicks);
  return csCards;
}

/**
 * @desc Wrapper function to call Readarr coming soon.
 * @returns {Promise<object>} mediaCards array - coming soon
 */
async function loadPictures() {
  // stop the clock
  clearInterval(picturesClock);
  let picturesTicks = 1200000; // refreshed every 20 minutes

  // stop timers and dont run if disabled
  if (!isPicturesEnabled) {
    return picCards;
  }

  let cPics = new pics();
  picCards = await cPics.GetPictures(loadedSettings.customPictureTheme, loadedSettings.enableCustomPictureThemes, loadedSettings.hasArt);

  // restart the 24 hour timer
  picturesClock = setInterval(loadPictures, picturesTicks);
  return picCards;
}

/**
 * @desc Wrapper function to call now screening method.
 * @returns {Promise<object>} mediaCards array - results of now screening search
 */
async function loadNowScreening() {

  // stop the clock
  clearInterval(nowScreeningClock);

  // stop timers dont run if disabled
  if (!isPlexEnabled) {
    nsCards = [];
    return nsCards;
  }

  // load MediaServer(s) (switch statement for different server settings server option - TODO)
  let ms = new pms({
    plexHTTPS: loadedSettings.plexHTTPS,
    plexIP: loadedSettings.plexIP,
    plexPort: loadedSettings.plexPort,
    plexToken: loadedSettings.plexToken,
  });

  let excludeLibraries;
  if(loadedSettings.excludeLibs !== undefined && loadedSettings.excludeLibs !== ""){
    excludeLibraries = loadedSettings.excludeLibs.split(",");
    
    // trim leading and trailing spaces
    excludeLibraries = excludeLibraries.map(function (el) {
      return el.trim();
    });
  }
  

  let pollInterval = nsCheckSeconds;
  // call now screening method
  try {
    nsCards = await ms.GetNowScreening(
      loadedSettings.playThemes,
      loadedSettings.genericThemes,
      loadedSettings.hasArt,
      loadedSettings.filterRemote,
      loadedSettings.filterLocal,
      loadedSettings.filterDevices,
      loadedSettings.filterUsers,
      loadedSettings.hideUser,
      excludeLibraries
    );
    // Send to Awtrix, if enabled
    if(isAwtrixEnabled){
      var awt = new awtrix();
      var awtrixApps = []; 

      nsCards.forEach(card => {
        var titleText = card.title.toUpperCase();
        
        titleText = titleText.replaceAll("’","'");
        var appIcon;
        //console.log(card);
        var RED = [255,0,0];
        var GREEN = [0,255,0];
        var BLUE = [0,0,255];
        switch(card.mediaType.toLowerCase()) {
          case 'movie':
            appColour = RED;
            appIcon = 1944;
            break;
          case 'episode':
            appColour = BLUE;    
            titleText = card.title.toUpperCase() + " - " + card.episodeName;
            appIcon = 2649;            
              break;
          case 'track':
            appColour = GREEN;
            appIcon = 17668;            
              break;
          default:
            appColour = RED;
        }

        var customApp = {
          'text': titleText,
          'pushIcon': 0,
          'icon': appIcon,
          'color': appColour,
          //'duration': 10,
          'textCase': 2,
          'scrollSpeed': 60,
          'progress': card.progressPercent,
          'progressC': appColour,
          'unique': "posterr:" + card.playerIP + ":" + card.playerDevice + ":" + card.title.toUpperCase().replaceAll("’","")
          };

          try{
            awtrixApps.push(customApp)
          }
          catch(ex){
            let now = new Date();
            console.log(now.toLocaleString() + " Failed to communicate with Awtrix. Check Awtrix settings/device, then restart poster - " + ex);
            isAwtrixEnabled = false;
          }
      });
      
        if (isNowShowingEnabled && isAwtrixEnabled) {  
          // add or update now playing item
          await awtrixApps.reduce(async (memo, md) => {
            await memo;
            awtrixIP = loadedSettings.awtrixIP;
            const result = await awt.appFind(oldAwtrixApps,md.unique);
            // add to awtrix if not there
            if(result==undefined){
              try{
                await awt.post(awtrixIP,md);
              }
              catch(ex){
                let now = new Date();
                console.log(now.toLocaleString() + " Failed to communicate with Awtrix. Check Awtrix settings/device, then restart poster. " + ex);
                isAwtrixEnabled = false;
              }
              oldAwtrixApps.push(md);
              let now = new Date();
              console.log(now.toLocaleString() + " Awtrix add: " + md.text);
            }
            else{
              // update if progress has changed
              if(result.progress !== md.progress){
                // find array item id to update
                const index = oldAwtrixApps.map(function (e) {
                  return e.text
                  }).indexOf(md.text);
                //console.log("Awtrix: History index of item to update:" + index);

                // remove from old array and add with new value
                oldAwtrixApps.splice(index,1)
                oldAwtrixApps.push(md);

                // upate with new value
                try{
                  await awt.post(awtrixIP,md);
                }
                catch(ex){
                  let now = new Date();
                  console.log(now.toLocaleString() + " - Failed to communicate with Awtrix. Check Awtrix settings/device, then restart poster. " + ex);
                  isAwtrixEnabled = false;
                }
                let now = new Date();
              //console.log(now.toLocaleString() + " Awtrix update: " + md.text + " - " + result.progress + "% --> " + md.progress +"%");
              }

            }
          }, undefined);

          // remove item if no longer playing
          await oldAwtrixApps.reduce(async (memo, md) => {
            await memo;
            const result = await awt.appFind(awtrixApps,md.unique);
            // remove from awtrix if not playing
            if(result==undefined){
              // remove from display
              await awt.delete(awtrixIP,md.unique);
              // find index
              const index = oldAwtrixApps.map(function (e) {
                return e.text
                }).indexOf(md.text);
              //console.log("Awtrix: History index of item to update:" + index);

              // remove from old array and add with new value
              oldAwtrixApps.splice(index,1)

              let now = new Date();
              console.log(now.toLocaleString() + " Awtrix removed: " + md.text);
            }
          }, undefined);
        }
      }

    // restore defaults if plex now available after an error
    if (isPlexUnavailable) {
      console.log("✅ Plex connection restored - defualt poll timers restored");
      isPlexUnavailable = false;
    }
  } catch (err) {
    let now = new Date();
    console.log(now.toLocaleString() + " *Now Showing. - Get full data: " + err);
    pollInterval = nsCheckSeconds + 60000;
    console.log(
      "✘✘ WARNING ✘✘ - Next Now Screening query will be delayed by 1 minute:",
      "(" + pollInterval / 1000 + " seconds)"
    );
    isPlexUnavailable = true;
  }

  // Concatenate cards for all objects load now showing and on-demand cards, else just on-demand (if present)
  // TODO - move this into its own function!
  let mCards = [];
  // is now screening false, then clear array
  if (!isNowShowingEnabled) { nsCards.length = 0 };

  if (nsCards.length > 0) {
    // check for theater mode and enable
    if(loadedSettings.theaterRoomMode !== undefined && loadedSettings.theaterRoomMode == 'true' && theaterMode !== true){
      theaterOn();
    }

    if (loadedSettings.pinNS !== "true") {
      if (loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides == "true") {
        mCards = nsCards.concat(odCards.concat(csCards.concat(csrCards).concat(picCards).concat(linkCards).concat(csbCards).concat(trivCards)).sort(() => Math.random() - 0.5));
      }
      else {
        mCards = nsCards.concat(odCards);
        mCards = mCards.concat(picCards);
        mCards = mCards.concat(csCards);
        mCards = mCards.concat(csrCards);
        mCards = mCards.concat(csbCards);
        mCards = mCards.concat(trivCards);
        mCards = mCards.concat(linkCards);
      }
      pinnedMode = false;
    }
    else {
      // if only one item is playing, then disable sound.
      if (pinnedMode == true && nsCards.length == 1) {
        nsCards[0].theme = "";
      }

      mCards = nsCards;

      if (pinnedMode == false) {
        pinnedMode = true;
        cold_start_time = new Date();
      }
    }
    globalPage.cards = mCards;
  } else {
    // check for theater mode and disable if nothing playing
    if(loadedSettings.theaterRoomMode !== undefined && loadedSettings.theaterRoomMode == 'true' && theaterMode==true){
      theaterOff(true);
    }
    
    // clear nscards if nothing playing
  //  mCards = [];

    pinnedMode = false;
    if (odCards.length > 0) {
      if (loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides == "true") {
        mCards = odCards.concat(csCards.concat(csrCards).concat(picCards).concat(csbCards).concat(linkCards).concat(trivCards)).sort(() => Math.random() - 0.5);
      }
      else {
        mCards = odCards.concat(csCards);
        mCards = mCards.concat(picCards);
        mCards = mCards.concat(csrCards);
        mCards = mCards.concat(csbCards);
        mCards = mCards.concat(trivCards);
        mCards = mCards.concat(linkCards);
      }
      globalPage.cards = mCards;
    } else {
      if (csCards.length > 0) {
        if (loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides == "true") {
          mCards = csCards.concat(csrCards.concat(picCards).concat(csbCards).concat(linkCards).concat(trivCards)).sort(() => Math.random() - 0.5);
        }
        else {
          mCards = csCards.concat(csrCards);
          mCards = mCards.concat(picCards);
          mCards = mCards.concat(csbCards);
          mCards = mCards.concat(trivCards);
          mCards = mCards.concat(linkCards);
        }
        globalPage.cards = mCards;
      } else {
        if (csrCards.length > 0) {
          if (loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides == "true") {
            mCards = csrCards.concat(picCards.concat(csbCards).concat(linkCards).concat(trivCards)).sort(() => Math.random() - 0.5);
          }
          else {
            mCards = csrCards.concat(picCards);
            mCards = mCards.concat(csbCards);
            mCards = mCards.concat(trivCards);
            mCards = mCards.concat(linkCards);
          }
          globalPage.cards = mCards;

          // console.log("CSR:" +csrCards.length);
        }
        else {
          if (csbCards.length > 0) {
            if (loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides == "true") {
              mCards = csbCards.concat(picCards.concat(trivCards)).concat(linkCards).sort(() => Math.random() - 0.5);
            }
            else {
              mCards = csbCards.concat(picCards);
              mCards = mCards.concat(trivCards);
              mCards = mCards.concat(linkCards);
            }
            globalPage.cards = mCards;
          }
          else {
            if(picCards.length > 0) {
              if (loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides == "true") {
                mCards = picCards.concat(trivCards).concat(linkCards).sort(() => Math.random() - 0.5);
              }
              else {
                mCards = picCards.concat(trivCards);
                mCards = mCards.concat(linkCards);
              }
              globalPage.cards = mCards;
            }
            else {
              if (loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides == "true") {
                mCards = trivCards.concat(linkCards).sort(() => Math.random() - 0.5);
              }
              else {
                mCards = trivCards;
                mCards = mCards.concat(linkCards);
              }
              globalPage.cards = mCards;
            }
          }
        }
      }
    }
//console.log(linkCards.length);
//    globalPage.cards = mCards;
  }

  // setup transition - fade or default slide
  let fadeTransition = "";
  if (loadedSettings.fade) {
    fadeTransition = "carousel-fade";
  }

  // put everything into global class, ready to be passed to poster.ejs
  // render html for all cards
  await globalPage.OrderAndRenderCards(BASEURL, loadedSettings.hasArt, loadedSettings.odHideTitle, loadedSettings.odHideFooter);
  globalPage.slideDuration = loadedSettings.slideDuration * 1000;
  globalPage.playThemes = loadedSettings.playThemes;
  globalPage.playGenericThemes = loadedSettings.genericThemes;
  globalPage.fadeTransition =
    loadedSettings.fade == "true" ? "carousel-fade" : "";
  globalPage.custBrand = loadedSettings.custBrand;
  globalPage.titleColour = loadedSettings.titleColour;
  globalPage.footColour = loadedSettings.footColour;
  globalPage.bgColour = loadedSettings.bgColour;
  globalPage.hasArt = loadedSettings.hasArt;
  globalPage.quizTime = loadedSettings.triviaTimer !== undefined ? loadedSettings.triviaTimer : 15;
  globalPage.hideSettingsLinks = loadedSettings.hideSettingsLinks !== undefined ? loadedSettings.hideSettingsLinks : 'false';
  globalPage.rotate = loadedSettings.rotate !== undefined ? loadedSettings.rotate : "false";

  // restart the clock
  nowScreeningClock = setInterval(loadNowScreening, pollInterval);
  return nsCards;
}

/**
 * @desc Wrapper function to call on-demand method
 * @returns {Promise<object>} mediaCards array - results of on-demand search
 */
async function loadOnDemand() {
  // stop the clock
  clearInterval(onDemandClock);

  // dont restart clock and dont run if disabled
  if (!isOnDemandEnabled) {
    return odCards;
  }

  // changing timings if plex unavailable or ns not working
  let odCheckMinutes = loadedSettings.onDemandRefresh;
  if (isPlexUnavailable) {
    odCheckMinutes = 1;
    console.log("✘✘ WARNING ✘✘ - Next on-demand query will run in 1 minute.");
    // restart interval timer
    onDemandClock = setInterval(loadOnDemand, odCheckMinutes * 60000);

    return odCards;
  }

  // load MediaServer(s) (switch statement for different server settings server option - TODO)
  let ms = new pms({
    plexHTTPS: loadedSettings.plexHTTPS,
    plexIP: loadedSettings.plexIP,
    plexPort: loadedSettings.plexPort,
    plexToken: loadedSettings.plexToken,
  });

  try {
    odCards = await ms.GetOnDemand(
      loadedSettings.onDemandLibraries,
      loadedSettings.numberOnDemand,
      loadedSettings.playThemes,
      loadedSettings.genericThemes,
      loadedSettings.hasArt,
      loadedSettings.genres,
      loadedSettings.recentlyAddedDays,
      loadedSettings.contentRatings
    );
  } catch (err) {
    let d = new Date();
    console.log(d.toLocaleString() + " *On-demand - Get full data: " + err);
  }

  // restart interval timer
  onDemandClock = setInterval(loadOnDemand, odCheckMinutes * 60000);

  // randomise on-demand results for all libraries queried
  if (loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides == "true") {
    return odCards.sort(() => Math.random() - 0.5);
  }
  else {
    return odCards;
  }

}

/**
 * @desc Cleans up image and MP3 cache directories
 * @returns nothing
 */
async function houseKeeping() {
  //cold_start_time = new Date();

  // clean cache
  await core.DeleteMP3Cache();
  await core.DeleteImageCache();
}

/*
 * @desc Loads all poster settings
 * @returns {object} json - settings details
 */
async function loadSettings() {
  const ls = await Promise.resolve(await Promise.resolve(setng.GetSettings()));
  return await Promise.resolve(ls);
}

/**
 * @desc check if Now Screening/Playing, On-Demand, Sonarr or Radarr options are empty/disabled
 * @returns nothing
 */
async function checkEnabled() {
  // reset all enabled variables
  isOnDemandEnabled = false;
  isPlexEnabled = false;
  isSonarrEnabled = false;
  isRadarrEnabled = false;
  isNowShowingEnabled = false;
  isPicturesEnabled = false;
  isReadarrEnabled = false;
  isSleepEnabled = false;
  isTriviaEnabled = false;
  isLinksEnabled = false;
  isAwtrixEnabled = false;

  let sleepStart;
  let sleepEnd;
  let sleepTicks;

  // check links
  if (loadedSettings.enableAwtrix == 'true' && loadedSettings.awtrixIP != null) isAwtrixEnabled = true;

  // check links
  if (loadedSettings.enableLinks == 'true') isLinksEnabled = true;

  // check trivia
  if (loadedSettings.enableTrivia == 'true') isTriviaEnabled = true;

  // check pictures
  if (loadedSettings.enableCustomPictures == 'true') isPicturesEnabled = true;

  // check now showing
  if (
    loadedSettings.enableNS !== 'false'
  ) {
    isNowShowingEnabled = true;
  }

  // check sleep mode
  // let startTime = await util.emptyIfNull(loadedSettings.sleepStart);
  // let endTime = await util.emptyIfNull(loadedSettings.sleepEnd);
  try {
    if(loadedSettings.isSleepEnabled == "true")
    isSleepEnabled = true;
  }
  catch (ex) {
    isSleepEnabled = false;
  }


  try {
    sleepStart = new Date("2100-01-01T" + loadedSettings.sleepStart);
    isSleepEnabled = true;
  }
  catch (ex) {
    console.log("*Invalid sleep start time entered");
    isSleepEnabled = false;
  }

  try {
    sleepEnd = new Date("2100-01-01T" + loadedSettings.sleepEnd);
    isSleepEnabled = true;
  }
  catch (ex) {
    console.log("*Invalid sleep end time entered");
    isSleepEnabled = false;
  }

  try {
    if (loadedSettings.enableSleep == "true" && isSleepEnabled == true && sleepEnd.getTime() !== sleepStart.getTime()) {
      isSleepEnabled = true;
      sleepTicks = sleepEnd - sleepStart;
    }
    else {
      isSleepEnabled = false;
    }
  }
  catch(ex){
    console.log("*Invalid sleep timer settings");
    isSleepEnabled = false;
  }

  // check Plex
  if (
    (loadedSettings.plexIP !== undefined && loadedSettings.plexIP !== '') &&
    (loadedSettings.plexToken !== undefined && loadedSettings.plexToken !== '') &&
    (loadedSettings.plexPort !== undefined && loadedSettings.plexPort !== undefined)
  ) {
    isPlexEnabled = true;
  }
  else{
    isPlexEnabled = false;
  }
  
  // check on-demand
  if (loadedSettings.onDemandLibraries !== undefined &&
    isPlexEnabled &&
    loadedSettings.numberOnDemand !== undefined &&
    //loadedSettings.numberOnDemand !== 0 &&
    loadedSettings.enableOD !== 'false'
  ) {
    isOnDemandEnabled = true;
  }
  else{
    isOnDemandEnabled = false;
  }
  
  // check Sonarr
  if (
    loadedSettings.sonarrURL !== undefined &&
    loadedSettings.sonarrCalDays !== undefined &&
    loadedSettings.sonarrToken !== undefined &&
    loadedSettings.enableSonarr !== 'false'
  ) {
    isSonarrEnabled = true;
  }
  else{
    isSonarrEnabled = false;
  }
  
  // check Radarr
  if (
    loadedSettings.radarrURL !== undefined &&
    loadedSettings.radarrCalDays !== undefined &&
    loadedSettings.radarrToken !== undefined &&
    loadedSettings.enableRadarr !== 'false'
  ) {
    isRadarrEnabled = true;
  }
  else{
    isRadarrEnabled = false;
  }
  
  // check Readarr
  if (
    loadedSettings.readarrURL !== undefined &&
    loadedSettings.readarrCalDays !== undefined &&
    loadedSettings.readarrToken !== undefined &&
    loadedSettings.enableReadarr !== 'false'
  ) {
    isReadarrEnabled = true;
  }
  else{
    isReadarrEnabled = false;
  }

  // check Trivia

  if (
    loadedSettings.triviaCategories !== undefined &&
    loadedSettings.triviaCategories.length !== 0 &&
    loadedSettings.triviaTimer !== undefined &&
    loadedSettings.triviaNumber !== undefined &&
    loadedSettings.triviaFrequency !== undefined &&
    loadedSettings.enableTrivia !== 'false'
  ) {
    isTriviaEnabled = true;
  }
  else{
    isTriviaEnabled = false;
  }

// check Awtrix
  if (
    loadedSettings.awtrixIP !== undefined &&
    loadedSettings.enableAwtrix !== 'false' &&
    loadedSettings.enableNS !== 'false'
  ) {
    isAwtrixEnabled = true;
  }
  else{
    isAwtrixEnabled = false;
  }

  // display status
  let sleepRange = " (Invalid or no date range set)";
  if (isSleepEnabled == true) {
    sleepRange = " (" + checkTime(sleepStart.getHours()) + 
      ":" + checkTime(sleepStart.getMinutes()) + 
      "->" + checkTime(sleepEnd.getHours()) + 
      ":" + checkTime(sleepEnd.getMinutes()) + ")";
  }
  else{
    sleepRange = "";
  }

  // calculate daily restart time
  let timeObject = new Date(Date.now() + restartSeconds);
  
  console.log(
    `--- Enabled Status ---
   Plex: ` +
    isPlexEnabled +
    `
   Now Showing: ` +
    isNowShowingEnabled +
    `
   Awtrix: ` +
    isAwtrixEnabled +
    `
   On-demand: ` +
    isOnDemandEnabled +
    `
   Sonarr: ` +
    isSonarrEnabled +
    `
   Radarr: ` +
    isRadarrEnabled +
    `
   Custom Pictures: ` +
    isPicturesEnabled +
    `
   Readarr: ` +
    isReadarrEnabled +
    `
   Sleep timer: ` +
    isSleepEnabled + sleepRange +
    `
   Trivia: ` +
    isTriviaEnabled + 
    `
   Links: ` +
    isLinksEnabled + 
    `
   Daily restart commencing at: ` +
    timeObject.toLocaleTimeString() + 
    `
  `
  );
  return;
}

async function theaterOn(){
  tmpSleepStart = loadedSettings.sleepStart;
  tmpSleepEnd = loadedSettings.sleepEnd;

  let d = new Date();
  let h = checkTime(d.getHours());
  let m = checkTime(d.getMinutes() -5);
  let ms = checkTime(d.getMinutes() -3);
  loadedSettings.sleepEnd = h + ":" + m;
  loadedSettings.sleepStart = h + ":" + ms;
  sleep="true";
  console.log(d.toLocaleString() + ` ** Theatre mode active`);
  theaterMode = true;
}

async function theaterOff(theater) {
  sleep = "false";
  let d = new Date();
  if(theater !== undefined && theater == true && theaterMode == true){
    loadedSettings.sleepStart = tmpSleepStart;
    loadedSettings.sleepEnd = tmpSleepEnd;
    theaterMode = false;
    isSleepEnabled = false;
    //loadedSettings.enableSleep = 'false';
  }
    console.log(d.toLocaleString() + ` ** Theatre mode deactivated`);
}

async function suspend() {
  // stop all clocks
  clearInterval(nowScreeningClock);
  clearInterval(onDemandClock);
  clearInterval(sonarrClock);
  clearInterval(radarrClock);
  //todo - possibly remove this permanenetly. trying to debug if cache is cleared inadvertantly. Leave commented for now.      clearInterval(houseKeepingClock);
  clearInterval(picturesClock);
  clearInterval(readarrClock);
  clearInterval(linksClock);
  // set to sleep
  sleep = "true";
  // loadedSettings.playThemes = 'false';
  // loadedSettings.genericThemes = 'false';
  // loadedSettings.enableCustomPictureThemes = 'false';

  let d = new Date();
  if (apiSleep==true)
  {
    console.log(" ** api/sleep - Sleep command issued. (Overrides set schedules)");
  }
  else
  {
    console.log(d.toLocaleString() + ` ** Sleep mode activated (sleep terminates at ` + loadedSettings.sleepEnd + `)`);
  }
}


async function wake(theater) {
  sleep = "false";
  loadedSettings = await loadSettings();
  if (isSonarrEnabled) await loadSonarrComingSoon();
  if (isRadarrEnabled) await loadRadarrComingSoon();
  if (isOnDemandEnabled) await loadOnDemand();
  if (isPicturesEnabled) await loadPictures();
  if (isReadarrEnabled) await loadReadarrComingSoon();
  if (isTriviaEnabled) await loadTrivia();
  if (isLinksEnabled) await loadLinks();
  await loadNowScreening();
  let d = new Date();
  if(theater !== true) console.log(d.toLocaleString() + ` ** Sleep mode terminated (next activation at ` + loadedSettings.sleepStart + `)`);
}

/**
 * @desc Starts everything - calls coming soon 'tv', on-demand and now screening functions. Then initialises timers
 * @returns nothing
 */
async function startup(clearCache) {
  // stop all clocks
  clearInterval(nowScreeningClock);
  clearInterval(onDemandClock);
  clearInterval(sonarrClock);
  clearInterval(radarrClock);
  clearInterval(houseKeepingClock);
  clearInterval(picturesClock);
  clearInterval(readarrClock);
  clearInterval(triviaClock);
  clearInterval(linksClock);

  picCards = [];
  odCards = [];
  nsCards = [];
  csCards = [];
  csrCards = [];
  csbCards = [];
  trivCards = [];
  linkCards = [];

  // run housekeeping job 
  if (clearCache !== false){
    await houseKeeping();
//    let d = new Date();
//    console.log(d.toLocaleString() + ` ** Restart/reload **`);
  }
// TODO to remove this!       console.log(clearCache);
  // load settings object
  loadedSettings = await Promise.resolve(await loadSettings());
  if (loadedSettings == 'undefined') {
    console.load('settings not loaded!!');
  }
  else {
    console.log(`✅ Settings loaded
  `);

  // set values for noLinks
  globalPage.hideSettingsLinks = loadedSettings.hideSettingsLinks !== undefined ? loadedSettings.hideSettingsLinks : 'false';

    // restart timer for houseKeeping
    //houseKeepingClock = setInterval(houseKeeping, 86400000); // daily
  }

  // check status
  await checkEnabled();

  // set custom titles if available
  CardTypeEnum.NowScreening[1] = loadedSettings.nowScreening !== undefined ? loadedSettings.nowScreening : "";
  CardTypeEnum.OnDemand[1] = loadedSettings.onDemand !== undefined ? loadedSettings.onDemand : "";
  CardTypeEnum.RecentlyAdded[1] = loadedSettings.recentlyAdded !== undefined ? loadedSettings.recentlyAdded : "";
  CardTypeEnum.ComingSoon[1] = loadedSettings.comingSoon !== undefined ? loadedSettings.comingSoon : "";
  CardTypeEnum.IFrame[1] = loadedSettings.iframe !== undefined ? loadedSettings.iframe : "";
  CardTypeEnum.Playing[1] = loadedSettings.playing !== undefined ? loadedSettings.playing : "";
  CardTypeEnum.Picture[1] = loadedSettings.picture !== undefined ? loadedSettings.picture : "";
  CardTypeEnum.EBook[1] = loadedSettings.ebook !== undefined ? loadedSettings.ebook : "";
  CardTypeEnum.Trivia[1] = loadedSettings.trivia !== undefined ? loadedSettings.trivia : ""; 
  CardTypeEnum.WebURL[1] = loadedSettings.links !== undefined ? loadedSettings.links : ""; 

  // initial load of card providers
  if (isSonarrEnabled) await loadSonarrComingSoon();
  if (isRadarrEnabled) await loadRadarrComingSoon();
  if (isOnDemandEnabled) await loadOnDemand();
  if (isPicturesEnabled) await loadPictures();
  if (isReadarrEnabled) await loadReadarrComingSoon();
  if (isTriviaEnabled) await loadTrivia();
  if (isLinksEnabled) await loadLinks();

  // Awtrix initialize - if enabled
  if(isAwtrixEnabled){
    var awt = new awtrix();
    awtrixIP = loadedSettings.awtrixIP;
    try{
      const STATS = await awt.stats(awtrixIP);
      let now = new Date();
      console.log(now.toLocaleString() + " *Awtrix device status: " + STATS.statusText);
    }
    catch(ex){
      let now = new Date();
      //console.log(now.toLocaleString() + " Awtrix failed connectivity test");
      console.log(now.toLocaleString() + " Disabling Awtrix. Check Awtrix settings/device, then restart poster - " + ex);

      isAwtrixEnabled = false;
    }
    try{
      // clear any old awtrix apps
      await awt.clear(awtrixIP);
      // play a pleasant greeting
      var tune = {
        "Flntstn":"d=4,o=5,b=200:g#,c#,8p,c#6,8a#,g#,c#,8p"
      }
      //await awt.rtttl(awtrixIP,tune);
    }
    catch(ex){
      let now = new Date();
      //console.log(now.toLocaleString() + " Awtrix failed clear operation");
      console.log(now.toLocaleString() + " Disabling Awtrix. Check Awtrix settings/device, then restart poster - " + ex);
      isAwtrixEnabled = false;
    }
  }

  await loadNowScreening();

  // let now = new Date();
  // console.log(
  //   now.toLocaleString() + " Now screening titles refreshed (First run only)"
  // );
  console.log(" ");
  console.log(`✅ Application ready on http://hostIP:` + PORT + BASEURL + `
   Goto http://hostIP:` + PORT + BASEURL + `/settings to get to setup page.
  `);
  cold_start_time = new Date();

  // add a server id if missing
  if (loadedSettings !== undefined && loadedSettings.serverID == undefined) {
    loadedSettings.serverID = util.createUUID();
    const saved = await setng.UpdateSettings(loadedSettings);
  }

  if (hasReported == false && loadedSettings !== undefined) {
    let v = new vers(endPoint);
    const logzResponse = await v.log(loadedSettings.serverID, pjson.version, isNowShowingEnabled, isOnDemandEnabled, isSonarrEnabled, isRadarrEnabled, isPicturesEnabled, isReadarrEnabled, isTriviaEnabled, isLinksEnabled);
    message = logzResponse.message;
    latestVersion = logzResponse.version;
    hasReported = true;
  }
  if (latestVersion !== undefined && latestVersion !== pjson.version.toString()) {
    // version numbers
    let curMaj = parseInt(pjson.version.toString().split(".")[0]);
    let curMed = parseInt(pjson.version.toString().split(".")[1]);
    let curMin = parseInt(pjson.version.toString().split(".")[2]);
    let rptMaj = parseInt(latestVersion.split(".")[0]);
    let rptMed = parseInt(latestVersion.split(".")[1]);
    let rptMin = parseInt(latestVersion.split(".")[2]);

    // check if update required
    if (rptMaj > curMaj) {
      updateAvailable = true;
    }
    else {
      if (rptMaj == curMaj && rptMed > curMed) {
        updateAvailable = true;
      }
      else {
        if (rptMaj == curMaj && rptMed == curMed && rptMin > curMin) {
          updateAvailable = true;
        }
        else {
          updateAvailable = false;
        }
      }
    }

    if (updateAvailable == true) {
      console.log("*** PLEASE UPDATE TO v" + latestVersion + " ***");
      console.log("");
    }
    else {
      console.log("*** You are running the latest version of Posterr ***");
      console.log("");
    }
  }

  if (message !== undefined && message !== "") {
    console.log("Message: " + message);
    console.log("");
  }

  // setup sleep mode if enabled
  if(isSleepEnabled==true){
    // check times every 5 seconds
    sleepClock = setInterval(() => {
      if(theaterMode !== true){
        let startSleep = new Date("2100-01-01T" + loadedSettings.sleepStart);
        let endSleep = new Date("2100-01-01T" + loadedSettings.sleepEnd);
        let cur = new Date();
        let curDate = new Date("2100-01-01T" + checkTime(cur.getHours()) + ":" + checkTime(cur.getMinutes()));

        if((curDate.getTime() >= startSleep.getTime() && curDate.getTime() < endSleep.getTime() && endSleep.getTime() > startSleep.getTime()) || (endSleep.getTime() < startSleep.getTime() && (curDate.getTime() < endSleep.getTime() || curDate.getTime() >= startSleep.getTime())) ){
          if(sleep !== "true"){
            sleep="true";
            suspend();
          }
        }
        else{
          if(sleep=="true" && apiSleep!=true){
            wake();
            sleep="false";
          } 
        }
      }
    }, 5000);
  }
  else{
    clearInterval(sleepClock);
    sleep = "false";
  }
  // restart timer
  houseKeepingClock = setInterval(startup, restartSeconds); // daily

  return;
}

/**
 * @desc Saves settings and calls startup
 * @returns nothing
 */
async function saveReset(formObject) {
  const saved = await setng.SaveSettingsJSON(formObject);
  // cancel all clocks, then pause 5 seconds to ensure downloads finished
  clearInterval(nowScreeningClock);
  clearInterval(onDemandClock);
  clearInterval(sonarrClock);
  clearInterval(radarrClock);
  clearInterval(readarrClock);
  clearInterval(houseKeepingClock);
  clearInterval(picturesClock);
  clearInterval(triviaClock);
  clearInterval(linksClock);

  // clear cards
  nsCards = [];
  odCards = [];
  csrCards = [];
  csrCards = [];
  picCards = [];
  csbCards = [];
  trivCards = [];
  linkCards = [];

  console.log(
    "✘✘ WARNING ✘✘ - Restarting. Please wait while current jobs complete"
  );
  // clear old cards
  globalPage.cards = [];
  // dont clear cached files if restarting after settings saved
  startup(false);
}

// call all card providers - initial card loads and sets scheduled runs
//TODO - to remove!    console.log('<< INITIAL START >>');
startup(true);

//use ejs templating engine
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'myviews'));
//console.log('app.set:' + __dirname);

// Express settings
app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  })
);
app.use(cors());

app.set("trust proxy", 1);
app.use(cookieParser());
app.use(
  session({
    cookie: {
      secure: true,
      maxAge: 3000000,
    },
    // store: cookieParser,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    secret: "xyzzy",
    saveUninitialized: true,
    resave: false,
  })
);

// sets public folder for assets
//app.use(express.static(path.join(__dirname, "public")));

//sets public folder for assets
if (BASEURL == "") {
  //  console.log(__dirname);
  //  console.log(process.cwd());
  app.use(express.static(path.join(__dirname, "public")));
  app.use(express.static(path.join(process.cwd(), "saved")));
  app.use(express.static(path.join(process.cwd(), "public")));
  // app.use("/js",express.static(path.join(__dirname, "/node_modules/fitty/dist")));  
  // app.use("/bscss",express.static(path.join(__dirname, "/node_modules/bootstrap/dist/css")));
  // app.use("/js",express.static(path.join(__dirname, "node_modules/bootstrap/dist/js")));
  // app.use("/js",express.static(path.join(__dirname, "node_modules/jquery/dist")));
}
else {
  app.use(BASEURL, express.static(__dirname + '/public'));
  app.use(BASEURL, express.static(process.cwd() + '/saved'));
  app.use(BASEURL, express.static(process.cwd() + '/public'));

}


// set routes
app.get(BASEURL + "/", (req, res) => {
  // try {
  res.render("index", { globals: globalPage, hasConfig: setng.GetChanged(), baseUrl: BASEURL, custBrand: globalPage.custBrand, hasArt: globalPage.hasArt, quizTime: globalPage.quizTime, rotate: globalPage.rotate }); // index refers to index.ejs
  // }
  // catch (ex) {
  //   console.log('res.render:' + __dirname);
  //   res.render(path.join(__dirname, 'myviews', 'index'), { globals: globalPage, hasConfig: setng.GetChanged(), baseUrl: BASEURL, custBrand: globalPage.custBrand, hasArt: globalPage.hasArt, quizTime: globalPage.quizTime }); // index refers to index.ejs
  // }
});

app.get(BASEURL + "/getcards", (req, res) => {
  res.send({ globalPage: globalPage, baseUrl: BASEURL }); // get generated cards
});

// Used by the web client to check connection status to Posterr, and also to determine if there was a cold start that was missed
app.get(BASEURL + "/conncheck", (req, res) => {
  res.send({ "status": cold_start_time, "sleep": sleep });
});


app.get(BASEURL + "/debug", (req, res) => {
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL });
});

app.get(BASEURL + "/debug/ping", (req, res) => {
  console.log(' ');
  console.log('** PING TESTS **');
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.TestPing();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL });
});

app.get(BASEURL + "/debug/plexns", (req, res) => {
  console.log(' ');
  console.log("** PLEX 'NOW SCREENING' CHECK **");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.PlexNSCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL });
});

app.get(BASEURL + "/debug/plexod", (req, res) => {
  console.log(' ');
  console.log("** PLEX 'ON-DEMAND' CHECK **");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.PlexODCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL });
});

app.get(BASEURL + "/debug/sonarr", (req, res) => {
  console.log(' ');
  console.log("** SONARR CHECK ** (titles in next 5 days)");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.SonarrCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL });
});

app.get(BASEURL + "/debug/radarr", (req, res) => {
  console.log(' ');
  console.log("** RADARR CHECK ** (Any releases in next 30 days)");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.RadarrCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL });
});

app.get(BASEURL + "/debug/readarr", (req, res) => {
  console.log(' ');
  console.log("** READARR CHECK ** (Any releases in next 90 days)");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.ReadarrCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL });
});

app.get(BASEURL + "/debug/trivia", (req, res) => {
  console.log(' ');
  console.log("** Open Trvia DB CHECK ** (Get 5 questions)");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.TriviaCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL });
});

// password for settings section
let userData = { valid: false, expires: 10 };

// settings page
app.get(BASEURL + "/logon", (req, res) => {
  res.render("logon", {
    success: req.session.success, baseUrl: BASEURL
  });
  req.session.errors = null;
});


function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path + '/' + file).isDirectory();
  });
}

app.get('/api/sleep', (req, res) => {
  res.send({
    status: sleep
  })
})

app.post(
  BASEURL + "/api/sleep", (req, res) => {
    if(req.body.psw==loadedSettings.password){
      if(req.body.sleep=='true'){
        sleep=true;
        apiSleep=true;
        suspend()
        res.send({
          status: sleep
        })
      }
      else{
        sleep=false;
        apiSleep=false;
        console.log(" ** api/sleep - Wake command issued");
        res.send({
          status: sleep
        })
      }
    }
    else {
      res.send({
        error: 'Incorrect password'
      })
    }
  }
)


app.post(
  BASEURL + "/logon",
  [
    check("password")
      .custom((value) => {
        if (loadedSettings.password !== value) {
          throw new Error("Invalid Password!!");
        }
        userData.valid = true;
        return true;
      })
      .withMessage("Invalid password"),
  ],
  (req, res) => {
    var errors = validationResult(req).array();
    if (errors.length > 0) {
      req.session.errors = errors;
      req.session.success = false;
      res.render("logon", {
        errors: req.session.errors,
        user: { valid: false },
        baseUrl: BASEURL,
        customPicFolders: customPicFolders,
        updateAvailable: updateAvailable
      });
    } else {
      res.render("settings", {
        user: userData,
        success: req.session.success,
        settings: loadedSettings,
        version: pjson.version,
        baseUrl: BASEURL,
        customPicFolders: customPicFolders,
        latestVersion: latestVersion,
        message: message,
        updateAvailable: updateAvailable
      });
    }
  }
);

// settings page
app.get(BASEURL + "/settings", (req, res) => {
  // load pic folders
  customPicFolders = getDirectories('./public/custom/pictures');

  if (loadedSettings.password == undefined) {
    res.render("settings", {
      success: req.session.success,
      user: { valid: true },
      settings: loadedSettings,
      errors: req.session.errors,
      version: pjson.version,
      baseUrl: BASEURL,
      customPicFolders: customPicFolders,
      latestVersion: latestVersion,
      message: message,
      updateAvailable: updateAvailable
    });
  }
  else {
    res.render("settings", {
      success: req.session.success,
      user: { valid: false },
      settings: loadedSettings,
      errors: req.session.errors,
      version: pjson.version,
      baseUrl: BASEURL,
      customPicFolders: customPicFolders,
      latestVersion: latestVersion,
      message: message,
      updateAvailable: updateAvailable

    });
  }
  req.session.errors = null;
});

app.post(
  BASEURL + "/settings",
  [
    //check("password").not().isEmpty().withMessage("Password cannot be blank"),
    check("slideDuration")
      .not()
      .isEmpty()
      .withMessage("'Slide Duration' cannot be blank. (setting default)")
      .custom((value) => {
        if (isNaN(parseInt(value))) {
          throw new Error("'Slide duration' must be a number");
        }
        if (parseInt(value) < 5) {
          throw new Error("'Slide duration' cannot be less than 5 seconds");
        }
        // Indicates the success of this synchronous custom validator
        return true;
      })
      .withMessage("'Slide Duration' is required and must be 5 or more"),
    check("plexIP").not().isEmpty().withMessage("'Plex IP' is required"),
    check("plexPort")
      .not()
      .isEmpty()
      .withMessage("'Plex port' is required. (setting default)")
      .custom((value) => {
        if (parseInt(value) === "NaN") {
          throw new Error("'Plex Port' must be a number");
        }
        // Indicates the success of this synchronous custom validator
        return true;
      }),
    check("onDemandRefresh")
      .not()
      .isEmpty()
      .withMessage("'On-demand refresh period' cannot be blank. (setting default)")
      .custom((value) => {
        if (isNaN(parseInt(value))) {
          throw new Error("'On-demand refresh period' must be a number (setting default)");
        }
        if (parseInt(value) < 10) {
          throw new Error("'On-demand refresh period' must be 10 or more");
        }
        // Indicates the success of this synchronous custom validator
        return true;
      })
      .withMessage("'On-demand refresh period' cannot be less than 10 minutes"),
    check("numberOnDemand")
      .not()
      .isEmpty()
      .withMessage("'Number to Display' must be 0 or more. (setting default)")
      .custom((value, { req }) => {
        if (value !== undefined && value !== "" && parseInt(value) !== "NaN") {
          // make sure there are limited slides requested
          let numOfLibraries = 0;
          let themeMessage;

          // double the slide count if tv and movie themes are off
          let maxSlides = MAX_OD_SLIDES;

          if (req.body.themeSwitch == undefined && req.body.genericSwitch == undefined) {
            maxSlides = maxSlides * 2;
            themeMessage = "";
          }
          else {
            maxSlide = MAX_OD_SLIDES;
            themeMessage = "(when themes enabled)";
          }

          if (req.body.plexLibraries !== undefined || req.body.plexLibraries !== "") {
            numberOfLibraries = req.body.plexLibraries.split(",").length;
            if (parseInt(value) * numberOfLibraries > maxSlides) {
              let estimatedNumber = parseInt(maxSlides / numberOfLibraries);
              throw new Error("'Number to Display' cannot be more than '" + estimatedNumber + "' for '" + numberOfLibraries + "' libraries " + themeMessage);
            }
          }
        }
        // Indicates the success of this synchronous custom validator
        return true;
      }),
    check("plexToken").not().isEmpty().withMessage("'Plex token' is required"),
    check("enableSleep")
      .custom((value, { req }) => {
        if(value == "true"){
          if(req.body.sleepStart.length == 0) throw new Error("You must specify sleep start and end times if the sleep timer is enabled");
        }
        if(value == "true"){
          if(req.body.sleepEnd.length == 0) throw new Error("You must specify sleep start and end times if the sleep timer is enabled");
        }
        return true;
      }),
    check("sleepStart")
      .custom((value, { req }) => {
        if(isNaN(Date.parse("2100-01-01T" + value)) == true && value.length !== 0) throw new Error("Sleep start time must be in 24 hour format hh:mm (eg. 07:15 or 23:30)");
        return true;
      }),
    check("sleepEnd")
      .custom((value, { req }) => {
        if(isNaN(Date.parse("2100-01-01T" + value)) == true && value.length !== 0) throw new Error("Sleep end time must be in 24 hour format hh:mm (eg. 07:15 or 23:30)");
        return true;
      }),
    check("sonarrUrl")
      .custom((value, { req }) => {
        if(value.endsWith('/') == true && value.length !== 0) throw new Error("Sonarr URL cannot have a trailing slash");
        return true;
      }),
      check("radarrUrl")
        .custom((value, { req }) => {
          if(value.endsWith('/') == true && value.length !== 0) throw new Error("Radarr URL cannot have a trailing slash");
          return true;
        }),
      check("readarrUrl")
        .custom((value, { req }) => {
          if(value.endsWith('/') == true && value.length !== 0) throw new Error("Readarr URL cannot have a trailing slash");
          return true;
        })        
  ],
  (req, res) => {
    //fields value holder. Also sets default values in form passed without them.
    let form = {
      password: req.body.password,
      slideDuration: req.body.slideDuration ? parseInt(req.body.slideDuration) : DEFAULT_SETTINGS.slideDuration,
      artSwitch: req.body.artSwitch,
      themeSwitch: req.body.themeSwitch,
      genericSwitch: req.body.genericSwitch,
      fadeOption: req.body.fadeOption,
      shuffleSwitch: req.body.shuffleSwitch,
      hideSettingsLinks: req.body.hideSettingsLinks,
      theaterRoomMode: req.body.theaterRoomMode,
      plexToken: req.body.plexToken,
      plexIP: req.body.plexIP,
      plexHTTPSSwitch: req.body.plexHTTPSSwitch,
      plexPort: req.body.plexPort ? parseInt(req.body.plexPort) : DEFAULT_SETTINGS.plexPort,
      plexLibraries: req.body.plexLibraries,
      pinNSSwitch: req.body.pinNSSwitch,
      hideUser: req.body.hideUser,
      numberOnDemand: !isNaN(parseInt(req.body.numberOnDemand)) ? parseInt(req.body.numberOnDemand) : DEFAULT_SETTINGS.numberOnDemand,
      recentlyAddedDays: !isNaN(parseInt(req.body.recentlyAddedDays)) ? parseInt(req.body.recentlyAddedDays) : DEFAULT_SETTINGS.recentlyAddedDays, 
      recentlyAdded: req.body.recentlyAdded,
      contentRatings: req.body.contentRatings,
      onDemandRefresh: parseInt(req.body.onDemandRefresh) ? parseInt(req.body.onDemandRefresh) : DEFAULT_SETTINGS.onDemandRefresh,
      genres: req.body.genres,
      sonarrUrl: req.body.sonarrUrl,
      sonarrToken: req.body.sonarrToken,
      sonarrDays: req.body.sonarrDays ? parseInt(req.body.sonarrDays) : DEFAULT_SETTINGS.sonarrCalDays,
      premiereSwitch: req.body.premiereSwitch,
      radarrUrl: req.body.radarrUrl,
      radarrToken: req.body.radarrToken,
      radarrDays: req.body.radarrDays ? parseInt(req.body.radarrDays) : DEFAULT_SETTINGS.radarrCalDays,
      readarrUrl: req.body.readarrUrl,
      readarrToken: req.body.readarrToken,
      readarrDays: req.body.readarrDays ? parseInt(req.body.readarrDays) : DEFAULT_SETTINGS.readarrCalDays,
      titleFont: req.body.titleFont,
      nowScreening: req.body.nowScreening,
      comingSoon: req.body.comingSoon,
      onDemand: req.body.onDemand,
      playing: req.body.playing,
      iframe: req.body.iframe,
      trivia: req.body.trivia,
      picture: req.body.picture,
      ebook: req.body.ebook,
      titleColour: req.body.titleColour ? req.body.titleColour : DEFAULT_SETTINGS.titleColour,
      footColour: req.body.footColour ? req.body.footColour : DEFAULT_SETTINGS.footColour,
      bgColour: req.body.bgColour ? req.body.bgColour : DEFAULT_SETTINGS.bgColour,
      enableNS: req.body.enableNS,
      enableOD: req.body.enableOD,
      enableSonarr: req.body.enableSonarr,
      enableRadarr: req.body.enableRadarr,
      enableReadarr: req.body.enableReadarr,
      filterRemote: req.body.filterRemote,
      filterLocal: req.body.filterLocal,
      filterDevices: req.body.filterDevices,
      filterUsers: req.body.filterUsers,
      odHideTitle: req.body.odHideTitle,
      odHideFooter: req.body.odHideFooter,
      enableCustomPictures: req.body.enableCustomPictures,
      enableCustomPictureThemes: req.body.enableCustomPictureThemes,
      customPictureTheme: req.body.customPictureTheme ? req.body.customPictureTheme : DEFAULT_SETTINGS.customPictureTheme,
      customPicFolders: customPicFolders,
      serverID: loadedSettings.serverID,
      updateAvailable: updateAvailable,
      enableSleep: req.body.enableSleep,
      sleepStart: req.body.sleepStart,
      sleepEnd: req.body.sleepEnd,
      triviaTimer: req.body.triviaTimer ? req.body.triviaTimer : DEFAULT_SETTINGS.triviaTimer,
      triviaCategories: req.body.triviaCategories,
      enableTrivia: req.body.enableTrivia,
      triviaNumber: req.body.triviaNumber,
      triviaFrequency: req.body.triviaFrequency,
      enableAwtrix: req.body.enableAwtrix,
      awtrixIP: req.body.awtrixIP,
      enableLinks: req.body.enableLinks,
      links: req.body.links,
      rotate: req.body.rotate,
      excludeLibs: req.body.excludeLibs,
      saved: false
    };

    // 'try' to reset awtrix if previous enabled
    if(isAwtrixEnabled == true){
      // try to reboot
      let now = new Date();
      console.log(now.toLocaleString() + " *Attempting to reset Awtrix if previously running");
      var awt = new awtrix();
      try{
        awt.reboot(awtrixIP);
      }
      catch(ex){
        let now = new Date();
        console.log(now.toLocaleString() + " *Unable to reset Awtrix, you 'may' need to do so manually. " + ex);
        isAwtrixEnabled = false;
      }
    }


    var errors = validationResult(req).array();
    if (errors.length > 0) {
      req.session.errors = errors;
      form.saved = false;
      req.session.success = false;
      res.render("settings", {
        errors: req.session.errors,
        user: { valid: true },
        formData: form,
        version: pjson.version,
        baseUrl: BASEURL,
        customPicFolders: customPicFolders,
        latestVersion: latestVersion,
        message: message
      });
    } else {
      // save settings
      req.session.errors = errors;
      req.session.success = true;
      form.saved = true;
      saveReset(form);
      res.render("settings", {
        errors: req.session.errors,
        version: pjson.version,
        user: { valid: true },
        formData: form,
        baseUrl: BASEURL,
        customPicFolders: customPicFolders,
        latestVersion: latestVersion,
        message: message,
        updateAvailable: updateAvailable
      });
    }
  }
);

// start listening on port 3000
app.listen(PORT, () => {
  console.log(`✅ Web server started on internal port ` + PORT);
});