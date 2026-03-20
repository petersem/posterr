const mediaCard = require("./../cards/MediaCard");
const cType = require("./../cards/CardType");
const util = require("./../core/utility");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { CardTypeEnum } = require("./../cards/CardType");

/**
 * Jellyfin media server (Emby API compatible).
 * @param {boolean|string} HTTPS
 * @param {string} jfIP
 * @param {number} jfPort
 * @param {string} jfToken API key
 * @param {string} [displayName] Label for logs/errors (e.g. "Emby")
 */
class Jellyfin {
  constructor({ HTTPS, jfIP, jfPort, jfToken, displayName }) {
    this.https = HTTPS === true || HTTPS === "true";
    this.jfIP = jfIP;
    this.jfPort = parseInt(jfPort, 10) || 8096;
    this.jfToken = jfToken;
    this.displayName = displayName || "Jellyfin";
    this.baseUrl = `${this.https ? "https" : "http"}://${jfIP}:${this.jfPort}`;
    this.headers = {
      Authorization: `MediaBrowser Token="${jfToken}"`,
      "Content-Type": "application/json",
    };
  }

  imageUrl(itemId, imageType = "Primary", imageIndex = 0) {
    let p = `/Items/${itemId}/Images/${imageType}`;
    if (imageType === "Backdrop") p += `/${imageIndex}`;
    return `${this.baseUrl}${p}?api_key=${encodeURIComponent(this.jfToken)}`;
  }

  /**
   * Download poster/backdrop with API auth headers. Plain URL+api_key often fails on HTTPS / reverse proxies.
   * @param {string|string[]} itemIdOrIds One or more item ids (e.g. episode → series for backdrops).
   * @param {string|string[]} imageType Single type, or try in order (e.g. ["Primary","Thumb"] for series posters).
   * @param {object} [options] quietNotFound: no console spam; writes fileName+".missing" so we do not retry every poll.
   * @returns {boolean} true if image written
   */
  async cacheItemImage(fileName, itemIdOrIds, imageType = "Primary", imageIndex = 0, options) {
    const { quietNotFound = false } = options || {};
    const rawIds = Array.isArray(itemIdOrIds) ? itemIdOrIds : [itemIdOrIds];
    const itemIds = [];
    for (const id of rawIds) {
      if (id === undefined || id === null) continue;
      const s = String(id).trim();
      if (!s || itemIds.includes(s)) continue;
      itemIds.push(s);
    }
    if (!itemIds.length) return false;

    const dir = path.join(process.cwd(), "saved", "imagecache");
    const savePath = path.join(dir, fileName);
    const missPath = savePath + ".missing";

    if (fs.existsSync(savePath)) return true;
    if (quietNotFound && fs.existsSync(missPath)) return false;

    try {
      await fsp.mkdir(dir, { recursive: true });
    } catch (_) {}

    const types = Array.isArray(imageType) ? imageType : [imageType];
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : this.baseUrl + "/";

    for (const itemId of itemIds) {
      for (const it of types) {
        let rel = `Items/${encodeURIComponent(String(itemId))}/Images/${it}`;
        if (it === "Backdrop") rel += `/${imageIndex}`;
        const u = new URL(rel, base);
        let res;
        try {
          res = await fetch(u, { headers: this.headers });
        } catch (e) {
          const d = new Date();
          console.log(
            d.toLocaleString() + " " + this.displayName + " image fetch error: " + e.message
          );
          continue;
        }
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 100) continue;
        try {
          await fsp.writeFile(savePath, buf);
          if (fs.existsSync(missPath)) {
            await fsp.unlink(missPath).catch(() => {});
          }
          return true;
        } catch (e) {
          const d = new Date();
          console.log(
            d.toLocaleString() + " " + this.displayName + " image write failed: " + e.message
          );
          return false;
        }
      }
    }

    if (quietNotFound) {
      try {
        await fsp.writeFile(missPath, "");
      } catch (_) {}
      return false;
    }

    const d = new Date();
    console.log(
      d.toLocaleString() +
        " " +
        this.displayName +
        " no image for " +
        types.join("|") +
        " item " +
        itemIds.join(",") +
        " (" +
        fileName +
        ")"
    );
    return false;
  }

  /** Jellyfin episodes often have no Backdrop on the episode item; series/parent may. */
  backdropSourceIds(np) {
    const out = [];
    const add = (id) => {
      if (id === undefined || id === null) return;
      const s = String(id).trim();
      if (!s || out.includes(s)) return;
      out.push(s);
    };
    if (!np) return out;
    add(np.Id);
    add(this.pickFirst(np, ["ParentBackdropItemId", "parentBackdropItemId"]));
    add(this.pickFirst(np, ["SeriesId", "seriesId"]));
    add(this.pickFirst(np, ["ParentPrimaryImageItemId", "parentPrimaryImageItemId"]));
    return out;
  }

  pickFirst(obj, keys) {
    if (!obj) return undefined;
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  }

  useSeriesPosterFromSetting(seriesPosterForEpisodes) {
    if (seriesPosterForEpisodes === false || seriesPosterForEpisodes === "false") return false;
    if (seriesPosterForEpisodes === true || seriesPosterForEpisodes === "true") return true;
    return String(seriesPosterForEpisodes ?? "true").toLowerCase() !== "false";
  }

  /**
   * Walk parents until we find the Series item (reliable when SeriesId is missing on session DTO).
   */
  async resolveSeriesIdFromAncestors(itemId, uid) {
    const attempts = [];
    if (uid) {
      attempts.push([
        `/Users/${encodeURIComponent(String(uid))}/Items/${encodeURIComponent(String(itemId))}/Ancestors`,
        {},
      ]);
    }
    attempts.push([
      `/Items/${encodeURIComponent(String(itemId))}/Ancestors`,
      uid ? { UserId: String(uid) } : {},
    ]);
    for (const [path, params] of attempts) {
      try {
        const data = await this.request("get", path, params);
        const list = Array.isArray(data) ? data : [];
        for (const item of list) {
          const typ = String(item.Type ?? item.type ?? "").toLowerCase();
          if (typ === "series") {
            const id = item.Id ?? item.id;
            if (id) return String(id);
          }
        }
      } catch (_) {
        /* try next */
      }
    }
    return null;
  }

  /**
   * Session NowPlayingItem is often slim: SeriesId missing. Prefer real Series id (not Season) for Primary art.
   */
  async resolvePosterItemIdForEpisode(np, session) {
    let sid = this.pickFirst(np, ["SeriesId", "seriesId"]);
    if (sid) return String(sid);

    const uid = this.pickFirst(session, ["UserId", "userId"]);
    let detail;
    try {
      const fields = "SeriesId,ParentPrimaryImageItemId";
      if (uid) {
        detail = await this.request(
          "get",
          `/Users/${encodeURIComponent(String(uid))}/Items/${encodeURIComponent(String(np.Id))}`,
          { Fields: fields }
        );
      } else {
        detail = await this.request("get", `/Items/${encodeURIComponent(String(np.Id))}`, {
          Fields: fields,
        });
      }
      sid = this.pickFirst(detail, ["SeriesId", "seriesId"]);
      if (sid) return String(sid);
    } catch (_) {
      /* ignore */
    }

    const fromAncestors = await this.resolveSeriesIdFromAncestors(np.Id, uid);
    if (fromAncestors) return fromAncestors;

    if (detail) {
      const ppcDetail = this.pickFirst(detail, [
        "ParentPrimaryImageItemId",
        "parentPrimaryImageItemId",
      ]);
      if (ppcDetail) return String(ppcDetail);
    }

    const ppc = this.pickFirst(np, [
      "ParentPrimaryImageItemId",
      "parentPrimaryImageItemId",
    ]);
    if (ppc) return String(ppc);

    return String(np.Id);
  }

  /** Device filter: allow substring match (Jellyfin Client/Device strings vary). */
  deviceFilterAllows(devices, playerDevice, deviceDisplay) {
    if (!devices.length) return true;
    const pd = (playerDevice || "").toLowerCase().trim();
    const dd = (deviceDisplay || "").toLowerCase().trim();
    const blob = [pd, dd].filter(Boolean).join(" ");
    if (!blob) return true;
    return devices.some((d) => {
      const di = String(d).toLowerCase().trim();
      if (!di) return false;
      return (
        blob === di ||
        pd === di ||
        dd === di ||
        pd.includes(di) ||
        dd.includes(di) ||
        di.includes(pd) ||
        di.includes(dd)
      );
    });
  }

  async request(method, path, params) {
    const u = new URL(path.replace(/^\//, ""), this.baseUrl + "/");
    if (params && typeof params === "object") {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      });
    }
    const res = await fetch(u.toString(), {
      method,
      headers: this.headers,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new Error(`${this.displayName} ${method} ${path}: ${res.status} ${text && text.slice ? text.slice(0, 200) : text}`);
    }
    return data;
  }

  /**
   * Remote playback command (Emby/Jellyfin Sessions API).
   * @param {string} sessionId
   * @param {"Pause"|"Unpause"|"Stop"|"PlayPause"} command
   */
  async sendPlaystateCommand(sessionId, command) {
    const path = `/Sessions/${encodeURIComponent(sessionId)}/Playing/${encodeURIComponent(command)}`;
    const u = new URL(path.replace(/^\//, ""), this.baseUrl + "/");
    const res = await fetch(u.toString(), {
      method: "POST",
      headers: this.headers,
      body: "{}",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `${this.displayName} POST ${path}: ${res.status} ${text && text.slice ? text.slice(0, 200) : text}`
      );
    }
    return text;
  }

  isPrivateEndpoint(addr) {
    if (!addr || addr === "") return true;
    if (addr === "127.0.0.1" || addr === "::1") return true;
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(addr);
  }

  ratingColour(contentRating) {
    let cr = contentRating || "NR";
    let ratingColour = "badge-dark";
    switch (String(cr).toLowerCase()) {
      case "nr":
      case "unrated":
        ratingColour = "badge-dark";
        break;
      case "g":
      case "tv-g":
      case "tv-y":
        ratingColour = "badge-success";
        break;
      case "pg":
      case "tv-pg":
      case "tv-y7":
        ratingColour = "badge-info";
        break;
      case "pg-13":
      case "tv-14":
        ratingColour = "badge-warning";
        break;
      case "tv-ma":
      case "r":
        ratingColour = "badge-danger";
        break;
      default:
        ratingColour = "badge-dark";
    }
    return { contentRating: cr === "unrated" ? "NR" : cr, ratingColour };
  }

  async getLibraryNameForItem(itemId) {
    try {
      const ancestors = await this.request("get", `/Items/${itemId}/Ancestors`, {});
      if (!Array.isArray(ancestors)) return "";
      const lib = ancestors.find((a) => a.CollectionType && a.Name);
      return lib ? lib.Name : "";
    } catch {
      return "";
    }
  }

  pickVideoAudioStreams(item) {
    let resCodec = "";
    let audioCodec = "";
    const src = item.MediaSources && item.MediaSources[0];
    if (!src || !src.MediaStreams) return { resCodec, audioCodec };
    const v = src.MediaStreams.find((s) => s.Type === "Video");
    const a = src.MediaStreams.find((s) => s.Type === "Audio");
    if (v) {
      const parts = [v.DisplayTitle || "", v.Codec || ""].filter(Boolean);
      resCodec = parts.join(" ").replace(/\(/g, "").replace(/\)/g, "").trim();
    }
    if (a) {
      audioCodec = (a.DisplayTitle || a.Codec || "")
        .replace("Unknown ", "")
        .replace(/\(/g, "")
        .replace(/\)/g, "")
        .trim();
    }
    return { resCodec, audioCodec };
  }

  playMethodDecision(session) {
    const pm = session.PlayState && session.PlayState.PlayMethod;
    if (pm === "Transcode") return "transcode";
    return "direct";
  }

  /**
   * @returns {object} mediaCard[]
   */
  async GetNowScreening(
    playThemes,
    playGenenericThemes,
    hasArt,
    filterRemote,
    filterLocal,
    filterDevices,
    filterUsers,
    hideUser,
    excludeLibs,
    seriesPosterForEpisodes
  ) {
    const nsCards = [];
    let sessions = [];
    try {
      sessions = await this.request("get", "/Sessions", {});
    } catch (err) {
      const now = new Date();
      console.log(now.toLocaleString() + " *Now Scrn. - " + this.displayName + " sessions: " + err.message);
      throw err;
    }
    if (!Array.isArray(sessions)) {
      if (sessions && Array.isArray(sessions.Items)) {
        sessions = sessions.Items;
      } else {
        sessions = [];
      }
    }

    const ex = excludeLibs || [];
    const excludeList = ex.length ? ex.map((s) => String(s).trim().toLowerCase()) : [];
    const devices = (filterDevices || "")
      .toLowerCase()
      .replace(/, /g, ",")
      .replace(/ ,/g, ",")
      .replace(/,+$/, "")
      .split(",")
      .filter(Boolean);
    const users = (filterUsers || "")
      .toLowerCase()
      .replace(/, /g, ",")
      .replace(/ ,/g, ",")
      .replace(/,+$/, "")
      .split(",")
      .filter(Boolean);

    for (const session of sessions) {
      const np = session.NowPlayingItem;
      if (!np || !np.Id) continue;
      let runTicks = np.RunTimeTicks || 0;
      if (!runTicks && np.MediaSources && np.MediaSources[0] && np.MediaSources[0].RunTimeTicks) {
        runTicks = np.MediaSources[0].RunTimeTicks;
      }
      const t = String(np.Type || "").toLowerCase();
      const isTimedVideo =
        t === "episode" ||
        t === "movie" ||
        t === "video" ||
        t === "musicvideo" ||
        t === "trailer" ||
        t === "tvchannel";
      const posTicks = (session.PlayState && session.PlayState.PositionTicks) || 0;
      if (runTicks <= 0 && t !== "audio") {
        if (isTimedVideo) {
          runTicks = Math.max(posTicks * 2, 10000000);
        } else {
          continue;
        }
      }
      const remoteAddr = session.RemoteEndPoint || "";
      const playerLocal = this.isPrivateEndpoint(remoteAddr.split(":")[0]);

      let libraryName = "";
      if (excludeList.length) {
        libraryName = (await this.getLibraryNameForItem(np.Id)) || "";
      }

      const medCard = new mediaCard();
      let transcode = this.playMethodDecision(session);
      medCard.remoteSessionId = session.Id || "";

      if (t === "audio") {
        medCard.title = np.Name || "";
        medCard.tagLine = [np.AlbumArtist || "", np.Album || "", np.Name || ""].filter(Boolean).join(" — ");
        medCard.DBID = np.Id;
        const fileName = `${np.Id}-audio.jpg`;
        await this.cacheItemImage(fileName, np.Id, "Primary");
        medCard.posterURL = "/imagecache/" + fileName;
        if (hasArt === "true") {
          const artName = `${np.Id}-art.jpg`;
          const thumb = this.pickFirst(np, ["ParentThumbItemId", "parentThumbItemId"]);
          const ok = await this.cacheItemImage(
            artName,
            thumb ? [thumb, np.Id] : [np.Id],
            "Backdrop",
            0,
            { quietNotFound: true }
          );
          if (ok) medCard.posterArtURL = "/imagecache/" + artName;
        }
        medCard.posterAR = 1;
        const { resCodec, audioCodec } = this.pickVideoAudioStreams(np);
        medCard.resCodec = resCodec || "";
        medCard.audioCodec = audioCodec || "";
        medCard.runTime = runTicks ? Math.round(runTicks / 10000000 / 60) : 0;
        medCard.cardType = cType.CardTypeEnum.Playing;
        medCard.mediaType = "track";
      } else if (t === "episode") {
        medCard.tagLine = `${np.SeriesName || ""}, Season ${np.ParentIndexNumber} Episode ${np.IndexNumber} — '${np.Name || ""}'`;
        medCard.episodeName = np.Name || "";
        medCard.DBID = this.pickFirst(np, ["SeriesId", "seriesId"]) || np.Id;
        const useSeriesPoster = this.useSeriesPosterFromSetting(seriesPosterForEpisodes);
        const posterItemId = useSeriesPoster
          ? await this.resolvePosterItemIdForEpisode(np, session)
          : String(np.Id);
        const fileName = useSeriesPoster
          ? `ser-${posterItemId}.jpg`
          : `e-${np.Id}.jpg`;
        await this.cacheItemImage(fileName, posterItemId, ["Primary", "Thumb"]);
        medCard.posterURL = "/imagecache/" + fileName;
        if (hasArt === "true") {
          const artName = `e-${np.Id}-art.jpg`;
          const ok = await this.cacheItemImage(
            artName,
            this.backdropSourceIds(np),
            "Backdrop",
            0,
            { quietNotFound: true }
          );
          if (ok) medCard.posterArtURL = "/imagecache/" + artName;
        }
        medCard.posterAR = 1.5;
        medCard.title = np.SeriesName || "";
        medCard.genre = np.Genres || [];
        const { resCodec, audioCodec } = this.pickVideoAudioStreams(np);
        medCard.resCodec = resCodec;
        medCard.audioCodec = audioCodec;
        medCard.cardType = cType.CardTypeEnum.NowScreening;
        let cr = np.OfficialRating || "NR";
        const rc = this.ratingColour(cr);
        medCard.contentRating = rc.contentRating;
        medCard.ratingColour = rc.ratingColour;
        medCard.mediaType = "episode";
      } else if (
        t === "movie" ||
        t === "video" ||
        t === "musicvideo" ||
        t === "trailer"
      ) {
        const fileName = `${np.Id}.jpg`;
        await this.cacheItemImage(fileName, np.Id, "Primary");
        medCard.posterURL = "/imagecache/" + fileName;
        if (hasArt === "true") {
          const artName = `${np.Id}-art.jpg`;
          const ok = await this.cacheItemImage(
            artName,
            this.backdropSourceIds(np),
            "Backdrop",
            0,
            { quietNotFound: true }
          );
          if (ok) medCard.posterArtURL = "/imagecache/" + artName;
        }
        medCard.posterAR = 1.5;
        medCard.title = np.Name || "";
        medCard.tagLine = (await util.emptyIfNull(np.Taglines && np.Taglines[0])) || (await util.emptyIfNull(np.Overview)) || "";
        medCard.genre = np.Genres || [];
        const { resCodec, audioCodec } = this.pickVideoAudioStreams(np);
        medCard.resCodec = resCodec;
        medCard.audioCodec = audioCodec;
        medCard.cardType = cType.CardTypeEnum.NowScreening;
        let cr = np.OfficialRating || "NR";
        const rc = this.ratingColour(cr);
        medCard.contentRating = rc.contentRating;
        medCard.ratingColour = rc.ratingColour;
        medCard.mediaType = "movie";
      } else if (t === "tvchannel") {
        const fileName = `${np.Id}-livetv.jpg`;
        await this.cacheItemImage(fileName, np.Id, "Primary");
        medCard.posterURL = "/imagecache/" + fileName;
        if (hasArt === "true") {
          const artName = `${np.Id}-livetv-art.jpg`;
          const ok = await this.cacheItemImage(
            artName,
            this.backdropSourceIds(np),
            "Backdrop",
            0,
            { quietNotFound: true }
          );
          if (ok) medCard.posterArtURL = "/imagecache/" + artName;
        }
        medCard.posterAR = 1.5;
        medCard.title = np.Name || np.SeriesName || "Live TV";
        medCard.tagLine =
          (await util.emptyIfNull(np.SeriesName)) ||
          (await util.emptyIfNull(np.Overview)) ||
          (np.ChannelName || "");
        medCard.genre = np.Genres || [];
        const { resCodec, audioCodec } = this.pickVideoAudioStreams(np);
        medCard.resCodec = resCodec;
        medCard.audioCodec = audioCodec;
        medCard.cardType = cType.CardTypeEnum.NowScreening;
        const rc = this.ratingColour(np.OfficialRating || "NR");
        medCard.contentRating = rc.contentRating;
        medCard.ratingColour = rc.ratingColour;
        medCard.mediaType = "episode";
      } else {
        continue;
      }

      if (hideUser !== "true") {
        medCard.user = session.UserName || "";
        medCard.device = session.DeviceName || session.Client || "";
      }
      medCard.playerDevice = session.DeviceName || session.Client || "";
      medCard.runTime = runTicks ? Math.round(runTicks / 10000000 / 60) : 0;
      medCard.progress = runTicks ? Math.round(posTicks / 10000000 / 60) : 0;
      medCard.progressPercent = runTicks ? Math.round((posTicks / runTicks) * 100) : 0;
      medCard.runDuration = runTicks ? Math.round(runTicks / 10000000 / 60) / 100 : 0;
      medCard.runProgress = runTicks ? Math.round(posTicks / 10000000 / 60) / 100 : 0;

      if (!(await util.isEmpty(np.CommunityRating))) {
        medCard.rating = Math.round(np.CommunityRating * 10) + "%";
      } else {
        medCard.rating = "";
      }

      medCard.genre = await util.emptyIfNull(np.Genres);
      medCard.summary = np.Overview || "";
      medCard.playerIP = remoteAddr;
      medCard.playerLocal = playerLocal;

      if (t === "audio") {
        medCard.contentRating = "";
        medCard.ratingColour = "badge-dark";
      }

      medCard.decision = transcode === "transcode" ? "transcode" : "direct";

      const anyLocationFilter =
        filterRemote === "true" || filterLocal === "true";
      let okToAdd = false;
      if (!anyLocationFilter) {
        okToAdd = true;
      } else {
        if (filterRemote === "true" && playerLocal === false) okToAdd = true;
        if (filterLocal === "true" && playerLocal === true) okToAdd = true;
      }
      if (users.length && session.UserName && !users.includes(String(session.UserName).toLowerCase())) okToAdd = false;
      if (
        devices.length &&
        !this.deviceFilterAllows(devices, medCard.playerDevice, medCard.device)
      )
        okToAdd = false;
      if (excludeList.length && libraryName && excludeList.includes(libraryName.toLowerCase())) okToAdd = false;

      if (okToAdd) nsCards.push(medCard);
    }

    return nsCards;
  }

  async resolveLibraryIds(onDemandLibraries) {
    const folders = await this.request("get", "/Library/MediaFolders", {});
    const items = (folders && folders.Items) || [];
    const wanted = String(onDemandLibraries || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const ids = [];
    for (const w of wanted) {
      const found = items.find((it) => it.Name && it.Name.toLowerCase() === w);
      if (found) ids.push(found.Id);
      else {
        const d = new Date();
        console.log(d.toLocaleString() + " ✘✘ WARNING ✘✘ - On-demand library '" + w + "' not found (" + this.displayName + ")");
      }
    }
    return ids;
  }

  filterItemsByGenreAndRating(items, genres, contentRatings, recentlyAdded) {
    let list = items.slice();
    if (recentlyAdded > 0) {
      const from = new Date();
      from.setDate(from.getDate() - recentlyAdded);
      from.setHours(0, 0, 0, 0);
      list = list.filter((it) => it.DateCreated && new Date(it.DateCreated) >= from);
    } else {
      if (genres && genres.length) {
        list = list.filter((it) => {
          const g = (it.Genres || []).map((x) => String(x).toLowerCase());
          return genres.some((gv) => g.includes(String(gv).toLowerCase()));
        });
      }
      if (contentRatings && contentRatings.length) {
        const exclude = new Set(contentRatings.map((c) => String(c).toLowerCase()));
        list = list.filter((it) => {
          const or = (it.OfficialRating || "").toLowerCase();
          return !exclude.has(or);
        });
      }
    }
    return list;
  }

  async fetchLibraryItems(parentId, genres, recentlyAdded, contentRatings) {
    const data = await this.request("get", "/Items", {
      ParentId: parentId,
      Recursive: true,
      IncludeItemTypes: "Movie,Series",
      Limit: 20000,
      Fields:
        "Overview,Genres,DateCreated,RunTimeTicks,CommunityRating,OfficialRating,Taglines,ProductionYear,Studios,Path,ParentBackdropItemId,SeriesId,ParentPrimaryImageItemId",
    });
    const raw = (data && data.Items) || [];
    return this.filterItemsByGenreAndRating(raw, genres, contentRatings, recentlyAdded);
  }

  async GetOnDemand(
    onDemandLibraries,
    numberOnDemand,
    playThemes,
    playGenenericThemes,
    hasArt,
    genres,
    recentlyAdded,
    contentRatings
  ) {
    let odCards = [];
    if (genres != undefined) {
      genres = genres
        .replace(/, /g, ",")
        .replace(/ ,/g, ",")
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);
    }
    if (contentRatings !== undefined) {
      contentRatings = contentRatings
        .replace(/, /g, ",")
        .replace(/ ,/g, ",")
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);
    }

    let odRaw = [];
    try {
      const keys = await this.resolveLibraryIds(onDemandLibraries || "");
      for (const libId of keys) {
        const batch = await this.fetchLibraryItems(libId, genres, recentlyAdded, contentRatings);
        if (!batch.length) continue;
        const picked = await util.build_random_od_set(numberOnDemand, batch, recentlyAdded);
        for (const odc of picked) {
          odc.ctype = recentlyAdded > 0 ? CardTypeEnum.RecentlyAdded : CardTypeEnum.OnDemand;
          odRaw.push(odc);
        }
      }
    } catch (err) {
      const now = new Date();
      console.log(now.toLocaleString() + " *On-demand - " + this.displayName + ": " + err.message);
      throw err;
    }

    if (!odRaw.length) {
      const now = new Date();
      console.log(now.toLocaleString() + " No On-demand titles available (" + this.displayName + ")");
      return odCards;
    }

    for (const md of odRaw) {
      const medCard = new mediaCard();
      const it = String(md.Type || "").toLowerCase();

      if (it === "series") {
        medCard.tagLine = md.Name || "";
        const mediaId = md.Id;
        medCard.DBID = mediaId;
        medCard.theme = "";
        if (playThemes === "true") {
          /* Jellyfin has no Plex-style theme URL; optional TVDB via tvthemes could be added */
        }
        if (!(await util.isEmpty(md.CommunityRating))) {
          medCard.rating = Math.round(md.CommunityRating * 10) + "%";
        } else medCard.rating = "";

        const fileName = `${mediaId}.jpg`;
        await this.cacheItemImage(fileName, mediaId, "Primary");
        medCard.posterURL = "/imagecache/" + fileName;
        if (hasArt === "true") {
          const artFile = `${mediaId}-art.jpg`;
          const ok = await this.cacheItemImage(
            artFile,
            this.backdropSourceIds(md),
            "Backdrop",
            0,
            { quietNotFound: true }
          );
          if (ok) medCard.posterArtURL = "/imagecache/" + artFile;
        }
        medCard.posterAR = 1.47;
        medCard.runTime = md.RunTimeTicks ? Math.round(md.RunTimeTicks / 10000000 / 60) : 0;
        medCard.title = md.Name || "";
      } else if (it === "movie") {
        const movieFileName = `${md.Id}.jpg`;
        await this.cacheItemImage(movieFileName, md.Id, "Primary");
        medCard.posterURL = "/imagecache/" + movieFileName;
        if (hasArt === "true") {
          const artName = `${md.Id}-art.jpg`;
          const ok = await this.cacheItemImage(
            artName,
            this.backdropSourceIds(md),
            "Backdrop",
            0,
            { quietNotFound: true }
          );
          if (ok) medCard.posterArtURL = "/imagecache/" + artName;
        }
        medCard.posterAR = 1.47;
        medCard.title = md.Name || "";
        medCard.runTime = md.RunTimeTicks ? Math.round(md.RunTimeTicks / 10000000 / 60) : 0;
        const { resCodec, audioCodec } = this.pickVideoAudioStreams(md);
        medCard.resCodec = resCodec;
        medCard.audioCodec = audioCodec;
        medCard.tagLine = (await util.emptyIfNull(md.Taglines && md.Taglines[0])) || "";
        if (!(await util.isEmpty(md.CommunityRating))) {
          medCard.rating = Math.round(md.CommunityRating * 10) + "%";
        } else medCard.rating = "";
      } else {
        continue;
      }

      if (medCard.tagLine === "") medCard.tagLine = medCard.title;
      medCard.mediaType = it === "series" ? "show" : "movie";

      let cr = md.OfficialRating || "NR";
      const rc = this.ratingColour(cr);
      medCard.contentRating = rc.contentRating;
      medCard.ratingColour = rc.ratingColour;

      medCard.year = md.ProductionYear || "";
      medCard.genre = await util.emptyIfNull(md.Genres);
      medCard.summary = md.Overview || "";
      if (!(await util.isEmpty(md.Studios)) && md.Studios[0]) {
        medCard.studio = md.Studios[0].Name || "";
      }
      medCard.cardType = md.ctype;
      odCards.push(medCard);
    }

    const now = new Date();
    if (odCards.length) {
      console.log(now.toLocaleString() + " On-demand titles refreshed (" + this.displayName + ") (" + onDemandLibraries + ")");
    }
    return odCards;
  }
}

module.exports = Jellyfin;
