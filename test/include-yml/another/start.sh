#!/bin/bash
sleep 1
from_fileserver=$(curl fileserver:8080/lorem.txt)
from_volume=$(cat /data/lorem.txt)

echo "fileserver: ${from_fileserver}"
echo "volume: ${from_volume}"
