const express = require("express");
const path = require("path");
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { check, validationResult } = require('express-validator');
//const user = require('./routes/user.routes');
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
const plexHTTPS = process.env.PLEX_HTTPS || "false";
const plexPort = process.env.PLEX_PORT || 32400;

// sonarr settings
const sonarrURL = process.env.SONARR_URL || "http://192.168.1.135:8989";
const sonarrToken =
  process.env.SONARR_TOKEN || "";
const sonarrCalDays = process.env.SONARR_CAL_DAYS || 175; // how far to look ahead in days (set to a low number if premieres is false)
const sonarrPremieres = process.env.SONARR_PREMIERES || "true"; // only show season premieres

// radarr settings - not yet implemented
const radarrURL = process.env.RADARR_URL || "http://192.168.1.135:7878";
const radarrToken = process.env.RADARR_TOKEN || "";
const radarrCalDays = process.env.RADARR_CAL_DAYS || 15; // how far to look ahead in days

// general settings
const fade = process.env.FADE || "true"; // transitions will slide, unless fade is set to true
const slideDuration = process.env.SLIDE_DURATION || 7; // seconds for slide transition
const refreshPeriod = process.env.REFRESH_PERIOD || 120; // browser refresh period - should be longer than combined (cards x slide_duration)
const playThemes = process.env.PLAY_THEMES || "true"; // enables theme music where appropriate
const playGenenericThemes = process.env.PLAY_GENERIC_THEMES || "true"; // will play a random generic themes from 'randomtheme' folder for movies

// on-demand settings
const numberOnDemand = process.env.NUMBER_ON_DEMAND || 2; // how many random on-demand titles to show
const OnDemandRefresh = process.env._ON_DEMAND_REFRESH || 30; // how often, in minutes, to refresh the on-demand titles
const onDemandLibraries =
  process.env.ON_DEMAND_LIBRARIES || "anime,movies,tv shows"; // libraries to pull on-demand titles from ** only last library is actually working!!!!

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

// global variables
let odCards = [];
let nsCards = [];
let csCards = [];
let globalPage = new glb();
let nowScreeningClock;
let onDemandClock;
let sonarrClock;
let houseKeepingClock;

/**
 * @desc Wrapper function to call Sonarr coming soon.
 * @returns {Promise<object>} mediaCards array - coming soon
 */
async function loadSonarrComingSoon() {
  // stop the clock
  clearInterval(sonarrClock);

  // instatntiate sonarr class
  let sonarr = new sonr(sonarrURL, sonarrToken, sonarrPremieres);
  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  //console.log(today.toISOString().split("T")[0]);
  later.setDate(later.getDate() + sonarrCalDays);
  //console.log(later.toISOString().split("T")[0]);
  let now = today.toISOString().split("T")[0];
  let ltr = later.toISOString().split("T")[0];

  // call sonarr coming soon
  csCards = await sonarr.GetComingSoon(now, ltr, sonarrPremieres);

  // restart the 24 hour timer
  sonarrClock = setInterval(loadSonarrComingSoon, 86400000); // daily

  return csCards;
}

/**
 * @desc Wrapper function to call now screening method.
 * @returns {Promise<object>} mediaCards array - results of now screening search
 */
async function loadNowScreening() {
  // stop the clock
  clearInterval(nowScreeningClock);

  // load MediaServer(s) (switch statement for different server settings server option - TODO)
  let ms = new pms({ plexHTTPS, plexIP, plexPort, plexToken });

  // call now screening method
  nsCards = await ms.GetNowScreening(playGenenericThemes);

  // Concatenate cards for all objects load now showing and on-demand cards, else just on-demand (if present)
  // TODO - move this into its own function!
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

  // setup transition - fade or default slide
  let fadeTransition = "";
  if (fade) {
    fadeTransition = "carousel-fade";
  }

  // put everything into global class, ready to be passed to poster.ejs
  // render html for all cards
  await globalPage.OrderAndRenderCards(playGenenericThemes);
  globalPage.refreshPeriod = refreshPeriod * 1000;
  globalPage.slideDuration = slideDuration * 1000;
  globalPage.playThemes = playThemes;
  globalPage.playGenericThemes = playGenenericThemes;
  globalPage.fadeTransition = fadeTransition;

  // restart the clock
  nowScreeningClock = setInterval(loadNowScreening, 60000); // every minute
  return nsCards;
}

   /**
   * @desc Wrapper function to call on-demand method
   * @returns {Promise<object>} mediaCards array - results of on-demand search
   */
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
  onDemandClock = setInterval(loadOnDemand, OnDemandRefresh * 60000);
  
  return odCards;
}

/**
 * @desc Cleans up image and MP3 cache directories
 * @returns nothing
 */
async function houseKeeping() {
  // stop the clock
  clearInterval(houseKeepingClock);
  // clean cache
  await core.DeleteMP3Cache();
  await core.DeleteImageCache();
  // restart timer
  setInterval(houseKeeping, 86400000); // daily
}

/**
 * @desc Starts everything - calls coming soon 'tv', on-demand and now screening functions. Then initialises timers
 * @returns nothing
 */
async function startup() {
  // initial load of card providers
  await loadSonarrComingSoon();
  await loadOnDemand();
  await loadNowScreening();

  let now = new Date();
  console.log(
    now.toLocaleString() + " Now screening titles refreshed (First run only)"
  );
  console.log(" ");
  console.log("✅ Application ready on http://hostIP:3000");
  console.log(" ");

  // set intervals for timers
  nowScreeningClock = setInterval(loadNowScreening, 60000); // every minute
  onDemandClock = setInterval(loadOnDemand, OnDemandRefresh * 60000);
  sonarrClock = setInterval(loadSonarrComingSoon, 86400000); // daily
  houseKeepingClock = setInterval(houseKeeping, 86400000); // daily

  return;
}

// call all card providers - initial card loads and sets scheduled runs
startup();

//use ejs templating engine
app.set("view engine", "ejs");

// Express settings
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));
app.use(cors());

app.use(cookieParser());
app.use(session({
    secret: 'positronx',
    saveUninitialized: false,
    resave: false
}));

// sets public folder for assets
app.use(express.static(path.join(__dirname, "public")));

// set routes
app.get("/", (req, res) => {
  res.render("index", { globals: globalPage }); // index refers to index.ejs
});

// health check - TODO
app.get("/health", (req, res) => {
  res.json(app.locals.globals);
});

// settings page TODO
app.get("/settings", (req, res) => {
  res.render('settings', {
    success: req.session.success,
    errors: req.session.errors
});
req.session.errors = null;
});

app.post('/save',
    [
        check('slideDuration')
            .not()
            .isEmpty()
            .withMessage('Slide duration is required')
        // check('email', 'Email is required')
        //     .isEmail(),
        // check('password', 'Password is requried')
        //     .isLength({ min: 1 })
        //     .custom((val, { req, loc, path }) => {
        //         if (val !== req.body.confirm_password) {
        //             throw new Error("Passwords don't match");
        //         } else {
        //             return value;
        //         }
        //     }),
    ], (req, res) => {
        var errors = validationResult(req).array();
        if (errors) {
            req.session.errors = errors;
            req.session.success = false;
            res.redirect('/settings');
            
        } else {
            req.session.success = true;
            // TODO Now go and save the data and reload forms
            res.redirect('/settings');
        }
    });

// start listening on port 3000
app.listen(3000, () => {
  console.log(
    `✅ Web server started on internal port 3000 
    `
  );
});

