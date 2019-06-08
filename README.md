# Pinano Bot

[![Build Status](https://travis-ci.com/pinano-discord/Pinano-Discord-Bot.svg?branch=master)](https://travis-ci.com/pinano-discord/Pinano-Discord-Bot)

This is the open source for the Pinano discord bot. The bot serves to track stats and help out in the Pinano discord community.

## Contributors

All help is welcome, if you have anything to improve you can either open an **issue** or you can submit a **pullrequest** directly.

The bot is written in Javascript using [NodeJS](https://nodejs.org/).

To start developing, you should install [`nodenv`](https://github.com/nodenv/nodenv) to ensure you
use the same version of Node as other developers. There are instructions at the link above. However,
if you just want to jump in without install `nodenv`, make sure you look at [`.node-version`](.node-version)
for the current version we are using.

PS - You must have mongodb installed and running.

## Development setup

To test your own instance of the bot, do the following:

* Create your own personal testing server
* [Enable developer mode](https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-)
 in discord to be able to get guild IDs and client IDs
* [Create an application](https://discordjs.guide/preparations/setting-up-a-bot-application.html)
 for your bot
* [Add the bot to your server](https://discordjs.guide/preparations/adding-your-bot-to-servers.html#bot-invite-links)
* [Create a role for your bot](https://support.discordapp.com/hc/en-us/articles/206029707-How-do-I-set-up-Permissions-)
 and give it the permissions to manage messages, manage channels, and all the voice related permissions.
 
### Populate settings.json

* Copy the guild ID of your server under `pinano_guilds`
* Copy the token of the bot under `beta_token`
* Set `dev_mode` to `true`
* Copy your user ID under `bot_devs`

### Create the initial mongo entries

To create the initial guild object in the mongo database,
join a voice channel and say something.
This will trigger the creation of the guild information.

