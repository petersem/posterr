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
    this.runTime = "";
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
  }

  /**
   * @desc renders the properties of the card into html, then sets this to the 'rendered' property
   * @returns nothing
   */
  async Render(playThemes,playGenericThemes) {
    let hidden = "";
    if (this.cardType != "Now Screening" && this.cardType != "Playing") hidden = "hidden";
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
      resCodecPill =
        "<span class='badge badge-pill badge-dark'> " +
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

    // render data into html
    this.rendered =
      `
    <audio id="audio` +
      this.ID +
      `">
      <source src="` +
      this.theme +
      `" type="audio/mpeg">
      Your browser does not support the audio element.
    </audio>
    <div class="carousel-item ` +
      this.active +
      ` w-100 h-100" id="` +
      this.ID +
      `">
      <div class="myDiv">
      <div class="posterArt" style="background-image: url('` +
      this.posterArtURL + `'">
      </div>
        <div class="banners">
          <div class="bannerBigText ` +
      this.cardType +
      `">` +
      this.cardType +
      `</div>
        </div> 

      <div id="poster` +
      this.ID +
      `" class="poster" style="background-image: url('` +
      this.posterURL + `'">

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
      <div class="hidden" id="poster` + this.ID + `AR">`+this.posterAR+`</div>
      </div>

      <div class="bottomBanner mx-auto transparent" id="bottomBanner` +
      this.ID +
      `">
        <div class="tagLine">` +
      this.tagLine +
      `</div>
        <div class="tagDetails">` +
      contentRatingPill +
      resCodecPill +
      networkPill +
      studioPill +
      audioCodecPill +
      runTimePill +
      ratingPill +
      userPill +
      devicePill + 
      ipPill +
      yearPill +
      `</div>
      </div>
      </div>
    </div>`;
    return;
  }
}

module.exports = MediaCard;
