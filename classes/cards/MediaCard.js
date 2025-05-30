const util = require("./../core/utility");

/**
 * @desc mediaCards base class for defining every card that is showed in the poster app
 * @returns nothing
 */
class MediaCard {
  constructor() {
    this.ID = null;
    this.DBID = "";
    this.mediaType = "";
    this.active = null;
    this.title = "";
    this.year = "";
    this.posterURL = "";
    this.posterArtURL = "";
    this.posterAR = "";
    this.contentRating = "";
    this.ratingColour = "";
    this.rating = "";
    this.summary = "";
    this.tagLine = "";
    this.episodeName = "";
    this.runTime = "";
    this.pageCount = "";
    this.resCodec = "";
    this.studio = "";
    this.network = "";
    this.audioCodec = "";
    this.playerDevice = "";
    this.playerIP = "";
    this.device = "";
    this.playerLocal = "";
    this.user = "";
    this.genre = [];
    this.cardType = null;
    this.progress = "";
    this.progressPercent = "";
    this.decision = "";
    this.theme = "";
    this.rendered = "";
    this.user ="";
    this.ip ="";
    this.triviaCategory = "";
    this.triviaType = "";
    this.triviaAnswer = "";
    this.triviaQuestion = "";
    this.triviaOptions = [];
    this.triviaDifficulty = "";
    this.runDuration = "";
    this.runProgress = "";
    this.linkUrl = "";
    this.youtubeKey = "";
  }

  /**
   * @desc renders the properties of the card into html, then sets this to the 'rendered' property
   * @returns nothing
   */
  async Render(hasArt,baseUrl,hideTitle,hideFooter) {
    let hiddenTitle = "";
    let hiddenFooter = "";
    let hidden = "";
    let fullScreen = "";
    let pauseMessage = "";

    // set header/footer hidden values
    if(hideTitle=='true' && this.cardType[0] == "On-demand") hiddenTitle = "hidden";
    if(hideFooter=='true' && this.cardType[0] == "On-demand") hiddenFooter = "hidden";
    if(hiddenTitle !== "" && hiddenFooter !== "") fullScreen="fullscreen";
    if(this.cardType[0] == "Picture" || this.cardType == "Trivia Question" || this.cardType == "WebURL"){
      hiddenTitle="hidden";
      hiddenFooter="hidden";
      if(hasArt && this.posterArtURL !== ""){
        // if has art, then reduce poster by 6% to improve look
        fullScreen="fullscreenCustom";
      }
      else{
        // if no art, then likely portrait and so go full screen
        fullScreen="fullscreen";
      }
    }

    if(this.cardType[0] == "Picture"){
      pauseMessage = `<div style="position: relative; z-index: 1;">
  <span id="overlay_text` + this.ID + `" style="position: fixed; bottom: 5px; z-index: 3;"></span>
  </div>`
    }


    // set to hide progress bar if not a playing type of card
    if (this.cardType[0] != "Now Screening" && this.cardType[0] != "Playing") hidden = "hidden";
    
    // get custom card title
    let cardCustomTitle = this.cardType[1] !== "" ? this.cardType[1] : this.cardType[0];

    var decRemainingTime = this.runDuration - this.runProgress;
    var et = new Date();
    et.setMinutes(et.getMinutes()+decRemainingTime);
    //console.log(decRemainingTime);
    //console.log(et.toLocaleTimeString());
    var endTime = et.toLocaleTimeString("en-US", {hour: '2-digit', minute:'2-digit'});

    this.triviaRender="";
    this.linkRender="";
    // if a trivia card, then prepare html

    if(this.cardType[0] == "Trivia Question"){
     
      let options = "<ol type='A' class='listOptions'>";
      this.triviaOptions.forEach(o => {
        if(o == this.triviaAnswer){
          options += "<li class='theAnswer'>" + o + "</li>";
        }
        else{
        options += "<li>" + o + "</li>";
        }
      });
      options += "</ol>";

      this.triviaRender = `
      <div id='quiz' class='quiz quizText'>
        <div id='question' class='question'>` + this.triviaQuestion + `</div>
        <div class='options'>` + options + `</div>
        <div class="countdown timer` + this.ID + `">
          <div class="time_left_txt` + this.ID + `">Time Left</div>
          <div class="time timer_sec` + this.ID + `"></div>
          <div class="time_line` + this.ID + `"></div>
        </div>
      </div>`;
    }

    if(this.cardType[0] == "WebURL"){
      hiddenFooter = "hidden";
      fullScreen="fullscreen";
      hiddenTitle="hidden";
      this.linkRender = `<embed type="text/html" src="` + this.linkUrl + `" width=100% height=100% style="border: none; overflow: hidden;>`
      //this.linkRender = `<iframe scrolling="no" src="` + this.linkUrl + `" width=100% height=100%  style="border: none; overflow: hidden;" >`;
//      console.log(this.linkRender);
    }


    // pill variables
    let contentRatingPill = "";
    let resCodecPill = "";
    let audioCodecPill = "";
    let runTimePill = "";
    let ratingPill = "";
    let networkPill = "";
    let studioPill = "";
    let ipPill = "";
    let userPill = "";
    let devicePill = "";
    let yearPill = "";
    let pagePill = "";
    let endTimePill = "";

    // toggle background art as per settings
    if(hasArt=="true") {
      // leave art if present
    }
    else{
      this.posterArtURL = "";
    }

    // include if value present
    if (!(await util.isEmpty(this.year))) {
      yearPill =
        "<span class='badge badge-pill badge-dark'> " +
        this.year +
        "</span>";
    }

    if (!(await util.isEmpty(this.contentRating))) {
      contentRatingPill =
        "<span class='badge badge-pill " +
        this.ratingColour +
        "'>" +
        this.contentRating +
        "</span>";
    }

    if (!(await util.isEmpty(this.ip))) {
      ipPill =
        "<span class='badge badge-pill badge-dark'> " +
        this.ip +
        "</span>";
    }

    if (!(await util.isEmpty(this.device))) {
      devicePill =
        "<span class='badge badge-pill badge-dark'> " +
        this.device +
        "</span>";
    }

    if (!(await util.isEmpty(this.user))) {
      userPill =
        "<span class='badge badge-pill badge-dark'> " +
        this.user +
        "</span>";
    }

    if (!(await util.isEmpty(this.resCodec))) {
      let resBadge = "badge-dark";
      // if(this.resCodec.toLocaleLowerCase().includes('4k') && this.resCodec.toLocaleLowerCase().includes('main 10 hdr')){
      //   resBadge = "badge-primary super-res";
      // }
      resCodecPill =
        "<span class='badge badge-pill " + resBadge + "'> " +
        this.resCodec +
        "</span>";
    }

    if (!(await util.isEmpty(this.network))) {
      networkPill =
        "<span class='badge badge-pill badge-dark'> " +
        this.network +
        "</span>";
    }

    if (!(await util.isEmpty(this.studio))) {
      studioPill =
        "<span class='badge badge-pill badge-dark'> " +
        this.studio +
        "</span>";
    }

    if (!(await util.isEmpty(this.audioCodec))) {
      audioCodecPill =
        "<span class='badge badge-pill badge-dark'> " +
        this.audioCodec +
        "</span>";
    }

    if (!(await util.isEmpty(this.pageCount))) {
      pagePill =
        "<span class='badge badge-pill badge-dark'> " +
        this.pageCount +
        " pages</span>";
    }

    if (!(await util.isEmpty(this.runTime))) {
      runTimePill =
        "<span class='badge badge-pill badge-dark'> " +
        this.runTime +
        "m</span>";
    }

    if (!(await util.isEmpty(this.rating))) {
      ratingPill =
        "<span class='badge badge-pill badge-dark'> " + this.rating + "</span>";
    }

    if(this.cardType[0] == "Now Screening" || this.cardType[0] == "Playing") {
      endTimePill =
        "<span class='badge badge-pill badge-dark'>End: " + endTime + "</span>";
    }

    // render data into html
    this.rendered =
      `
    <div class="carousel-item ` +
      this.active +
      ` w-100 h-100" id="` +
      this.ID +
      `">
      <audio id="audio` +
        this.ID +
        `">
        <source src="` +
        baseUrl + this.theme +
        `" type="audio/mpeg" preload="auto">
        Your browser does not support the audio element.
      </audio>
      <div class="myDiv">
      <div class="posterArt" style="background-image: url('` +
      baseUrl + 
      this.posterArtURL + `')">
      </div>
        <div class="banners">
          <div class="bannerBigText ` +
      this.cardType[0] +
      ` ` + hiddenTitle + 
      `">` +
      cardCustomTitle +
      `</div>
       </div> 

      <div id="poster` +
      this.ID +
      `" class="poster` +
      " " + fullScreen +
      `" style="background-image: url('` +
      baseUrl + 
      this.posterURL + `')">` + pauseMessage + `

      <div class="progress ` +
      hidden +
      `" id="progress` +
      this.ID + `">
          <div class="progress-bar ` +
      this.decision +
      `" role="progressbar" style="width: ` +
      this.progressPercent +
      `%"
            aria-valuenow="` +
      this.progress +
      `" aria-valuemin="0" aria-valuemax="` +
      this.runTime +
      `"></div>
        </div>
      <div class="hidden" id="poster` + this.ID + `AR">`+this.posterAR+`</div>` +
      this.triviaRender + this.linkRender +
      `</div>

      <div class="bottomBanner mx-auto transparent` +
      ` ` + hiddenFooter + 
      `" id="bottomBanner` +
      this.ID +
      `">
        <marquee direction="left" autostart="false" id="marquee`+ this.ID + `"><div class="tagLine" id="tagLine`+ this.ID + `">` +
      this.tagLine +
      `</div></marquee>
        <div class="tagDetails">` +
      contentRatingPill +
      resCodecPill +
      networkPill +
      studioPill +
      audioCodecPill +
      runTimePill +
      pagePill +
      ratingPill +
      userPill +
      devicePill + 
      ipPill +
      yearPill +
      endTimePill +
      `</div>
      </div>
      </div>
    </div>`;
      return;
  }
}

module.exports = MediaCard;
