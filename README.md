# Posterr
## Media display software for Plex, Sonarr, Radarr, and Readarr. (Just like the display screens in movie theatre foyers)

![Docker Pulls](https://img.shields.io/docker/pulls/petersem/posterr) 
![Docker Image Size (tag)](https://img.shields.io/docker/image-size/petersem/posterr/latest?logo=docker) 
![GitHub Stars](https://img.shields.io/github/stars/petersem/posterr?style=flat)
![Version](https://img.shields.io/github/package-json/v/petersem/posterr?logoColor=blue)
![GitHub last commit](https://img.shields.io/github/last-commit/petersem/posterr)
![Platforms](https://img.shields.io/badge/platform-docker-blue)
[![User Guide](https://img.shields.io/badge/user_guide-wiki-informational?logo=github)](https://github.com/petersem/posterr/wiki/Posterr-Configuration)

![Slides](https://github.com/petersem/posterr/blob/master/doco/posterr.jpg?raw=true)
![Awtrix](https://github.com/petersem/posterr/blob/master/doco/awtrix.gif?raw=true)

- Check [Here](https://github.com/petersem/posterr/wiki/Latest-changes) for the latest updates
- Visit the [wiki](https://github.com/petersem/posterr/wiki/Known-Issues) for more information on known issues.
- Visit the [Discord Group](https://discord.gg/TcnEkMEf9J) for discussions and limited support.
- **The default password is:** raidisnotabackup

 > **IMPORTANT NOTE ON UPGRADES**
 > - There are rare times that you will need to update settings. Check [here](https://github.com/petersem/posterr/wiki/Latest-changes) for detailed notes on each updated.
 
---
## Features
 - Displays movies, shows, music poster for what's currently playing.
 - Displays random (on-demand) titles from multiple Plex libraries.
 - Displays custom pictures, background art, and themes
 - Shows coming soon titles from Sonarr (or Season premieres).
 - Shows coming soon titles from Radarr.
 - Shows coming soon books from Readarr.
 - Optionally plays TV and Movies themes, if available
 - A playing progress bar (green for direct play and red for transcoding)
 - Various metadata displayed, such as run time, content rating, studio, etc. 
 - Move the mouse cursor to the bottom footer of the page to hide it
 - Background artwork option for improved landscape view (when available)
 - Automatically scales for most display sizes and orientation.
 - 'Sleep timer' disables the display during set hours.
 - Trivia Quiz (multiple selectable topics)
 - Support LED Matrix displays running Awtrix software
 - Display custom web pages as slides (if web page compatible) - **EXPERIMENTAL!**
 - Rotate display -90° (for running on display devices, like Firesticks, which do not support portait rotation)
 - Post API (at '/api/sleep') to toggle sleep mode. (Pass in header values `'psw: your Posterr password'` and `'sleep: true|false'`)
 - Get API at the same endpoint will return the sleep status without any parsed parameters.
 - Supports `CEC` control of monitor inconjunction with the Posterr `Sleep Timer`. 
---
## Prerequisites
### Mandatory
 - Plex

### Optional
 - Sonarr v3.0
 - Radarr v4.3
 - Readarr v0.1.3
---

## Installation
Installation details are as follows:
### <ins>Docker Compose (X86, ARM64)</ins>
Create the following directories in your docker folder:
 - ./docker/posterr
 - ./docker/posterr/config
 - ./docker/posterr/custom

```ya
version: '2.4'

services:
  posterr:
    image: petersem/posterr
    container_name: posterr
    environment:
      TZ: Australia/Brisbane
      BASEPATH: ""
    volumes:
      - ./docker/posterr/config:/usr/src/app/config
      - ./docker/posterr/custom:/usr/src/app/public/custom
    ports:
      - 9876:3000
    restart: unless-stopped
```
### <ins>Docker CLI (X86, ARM64)</ins>
Create the following directories in your docker folder:
 - ./docker/posterr
 - ./docker/posterr/config
 - ./docker/posterr/custom

```
docker run -d --name posterr \
-p 9876:3000 \
-v ~/docker/posterr/config:/usr/src/app/config \
-v ~/docker/posterr/custom:/usr/src/app/public/custom \
-e TZ=Australia/Brisbane \
--restart=always \
petersem/posterr
```

#### Details
|Option|Details|
|--|--|
|TZ|Your local timezone. Go to [wikipedia](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) and use the `TZ Database Name` value.|
|/docker/posterr/config|This is required to save your Posterr settings|
|/docker/posterr/custom|This is required for custom pictures (and other custom media in the future)|
|Ports|Change first part to a different port if needed. e.g. 9876:3000|
|BASEPATH|_"/path"_ Use this for reverse proxy setups which require a base path value. **This line can be left out, or value left blank** if you dont use alternate paths. |

### <ins>Unraid</ins>
 - Use the Posterr template in community apps. (Being replaced with new version)

---
## CEC Control script installation **(rPi only)**
 - Install instructions are located [HERE](/scripts/scriptdoco.md)

---
## Updates
 - From v1.10.1, there will be a notice at the top of the settings screen informing you if you are running an old version. 
 - Use containrr/watchtower to auto-update Posterr in Docker environments
 - Update in the usual way for Unraid

---
## Setup
Get to the settings page in a number of ways:
 - On initial load, you will be prompted.
 - Change the URL to _'http://hostIP:9876/settings'_ (where `hostIP` is the IP number of the machine that Posterr is installed on. Change the port number if you set a different value. 3000 is the default for the binary executables)
 - Clicking on the top banner title of any slide.
 - If on the 'no content' page, then click this text

*The default password is:* **raidisnotabackup**

---
## Possible Uses
 - Mount a monitor on your wall and showcase your home media setup
 - Use it on a second monitor to keep an eye on what is running
 - Run it on a small screen mounted outside your theater room to show when a movie is in progress
 - Use a reverse proxy, or port-forward, to let your friends see what is playing, available, and coming soon

---
## Technical Features
 - Built in Node JS, and packaged as a Docker image. (included image health check)
 - Direct binary files also provided for MacOS, Linux, and Windows.
 - Low resource usage. Memory: 20-35mb, Diskspace: ~75mb, CPU: < 1% (running on a Synology NAS with a Celeron processor)
 - Checks for updates in Now Screening / Playing every 10 seconds (Will not display updates until browser refreshed or all slides cycled through)
 - Browser-based, so can run the app on one machine and a browser on another.
 - Browser connectivity checks and auto-reconnect when the Posterr app restarts. (eg During container updates) 
 - Supports screen resolution heights from 320 pixels to around 3500 pixels. 
 - Supports reverse proxy setup for wildcard dns or alternate base path.
 - Built-in recovery features should the Poster app, or Plex, go offline.

 > Please see the [Posterr Wiki](https://github.com/petersem/posterr/wiki/Posterr-Configuration) for more information.

---
## Star History
[![Star History Chart](https://api.star-history.com/svg?repos=petersem/posterr,petersem/monocker,petersem/dockerholics,petersem/exportarr&type=Date)](https://star-history.com/#petersem/posterr&petersem/monocker&petersem/dockerholics&petersem/exportarr&Date)
---
## Troubleshooting
Should you encounter a problem, the solution may be listed [HERE](https://github.com/petersem/posterr/wiki/Troubleshooting).

---
## Support
 - There is no _'official'_ support for this product, however should you encounter issues, raise an issue on the github page.
 - Limited support in [Discord](https://discord.gg/TcnEkMEf9J)

---
### Support my efforts and continued development 

> [![](https://github.com/petersem/posterr/blob/master/doco/coffeesmall.gif?raw=true)](https://www.paypal.com/paypalme/thanksmp)


Thanks,

Matt Petersen (April 2021)

---
## Technical Details
Posterr uses the following:
 - Node & Node Express
 - The awesome [Node-Plex-APi](https://github.com/phillipj/node-plex-api)
 - Jquery
 - Bootstrap
 - Font-Awesome
 - Plex (via PlexAPI)
 - Sonarr (via API)
 - Radarr (via API)
 - Readarr (via API)
 - Posters and artwork from Plex, TVDB and TMDB.
 - Awtrix (via API)

---
## Notice
> Posterr is dependant on third party applications and services. Some features may fail temporarily or permenantly if the dependancies are unavailable, or become incompatible for any technical or legal reason. This software comes with no warranty or guarantee of any kind. Images and themes that you download through Posterr may be copyrighted, and are the property of the respective copyright holders.

---
## License

MIT

**Free Software, Hell Yeah!**
