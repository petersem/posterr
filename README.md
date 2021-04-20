# Poster
Media display software for Plex, Sonarr and Radarr.

![Music playing](https://github.com/petersem/poster/blob/master/doco/music.png?raw=true)
![Now screening](https://github.com/petersem/poster/blob/master/doco/ns.png?raw=true)
![On-demand](https://github.com/petersem/poster/blob/master/doco/od.png?raw=true)
![Coming soon](https://github.com/petersem/poster/blob/master/doco/cs.png?raw=true)
![Settings](https://github.com/petersem/poster/blob/master/doco/settings.png?raw=true)

## Alpha software
This software is still considered `ALPHA` quality. (Still not feature complete) 

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

## Possible Uses
 - Mount a monitor on your wall (extra points if framed) and showcase your home media setup
 - Use it on a second monitor to keep an eye on what is running
 - Run it on a small screen mounted outside your theater room to show when a movie is in progress
 - Use a reverse proxy, or port-forward, to let your friends see what is playing, available, and coming soon

## Installation
Installation options are as follows:

### Node (for non production use)
 - Ensure you have the latest version of Node installed
 - Clone this repo to your local disk
 - Open the directory from a command prompt / terminal
 - Run 'npm install'
 - Run 'npm start'

### Docker Compose (preferred)
Create the follow directories in your docker folder:
 - .../docker/poster/config
 - .../docker/poster/randomthemes

```ya
version: '2.4'

services:
  poster:
    image: petersem/poster
    container_name: poster
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
|/docker/poster/config|This is required to save your Poster settings|
|/docker/poster/randomthemes|This is optional. If you leave it out then there are a few royaly free movie tunes that are made available. If you choose to add this, then you need to populate this directory with your own MP3 files that will play for movie slides|
|Ports|If you have a conflict with port 3000 already in use then you can change this to a different port. e.g. 9876:3000 (second value must always be 3000)|

## Updates
 - If installed with Docker, then use containrr/watchtower to auto-update
 - If you cloned this repo locally, then it is on you to manually watch for updates and download new versions

## Setup
Once running, open a browser to http://host_machine_ip:3000'. From here you will see a screen with a link to the setup page. (Once you have the system configured, return to settings by clicking on the top banner title of any slide)

*The default settings page password is:* **raidisnotabackup**

Buttons are:
 - `Reload Saved Settings` - Discards any changes and reloads last saved settings
 - `Main Page` - Navigates to main Poster page (Any unsaved settings are discarded)
 - `Save` - Saves all fields and restarts the application

Following is a description of each setup option. Options with a **'*'** are mandatory.

#### General Options
|Option|Description  |
|--|--|
|*Password |Settings page password|
|*Slide duration|How long (in seconds) that each slide will be shown for. (suggest 20-30 seconds)|
|*Refresh period|How long ( in seconds) before the browser auto-refreshes all slides (suggested 120-300 seconds)|
|TV theme tunes|`ON / OFF` Enable to play them tunes for slides that show TV shows. (note that in rare cases, some TV themes are unavaible) |
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
|Number to display |The number of random titles to show for on-demand slides |
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
Should you encounter a problem, it may be listed here:
### Container not starting
Check your yaml against what is in the example here. It could be as simple as a formatting issue with spaces or tabs. (tabs not allowed in yaml) 
### Container crashing after start
Check the container logs and see what they say. Ensure that there are no firewalls enabled that are blocking docker bridge networks. 
### Not all the expected slides are showing
Check the `Refresh Duration` and `Slide Duration` values. Its likely that this is too low if you have a lot playing or a large `number of on-demand` being selected.
### Container started but cannot access the app in a browser
This could be that the default port `3000` is in use already. Try setting it to another port, like 9876.
### The poster image doesn't load
Try refreshing your browser. Images are cached locally and dependant on your internet speed, may take a few seconds to initially load.
### The poster image looks to be the wrong size
Posters for Now screening and on-demand, come from your plex library. Find the media item in your library and update the poster art. 
### No TV theme being played
Provided that you have enabled the TV theme option, then this *is normal*. Most, but *not all*, TV shows have themes available.
### Not getting music when a movie title is displayed (or music repetative)
Providing you have enabled the Movie themes option, then there are two choices for music to play with movies. (In either case, if you don't have enough themes, then there will be duplication)
 - Use the provided royalty-free titles. (Leave out the volume mount for /randomthemes in your YAML)
 - Provide your own MP3 files. (Set the randomthemes volume mount and add your own MP3's)
 > Adding additional MP3 files to your `randomthemes` folder will decrease potential repitition of music

## Support
There is no official support for this product, however should you encounter issues, raise a defect on the github page and I will prioritise and address it.

Support my efforts and continued development. Click this link to Buy me a coffee: 

 - [Support development](https://paypal.me/thanksmp)

Thanks,

Matt Petersen (April 2021)

## License

MIT

**Free Software, Hell Yeah!**
