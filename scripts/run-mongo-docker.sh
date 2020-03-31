#!/bin/bash

CONTAINER_NAME="practice-room-mongo-dev"

if [[ ! "$(docker ps -aqf name=$CONTAINER_NAME)" ]]; then
docker run \
    -p 27017-27019:27017-27019 \
    --name "$CONTAINER_NAME" \
    -v $PWD/.db:/data/db \
    -e MONGO_INITDB_ROOT_USERNAME="user" \
    -e MONGO_INITDB_ROOT_PASSWORD="password" \
    -e MONGO_INITDB_DATABASE="db" \
    mongo:4.0.4
else
  docker start -ia "$CONTAINER_NAME"
fi
