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
var MemoryStore = require('memorystore')(session);
const DEFAULT_SETTINGS = require('./consts');
const health = require("./classes/core/health");

console.log("-------------------------------------------------------");
console.log(" POSTERR - Your media display");
console.log(" Developed by Matt Petersen - Brisbane Australia");
console.log(" ");
console.log(" *App under development and considered alpha quality");
console.log(" Version: " + process.env.npm_package_version);
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
let version = {
  "versionLabel": "Alpha",
  "version": process.env.npm_package_version
};

/**
 * @desc Wrapper function to call Radarr coming soon.
 * @returns {Promise<object>} mediaCards array - coming soon
 */
 async function loadRadarrComingSoon() {
  // stop the clock
  clearInterval(radarrClock);

  // stop timers and dont run if disabled
  if(!isRadarrEnabled) {
    return csrCards;
  } 
  
  // instatntiate radarr class
  let radarr = new radr(
    loadedSettings.radarrURL,
    loadedSettings.radarrToken,
    loadedSettings.radarrPremieres
  );
  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  later.setDate(later.getDate() + loadedSettings.radarrCalDays);
  let now = today.toISOString().split("T")[0];
  let ltr = later.toISOString().split("T")[0];

  // call sonarr coming soon
  csrCards = await radarr.GetComingSoon(
    now,
    ltr,
    loadedSettings.genericThemes
  );

  // restart the 24 hour timer
  radarrClock = setInterval(loadRadarrComingSoon, 86400000); // daily

  return csrCards;
}

/**
 * @desc Wrapper function to call Sonarr coming soon.
 * @returns {Promise<object>} mediaCards array - coming soon
 */
async function loadSonarrComingSoon() {
  // stop the clock
  clearInterval(sonarrClock);

  // stop timers and dont run if disabled
  if(!isSonarrEnabled) {
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
  csCards = await sonarr.GetComingSoon(
    now,
    ltr,
    loadedSettings.sonarrPremieres,
    loadedSettings.playThemes
  );

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

  // stop timers dont run if disabled
  if(!isPlexEnabled) {
    // restart the clock
    return nsCards;
  } 

  // load MediaServer(s) (switch statement for different server settings server option - TODO)
  let ms = new pms({
    plexHTTPS: loadedSettings.plexHTTPS,
    plexIP: loadedSettings.plexIP,
    plexPort: loadedSettings.plexPort,
    plexToken: loadedSettings.plexToken,
  });

  // call now screening method
  try{
    nsCards = await ms.GetNowScreening(loadedSettings.playThemes, loadedSettings.genericThemes);
  }
  catch(err){
    console.log(err.message);
  }
  // Concatenate cards for all objects load now showing and on-demand cards, else just on-demand (if present)
  // TODO - move this into its own function!
  let mCards = [];
  if (nsCards.length > 0) {
    mCards = nsCards.concat(odCards);
    mCards = mCards.concat(csCards);
    mCards = mCards.concat(csrCards);
    globalPage.cards = mCards;
  } else {
    if (odCards.length > 0) {
      mCards = odCards.concat(csCards);
      mCards = mCards.concat(csrCards);
      globalPage.cards = mCards;
    } else {
      if (csCards.length > 0) {
        mCards = csCards.concat(csrCards);
        globalPage.cards = mCards;
        // console.log("CS:" +csCards.length);
      }
      else {
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
  await globalPage.OrderAndRenderCards(loadedSettings.hasArt);
  globalPage.refreshPeriod = loadedSettings.refreshPeriod * 1000;
  globalPage.slideDuration = loadedSettings.slideDuration * 1000;
  globalPage.playThemes = loadedSettings.playThemes;
  globalPage.playGenericThemes = loadedSettings.genericThemes;
  globalPage.fadeTransition = (loadedSettings.fade=="true") ? "carousel-fade" : "";

  // restart the clock
  nowScreeningClock = setInterval(loadNowScreening, nsCheckSeconds);
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
  if(!isOnDemandEnabled) {
    return odCards;
  } 

  // load MediaServer(s) (switch statement for different server settings server option - TODO)
  let ms = new pms({
    plexHTTPS: loadedSettings.plexHTTPS,
    plexIP: loadedSettings.plexIP,
    plexPort: loadedSettings.plexPort,
    plexToken: loadedSettings.plexToken,
  });

  odCards = await ms.GetOnDemand(
    loadedSettings.onDemandLibraries,
    loadedSettings.numberOnDemand,
    loadedSettings.playThemes,
    loadedSettings.genericThemes
  );

  // restart interval timer
  onDemandClock = setInterval(
    loadOnDemand,
    loadedSettings.onDemandRefresh * 60000
  );

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
 * @desc Loads all poster settings
 * @returns {object} json - settings details
 */
async function loadSettings() {
  const ls = await setng.GetSettings();
  return ls;
}

/**
 * @desc check if Now Screening/Playing, On-Demand, Sonarr or Radarr options are empty/disabled
 * @returns nothing
 */
async function checkEnabled(){
  // reset all enabled variables
  isOnDemandEnabled = false;
  isPlexEnabled = false;
  isSonarrEnabled = false;
  isRadarrEnabled = false;

  // check Plex
  if(loadedSettings.plexIP !== undefined && loadedSettings.plexToken !== undefined && loadedSettings.plexPort !== undefined) { isPlexEnabled = true;}
  // check on-demand
  if((loadedSettings.onDemandLibraries !== undefined) && isPlexEnabled) { isOnDemandEnabled = true;}
  // check Sonarr
  if(loadedSettings.sonarrURL !== undefined && loadedSettings.sonarrCalDays !== undefined && loadedSettings.sonarrToken !== undefined) { isSonarrEnabled = true;}
  // check Radarr
  if(loadedSettings.radarrURL !== undefined && loadedSettings.radarrCalDays !== undefined && loadedSettings.radarrToken !== undefined) { isRadarrEnabled = true;}
  
  // display status
  let now = new Date();
  console.log(`--- Enabled Status ---
   Plex: ` + isPlexEnabled + `
   On-demand: ` + isOnDemandEnabled + `
   Sonarr: ` + isSonarrEnabled + `
   Radarr: ` + isRadarrEnabled + `
   `);
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

  // run housekeeping job - but not on settings save
  if(clearCache !== false) await houseKeeping();

  // load settings object
  loadedSettings = await loadSettings();
  // check status 
  await checkEnabled();

  // initial load of card providers
  if(isSonarrEnabled) await loadSonarrComingSoon();
  if(isRadarrEnabled) await loadRadarrComingSoon();
  if(isOnDemandEnabled) await loadOnDemand();
  await loadNowScreening();

  let now = new Date();
  console.log(
    now.toLocaleString() + " Now screening titles refreshed (First run only)"
  );
  console.log(" ");
  console.log(`✅ Application ready on http://hostIP:3000
   Goto http://hostIP:3000/settings to get to setup page.
  `);

  return;
}

/**
 * @desc Saves settings and calls startup
 * @returns nothing
 */
async function saveReset(formObject) {
  await setng.SaveSettingsJSON(formObject);
  // cancel all clocks, then pause 5 seconds to ensure downloads finished
  clearInterval(nowScreeningClock);
  clearInterval(onDemandClock);
  clearInterval(sonarrClock);
  clearInterval(radarrClock);
  clearInterval(houseKeepingClock);
  console.log('Restarting. Please wait while current jobs complete');
  // clear old cards
  globalPage.cards=[];
  // dont clear cached files if restarting after settings saved
  startup(false);
}

/**
 * @desc Checks system connectivity and settings
 * @returns nothing
 */
function healthCheck() {
  test = new health(loadedSettings);
  test.TestAll();

  return;
}

// call all card providers - initial card loads and sets scheduled runs
startup();

//use ejs templating engine
app.set("view engine", "ejs");

// Express settings
app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  })
);
app.use(cors());

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(
  session({
    cookie:{
    secure: true,
    maxAge:3000000
       },
    // store: cookieParser,
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: "xyzzy",
    saveUninitialized: true,
    resave: false,
  })
);

// sets public folder for assets
app.use(express.static(path.join(__dirname, "public")));

// set routes
app.get("/", (req, res) => {
  res.render("index", { globals: globalPage, hasConfig: setng.GetChanged() }); // index refers to index.ejs
});

// password for settings section
let userData = { valid: false, expires: 10 };

// settings page
app.get("/logon", (req, res) => {
  res.render("logon", {
    success: req.session.success,
  });
  req.session.errors = null;
});

app.post(
  "/logon",
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
      });
    } else {
      res.render("settings", {
        user: userData,
        success: req.session.success,
        settings: loadedSettings,
        version: version
      });
      }
  }
);

// settings page 
app.get("/settings", (req, res) => {
  res.render("settings", {
    success: req.session.success,
    user: {valid: false},
    settings: loadedSettings,
    errors: req.session.errors,
    version: version
  });
  req.session.errors = null;
});

app.post(
  "/settings",
  [
    check("password")
      .not()
      .isEmpty()
      .withMessage("Password cannot be blank"),
    check("slideDuration")
      .not()
      .isEmpty()
      .custom((value) => {
        if (parseInt(value) === "NaN") {
          throw new Error('Slide duration must be a number');
        }
        // Indicates the success of this synchronous custom validator
        return true;
      })
      .withMessage("Slide Duration is required"),
    check("refreshPeriod")
      .not()
      .isEmpty()
      .custom((value) => {
        if (parseInt(value) === "NaN") {
          throw new Error('Refresh period must be a number');
        }
        // Indicates the success of this synchronous custom validator
        return true;
      })
      .withMessage("Refresh Period is required"),
    check("plexIP")
      .not()
      .isEmpty()
      .withMessage("Plex IP is required"),
    check("plexPort")
      .not()
      .isEmpty()
      .custom((value) => {
        if (parseInt(value) === "NaN") {
          throw new Error('Plex Port must be a number');
        }
        // Indicates the success of this synchronous custom validator
        return true;
      })
      .withMessage("Plex Port number is required"),
    check("plexToken")
      .not()
      .isEmpty()
      .withMessage("Plex token is required"),
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
  ],
  (req, res) => {
      //fields value holder. Also sets default values in form passed without them.
      let form = {
        password: req.body.password,
        slideDuration: req.body.slideDuration ? parseInt(req.body.slideDuration) : DEFAULT_SETTINGS.slideDuration,
        refreshPeriod: req.body.refreshPeriod ? parseInt(req.body.refreshPeriod) : DEFAULT_SETTINGS.refreshPeriod,
        artSwitch: req.body.artSwitch,
        themeSwitch: req.body.themeSwitch,
        genericSwitch: req.body.genericSwitch,
        fadeOption: req.body.fadeOption,
        plexToken: req.body.plexToken,
        plexIP: req.body.plexIP,
        plexHTTPSSwitch: req.body.plexHTTPSSwitch,
        plexPort: req.body.plexPort ? parseInt(req.body.plexPort) : DEFAULT_SETTINGS.plexPort,
        plexLibraries: req.body.plexLibraries,
        numberOnDemand: (!isNaN(parseInt(req.body.numberOnDemand))) ? parseInt(req.body.numberOnDemand) : DEFAULT_SETTINGS.numberOnDemand,
        onDemandRefresh: parseInt(req.body.onDemandRefresh) ? parseInt(req.body.onDemandRefresh) : DEFAULT_SETTINGS.onDemandRefresh,
        sonarrUrl: req.body.sonarrUrl,
        sonarrToken: req.body.sonarrToken,
        sonarrDays: req.body.sonarrDays ? parseInt(req.body.sonarrDays) : DEFAULT_SETTINGS.sonarrCalDays,
        premiereSwitch: req.body.premiereSwitch,
        radarrUrl: req.body.radarrUrl,
        radarrToken: req.body.radarrToken,
        radarrDays: req.body.radarrDays ? parseInt(req.body.radarrDays) : DEFAULT_SETTINGS.radarrCalDays,
        saved: false
      };

    var errors = validationResult(req).array();
    if (errors.length > 0) {
      req.session.errors = errors;
      form.saved= false;
      req.session.success = false;
      res.render("settings", {
        errors: req.session.errors,
        user: {valid: true},
        formData: form,
        version: version
      });
    } else {
      // save settings
      req.session.errors = errors;
      req.session.success = true;
      form.saved = true;
      saveReset(form);
      res.render("settings", {
        errors: req.session.errors,
        version: version,
        user: {valid: true},
        formData: form
      });
    }
  }
);

// start listening on port 3000
app.listen(3000, () => {
  console.log(
    `✅ Web server started on internal port 3000 `
  );
});
