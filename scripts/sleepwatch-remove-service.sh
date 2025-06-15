# remove service
echo "Poster-watcher removal"
echo "----------------------"
echo
if [ "$EUID" -ne 0 ]; then
   echo "Must run with sudo. Restarting script as super user"
   echo
   sudo $0
else
   sudo systemctl daemon-reload
   sudo systemctl stop posterr-watcher.service
   sudo rm /etc/systemd/system/posterr-watcher.service
   echo "posterr-watcher.service removed"
fi
