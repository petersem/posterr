# Poster
Media display software for Plex, Sonarr and Radarr.

![Music playing](https://github.com/petersem/posterr/blob/master/doco/music.png?raw=true)
![Now screening](https://github.com/petersem/posterr/blob/master/doco/ns.png?raw=true)
![On-demand](https://github.com/petersem/posterr/blob/master/doco/od.png?raw=true)
![Coming soon](https://github.com/petersem/posterr/blob/master/doco/cs.png?raw=true)
![Landscape - background art mode](https://github.com/petersem/posterr/blob/master/doco/artmode.png?raw=true)
![Settings](https://github.com/petersem/posterr/blob/master/doco/settings.png?raw=true)

## Alpha software
This software is still considered `ALPHA` quality. (Still not feature complete) 
- **Check this page often for updates**

Limitations:
 - The 'Slide effect' transitions has a UI issue and doesn't look good yet (fade is fine)
 - Software has not been rigorously tested
 - The are still some layout issues for tag lines and the progress bar
 - Supported browsers are Chrome and MS Edge. It is possible to get working with Firefox, but for now, im leaving that off the list. (other browsers may work, but have not been tested)
 - Not all screen sizes and resolutions will scale and look correct at this stage.
 - See the issues section on GitHub for a full list of defect and enhancement requests.
 
## Features
 - Now Screening: Shows and movies from Plex.
 - Playing: Music from Plex.
 - On-demand: Random on-demand titles from multiple specified Plex libraries.
 - Coming Soon: Shows in Sonarr that are releasing in a given number of days (or Season premieres).
 - Coming Soon: Movies in Radarr that are releasing in a given number of days.
 - Option to play TV themes (available for most shows)
 - Option to play a random MP3 of your choice for movies (add your own MP3 files)
 - Setup page (dark theme)
 - Built in Node JS, and packaged as a Docker image. (included image health check)
 - Now Screening / Playing displays a progress bar (green for direct play and red for transcoding)
 - Displays information for media, such as run time, content rating, studio, etc. 
 - Move the mouse cursor to the bottom footer of the page to hide it
 - Low resource usage. Memory: 20-35mb, Diskspace: 175mb, CPU: < 1% (running on a Synology NAS with a Celeron processor)
 - Checks for updates in Now Screening / Playing every 10 seconds (Will not display updates until browser `refresh period` is reached)
 - Browser-based, so can run the app on one machine and a browser on another.
 - Background artwork option for slides (when available)

## Possible Uses
 - Mount a monitor on your wall (extra points if framed) and showcase your home media setup
 - Use it on a second monitor to keep an eye on what is running
 - Run it on a small screen mounted outside your theater room to show when a movie is in progress
 - Use a reverse proxy, or port-forward, to let your friends see what is playing, available, and coming soon

## Installation
Installation options are as follows:

### Node (for development use)
 - Ensure you have the latest version of Node installed
 - Clone this repo to your local disk
 - Open the directory from a command prompt / terminal
 - Run 'npm install'
 - Run 'npm start'

### Docker Compose (preferred)
Create the following directories in your docker folder:
 - .../docker/poster/config
 - .../docker/poster/randomthemes

```ya
version: '2.4'

services:
  posterr:
    image: petersem/poster
    container_name: posterr
    environment:
      TZ: Australia/Brisbane
    volumes:
      - ./docker/poster/randomthemes:/usr/src/app/public/randomthemes
      - ./docker/poster/config:/usr/src/app/config
    ports:
      - 3000:3000
```
#### Details
|Variable|Details|
|--|--|
|TZ|Your local timezone. Look this up on [wikipedia](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) and use the `TZ Database Name` value.|
|/docker/poster/config|This is required to save your Posterr settings|
|/docker/poster/randomthemes|This is optional. If you leave it out then there are a few royaly free movie tunes that are made available. If you choose to add this, then you need to populate this directory with your own MP3 files that will play for movie slides|
|Ports|If you have a conflict with port 3000 already in use then you can change this to a different port. e.g. 9876:3000 (second value must always be 3000)|

## Updates
 - If installed with Docker, then use containrr/watchtower to auto-update
 - If you cloned this repo locally, then it is on you to manually watch for updates and download new versions

## Setup
Get to the settings page in a number of ways:
 - On initial load, you will be prompted
 - Change the URL to _'http://hostIP:3000/settings'_
 - Clicking on the top banner title of any slide)
 - If on the 'no content' page, then click this text

*The default settings page password is:* **raidisnotabackup**

Buttons are:
 - `Reload Saved` - Discards any changes and reloads last saved settings
 - `Main Page` - Navigates to main Posterr page (Any unsaved settings are discarded)
 - `Save` - Saves all fields and restarts the application

Following is a description of each setup option. Options with a **'*'** are mandatory.

#### General Options
|Option|Description  |
|--|--|
|*Password |Settings page password|
|*Slide duration|How long (in seconds) that each slide will be shown for. (suggest 5-30 seconds)|
|*Refresh period|How long ( in seconds) before the browser auto-refreshes all slides (suggested 120-300 seconds)|
|Enable background artwork|Shows media artwork in a faded background behind the poster|
|TV theme tunes|`ON / OFF` Enable to play theme tunes for slides that show TV shows. (note that in rare cases, some TV themes are unavaible) |
|Generic movie themes|`ON / OFF` Enable to play random tunes for slides that show movies. (Supplied MP3's are royalty free from https://www.bensound.com/ ) |
|Slide Transitions|`Slide / Fade`The slide transition effect.|
#### Plex Options
|Option|Description  |
|--|--|
|*HTTPS connection|`ON / OFF` If your Plex server only allows secure connections|
|*Server IP|The IP or domain name for plex (exclude http/https)|
|*Server port|The port Plex uses (default is 32400)|
|*Plex token|Token required to access Plex. ([Finding a Plex token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/))|
|Plex Libraries for On-demand titles|Enter the Plex library name(s) to use for on-demand slides. Comma-seperated if multiple libraries. *(**Leave this blank** if you do not want on-demand slides)* |
|Number to display |The number of random titles to show for on-demand slides (avoid going over 200 _'combined'_ slides for all libraries, or may cause excessive polling on Plex server.)  |
|On-demand refresh period|The refresh period in minutes before new random titles are loaded |
#### Sonarr Options (v3 only)
|Option|Description  |
|--|--|
|Sonarr token|The Sonarr API key required for accessing Sonarr. *(**Leave this blank** if you do not want coming soon TV titles to show)*|
|Sonarr url|The full URL and Port for your Sonarr installation.|
|Days ahead|The number of days to look ahead in the Sonarr calendar for titles. Set this low number, like `3-5`, if `Show Premieres` is off. Alternatively, up to `60+` days is fine if on.|
|Show premieres|`ON / OFF` Only season premieres will be shown |
#### Radarr Options
|Option|Description  |
|--|--|
|Radarr token|The Radarr API key required for accessing Radarr. *(**Leave this blank** if you do not want coming soon Movie titles to show)*|
|Radarr url|The full URL and Port for your Radarr installation.|
|Days ahead|The number of days to look ahead in the Radarr calendar for titles.|

## Troubleshooting
Should you encounter a problem, it may be listed [HERE](https://github.com/petersem/posterr/wiki/Troubleshooting).

## Support
There is no _'official'_ support for this product, however should you encounter issues, raise a defect on the github page and I will prioritise and address it.

Support my efforts and continued development. Click this link to Buy me a coffee: 

 - [Support development](https://paypal.me/thanksmp)

Thanks,

Matt Petersen (April 2021)

## Technical Details
Posterr uses the following:
 - Node & Node Express
 - The awesome [PlexAPi](https://github.com/phillipj/node-plex-api)
 - Jquery
 - Bootstrap
 - Popper.js
 - Font-Awesome
 - Plex (via PlexAPI)
 - Sonarr (via API)
 - Radarr (via API)

## License

MIT

**Free Software, Hell Yeah!**
