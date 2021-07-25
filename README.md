# Posterr
Media display software for Plex, Sonarr and Radarr.

![Music playing](https://github.com/petersem/posterr/blob/master/doco/music.png?raw=true)
![Now screening](https://github.com/petersem/posterr/blob/master/doco/ns.png?raw=true)
![On-demand](https://github.com/petersem/posterr/blob/master/doco/od.png?raw=true)

- Check [Here](https://github.com/petersem/posterr/wiki/Latest-changes) for the latest updates
- Visit the [wiki](https://github.com/petersem/posterr/wiki/Known-Issues) for more information on known issues.
- Visit the [Discord Group](https://discord.gg/c5mHXaY5) for discussions and limited support.
- **The default password is:** raidisnotabackup

 > **IMPORTANT NOTE ON UPGRADES**
 > - Whilst I work hard to ensure that upgrades are backwards compatible, there are rare times that you will need to update settings. Check [here](https://github.com/petersem/posterr/wiki/Latest-changes) for detailed notes on each updated.

## Features
 - Displays movies, shows, music poster for what is currently playing.
 - Displays random (on-demand) titles from multiple Plex libraries.
 - Displays custom pictures, background art, and themes
 - Shows coming soon titles from Sonarr (or Season premieres).
 - Shows coming soon titles from Radarr.
 - Optionally plays TV and Movies themes, if available
 - A progress bar (green for direct play and red for transcoding) displays for playing titles
 - Various metadata displayed, such as run time, content rating, studio, etc. 
 - Move the mouse cursor to the bottom footer of the page to hide it
 - Background artwork option for improved landscape view (when available)
 - Automatically scales for most display sizes and orientation.
 - Plus [more](https://github.com/petersem/posterr/wiki/Detailed-Features)

## Possible Uses
 - Mount a monitor on your wall and showcase your home media setup
 - Use it on a second monitor to keep an eye on what is running
 - Run it on a small screen mounted outside your theater room to show when a movie is in progress
 - Use a reverse proxy, or port-forward, to let your friends see what is playing, available, and coming soon

## Technical Features
 - Built in Node JS, and packaged as a Docker image. (included image health check)
 - Low resource usage. Memory: 20-35mb, Diskspace: ~75mb, CPU: < 1% (running on a Synology NAS with a Celeron processor)
 - Checks for updates in Now Screening / Playing every 10 seconds (Will not display updates until browser refreshed or all slides cycled through)
 - Browser-based, so can run the app on one machine and a browser on another.
 - Browser connectivity checks and auto-reconnect when the Posterr app restarts. (eg During container updates) 
 - Supports screen resolution heights from 320 pixels to around 3500 pixels. 
 - Supports reverse proxy setup for wildcard dns or alternate base path.
 - Built-in recovery features should the Docker app, or Plex, go offline.

## Installation
Installation details are as follows:

### Docker Compose
Create the following directories in your docker folder:
 - .../docker/posterr/config

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
#### Details
|Option|Details|
|--|--|
|TZ|Your local timezone. Go to [wikipedia](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) and use the `TZ Database Name` value.|
|/docker/posterr/config|This is required to save your Posterr settings|
|Ports|Change first part to a different port if needed. e.g. 9876:3000|
|BASEPATH|_"/path"_ Use this for reverse proxy setups which require a base path value. **This line can be left out, or value left blank** if you dont use alternate paths. |

## Updates
 - Use containrr/watchtower to auto-update Posterr.
 
## Setup
Get to the settings page in a number of ways:
 - On initial load, you will be prompted.
 - Change the URL to _'http://hostIP:3000/settings'_
 - Clicking on the top banner title of any slide.
 - If on the 'no content' page, then click this text

*The default password is:* **raidisnotabackup**

Buttons are:
 - `Reload Saved` - Discards any changes and reloads last saved settings
 - `Main Page` - Navigates to main Posterr page (unsaved changes lost)
 - `Save` - Saves and restarts the application.

 > Please see the [Posterr Wiki](https://github.com/petersem/posterr/wiki/Posterr-Configuration) for more information.

## Troubleshooting
Should you encounter a problem, the solution may be listed [HERE](https://github.com/petersem/posterr/wiki/Troubleshooting).

## Support
 - There is no _'official'_ support for this product, however should you encounter issues, raise an issue on the github page.
 - Limited support in [Discord](https://discord.gg/pucjF6j8k9)

### Support my efforts and continued development 

> [![](https://github.com/petersem/posterr/blob/master/doco/coffeesmall.gif?raw=true)](https://www.paypal.com/paypalme/thanksmp)


Thanks,

Matt Petersen (April 2021)

## Technical Details
Posterr uses the following:
 - Node & Node Express
 - The awesome [Node-Plex-APi](https://github.com/phillipj/node-plex-api)
 - Jquery
 - Bootstrap
 - Popper.js
 - Font-Awesome
 - Plex (via PlexAPI)
 - Sonarr (via API)
 - Radarr (via API)
 - Posters and artwork from Plex, TVDB and TMDB.

## License

MIT

**Free Software, Hell Yeah!**
