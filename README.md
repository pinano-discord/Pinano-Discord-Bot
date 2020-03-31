# The Pracitce Room Recital Bot

[![Build Status](https://travis-ci.com/pinano-discord/Pinano-Discord-Bot.svg?branch=master)](https://travis-ci.com/pinano-discord/Pinano-Discord-Bot)

This is the open source for the Pinano discord bot. The bot serves to track stats and help out in the Pinano discord community.

# Development instructions

The bot is written in Javascript using [NodeJS](https://nodejs.org/).

To start developing, you should install [`nodenv`](https://github.com/nodenv/nodenv) to ensure you
use the same version of Node as other developers.

On MacOS, you can run:

    brew install nodenv node-build
    nodenv install $(cat .node-version)

If you just want to jump in without install `nodenv`, make sure you look at [`.node-version`](.node-version)
for the current version we are using.

You must have mongodb installed and running. One way to achieve this is to use Docker:

    docker run --name pinano-mongo -p 27017:27017 -d mongo:latest

Then you can install all dependencies:

    npm install

And run any tests:

    npm test

# Testing instructions

If you'd like to actually run a test bot, you will need to follow the instructions to
[create a bot user](https://discordjs.guide/preparations/setting-up-a-bot-application.html).

Set the following environment variables customize what the bot connects to and what messages
it responds to:

    export BOT_TOKEN='your token here'
    export BOT_PREFIX='x!!'
    export BOT_BITRATE=96

The token can be obtained from the bot's Discord settings page.

# Contribution instructions

All help is welcome, if you have anything to improve you can either open an **issue** or you can submit a **pullrequest** directly.
