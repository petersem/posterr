#!/bin/bash
url=""
user=""
working_dir=""
# check if called with sudo first
if [ $EUID -eq 0 ] && [ $# -ne 3 ]
then
    echo "Error: You must call this script as your normal user, not with sudo"
    exit 1
fi

# run initial install as standard user
if [ $EUID -ne 0 ]; then
    echo
    echo "Posterr CEC display service install"
    echo "-----------------------------------"
    echo
    # gather parameters
    working_dir=$(pwd)
    user=$USER
    read -p "What is the full url for your posterr instance? 
(eg http://192.168.1.134:9876) " url
    echo "Posterr URL: ${url}"
    echo "User name: ${user}"
    echo "Working directory: ${working_dir}"
    echo  

    # run script as sudo
    sudo $0 $url $user $working_dir
else
    # secondary install as super user
    url=$1
    user=$2
    working_dir=$3
    echo "Running secondary install as super user"
    echo  

    # check if cec-utils installed
    ready="$(apt list --installed | grep "cec-utils" | grep "installed")"
    if [[ $ready == *"installed"* ]] 
    then
        echo "cec-utils package installed!"
    else
        echo "Installing cec-utils package." 
        sudo apt update && sudo apt install cec-utils -y
    fi

    # modify the service template prior to istallation
    sed -e "s|WORKING_DIRECTORY|${working_dir}|g" \
    -e "s|USER|${user}|g" \
    "$working_dir/posterr-watcher.service" > "/etc/systemd/system/posterr-watcher.service"
    echo "Updated service template and copied to /etc/systemd/system folder"
    echo

    sed -e "s|POSTERR_URL|${url}|g" \
    "$working_dir/sleepwatch.template" > "$working_dir/sleepwatch.sh"
    echo "Updated sleepwatch.sh script with Posterr url"
    echo

    # update script permissions
    sudo chmod 777 $working_dir/sleepwatch.sh
    sudo chmod +X $working_dir/sleepwatch.sh
    sudo chmod 777 $working_dir/sleepwatch-remove-service.sh
    sudo chmod +X $working_dir/sleepwatch-remove-service.sh

    echo "Set script permissions"
    echo

    # install service
    sudo systemctl daemon-reload
    sudo systemctl enable posterr-watcher.service
    sudo systemctl start posterr-watcher.service
    echo "monitor service by running:
sudo systemctl status posterr-watcher.service"
    echo 
    echo "installation done"
fi

exit 1
