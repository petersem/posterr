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

console.log("-------------------------------------------------------");
console.log(" POSTERR - Your media display");
console.log(" Developed by Matt Petersen - Brisbane Australia");
console.log(" ");
console.log(" Version: " + pjson.version);
console.log(" ");
// console.log(" BBBB   EEEEE  TTTTT    A      !!");
// console.log(" B   B  E        T     A A     !!");
// console.log(" BBBB   EEEEE    T    A   A    !!");
// console.log(" B   B  E        T   AAAAAAA   ");
// console.log(" BBBB   EEEEE    T  A       A  !!");
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
  if (!isPlexEnabled) {
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
      loadedSettings.hasArt
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
  if (nsCards.length > 0) {
    if(loadedSettings.shuffleSlides !== undefined && loadedSettings.shuffleSlides=="true"){
      mCards = nsCards.concat(odCards.concat(csCards.concat(csrCards)).sort(() => Math.random() - 0.5));
    }
    else {
      mCards = nsCards.concat(odCards);
      mCards = mCards.concat(csCards);
      mCards = mCards.concat(csrCards);
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
  await globalPage.OrderAndRenderCards(loadedSettings.hasArt);
  globalPage.slideDuration = loadedSettings.slideDuration * 1000;
  globalPage.playThemes = loadedSettings.playThemes;
  globalPage.playGenericThemes = loadedSettings.genericThemes;
  globalPage.fadeTransition =
    loadedSettings.fade == "true" ? "carousel-fade" : "";

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
      loadedSettings.hasArt
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

/**
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

  // check Plex
  if (
    loadedSettings.plexIP !== undefined &&
    loadedSettings.plexToken !== undefined &&
    loadedSettings.plexPort !== undefined
  ) {
    isPlexEnabled = true;
  }
  // check on-demand
  if (loadedSettings.onDemandLibraries !== undefined && isPlexEnabled && loadedSettings.numberOnDemand !== undefined && loadedSettings.numberOnDemand !== 0 ) {
    isOnDemandEnabled = true;
  }
  // check Sonarr
  if (
    loadedSettings.sonarrURL !== undefined &&
    loadedSettings.sonarrCalDays !== undefined &&
    loadedSettings.sonarrToken !== undefined
  ) {
    isSonarrEnabled = true;
  }
  // check Radarr
  if (
    loadedSettings.radarrURL !== undefined &&
    loadedSettings.radarrCalDays !== undefined &&
    loadedSettings.radarrToken !== undefined
  ) {
    isRadarrEnabled = true;
  }

  // display status
  console.log(
    `--- Enabled Status ---
   Plex: ` +
      isPlexEnabled +
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
  console.log(`✅ Application ready on http://hostIP:3000
   Goto http://hostIP:3000/settings to get to setup page.
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
app.use(express.static(path.join(__dirname, "public")));

// set routes
app.get("/", (req, res) => {
  res.render("index", { globals: globalPage, hasConfig: setng.GetChanged() }); // index refers to index.ejs
});

app.get("/getcards", (req, res) => {
  res.send({ globalPage: globalPage}); // get generated cards
});

// Used by the web client to check connection status to Posterr, and also to determine if there was a cold start that was missed
app.get("/conncheck", (req, res) => {
  res.send({ status: cold_start_time}); 
});


app.get("/debug", (req, res) => {
  res.render("debug", { settings: loadedSettings, version: pjson.version }); 
});

app.get("/debug/ping", (req, res) => {
  console.log(' ');
  console.log('** PING TESTS **');
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.TestPing();
  res.render("debug", { settings: loadedSettings, version: pjson.version}); 
});

app.get("/debug/plexns", (req, res) => {
  console.log(' ');
  console.log("** PLEX 'NOW SCREENING' CHECK **");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.PlexNSCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version}); 
});

app.get("/debug/plexod", (req, res) => {
  console.log(' ');
  console.log("** PLEX 'ON-DEMAND' CHECK **");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.PlexODCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version}); 
});

app.get("/debug/sonarr", (req, res) => {
  console.log(' ');
  console.log("** SONARR CHECK ** (titles in next 5 days)");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.SonarrCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version}); 
});

app.get("/debug/radarr", (req, res) => {
  console.log(' ');
  console.log("** RADARR CHECK ** (Any releases in next 30 days)");
  console.log('-------------------------------------------------------');
  let test = new health(loadedSettings);
  test.RadarrCheck();
  res.render("debug", { settings: loadedSettings, version: pjson.version}); 
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
        version: pjson.version
      });
    }
  }
);

// settings page
app.get("/settings", (req, res) => {
  res.render("settings", {
    success: req.session.success,
    user: { valid: false },
    settings: loadedSettings,
    errors: req.session.errors,
    version: pjson.version
  });
  req.session.errors = null;
});

app.post(
  "/settings",
  [
    check("password").not().isEmpty().withMessage("Password cannot be blank"),
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
      numberOnDemand: !isNaN(parseInt(req.body.numberOnDemand)) ? parseInt(req.body.numberOnDemand) : DEFAULT_SETTINGS.numberOnDemand,
      onDemandRefresh: parseInt(req.body.onDemandRefresh) ? parseInt(req.body.onDemandRefresh) : DEFAULT_SETTINGS.onDemandRefresh,
      sonarrUrl: req.body.sonarrUrl,
      sonarrToken: req.body.sonarrToken,
      sonarrDays: req.body.sonarrDays ? parseInt(req.body.sonarrDays) : DEFAULT_SETTINGS.sonarrCalDays,
      premiereSwitch: req.body.premiereSwitch,
      radarrUrl: req.body.radarrUrl,
      radarrToken: req.body.radarrToken,
      radarrDays: req.body.radarrDays ? parseInt(req.body.radarrDays) : DEFAULT_SETTINGS.radarrCalDays,
      saved: false,
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
        version: pjson.version
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
      });
    }
  }
);

// start listening on port 3000
app.listen(3000, () => {
  console.log(`✅ Web server started on internal port 3000 `);
});
