const fs = require("fs");
const request = require("request");
const fsExtra = require("fs-extra");
const util = require("./utility");

/**
 * @desc Cache class manages the downloaad, cleanup and random selection of mp3 and poster image assets. Methods are static.
 * @returns nothing
 */
class Cache {
  constructor() {
    return;
  }

  /**
   * @desc Downloads the poster image
   * @param {string} url - the full url to the picture file
   * @param {string} fileName - the filename to save the image file as
   * @returns nothing
   */
  static async CacheImage(url, fileName) {
    const savePath = "./public/imagecache/" + fileName;
      await this.download(url, savePath, fileName);
    return;
  }

  /**
   * @desc Downloads the tv mp3 file from tvthemes.plexapp.com
   * @param {string} fileName - the filename to download and save. this in the format of tvdbid.mp3
   * @returns nothing
   */
  static async CacheMP3(fileName) {
    const savePath = "./public/mp3cache/" + fileName;
    const url = "http://tvthemes.plexapp.com/" + fileName;
      await this.download(url, savePath);
    return;
  }

  /**
   * @desc Download any asset, providing it does not already exist in the save location
   * @param {string} url - the full url to the asset
   * @param {string} savePath - the path to save the asset to
   * @param {string} fileName - the filename to save the asset as
   * @returns nothing
   */
  static async download(url, savePath) {
    // download file function
    const download = (url, savePath, callback) => {
      try {
        request.head(url, (err, res, body) => {
          request(url)
            .pipe(fs.createWriteStream(savePath, { autoClose: true }))
            .on("close", callback)
            .on("error", (err) => {
              //console.log("download failed: " + err.message);
              throw err;
            })
            .on("finish", () => {
              //console.log("Download Completed");
              return callback;
            });
        });
      } catch (err) {
        console.log(" ");
        console.error("✘ Could not download file:", savepath, err);
        throw err;
      }

      return;
    };

    //
    // check if file exists before downloading
    if (!fs.existsSync(savePath)) {
      //file not present, so download
      download(url, savePath, () => {
        // console.log("✅ Downloaded: " + fileName);
      });
    } else {
      // console.log("✘ " + fileName + " exists, DL aborted");
    }
  }

  static async CheckFileSize(savePath) {
    let small = false;
    var stats = fs.statSync(savePath);
    var fileSizeInBytes = stats.size;
    // Convert the file size to megabytes (optional)
    var fileSizeInKbytes = fileSizeInBytes / 1024;

    if (fileSizeInKbytes <= 1) small = true;
    console.log(savePath + " - " + fileSizeInKbytes + "kb - " + small);
  }

  /**
   * @desc Deletes all files from the MP3Cache folder
   * @returns nothing
   */
  static async DeleteMP3Cache() {
    const directory = "./public/mp3cache/";
    fsExtra.emptyDirSync(directory);
    console.log("✅ MP3 cache cleared");
  }

  /**
   * @desc Deletes all files from the imageCache folder
   * @returns nothing
   */
  static async DeleteImageCache() {
    const directory = "./public/imagecache/";
    fsExtra.emptyDirSync(directory);
    console.log("✅ Image cache cleared");
  }

  /**
   * @desc Returns a single random mp3 filename from the randomthemese folder. (tries to make MP3 unique)
   * @param {array} cardArray - the card array that has been built thus far (needed to be able to check for duplicates)
   * @returns {string} fileName - a random filename
   */
  static async GetRandomMP3(cardArray, uniqueTryCount) {
    let directory = "./public/randomthemes";

    // calls random_items function to return a random item from an array
    let randomFile = await util.random_item(fs.readdirSync(directory));

    // set to zero for initial call
    if(uniqueTryCount == undefined) uniqueTryCount = 0;

    let tryCount = 0;
    // try again up to 5 times to get a valid MP3 file
    while((randomFile == undefined || !randomFile.includes("mp3")) && tryCount !== 5) {
      tryCount++;
      randomFile = await util.random_item(fs.readdirSync(directory));
    }

    // now try to get a unique file (try 5 times)
    if(cardArray.some(card => card.theme.includes(randomFile) == true) && uniqueTryCount !== 5) {
      // try again if the MP3 has already been used
      uniqueTryCount++;
  console.log(randomFile + ' already in use - trying again', uniqueTryCount);
      this.GetRandomMP3(cardArray,uniqueTryCount);
    }

    if(uniqueTryCount==5){
  console.log("Couldn't get a unique MP3 - sorry!!" );
    }

    // return whatever MP3 we ended up selecting
    return randomFile;
  }

  static async GetRandomUniqueMP3(cardArray){
    let randomFile = await this.GetRandomMP3();  
    let tryCount = 0;
    if(cardArray.some((card => card.theme.includes === randomFile) && tryCount !== 5)) {
      tryCount++;
      randomFile =1;
    }
  }

}
module.exports = Cache;
