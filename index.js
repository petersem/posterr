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
const settings = require("./classes/core/settings");

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
let setng = new settings();
let loadedSettings;

/**
 * @desc Wrapper function to call Sonarr coming soon.
 * @returns {Promise<object>} mediaCards array - coming soon
 */
async function loadSonarrComingSoon() {
  // stop the clock
  clearInterval(sonarrClock);

  // instatntiate sonarr class
  let sonarr = new sonr(
    loadedSettings.sonarrURL,
    loadedSettings.sonarrToken,
    loadedSettings.sonarrPremieres
  );
  // set up date range and date formats
  let today = new Date();
  let later = new Date();
  //console.log(today.toISOString().split("T")[0]);
  later.setDate(later.getDate() + loadedSettings.sonarrCalDays);
  //console.log(later.toISOString().split("T")[0]);
  let now = today.toISOString().split("T")[0];
  let ltr = later.toISOString().split("T")[0];

  // call sonarr coming soon
  csCards = await sonarr.GetComingSoon(
    now,
    ltr,
    loadedSettings.sonarrPremieres
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

  // load MediaServer(s) (switch statement for different server settings server option - TODO)
  let ms = new pms({
    plexHTTPS: loadedSettings.plexHTTPS,
    plexIP: loadedSettings.plexIP,
    plexPort: loadedSettings.plexPort,
    plexToken: loadedSettings.plexToken,
  });

  // call now screening method
  nsCards = await ms.GetNowScreening(loadedSettings.playGenenericThemes);

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
      // console.log("m:" + mCards.length);
    } else {
      if (csCards.length > 0) {
        globalPage.cards = csCards;
        // console.log("CS:" +csCards.length);
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
  await globalPage.OrderAndRenderCards(loadedSettings.playGenenericThemes);
  globalPage.refreshPeriod = loadedSettings.refreshPeriod * 1000;
  globalPage.slideDuration = loadedSettings.slideDuration * 1000;
  globalPage.playThemes = loadedSettings.playThemes;
  globalPage.playGenericThemes = loadedSettings.genericThemes;
  globalPage.fadeTransition = (loadedSettings.fade=="true") ? "carousel-fade" : "";

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
  let ms = new pms({
    plexHTTPS: loadedSettings.plexHTTPS,
    plexIP: loadedSettings.plexIP,
    plexPort: loadedSettings.plexPort,
    plexToken: loadedSettings.plexToken,
  });

  odCards = await ms.GetOnDemand(
    loadedSettings.onDemandLibraries,
    loadedSettings.numberOnDemand,
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
 * @desc Starts everything - calls coming soon 'tv', on-demand and now screening functions. Then initialises timers
 * @returns nothing
 */
async function startup() {
  // load settings object
  loadedSettings = await loadSettings();
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
  nowScreeningClock = setInterval(loadNowScreening, 30000); // every 30 seconds
  onDemandClock = setInterval(
    loadOnDemand,
    loadedSettings.onDemandRefresh * 60000
  );
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
app.use(
  express.urlencoded({
    extended: false,
  })
);
app.use(cors());

app.use(cookieParser());
app.use(
  session({
    secret: "xyzzy",
    saveUninitialized: false,
    resave: false,
  })
);

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
  res.render("settings", {
    success: req.session.success,
    errors: req.session.errors,
  });
  req.session.errors = null;
});

app.post(
  "/settings",
  [
    check("slideDuration")
      .not()
      .isEmpty()
      .withMessage("Slide duration is required"),
    check("refreshPeriod")
      .not()
      .isEmpty()
      .withMessage("Refresh period is required"),
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
    console.log(req.body);
    var errors = validationResult(req).array();
    if (errors) {
      //fields value holder
      let form = {
        password: req.body.password,
        slideDuration: req.body.slideDuration,
        refreshPeriod: req.body.refreshPeriod,
        themeSwitch: req.body.themeSwitch,
        genericSwitch: req.body.genericSwitch,
        fadeOption: req.body.fadeOption,
      };

      req.session.errors = errors;
      req.session.success = false;
      res.render("settings", {
        errors: req.session.errors,
        formData: form,
      });
    } else {
      req.session.success = true;
      // TODO Now go and save the data and reload forms
      res.redirect("settings");
    }
  }
);

// start listening on port 3000
app.listen(3000, () => {
  console.log(
    `✅ Web server started on internal port 3000 
    `
  );
});
