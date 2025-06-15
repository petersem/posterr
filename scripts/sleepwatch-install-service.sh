#!/bin/bash
sudo cp posterr-watcher.service /etc/systemd/system
sudo systenmctl daemon-reload
sudo systemctl enable posterr-watcher.service
sudo systemctl start posterr-watcher.service
echo monitor service by running 'systemctl status posterr-watcher.service'