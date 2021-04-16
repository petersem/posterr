# Poster
Media display software for Plex, Sonarr and Radarr.

![Music playing](https://github.com/petersem/poster/blob/master/doco/music.png)
![Music playing](https://github.com/petersem/poster/blob/master/doco/ns.png)
![Music playing](https://github.com/petersem/poster/blob/master/doco/od.png)
![Music playing](https://github.com/petersem/poster/blob/master/doco/cs.png)
![Music playing](https://github.com/petersem/poster/blob/master/doco/settings.png)

## Features
 - Now Screening: Shows and movies from Plex.
 - Playing: Music from Plex.
 - On-demand: Random on-demand titles from a specified Plex library.
 - Coming Soon: Shows in Sonarr that are releasing in a given number of days (or Season premieres).
 - Coming Soon: Movies in Radarr that are releasing in a given number of days.
 - Option to play TV themes (when theme available)
 - Option to play a random MP3 of your choice for movies
 - Setup page (dark theme)
 - Built in Node and packaged as a Docker image. (included image health check)
 - Now Screening / Playing shows a progress bar (green for direct play and red for transcoding)
 - Shows information for media, such as run time, content rating, studio, etc. 
 - Move the mouse cursor to the bottom of the page to hide it
 - Low resource usage. (Memory: 20-35mb, Diskspace: 175mb, CPU: < 1%)

## Possible Uses
 - Mount a monitor on your wall (extra points if framed) and showcase your home media setup
 - Use it on a second monitor to keep an eye on what is running
 - Run it on a small screen mounted outside your theater room to show when a movie is in progress
 - Use a reverse proxy, or port-forward, to let your friends see what is playing, available, and coming soon

## Installation
Installation options are as follows:

### Node
 - Ensure you have the latest version of Node installed
 - Clone this repo to youur local disk
 - Open the directory from a command prompt / terminal
 - Run 'npm start'

### Docker Compose
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

## Setup
Once running, open a browser to http://host_machine_ip:3000'. From here you will see a screen with a link to the setup page. (alternatively open your browser with 'http://host_machine_ip:3000/settings')

*The default settings page password is:* **raidisnotabackup**

Buttons are:
 - `Reload Saved Settings` - Discards any changes and reloads last saved settings
 - `Main Page` - Navigates to main Poster page (Any unsaved settings are discarded)
 - `Save` - Saves all fields and restarts the application

Following is a description of each setup option. Options with a **'*'** are mandatory.

#### General Options
Option|Desciption  |
|--|--|
|password |Settings page password|
|*Slide duration|How long (in seconds) that each slide will be shown for.|
|*Refresh period|How long ( in seconds) before the browser auto-refreshes all slides (suggested 120-300 seconds)|
|TV theme tunes|`ON|OFF` Enable to play them tunes for slides that show TV shows. (note that in rare cases, some TV themes are unavaible) |
|Generic movie themes|`ON|OFF` Enable to play random tunes for slides that show movies. (Supplied MP3's are royalty free from https://www.bensound.com/ ) |
|Slide Transitions|`Slide|Fade`The slide transition effect.|
#### Plex Options
Option|Desciption  |
|--|--|
|*HTTPS connection|`ON|OFF` If your Plex server only allows secure connections|
|*Server IP|The IP or domain name for plex (exclude http/https)|
|*Server port|The port Plex uses (default is 32400)|
|*Plex token|Token required to access Plex. ([Finding a Plex token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/))|
|Plex Libraries for On-demand titles|Enter a Plex library name to use for on-demand slides. *(**Leave this blank** if you do not want on-demand slides)* |
|Number to display |The number of random titles to show for on-demand slides |
|On-demand refresh period|The refresh period in minutes before new random titles are loaded |
#### Sonarr Options
*Note that only Sonarr v3 is currently supported*
Option|Desciption  |
|--|--|
|Sonarr token|The Sonarr API key required for accessing Sonarr. *(**Leave this blank** if you do not want coming soon TV titles to show)*|
|Sonarr url|The full URL and Port for your Sonarr installation.|
|Days ahead|The number of days to look ahead in the Sonarr calendar for titles. Set this less to a low number, like 3-5, if 'Show Premieres' is off. Alternatively, up to 60 days is fine if on.|
|Show premieres|`ON|OFF` Only season premieres will be shown |
#### Radarr Options
Option|Desciption  |
|--|--|
|Radarr token|The Radarr API key required for accessing Sonarr. *(**Leave this blank** if you do not want coming soon Movie titles to show)*|
|Radarr url|The full URL and Port for your Radarr installation.|
|Days ahead|The number of days to look ahead in the Radarr calendar for titles. |

## License

MIT

**Free Software, Hell Yeah!**
