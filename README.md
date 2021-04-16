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
      - ./docker/poster/public/randomthemes:/usr/src/app/public/randomthemes
      - ./docker/poster/config:/usr/src/app/config
    ports:
      - 3000:3000
```

## Setup
Once running, open a browser to http://host_machine_ip:3000'. From here you will see a screen with a link to the setup page. (alternatively open your borwser with 'http://host_machine_ip:3000/settings')


## License

MIT

**Free Software, Hell Yeah!**
