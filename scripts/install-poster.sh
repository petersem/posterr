#!/bin/bash
cd /home/$LOGNAME
mkdir docker
mkdir docker/posterr
mkdir docker/posterr/config
mkdir docker/posterr/custom
cd docker

docker run -d \
  --name posterr \
  --restart always \
  -e TZ=US/Central \
  -v /home/$LOGNAME/docker/posterr/custom:/usr/src/app/public/custom \
  -v /home/$LOGNAME/docker/posterr/config:/usr/src/app/config \
  -p 9876:3000 \
  petersem/posterr

docker run -d \
  --name watchtower \
  --restart always \
  -e TZ=US/Central \
  -e WATCHTOWER_REMOVE_VOLUMES=true \
  -e WATCHTOWER_CLEANUP=true \
  -e WATCHTOWER_INCLUDE_STOPPED=true \
  -e WATCHTOWER_POLL_INTERVAL=15000 \
  -e WATCHTOWER_TIMEOUT=30s \
  -e WATCHTOWER_NOTIFICATIONS_LEVEL=error \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p 8811:8080 \
  nickfedor/watchtower

docker ps
echo 'If you see the posterr and watchtower containers listed, then you are done!'

# Run this script from a linux terminal, as follows:
# wget https://raw.githubusercontent.com/petersem/posterr/refs/heads/master/scripts/install-poster.sh -O script.sh && chmod +x script.sh && ./script.sh && rm script.sh