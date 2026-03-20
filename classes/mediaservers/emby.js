const Jellyfin = require("./jellyfin");

/**
 * Emby uses the same HTTP API shape as Jellyfin (MediaBrowser token, /Sessions, /Items, etc.).
 */
class Emby extends Jellyfin {
  constructor({ HTTPS, embyIP, embyPort, embyToken }) {
    super({
      HTTPS,
      jfIP: embyIP,
      jfPort: embyPort,
      jfToken: embyToken,
      displayName: "Emby",
    });
  }
}

module.exports = Emby;
