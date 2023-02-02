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
    const savePath = "./saved/imagecache/" + fileName;
    const result = await this.download(url, savePath, fileName);
    return result;
  }

  /**
   * @desc Downloads the tv mp3 file from tvthemes.plexapp.com
   * @param {string} fileName - the filename to download and save. this in the format of tvdbid.mp3
   * @returns nothing
   */
  static async CacheMP3(fileName) {
    const savePath = "./saved/mp3cache/" + fileName;
    const url = "http://tvthemes.plexapp.com/" + fileName;
    const result = await this.download(url, savePath);
    return result;
  }

  /**
   * @desc Downloads the tv mp3 file from the Plex server
   * @param {string} url - the fully qualified URL for the plex media file
   * @param {string} fileName - the filename to download and save. this in the format of tvdbid.mp3
   * @returns nothing
   */
  static async CachePlexMP3(url, fileName) {
    const savePath = "./saved/mp3cache/" + fileName;
    //console.log(fileName, url);
    const result = await this.download(url, savePath);
    return result;
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
    let status=true;
    const download = (url, savePath, callback) => {
      // request.head(url, (err, res, body) => {
      request(url, function (err, res, body) {
        //console.log(res.rawHeaders[1]);
        // check to see if no content, then if mp3, throw exception
//         var size = parseInt(res.headers["content-length"], 10);
// //        console.log("file size: " + size);
//         if (isNaN(size) || (size < 250 && url.toLowerCase().includes("themes"))) {
//           //console.log('no mp3',url);
//           status=false;
//           return callback;
//         }
      })
        .pipe(fs.createWriteStream(savePath, { autoClose: true }))
        .on("error", (err) => {
          // throw error unless the download failed due to a restart
          if (err.code !== "EPERM") {
            console.log(
              "download failed for: ",
              url,
              err.message,
              err.code,
              err.errno
            );
          }
          status=false;
          return callback(true);
        })
        .on("close", () => {
          return callback;
        });
         return callback;
    };

    //
    // check if file exists before downloading
    if (!fs.existsSync(savePath)) {
      //file not present, so download
      download(url, savePath, function (dlRes) {
        // console.log("✅ Downloaded: " + fileName);
      });
    } else {
      // console.log("✘ " + fileName + " exists, DL aborted");
    }
  }

  // not implemented yet!
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
    const directory = "./saved/mp3cache/";
    try {
      fsExtra.emptyDirSync(directory);
    } catch (err) {
      if (err.code !== "EPERM") {
        console.log("Delete MP3 Cache-->" + err.code);
        throw err;
      }
    }
    console.log("✅ MP3 cache cleared");
  }

  /**
   * @desc Deletes all files from the imageCache folder
   * @returns nothing
   */
  static async DeleteImageCache() {
    const directory = "./saved/imagecache/";
    try {
      fsExtra.emptyDirSync(directory);
    } catch (err) {
      if (err.code !== "EPERM") {
        console.log("Delete Image Cache -->" + err.code);
        throw err;
      }
    }

    console.log("✅ Image cache cleared");
  }

  // /**
  //  * @desc Returns a single random mp3 filename from the randomthemese folder. (tries to make MP3 unique)
  //  * @param {array} cardArray - the card array that has been built thus far (needed to be able to check for duplicates)
  //  * @returns {string} fileName - a random filename
  //  */
  // static async GetRandomMP3(cardArray) {
  //   let directory = "./saved/randomthemes";
  //   // get all mp3 files from directory
  //   let fileArr = fs.readdirSync(directory);
  //   let mp3Files = fileArr.filter(function (elm) {
  //     return elm.match(/.*\.(mp3)/gi);
  //   });

  //   // calls random_items function to return a random item from an array
  //   let randomFile = await util.random_item(mp3Files);

  //   let tryCount = 0;

  //   // now try to get a unique file (try 5 times)
  //   while ((await this.themeUsed(cardArray, randomFile)) && tryCount < 5) {
  //     // try again if the MP3 has already been used
  //     tryCount++;
  //     randomFile = await util.random_item(mp3Files);
  //   }

  //   // return whatever MP3 we ended up selecting
  //   return randomFile;
  // }

  /**
   * @desc Returns a boolean if a theme is present in a card array
   * @param {array} cardArray - the card array that has been built thus far (needed to be able to check for duplicates)
   * @param {string} fileName - the filename to check for
   * @returns {boolean} - true if in array
   */
  static async themeUsed(cardArray, fileName) {
    let result = await cardArray.some(
      (card) => card.theme.includes(fileName) == true
    );
    //if(result) console.log('Dupe: '+ fileName, result);
    return result;
  }
}
module.exports = Cache;
