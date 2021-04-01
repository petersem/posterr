const express = require("express");
const path = require("path");
const app = express();
const pms = require("./classes/mediaservers/plex.js");
const glb = require("./classes/core/globalPage");
const core = require("./classes/core/cache");
const sonr = require("./classes/arr/sonarr");

// TODO - to implement
//const jms = require("./classes/jellyfin.js");
//const ems = require("./classes/emby.js");
//const kms = require("./classes/kodi.js");

// Plex Settings
const plexToken = process.env.PLEXTOKEN || "";
const plexIP = process.env.PLEXIP || "192.168.1.135";
const plexHTTPS = process.env.PLEX_HTTPS || false;
const plexPort = process.env.PLEX_PORT || 32400;

// sonarr settings
const sonarrURL = process.env.SONARR_URL || "http://192.168.1.135:8989";
const sonarrToken = process.env.SONARR_TOKEN || "";
const sonarrCalDays = process.env.SONARR_CAL_DAYS || 175; // how far to look ahead in days (set to a low number if premieres is false)
const sonarrPremieres = process.env.SONARR_PREMIERES || true; // only show season premieres

// radarr settings - not yet implemented
const radarrURL = process.env.RADARR_URL || "http://192.168.1.135:7878";
const radarrToken = process.env.RADARR_TOKEN || "";
const radarrCalDays = process.env.RADARR_CAL_DAYS || 15; // how far to look ahead in days

// general settings
const fade = process.env.FADE || true; // transitions will slide, unless fade is set to true
const slideDuration = process.env.SLIDE_DURATION || 7;  // seconds for slide transition
const refreshPeriod = process.env.REFRESH_PERIOD || 120; // browser refresh period - should be longer than combined (cards x slide_duration)
const playThemes = process.env.PLAY_THEMES || true; // enables theme music where appropriate
const playGenenericThemes = process.env.PLAY_GENERIC_THEMES || true; // will play a random generic themes from 'randomtheme' folder for movies

// on-demand settings
const numberOnDemand = process.env.NUMBER_ON_DEMAND || 2; // how many random on-demand titles to show
const OnDemandRefresh = process.env._ON_DEMAND_REFRESH || 30; // how often, in minutes, to refresh the on-demand titles
const onDemandLibraries = process.env.ON_DEMAND_LIBRARIES || "anime,movies,tv shows"; // libraries to pull on-demand titles from ** only last library is actually working!!!!

console.log("--------------------------------------------------------");
console.log("| POSTER - Your media display                          |");
console.log("| Developed by Matt Petersen - Brisbane Australia      |");
console.log("|                                                      |");
console.log("| *App under development and considered alpha quality  |");
console.log("|                                                      |");
console.log("--------------------------------------------------------");

// clear image and mp3 cache on start-up
core.DeleteMP3Cache();
core.DeleteImageCache();

let odCards = [];
let nsCards = [];
let csCards = [];
let globalPage = new glb();
let nowScreeningClock;
let onDemandClock;
let sonarrClock;
let houseKeepingClock;

async function loadSonarrComingSoon() {
    // stop the clock
    clearInterval(sonarrClock);

  let sonarr = new sonr(sonarrURL, sonarrToken, sonarrPremieres);
  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  later.setDate(later.getDate() + sonarrCalDays);
  let now = today.toISOString().split("T")[0];
  let ltr = later.toISOString().split("T")[0];

  csCards = await sonarr.GetComingSoon(now, ltr, sonarrPremieres);
  sonarrClock = setInterval(loadSonarrComingSoon, 86400000); // daily
  return csCards;
}

async function loadNowScreening() {
    // stop the clock
    clearInterval(nowScreeningClock);

  // load MediaServer(s) (switch statement for different server settings server option - TODO)
  let ms = new pms({ plexHTTPS, plexIP, plexPort, plexToken });

  nsCards = await ms.GetNowScreening(playGenenericThemes);

  // load now showing and on-demand cards, else just on-demand (if present)
  let mCards = [];
  if (nsCards.length > 0) {
    mCards = nsCards.concat(odCards);
    mCards = mCards.concat(csCards);
    globalPage.cards = mCards;
    // console.log("m:" +mCards.length);
  } else {
    if (odCards.length > 0) {
      mCards = odCards.concat(csCards);
      globalPage.cards = mCards;
      // console.log("m:" +mCards.length);
    } else {
      if (csCards.length > 0) {
        globalPage.cards = csCards;
        // console.log("CS:" +csCards.length);
      }
    }
  }

  let fadeTransition = "";
  if (fade) {
    fadeTransition = "carousel-fade";
  }

  await globalPage.OrderAndRenderCards(playGenenericThemes);
  globalPage.refreshPeriod = refreshPeriod * 1000;
  globalPage.slideDuration = slideDuration * 1000;
  globalPage.playThemes = playThemes;
  globalPage.playGenericThemes = playGenenericThemes;
  globalPage.fadeTransition = fadeTransition;

  //console.log('now showing called');
  nowScreeningClock = setInterval(loadNowScreening, 60000); // every minute
  return;
}

async function loadOnDemand() {
  // stop the clock
  clearInterval(onDemandClock);

  // load MediaServer(s) (switch statement for different server settings server option - TODO)
  let ms = new pms({ plexHTTPS, plexIP, plexPort, plexToken });

    odCards = await ms.GetOnDemand(
      onDemandLibraries,
      numberOnDemand,
      playGenenericThemes
    );

  // restart interval timer
  onDemandClock = setInterval(loadOnDemand, (OnDemandRefresh*60000)); 
  return;
}

async function houseKeeping() {
  // stop the clock
  clearInterval(houseKeepingClock);
  // clean cache
  await core.DeleteMP3Cache();
  await core.DeleteImageCache();
  // restart timer
  setInterval(houseKeeping,86400000); // daily
}

async function startup() {
  // initial load of card providers
  await loadSonarrComingSoon();
  await loadOnDemand();
  await loadNowScreening();
  
  let now = new Date();
  console.log(now.toLocaleString() + " Now screening titles refreshed (First run only)");
  console.log(" ");
  console.log("✅ Application ready on http://hostIP:3000");
  console.log(" ");
  
  // set intervals for timers
  nowScreeningClock = setInterval(loadNowScreening, 60000); // every minute
  onDemandClock = setInterval(loadOnDemand, (OnDemandRefresh*60000)); 
  sonarrClock = setInterval(loadSonarrComingSoon, 86400000); // daily
  houseKeepingClock = setInterval(houseKeeping, 86400000); // daily
}

// call all card providers - initial load and set scheduled runs
startup();

//use ejs templating engine
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { globals: globalPage }); // index refers to index.ejs
});

app.get("/health", (req, res) => {
  res.json(app.locals.globals);
});

app.get("/settings", (req, res) => {
  res.json(app.locals.globals);
});

app.listen(3000, () => {
  console.log(
    `✅ Web server started on internal port 3000 
    `
  );
});
