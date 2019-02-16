const jimp = require('jimp')
const hd = require('humanize-duration')
const moment = require('moment')

module.exports.load = (client) => {
  client.commands['stats'] = {
    run (message) {
      let args = message.content.split(' ').splice(1)
      let username
      let discriminator
      let mem
      let userId
      let av = './assets/default_avatar.jpg'

      if (args.length >= 1) {
        // fqName: "fully qualified name"
        let fqName = args.join(' ').split('#')
        if (fqName.length === 2) {
          username = fqName[0]
          discriminator = fqName[1]
          mem = client.guilds.get(message.guild.id).members.find(val => val.user.username === username && val.user.discriminator === discriminator)
          if (mem != null) {
            userId = mem.user.id
            // checks if user has pfp because discord dosnt return default pfp url >:C
            if (mem.user.avatarURL != null) {
              av = mem.user.avatarURL
            }
          } else {
            return client.errorMessage(message, `Unable to find user ${username}#${discriminator}.`)
          }
        } else {
          return client.errorMessage(message, `Invalid username format.`)
        }
      } else {
        username = message.author.username
        discriminator = message.author.discriminator
        userId = message.author.id
        mem = client.guilds.get(message.guild.id).members.get(userId)
        if (message.author.avatarURL != null) {
          av = message.author.avatarURL
        }
      }

      client.loadUserData(userId, async res => {
        if (res === null) {
          client.errorMessage(message, 'Error fetching your data from our servers, please try again.')
          return
        }

        // set "semi-global" variables
        let avatar
        let source
        let poss

        // get leaderboard pos
        await client.fetchWeeklyLeaderboardPos(message.guild.id, userId, pos => {
          poss = pos.replace(/`/g, '')
        })

        // load template
        await jimp.read('./assets/time_card.png')
          .then(i => {
            source = i
          })

        // overlay avatar on template image
        await jimp.read(av)
          .then(i => {
            avatar = i
          })
        await avatar.resize(98, 98)
        await source.composite(avatar, 14, 14)

        // check if the user is actively pracking and update times live if necessary
        let activeTime = 0
        let guild = await client.loadGuildData(message.guild.id)
        // these last two conditions should be equivalent but maybe they were already pracking when the bot came up
        if (mem.voiceChannel != null && guild.permitted_channels.includes(mem.voiceChannel.id) && !mem.mute && mem.s_time != null) {
          activeTime = moment().unix() - mem.s_time
        }

        // write the text stuff
        await jimp.loadFont(jimp.FONT_SANS_16_WHITE)
          .then(async font => {
            source.print(font, 245, 25, `${username}#${discriminator}`)
            source.print(font, 135, 90, abbreviateTime(res.current_session_playtime + activeTime))
            source.print(font, 280, 90, abbreviateTime(res.overall_session_playtime + activeTime))
            source.print(font, 435, 90, poss)
          })

        // send the pic as png
        await source.getBufferAsync(jimp.MIME_PNG)
          .then(buffer => {
            message.channel.send({
              files: [{
                attachment: buffer,
                name: 'level.jpg'
              }]
            })

              // delete response after set time
              .then(m => {
                setTimeout(() => {
                  m.delete()
                }, client.settings.res_destruct_time * 1000)
              })
          })

        function abbreviateTime (playtime) {
          return hd(playtime * 1000, { units: ['h', 'm', 's'], round: true })
            .replace('hours', 'h')
            .replace('minutes', 'm')
            .replace('seconds', 's')
            .replace('hour', 'h')
            .replace('minute', 'm')
            .replace('second', 's')
        }
      })
    }
  }
}
