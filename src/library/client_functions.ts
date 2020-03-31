/* eslint-disable max-lines */
/* eslint-disable sonarjs/cognitive-complexity */
// TODO:
import * as Discord from 'discord.js';
const hd = require('humanize-duration');
import moment from 'moment';
import { environment } from '../environment';

function translateLeaderboard(page, tagSyntax = '@') {
  // TODO: find a library or something
  const reducer = (msgStr, row, index) => {
    const secondsRaw = row.time % 60;
    const minutesRaw = Math.floor(secondsRaw / 60) % 60;
    const hours = Math.floor(minutesRaw / 60);
    const seconds = ('00' + secondsRaw).slice(-2);
    const minutes = ('00' + minutesRaw).slice(-2);

    const timeStr = `${hours}:${minutes}:${seconds}`;
    return (
      msgStr +
      `**${page.startRank + index}. <${tagSyntax}${page.data[index].id}>**\n \`${timeStr}\`\n`
    );
  };

  const data = page.data.reduce(reducer, '');
  return data === '' ? '\u200B' : data;
}

// TODO:
// eslint-disable-next-line max-lines-per-function
module.exports = (client) => {
  client.log = (string) => {
    console.log(`${moment().format('MMMM Do YYYY, h:mm:ss a')} :: ${string}`);
  };

  client.errorMessage = async (message, response) => {
    const m = await message.channel.send({
      embed: {
        title: 'Error',
        description: response,
        color: environment.embed_color,
        timestamp: new Date(),
      },
    });

    setTimeout(() => m.delete(), environment.res_destruct_time * 1000);
  };

  client.getTeamForUser = (member) => {
    // TODO: just search the list of roles instead of hardcoding this.
    const teams = [
      'J.S. Bach Blue',
      'Beethoven Maroon',
      'Brahms Green',
      'Chopin Pink',
      'Fauré Purple',
      'Mendelssohn Teal',
      'Mozart Red',
      'Rachmaninoff Green',
      'Schubert Orange',
      'Yiruma White',
    ];

    return member.roles.filter((role) => teams.includes(role.name)).first();
  };

  client.saveAllUsersTime = async (guild) => {
    await Promise.all(
      client.policyEnforcer.getPracticeRooms(guild).map((chan) =>
        Promise.all(
          chan.members
            .filter((member) => !member.mute && member.s_time && !member.deleted)
            .map((member) => {
              const team = client.getTeamForUser(member);
              return client.sessionManager.saveSession(member, team, chan.emoji);
            }),
        ),
      ),
    );
  };

  client.restart = async (guild, abort) => {
    if (abort) {
      // something's wrong, and we need to forcibly restart the bot without saving any sessions.
      process.exit(0);
    } else {
      const notifChan = guild.channels.find((c) => c.name === 'information');
      let message = await notifChan.send('Beginning restart procedure...');
      const edited = await message.edit(`${message.content}\nSaving all active sessions...`);
      message = edited; // for some reason the linter thinks message isn't being used if we assign it directly?
      await client.saveAllUsersTime(guild);

      message = await message.edit(`${message.content} saved.\nUnlocking rooms...`);
      await Promise.all(
        client.policyEnforcer
          .getPracticeRooms(guild)
          .map((chan) => client.policyEnforcer.unlockPracticeRoom(guild, chan)),
      );

      message = await message.edit(`${message.content} unlocked.\nRestarting Pinano Bot...`);
      process.exit(0);
    }
  };

  // a user is live if they are:
  // 1. not a bot (so we exclude ourselves and Craig)
  // 2. unmuted
  // 3. in a permitted channel
  // 4. that is not locked by someone else
  client.isLiveUser = (member) => {
    return (
      !member.user.bot &&
      !member.mute &&
      member.voiceChannel &&
      client.policyEnforcer.isPracticeRoom(member.voiceChannel) &&
      (member.voiceChannel['!locked_by'] || member.voiceChannel.locked_by === member.id)
    );
  };

  client.resume = async (guild) => {
    const infoChan = guild.channels.find((c) => c.name === 'information');
    const messages = await infoChan.fetchMessages();
    let message = messages.find((m) => m.content.startsWith('Beginning restart procedure...'));
    if (message) {
      message = await message.edit(`${message.content} ready.\nDetecting room status...`);
    }

    let channel = guild.channels.find((c) => c.name === 'Practice Room ⚡');
    if (channel) {
      channel.emoji = '⚡';
    }

    channel = guild.channels.find((c) => c.name === 'Practice Room 🐮');
    if (channel) {
      channel.emoji = '🐮';
    }

    channel = guild.channels.find((c) => c.name === 'Practice Room 🐺');
    if (channel) {
      channel.emoji = '🐺';
    }

    channel = guild.channels.find((c) => c.name === 'Practice Room 🤔');
    if (channel) {
      channel.emoji = '🤔';
    }

    const practiceRooms = client.policyEnforcer.getPracticeRooms(guild);
    await Promise.all(
      practiceRooms.map(async (chan) => {
        // assume that if there's only one person playing in a room, it should be locked to them.
        const unmuted = chan.members.filter((m) => !m.deleted && !m.mute);
        if (unmuted.size === 1) {
          return client.policyEnforcer.lockPracticeRoom(guild, chan, unmuted.first());
        } else {
          // keep the room unlocked; reset the permissions just in case they're borked
          await client.policyEnforcer.unlockPracticeRoom(guild, chan);
          chan.suppressAutolock = false;
        }
      }),
    );

    if (message) {
      message = await message.edit(
        `${message.content} marked locked rooms.\nResuming active sessions...`,
      );
    }

    practiceRooms.forEach((chan) => {
      chan.members
        .filter((member) => client.isLiveUser(member))
        .forEach((member) => client.sessionManager.startSession(member));
    });

    if (message) {
      message = await message.edit(`${message.content} resumed.\nRestart procedure completed.`);
      setTimeout(() => message.delete(), environment.res_destruct_time * 1000);
    }

    const quizChan = guild.channels.find((c) => c.name === '🎶literature-quiz');
    if (quizChan) {
      await client.quizMaster.resume(quizChan);
    }
  };

  client.refreshRoomInfo = async (guild) => {
    const reducer = (rooms, chan) => {
      const displayName = chan.locked_by ? chan.unlocked_name : chan.name;
      rooms += `\n\n${displayName}`;
      if (chan.bitrate !== 384) {
        rooms += ` | ${chan.bitrate}kbps`;
      }

      if (chan.bitrate > 64) {
        // don't bother with video links for low-bitrate rooms
        rooms += ` | [Video](http://www.discordapp.com/channels/${guild.id}/${chan.id})`;
      }

      chan.members.forEach((m) => {
        rooms += `\n<@${m.id}>`;
        if (m.deleted) {
          rooms += ' :ghost:';
        }

        if (m.s_time) {
          rooms += ' :microphone2:';
        }
      });

      return rooms;
    };

    client.roomInfo = client.policyEnforcer
      .getPracticeRooms(guild)
      .filter((chan) => chan.members.some((m) => !m.deleted))
      .sort((x, y) => x.position > y.position)
      .reduce(reducer, '');
  };

  client.updateInformation = async (guild) => {
    const liveData = client.findCurrentPrackers(guild);
    const teamLiveData = client.findCurrentTeams(guild);
    await client.refreshRoomInfo(guild);
    await client.weeklyLeaderboard.refresh(liveData);
    await client.overallLeaderboard.refresh(liveData);
    await client.teamLeaderboard.refresh(teamLiveData);

    await client.redrawInformation(guild);

    setTimeout(() => client.updateInformation(guild), 15 * 1000);
  };

  client.redrawInformation = async (guild) => {
    const weeklyData = client.weeklyLeaderboard.getPageData();
    const teamData = client.teamLeaderboard.getPageData();
    const overallData = client.overallLeaderboard.getPageData();
    const currentTime = moment().unix();
    const endOfWeek = moment()
      .endOf('isoWeek')
      .unix();
    const timeUntilReset = hd((endOfWeek - currentTime) * 1000, {
      units: ['d', 'h', 'm'],
      maxDecimalPoints: 0,
    });

    const pinnedPostUrl =
      'https://discordapp.com/channels/188345759408717825/411657964198428682/518693148877258776';
    const embed = new Discord.MessageEmbed()
      .setTitle('Practice Rooms')
      .setColor(environment.embed_color)
      .setDescription(`${client.roomInfo}\n\u200B`) // stupid formatting hack
      .addField('Weekly Leaderboard', translateLeaderboard(weeklyData), true)
      .addField('Team Standings', translateLeaderboard(teamData, '@&'), true)
      .addField('Overall Leaderboard', translateLeaderboard(overallData), true)
      .addField(
        `Weekly leaderboard resets in ${timeUntilReset}`,
        `\u200B\nClick [here](${pinnedPostUrl}) for optimal Discord voice settings\n\
Use \`p!stats\` for individual statistics\n\
Use \`p!bitrate [ BITRATE_IN_KBPS ]\` to adjust a channel's bitrate\n\u200B`,
      )
      .setTimestamp(Date.now());

    const infoChan = guild.channels.find((c) => c.name === 'information');
    const messages = await infoChan.fetchMessages();
    let message = messages.find(
      (m) => m.embeds && m.embeds.some((e) => e.title === 'Practice Rooms'),
    );
    if (!message) {
      message = await infoChan.send(embed);
    } else {
      message = await message.edit({ embed: embed });
    }

    if (client['!reactionsHandler']) {
      const filter = (r, u) => u !== client.user;
      client.reactionsHandler = message.createReactionCollector(filter);
      client.reactionsHandler.on('collect', async (reaction) => {
        switch (reaction.emoji.name) {
          case '◀':
            client.weeklyLeaderboard.decrementPage();
            await client.redrawInformation(guild);
            break;
          case '▶':
            client.weeklyLeaderboard.incrementPage();
            await client.redrawInformation(guild);
            break;
          case '⬅':
            client.overallLeaderboard.decrementPage();
            await client.redrawInformation(guild);
            break;
          case '➡':
            client.overallLeaderboard.incrementPage();
            await client.redrawInformation(guild);
            break;
        }

        reaction.users.filter((u) => u !== client.user).forEach((u) => reaction.remove(u));
      });

      await message.clearReactions();
      await message.react('◀');
      await message.react('🇼');
      await message.react('▶');
      await message.react('⬅');
      await message.react('🇴');
      await message.react('➡');
    }
  };

  client.findCurrentPrackers = (guild) => {
    // finds users with currently active session for liveness tracking
    const currentPrackers = new Map();

    client.policyEnforcer.getPracticeRooms(guild).forEach((chan) => {
      chan.members.forEach((member) => {
        const liveTime = client.sessionManager.getLiveSessionTime(member);
        if (!member.deleted && liveTime) {
          currentPrackers.set(member.id, liveTime);
        }
      });
    });

    return currentPrackers;
  };

  client.findCurrentTeams = (guild) => {
    const currentTeams = new Map();

    client.policyEnforcer.getPracticeRooms(guild).forEach((chan) => {
      chan.members.forEach((member) => {
        const team = client.getTeamForUser(member);
        const liveTime = client.sessionManager.getLiveSessionTime(member);
        if (!member.deleted && liveTime && team) {
          let time = currentTeams.get(team.id) || 0;
          time += liveTime;
          currentTeams.set(team.id, time);
        }
      });
    });

    return currentTeams;
  };

  client.submitWeek = async () => {
    const pinano = client.guilds.get('188345759408717825');
    const liveData = client.findCurrentPrackers(pinano);
    await client.weeklyLeaderboard.refresh(liveData);

    client.weeklyLeaderboard.resetPage();
    const pageData = client.weeklyLeaderboard.getPageData();
    const data = translateLeaderboard(pageData);
    await client.saveAllUsersTime(pinano);

    pinano.channels
      .find((chan) => chan.name === environment.chat_channel)
      .send({
        embed: {
          title: 'Weekly Leaderboard - Results',
          description: data,
          color: environment.embed_color,
          timestamp: Date.now(),
        },
      });
  };
};
