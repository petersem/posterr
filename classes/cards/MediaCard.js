const util = require("./../core/utility");

class MediaCard {
  constructor() {
    this.ID = null;
    this.DBID = "";
    this.mediaType = "";
    this.active = null;
    this.title = "";
    this.year = "";
    this.posterURL = "";
    this.contentRating = "";
    this.ratingColour = "";
    this.rating = "";
    this.summary = "";
    this.tagLine = "";
    this.runTime = "";
    this.resCodec = "";
    this.audioCodec = "";
    this.playerDevice = "";
    this.playerIP = "";
    this.playerLocal = "";
    this.user = "";
    this.genre = [];
    this.cardType = null;
    this.progress = "";
    this.progressPercent = "";
    this.decision = "";
    this.theme = "";
    this.rendered = "";
  }

  async Render() {
    var hidden = "";
    if (this.cardType != "Now Screening") hidden = "hidden";

    // pill variables
    var contentRatingPill = "";
    var resCodecPill = "";
    var audioCodecPill = "";
    var runTimePill = "";
    var ratingPill = "";

    // include if value present
    if (!(await util.isEmpty(this.contentRating))) {
      contentRatingPill =
        "<span class='badge badge-pill " +
        this.ratingColour +
        "'>" +
        this.contentRating +
        "</span>";
    }

    if (!(await util.isEmpty(this.resCodec))) {
      resCodecPill =
        "<span class='badge badge-pill badge-dark'> " +
        this.resCodec +
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
        <div class="banners">
          <div class="bannerBigText ` +
      this.typeClass +
      `">` +
      this.cardType +
      `</div>
        </div> 

        <div class="progress ` +
      hidden +
      `" style="height: 5px; width: 0px; background-color: darkslategrey;" id="progress` +
      this.ID +
      `">
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
        <img alt="" title="" class="poster" id="poster` +
      this.ID +
      `"
          src='` +
      this.posterURL +
      `' />
      </div>
      <div class="spacer"></div>
      <div class="bottomBanner mx-auto transparent" id="bottomBanner` +
      this.ID +
      `">
        <div class="tagLine">` +
      this.tagLine +
      `</div>
        <div class="tagDetails">` +
      contentRatingPill +
      resCodecPill +
      audioCodecPill +
      runTimePill +
      ratingPill +
      `</div>
      </div>
    </div>`;
    return;
  }
}

module.exports = MediaCard;
