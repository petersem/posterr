const express = require("express");
const path = require("path");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { check, validationResult } = require("express-validator");
//const user = require('./routes/user.routes');
const pms = require("./classes/mediaservers/plex");
const glb = require("./classes/core/globalPage");
const core = require("./classes/core/cache");
const sonr = require("./classes/arr/sonarr");
const radr = require("./classes/arr/radarr");
const settings = require("./classes/core/settings");
const MemoryStore = require("memorystore")(session);
const util = require("./classes/core/utility");
const DEFAULT_SETTINGS = require("./consts");
const health = require("./classes/core/health");
const pjson = require("./package.json");
const MAX_OD_SLIDES=150;  // this is with themes. Will be double this if tv and movie themes are off

// just in case someone puts in a / for the basepath value
if(process.env.BASEPATH=="/") process.env.BASEPATH="";
const BASEURL = process.env.BASEPATH || "";



console.log("-------------------------------------------------------");
console.log(" POSTERR - Your media display");
console.log(" Developed by Matt Petersen - Brisbane Australia");
console.log(" ");
console.log(" Version: " + pjson.version);
console.log(" ");
console.log("-------------------------------------------------------");

// global variables
let odCards = [];
let nsCards = [];
let csCards = [];
let csrCards = [];
let globalPage = new glb();
let nowScreeningClock;
let onDemandClock;
let sonarrClock;
let radarrClock;
let houseKeepingClock;
let setng = new settings();
let loadedSettings;
let nsCheckSeconds = 10000; // how often now screening checks are performed. (not available in setup screen as running too often can cause network issues)
let isSonarrEnabled = false;
let isRadarrEnabled = false;
let isOnDemandEnabled = false;
let isPlexEnabled = false;
let isPlexUnavailable = false;
let isSonarrUnavailable = false;
let isRadarrUnavailable = false;
let cold_start_time = new Date();

// create working folders if they do not exist
// needed for package binaries
var fs = require('fs');
const { CardTypeEnum } = require("./classes/cards/CardType");
const { titleColour } = require("./consts");
var dir = './config';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

var dir = './saved';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
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
 * @desc Wrapper function to call now screening method.
 * @returns {Promise<object>} mediaCards array - results of now screening search
 */
async function loadNowScreening() {
  // stop the clock
  clearInterval(nowScreeningClock);

  // stop timers dont run if disabled
  if (!isPlexEnabled ) {
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
      loadedSettings.filterUsers
    );
    // restore defaults if plex now available after an error
    if (isPlexUnavailable) {
      console.log("✅ Plex connection restored - defualt poll timers restored");
      isPlexUnavailable = false;
    }
  } catch (err) {
    let now = new Date();
    console.log(now.toLocaleString() + " *Now Scrn. - Get full data: " + err);
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
  // id now screening false, then clear array
  if(!isNowShowingEnabled){nsCards.length=0};
  
  if (nsCards.length > 0) {
    if(loadedSettings.pinNS !== "true"){
      if(loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides=="true"){
        mCards = nsCards.concat(odCards.concat(csCards.concat(csrCards)).sort(() => Math.random() - 0.5));
      }
      else {
        mCards = nsCards.concat(odCards);
        mCards = mCards.concat(csCards);
        mCards = mCards.concat(csrCards);
      }
    }
    else{
      mCards = nsCards;
    }
    globalPage.cards = mCards;
  } else {
    if (odCards.length > 0) {
      if(loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides=="true"){
        mCards = odCards.concat(csCards.concat(csrCards)).sort(() => Math.random() - 0.5);
      }
      else{
        mCards = odCards.concat(csCards);
        mCards = mCards.concat(csrCards);
      }
      globalPage.cards = mCards;
    } else {
      if (csCards.length > 0) {
        mCards = csCards.concat(csrCards);
        globalPage.cards = mCards;
        // console.log("CS:" +csCards.length);
      } else {
        if (csrCards.length > 0) {
          globalPage.cards = csrCards;
          // console.log("CSR:" +csrCards.length);
        }
      }
    }
  }

  // setup transition - fade or default slide
  let fadeTransition = "";
  if (loadedSettings.fade) {
    fadeTransition = "carousel-fade";
  }

  // put everything into global class, ready to be passed to poster.ejs
  // render html for all cards
  await globalPage.OrderAndRenderCards(BASEURL,loadedSettings.hasArt,loadedSettings.odHideTitle,loadedSettings.odHideFooter);
  globalPage.slideDuration = loadedSettings.slideDuration * 1000;
  globalPage.playThemes = loadedSettings.playThemes;
  globalPage.playGenericThemes = loadedSettings.genericThemes;
  globalPage.fadeTransition =
  loadedSettings.fade == "true" ? "carousel-fade" : "";
  globalPage.custBrand = loadedSettings.custBrand;
  globalPage.titleColour = loadedSettings.titleColour;
  globalPage.footColour = loadedSettings.footColour;
  globalPage.bgColour = loadedSettings.bgColour;


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
      loadedSettings.genres
    );
  } catch (err) {
    let d = new Date();
    console.log(d.toLocaleString() + " *On-demand - Get full data: " + err);
  }

  // restart interval timer
  onDemandClock = setInterval(loadOnDemand, odCheckMinutes * 60000);

  // randomise on-demand results for all libraries queried
  if(loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides=="true"){
    return odCards.sort(() => Math.random() - 0.5);
  }
  else{
    return odCards;
  }
  
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

  // check now showing
  if (
    loadedSettings.enableNS !== 'false'
  ) {
    isNowShowingEnabled = true;
  }

  // check Plex
  if (
    loadedSettings.plexIP !== undefined &&
    loadedSettings.plexToken !== undefined &&
    loadedSettings.plexPort !== undefined
  ) {
    isPlexEnabled = true;
  }
  // check on-demand
  if (loadedSettings.onDemandLibraries !== undefined && 
    isPlexEnabled && 
    loadedSettings.numberOnDemand !== undefined && 
    loadedSettings.numberOnDemand !== 0 &&
    loadedSettings.enableOD !== 'false'
  ) {
    isOnDemandEnabled = true;
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
  // check Radarr
  if (
    loadedSettings.radarrURL !== undefined &&
    loadedSettings.radarrCalDays !== undefined &&
    loadedSettings.radarrToken !== undefined &&
    loadedSettings.enableRadarr !== 'false'
  ) {
    isRadarrEnabled = true;
  }

  // display status
  console.log(
    `--- Enabled Status ---
   Plex: ` +
      isPlexEnabled +
      `
   Now Showing: ` +
      isNowShowingEnabled +
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
   `
  );

  return;
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

  odCards = [];
  nsCards = [];
  csCards = [];
  csrCards = [];

  // run housekeeping job 
  if (clearCache !== false) await houseKeeping();

  // load settings object
  loadedSettings = await Promise.resolve(await loadSettings());
  if(loadedSettings == 'undefined'){ 
    console.load('settings not loaded!!');
  }
  else{
    console.log(`✅ Settings loaded
  `);

  // restart timer for houseKeeping
  setInterval(houseKeeping, 86400000); // daily
}

  // check status
  await checkEnabled();

  // set custom titles if available
  CardTypeEnum.NowScreening[1] = loadedSettings.nowScreening !== undefined ? loadedSettings.nowScreening : ""
  CardTypeEnum.OnDemand[1] = loadedSettings.onDemand !== undefined ? loadedSettings.onDemand : ""
  CardTypeEnum.ComingSoon[1] = loadedSettings.comingSoon !== undefined ? loadedSettings.comingSoon : ""
  CardTypeEnum.IFrame[1] = loadedSettings.iframe !== undefined ? loadedSettings.iframe : "";
  CardTypeEnum.Playing[1] = loadedSettings.playing !== undefined ? loadedSettings.playing : "";
  CardTypeEnum.Picture[1] = loadedSettings.picture !== undefined ? loadedSettings.picture : "";

  // initial load of card providers
  if (isSonarrEnabled) await loadSonarrComingSoon();
  if (isRadarrEnabled) await loadRadarrComingSoon();
  if (isOnDemandEnabled) await loadOnDemand();
  await loadNowScreening();

  // let now = new Date();
  // console.log(
  //   now.toLocaleString() + " Now screening titles refreshed (First run only)"
  // );
  console.log(" ");
  console.log(`✅ Application ready on http://hostIP:3000`+BASEURL +`
   Goto http://hostIP:3000`+BASEURL+`/settings to get to setup page.
  `);
  cold_start_time = new Date();
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
  clearInterval(houseKeepingClock);
  console.log(
    "✘✘ WARNING ✘✘ - Restarting. Please wait while current jobs complete"
  );
  // clear old cards
  globalPage.cards = [];
  // dont clear cached files if restarting after settings saved
  startup(false);
}

// call all card providers - initial card loads and sets scheduled runs
startup(true);

//use ejs templating engine
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, '/myviews'));


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
if(BASEURL == ""){
//  console.log(__dirname);
//  console.log(process.cwd());
  app.use(express.static(path.join(__dirname, "public")));  
  app.use(express.static(path.join(process.cwd(), "saved")));
}
else{
  app.use(BASEURL, express.static(__dirname + '/public'));
  app.use(BASEURL, express.static(process.cwd() + '/saved'));
}


// set routes
app.get(BASEURL + "/", (req, res) => {
  res.render("index", { globals: globalPage, hasConfig: setng.GetChanged(), baseUrl: BASEURL, custBrand: globalPage.custBrand }); // index refers to index.ejs
});

app.get(BASEURL + "/getcards", (req, res) => {
  res.send({ globalPage: globalPage, baseUrl: BASEURL}); // get generated cards
});

// Used by the web client to check connection status to Posterr, and also to determine if there was a cold start that was missed
app.get(BASEURL + "/conncheck", (req, res) => {
  res.send({ status: cold_start_time}); 
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
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL}); 
});

app.get(BASEURL + "/debug/plexns", (req, res) => {
  console.log(' ');
  console.log("** PLEX 'NOW SCREENING' CHECK **");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.PlexNSCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL}); 
});

app.get(BASEURL + "/debug/plexod", (req, res) => {
  console.log(' ');
  console.log("** PLEX 'ON-DEMAND' CHECK **");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.PlexODCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL}); 
});

app.get(BASEURL + "/debug/sonarr", (req, res) => {
  console.log(' ');
  console.log("** SONARR CHECK ** (titles in next 5 days)");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.SonarrCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL}); 
});

app.get(BASEURL + "/debug/radarr", (req, res) => {
  console.log(' ');
  console.log("** RADARR CHECK ** (Any releases in next 30 days)");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.RadarrCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version, baseUrl: BASEURL}); 
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
        baseUrl: BASEURL
      });
    } else {
      res.render("settings", {
        user: userData,
        success: req.session.success,
        settings: loadedSettings,
        version: pjson.version, 
        baseUrl: BASEURL
      });
    }
  }
);

// settings page
app.get(BASEURL + "/settings", (req, res) => {
  if (loadedSettings.password == undefined) {
    res.render("settings", {
      success: req.session.success,
      user: { valid: true },
      settings: loadedSettings,
      errors: req.session.errors,
      version: pjson.version, 
      baseUrl: BASEURL
    });
  }
  else{
    res.render("settings", {
    success: req.session.success,
    user: { valid: false },
    settings: loadedSettings,
    errors: req.session.errors,
    version: pjson.version, 
    baseUrl: BASEURL
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
      .withMessage("'Slide Duration' is required and must be 5 or more"),
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

          if(req.body.themeSwitch==undefined && req.body.genericSwitch==undefined){
            maxSlides = maxSlides * 2;
            themeMessage = "";
          }
          else{
            maxSlide = MAX_OD_SLIDES;
            themeMessage ="(when themes enabled)";
          }

          if (req.body.plexLibraries !== undefined || req.body.plexLibraries !== ""){
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
      plexToken: req.body.plexToken,
      plexIP: req.body.plexIP,
      plexHTTPSSwitch: req.body.plexHTTPSSwitch,
      plexPort: req.body.plexPort ? parseInt(req.body.plexPort) : DEFAULT_SETTINGS.plexPort,
      plexLibraries: req.body.plexLibraries,
      pinNSSwitch: req.body.pinNSSwitch,
      numberOnDemand: !isNaN(parseInt(req.body.numberOnDemand)) ? parseInt(req.body.numberOnDemand) : DEFAULT_SETTINGS.numberOnDemand,
      onDemandRefresh: parseInt(req.body.onDemandRefresh) ? parseInt(req.body.onDemandRefresh) : DEFAULT_SETTINGS.onDemandRefresh,
      genres: req.body.genres,
      sonarrUrl: req.body.sonarrUrl,
      sonarrToken: req.body.sonarrToken,
      sonarrDays: req.body.sonarrDays ? parseInt(req.body.sonarrDays) : DEFAULT_SETTINGS.sonarrCalDays,
      premiereSwitch: req.body.premiereSwitch,
      radarrUrl: req.body.radarrUrl,
      radarrToken: req.body.radarrToken,
      radarrDays: req.body.radarrDays ? parseInt(req.body.radarrDays) : DEFAULT_SETTINGS.radarrCalDays,
      titleFont: req.body.titleFont,
      nowScreening: req.body.nowScreening,
      comingSoon: req.body.comingSoon,
      onDemand: req.body.onDemand,
      playing: req.body.playing,
      iframe: req.body.iframe,
      picture: req.body.picture,
      titleColour: req.body.titleColour ? req.body.titleColour : DEFAULT_SETTINGS.titleColour,
      footColour: req.body.footColour ? req.body.footColour : DEFAULT_SETTINGS.footColour,
      bgColour: req.body.bgColour ? req.body.bgColour : DEFAULT_SETTINGS.bgColour,
      enableNS: req.body.enableNS,
      enableOD: req.body.enableOD,
      enableSonarr: req.body.enableSonarr,
      enableRadarr: req.body.enableRadarr,
      filterRemote: req.body.filterRemote,
      filterLocal: req.body.filterLocal,
      filterDevices: req.body.filterDevices,      
      filterUsers: req.body.filterUsers,
      odHideTitle: req.body.odHideTitle,
      odHideFooter: req.body.odHideFooter,
      saved: false
    };
   
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
        baseUrl: BASEURL
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
        baseUrl: BASEURL
      });
    }
  }
);

// start listening on port 3000
app.listen(3000, () => {
  console.log(`✅ Web server started on internal port 3000 `);
});
