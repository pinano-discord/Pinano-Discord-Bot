# Pinano Bot

[![Build Status](https://travis-ci.com/pinano-discord/Pinano-Discord-Bot.svg?branch=master)](https://travis-ci.com/pinano-discord/Pinano-Discord-Bot)

This is the open source for Pinano Bot, which tracks stats and enhances the experience in the
[Pinano Discord server](https://discord.gg/piano).

# Getting started

Pinano Bot is written in Javascript using [NodeJS](https://nodejs.org/).

To start developing, you should install [`nodenv`](https://github.com/nodenv/nodenv) to ensure you
use the same version of Node as other developers.

On MacOS, you can run:

    brew install nodenv node-build
    nodenv install $(cat .node-version)

If you just want to jump in without installing `nodenv`, make sure you look at
[`.node-version`](.node-version) for the current version we are using.

You must have mongodb installed and running. One way to achieve this is to use Docker:

    docker run --name pinano-mongo -p 27017:27017 -d mongo:latest

Then you can install all dependencies:

    npm install

And run any tests:

    npm test

# Running a test bot

If you'd like to actually run a test bot, you will need to follow the instructions to
[create a bot user](https://discordjs.guide/preparations/setting-up-a-bot-application.html).
Replace the placeholder in [`config.json`](config.json) with the token from the bot's Discord
settings page, and follow the instructions to [add the bot to a server](https://discordjs.guide/preparations/adding-your-bot-to-servers.html).
You can either use your own test server, or the Pinano bot development server (feel free to ask any
staff member on Pinano for an invite).

For your bot to do anything, you'll need to add a config document to the `pinano.config` mongodb
collection specifying which modules to activate. The following config can be used for basic testing:

    {
      id: "[SERVER ID]",
      commandPrefix: "pb!!",
      enableHelp: true
    }

This bot responds to two commands: `pb!!help` and `p!!config`. The `pb!!help` command DMs you the
commands it knows about (this requires that your Discord privacy settings permit receiving DMs from
the bot, i.e. on your test server you have the privacy setting "Allow direct messages from server
members" enabled).

# Modules

Pinano Bot functionality is implemented by modules, the configuration of which is specified in the
config document for a given server (i.e. modules can be configured differently per server). For
ease of testing, some modules are split into a logic module and an adapter module for talking to
Discord.

Pinano Bot provides the following modules:

## Badges

Controlled by the configuration setting `enableBadges`. When enabled, the `stats` command shows a
list of personal achievements attained. Each badge must also be enabled individually via config.
Badges associated with specific modules are described in that module's description. If defined in
config, this module awards the following badges:

* `nitroBadge` - awarded for having a role specified by the `nitroRoleId` config setting. On Pinano
this is used to award a badge to Nitro Boosters.
* `recencyWeekBadge` and `recencyMonthBadge` - awarded for having a qualifying practice session
within the last week and month, respectively.
* `developerBadge` - awarded for code contributions to Pinano Bot. Awarded manually.
* `punctualBadge` - awarded for having a practice session of exactly one hour, or any positive
integer multiple thereof.
* `noBadgesBadge` - awarded if the subject of the `stats` command has no badges.

The `badgesPerPage` config setting (default value: `12`) determines how many badges can appear on a
user's `stats` card until scrolling behaviour is enabled.

## Channel Raiding

Controlled by the configuration setting `enableChannelRaiding`. When enabled, the occupant of a
locked room may invoke the `raid` command to send everybody in the occupant's room (including the
occupant) into another user's locked room.

## Configuration Management

This module is always enabled, and allows members of the role specified by `managementRoleId` to
change configuration settings by invoking the `config` command. If no `managementRoleId` is
specified, or `managementRoleId` does not refer to a valid role, then initialization of this
module will fail.

Only a small number of config settings are currently reloadable without restarting Pinano Bot;
these are listed in [`base/config_manager.js`](base/config_manager.js).

## Daily Time

Controlled by the configuration setting `enableDailyTime`. When enabled, users can invoke the
`setdailyreset` command to configure daily time tracking. The parameter to the `setdailyreset`
command represents the UTC hour at which the user's daily time tracking will reset every day.
(Note that this means that users in time zones that are not offset from UTC by an integer
multiple of an hour cannot configure their time to reset at midnight in their local time zone.)
This module requires the Practice Manager module to be enabled.

If a user has daily time tracking enabled, then daily streaks will be calculated for that user.
If defined in config, `streakBadgeIcon` configures the icon for a badge that is awarded for
having a qualifying practice session for five or more days in a row.

By using the `setdailyreset` to modify the reset hour at appropriate times, the user can
effectively lengthen a "day" to be longer than twenty-four hours (similar to the normal
adjustment of UTC offset during Daylight Savings Time switches). If, by doing this, the user
attains a daily practice time of forty hours or more, the `linglingBadge`, if defined in config,
is awarded to the user.

## Frequently Asked Questions

Controlled by the configuration setting `enableFaq`. When enabled, the configuration setting
`faqEntries` defines an array of questions. Each question contains a `question` field, an `answer`
field, as well as an array of `tags` that can be used as the parameter to the `faq` command to
cause that question to display as the result of the command. For example:

    "faqEntries" : [
      {
        "question" : "What is the answer to the ultimate question of life, the universe and everything?",
        "answer" : "42.",
        "tags" : ["sky", "blue"]
      }
    ]

defines a single FAQ entry which can be displayed by using invoking `faq sky` or `faq blue`.

## Help

Controlled by the configuration setting `enableHelp`. When enabled, users can invoke the `help`
command to have Pinano Bot send them a DM containing a list of supported commands. The list of
commands is dependent on what modules are enabled, e.g. if the Statistics module is not enabled,
then `stats` will not appear on the list of commands.

Pinano Bot does not check whether the user is DMable. In order to receive the command list, the
user's Discord privacy settings must permit receiving DMs from the bot, i.e. the user must have
privacy setting "Allow direct messages from server members" enabled for the server.

## Listening Graph

Controlled by the configuration setting `enableListeningGraph`. When enabled, Pinano Bot tracks
per-user listening statistics, i.e. the amount of time each user has spent listening to each
person practicing is tracked separately. The `top` command can be invoked for a given user to
display the top five Listeners (i.e. users who have listened to the subject) and the top five
Listened To (i.e. users whom the subject has listened to). This module requires the Practice
Manager module to be enabled.

If defined in config, this module awards the following badges:

* `listeningTwinBadge` - awarded to two people who occupy the #1 position on each other's Top
Listened To list (minimum five hours listening time total for each person), i.e. each user listens
to the other more than they listen to anybody else.
* `listenedToBadgeIcon` - configures the icon for a badge that is awarded for listening to at least
ten users for a minimum of one hour each.
* `topListenerExchangeBadge` - awarded to two people who occupy the #1 position on each other's Top
Listeners list (minimum five hours listened to each other), i.e. nobody else has listened to each
person more than the other person.
* `topListenerBadge` - awarded for occupying the #1 position on someone's Top Listeners List
(minimum five hours listened to that person). Not awarded if the user already has the `topListenerExchangeBadge`.
* `ultimateTopListenerBadge` - awarded to the listener with the most listening hours on any Top
Listeners list.

Badge updates are not immediate; the Top Fan and Top Choice are recalculated according to the
`listeningGraphUpdateSpec` config setting. By default this is set to `0 * * * *`, i.e. the badges
are recalculated at the top of every hour.

## Literature Quiz

Controlled by the configuration setting `enableLiteratureQuiz`. This module enables an
identification game in the channel specified by `literatureQuizChannelId`. Users post an excerpt to
be identified in the channel; other users attempt to guess it, and either the original user, or a
member of the role specified by `quizMasterRoleId`, can mark the guess as correct or incorrect.
When a riddle is added but there is no room for a new active riddle, the riddle is added to a
persistent queue and posted at an appropriate time later.

The behaviour of the Literature Quiz module is modified by the following configuration settings:

* `actionOnTaglessGuess` - if set to `ignore`, then Pinano Bot will not consider guesses that do
not tag the user whose riddle the guess applies to. It is recommended to use `ignore` only when
`warnOnTaglessGuess` is set to `true`.
* `automaticallyStartQueue` (default: `false`) - if `true`, then when the Literature Quiz module
starts, Pinano Bot will attempt to post riddles from the queue until there is no more room for
another active riddle.
* `blacklist` - see `riddleAcceptancePolicy`.
* `maxConcurrentRiddles` (default: `1`) - specifies how many riddles can be active at once; if
greater than `1`, then the module is considered to be in multi-riddle mode. When operating in
multi-riddle mode, guessers must tag the user whose riddle they are guessing.
* `nagTimeoutInSeconds` (default: `0`) - if greater than `0`, Pinano Bot will prompt a riddler to
give a hint or skip a riddle after the specified timeout.
* `rejectedRiddleAction` (default: `ignore`) - if set to `reject`, users who have their riddles
rejected by policy (see `riddleAcceptancePolicy`) are notified immediately that their submission is
rejected; otherwise, riddles are accepted, but silently skipped in the queue.
* `riddleAcceptancePolicy` - if set to `whitelist`, only users in the list specified by `whitelist`
have their riddles accepted into the queue. If set to `blacklist`, then all users except users in
the list specified by `blacklist` have their riddles accepted into the queue.
* `skipTimeoutInSeconds` (default: `0`) - if greater than `0`, then Pinano Bot will automatically
skip unanswered riddles older than the specified timeout.
* `warnOnTaglessGuess` (default: `false`) - if `true`, Pinano Bot warns guessers if they make a
guess without tagging the user whose riddle they are guessing, even outside of multi-riddle mode.
* `whitelist` - see `riddleAcceptancePolicy`.

If defined in config, this module awards the following badges:

* `litQuizSolvedBadgeIcon` - awarded for solving at least ten riddles.
* `litQuizGivenBadgeIcon` - awarded for giving at least ten riddles that are solved.

## Policy Enforcer

Controlled by the configuration setting `enablePolicyEnforcer`. When enabled, the `lock` and
`unlock` commands can be used to lock and unlock the room currently occupied by the invoking user
for exclusive use. Members with the role specified by `managementRoleId` can additionally lock
rooms they are not currently occupying, as well as unlock rooms they do not have locked. If no
`managementRoleId` is specified, or `managementRoleId` does not refer to a valid role, then
initialization of this module will fail.

The Policy Enforcer also provides the following additional features:

* Autolock: controlled by the configuration setting `enableAutolock`. When enabled, rooms will
automatically lock to a single unmuted person after `autolockDelayInSeconds` (default: `120`) as
long as they were the most recent user to have single occupancy of the room.
* Exclusive Chat: controlled by the configuration setting `enableExclusiveChat`. When enabled,
users are given permissions to send messages to the channel specified by `exclusiveChatChannelId`
only if they are currently unmuted or undeafened in a practice room. To use this feature
effectively, the exclusive channel should have the send messages permissions denied to the
`@everyone` role. If no `exclusiveChatChannelId` is specified or `exclusiveChatChannelId` does not
refer to a valid channel, then initialization of this module will fail.
* Room Autocreation: controlled by the configuration setting `enableRoomAutocreation`. When
enabled, new rooms are automatically created with Discord permissions specified by
`newChannelPermissions` if all rooms are occupied by at least one user. Extra rooms are deleted
when they become unnecessary. At least `minimumRooms` (default: `4`) will always be present. If
`enableFeedbackRooms` is `true`, then autocreation applies to both regular practice rooms as well
as feedback rooms (i.e. at least one of each type will always be unoccupied).

## Practice Manager

Controlled by the configuration setting `enablePracticeManager`. This module is the core of most
Pinano Bot stat tracking. When enabled, Pinano Bot tracks session and overall practice time, as
well as overall listening time. If `enableLeaderboardDisplay` is `true`, then the leaderboards for
these statistics are displayed in the channel specified by `informationChannelId`, and updated
according to `updateLeaderboardCronSpec`. By default, `updateLeaderboardCronSpec` is set to
`*/15 * * * * *`, i.e. the information channel is updated every fifteen seconds.

Session practice time is reset according to the `resetCronSpec` config setting; on reset, the
practice manager saves all active sessions, and optionally posts the final result to the channel
specified by `announcementsChannelId` if `postLeaderboardOnReset` is `true`.

`enableSanityCheck` is a configuration setting to provide defense-in-depth against a ghost session,
i.e. a session that Pinano Bot thinks is active, but the user is not unmuted in a practice room.
This may happen, for example, if Pinano Bot missed a channel leave event. If `enableSanityCheck` is
true, then every minute, Pinano Bot will audit current sessions to ensure that they correspond to
currently unmuted Discord users; if not, then Pinano Bot will delete the session without committing
the time to the database.

## Restart

Controlled by the configuration setting `enableRestart`. When enabled, this module allows members
of the role specified by `managementRoleId` to exit the Pinano Bot process. If `managementRoleId`
is not specified, or `managementRoleId` does not refer to a valid role, then initialization of this
module will fail. *This module should not be enabled on untrusted servers; otherwise, any member of
the management role on that server can restart the bot for all servers without committing active
practice sessions to the database.*

## Roles

Controlled by the configuration setting `enableRoles`. When enabled, users can use the `ranks`
command to switch between a list of roles described by the `ranks` config setting. A user may only
have one rank at a time. A user can also discard their current rank. This module is a replacement
for the `?rank` command in Dyno, which was deemed to be too spammy for Pinano.

## Stage Manager

Controlled by the configuration setting `enableStageManager`. Requires `recitalManagerRoleId`,
`performerRoleId`, `controlChannelId`, `textChannelId`, `voiceChannelId`, `programChannelId` to be
configured and to refer to valid roles and channels. When enabled, this module creates a control
panel in the channel specified by `controlChannelId` to apply pre-defined permissions presets to
a recital voice channel, and text channels for a recital programme and chat.

## Statistics

Controlled by the configuration setting `enablePStats`. When enabled, users can use the `stats`
command to display their own statistics or statistics of another user. The stats card is modified
by other modules such as the Daily Time module and the Badges module.

## Subscriptions

Controlled by the configuration setting `enableSubscriptions`. This module requires the Policy
Enforcer module to be enabled. When enabled, users can use the `subscribe` command to receive a DM
from Pinano Bot when the subscribee locks a practice room (this includes when a room locks
automatically due to autolock). The subscribee can control whether other users can subscribe to
them with the `subscribers` command. `subscribers off` means that other users can no longer
subscribe to them; `subscribers silent` means that other users can subscribe to them, but
notifications are disabled.

Pinano Bot does not check whether the user is DMable. In order to receive subscription
notifications, the user's Discord privacy settings must permit receiving DMs from the bot, i.e. the
user must have privacy setting "Allow direct messages from server members" enabled for the server.

## Token Collecting

Controlled by the configuration setting `enableTokenCollecting`. This module requires the Practice
Manager module to be enabled. When enabled, this module enables a collection game based on the
names of practice rooms that are spawned by the Policy Enforcer's autocreation feature.

By practicing in a room for some length of time (configurable via `minimumSessionTimeToEarnToken`),
a user earns the token associated with that room, which is displayed in the channel name. The
user's stats card shows which tokens the user has earned. The [RoomIdentifiers collection](library/room_identifiers.js)
contains the list of available tokens. Some collections have special behaviour:

* `rare` tokens spawn at a reduced rate, and go away once claimed.
* `christmas`, `valentines`, and `rickroll` tokens only spawn during certain times of the year.
* `timeBased` tokens spawn at a greater rate than the regular set. Time-based tokens change hourly,
and are awarded anytime a user has at least the minimum session time within a particular hour
interval; that is to say, a user may earn multiple time-based tokens with the same session, as long
as that session fulfills the minimum session time requirements for multiple hour intervals.
Time-based tokens are only generated if `enableTimeBasedTokens` is `true`.
* `exclusive` tokens spawn at a reduced rate, and have the additional property that they can only
be held by one user at a time, i.e. when an exclusive token is claimed, it is removed from the
token collection of the previous holder. The badge associated with this collection is awarded for
ever having held all elements of the collection at the same time.

Additionally, if `enableCustomTokens` is `true`, then an egg token is awarded for any *listening*
session exceeding the minimum session time. An egg token hatches after a randomly-selected amount
of practice subsequent to being awarded the egg token; the range is configurable using the config
settings `timeToHatchCustomToken` and `hatchCustomTokenTimeRange` (default: `7200`). A user may
only have one egg token at a time. An egg token hatches into the `defaultCustomToken` with
probability `defaultCustomTokenProbability`, one of `rareCustomTokens` with probability
`rareCustomTokenProbability`, and one of `customTokens` otherwise. If a user's ID is present in
`alwaysGetsDefault` (default: `[]`), then irrespective of the preceding probability distribution,
that user's eggs always hatch into the default custom token, unless they have no custom tokens yet.
If `announceCustomTokens` is `true`, then egg token awards and custom token hatches are announced
in the channel described by `announcementsChannelId`.

If defined in config, this module awards the following badges:

* `collectionBadgeAll` - awarded for accumulating all tokens in the `all` collection.
* `collectionBadgeOriginal` - awarded for accumulating all tokens in the `original` collection.
* `collectionBadgeAnimals` - awarded for accumulating all tokens in the `animals` collection.
* `collectionBadgeRare` - awarded for accumulating all tokens in the `rare` collection.
* `collectionBadgeChristmas` - awarded for accumulating all tokens in the `christmas` collection.
* `collectionBadgeValentines` - awarded for accumulating all tokens in the `valentines` collection.
* `collectionBadgeRickroll` - awarded for accumulating all tokens in the `rickroll` collection.
* `collectionBadgeTimeBased` - awarded for accumulating all tokens in the `timeBased` collection.
* `collectionBadgeEggs` - when custom tokens are configured, this badge is awarded for accumulating
all tokens in the collections specified by `customTokens` and `rareCustomTokens`.
* `monkeyBadge` - awarded for ever having accumulated all tokens in the `exclusive` collection.

## User Management

Controlled by the configuration setting `enableUserManagement`. When enabled, this module allows
members of the role specified by `managementRoleId` to use the `addtime` or `deltime` commands to
adjust the session playtimes of a given user. Users may not adjust their own times. If
`managementRoleId` is not specified, or `managementRoleId` does not refer to a valid role, then
initialization of this module will fail.

# Writing a new module

Modules are passed in a single argument when constructed: the [module manager](base/module_manager.js).
The module manager exposes access to several components:

* `getClient()` returns the Discord `Client` object. This is typically useful for obtaining the
client user object. *For receiving Discord events, modules should use the event dispatcher.*
* `getGuild()` returns the Discord `Guild` object, for code that requires the ID of the guild, or
to resolve Discord IDs against the guild for which the module has been constructed.
* `getDispatcher()` returns the Pinano Bot event dispatcher. This receives Discord events and
dispatches them to modules that have registered for them. Additionally, the event dispatcher
contains logic for parsing and responding to commands. Modules that wish to implement a command
should call `dispatcher.command()`.
* `getPersistence()` returns an encapsulation of the mongodb collections for the guild.
* `getConfig()` returns the Pinano Bot configuration for the guild.

For scheduled tasks, Pinano Bot uses [`node-cron`](https://www.npmjs.com/package/node-cron).

An example of a module implementing a command using the event dispatcher and a scheduled task via
`node-cron` to modify the user repository is the [`Daily Times` module](modules/daily_time.js).

# Required permissions

Pinano Bot requires the following permissions:

* Read Messages, Send Messages, Manage Messages, Add Reactions, and Embed Links on any channel for
which Pinano Bot should receive commands.
* Add Reactions for the channels described by `controlChannelId` (Stage Manager module) and
`informationChannelId` (Practice Manager module).
* Manage Messages for any module that requires pinning and un-pinning messages (e.g. Literature
Quiz, as well as the announcement of weekly leaderboard results).
* Manage Roles, if the Roles module is enabled.
* Manage Channels on the categories maintained by the Policy Enforcer and Stage Manager modules.
* Mute Members, if the Policy Enforcer module is enabled.

# Contribution instructions

If you have anything to improve, you can either open an **issue** or you can submit a
**pullrequest** directly.