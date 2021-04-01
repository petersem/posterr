const fs = require("fs");
const request = require("request");
const fsExtra = require("fs-extra");
const util = require("./utility");

class Core {
  constructor() {
    return;
  }

  static async CacheImage(url, fileName) {
    const savePath = "./public/imagecache/" + fileName;
    await this.download(url, savePath, fileName);
    return;
  }

  static async CacheMP3(fileName) {
    const savePath = "./public/mp3cache/" + fileName;
    const url = "http://tvthemes.plexapp.com/" + fileName;
    await this.download(url, savePath, fileName);

    return;
  }

  static async download(url, savePath, fileName) {
    // download file function
    const download = (url, savePath, callback) => {
      try {
        request.head(url, (err, res, body) => {
          request(url)
            .pipe(fs.createWriteStream(savePath,{autoClose:true}))
            .on("close", callback)
            .on("error", (err) => {
              console.log('download failed: ' + err.message);
            })
            .on("finish", () => {
              //console.log("Download Completed");
              return callback;
            });
        });
      } catch (err) {
        console.log(" ");
        console.error("✘ Could not download file", err);
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

  static async DeleteMP3Cache() {
    const directory = "./public/mp3cache/";
    fsExtra.emptyDirSync(directory);
    console.log("✅ MP3 cache cleared");
  }

  static async DeleteImageCache() {
    const directory = "./public/imagecache/";
    fsExtra.emptyDirSync(directory);
    console.log("✅ Image cache cleared");
  }

  static async GetRandomMP3() {
    var directory = "./public/randomthemes";

    var randomFile = await util.random_item(fs.readdirSync(directory));
    return randomFile;
  }
}
module.exports = Core;
