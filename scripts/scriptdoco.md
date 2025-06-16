
# Posterr Script - Download and start install steps
## What is this?
If you implement the `Sleep Timer` feature in Posterr, the screen is blanked out, but still powered on. This script uses the [`CEC`](https://support.google.com/chromecast/answer/7199917?hl=en#:~:text=CEC%20(Consumer%20Electronics%20Control)%20allows,Google%20streaming%20device%20is%20connected.) feature of your HDMI connected display to put the display in standby mode. This will save power and increase the longevity of your display.

*Posterr scripts are designed to work on a rPi with a connected CEC compatible display.* 

## Compatibility
There are items required for the script 
- These scripts will only work on a `Raspberry Pi 4/5`, that is being used to display Posterr
- The operating system should be `PI OS` or `PI OS Lite`. 
- Displays connected via HDMI.
- The monitor or tv being used must support CEC control.
- The `cec-utils` package is required for this script to work. 
*(the install script will install this if needed)* 

## Get the Posterr scripts 
### Download
```
cd ~/
curl -sSL https://raw.githubusercontent.com/petersem/posterr/master/scripts/rpiwatcherservice.tar.gz -o rpiwatcherservice.tar.gz 
mkdir ~/posterr-scripts
```
### Decompress
```
tar -xvf rpiwatcherservice.tar.gz -C ~/posterr-scripts
``` 
### Set script permissions
```
cd ~/posterr-scripts
sudo chmod 777 sleepwatch-install-service.sh
sudo chmod +X sleepwatch-install-service.sh
```
### Start installation
```
./sleepwatch-install-service.sh
```
> 
> Installation script **MUST** run as your standard user, not with sudo
> 
## Uninstall
To uninstall the Poster Script, run the remove script and then delete the poster-scripts folder
```
~/posterr-scripts/sleepwatch-remove-service.sh
cd ~
sudo rm -R posterr-scripts
```
## Troubleshooting
- Limited support is available on [Discord](https://discord.gg/TcnEkMEf9J).
- Run the following command to check the status of the service.
```
sudo systemctl status posterr-watcher.service
``` 

## Technical Details
- This script implements a `systemd service` which runs the `~/poster-scripts/sleepwatch.sh script`. 
- The sleepwatch script polls a Posterr API ever 5 seconds to determine if Posterr is in scheduled sleep mode or not. It then issues an `on` or `standby` command to the attached display.

The script does the following:
- Gathers the URL for Posterr, current user and home directory
- Substitutes values and creates the 'sleepwatch.sh' file.
- Substitutes values into the service `unit` file 
- Restarts as `super user` (required for installation)
- Installs `cec-utils` if not nstalled.
- Copies the `unit` file, installs, then starts the service. 

> ## *This is a new feature and script, so let me know how you go on Discord.*

[Return to main page](/README.md)