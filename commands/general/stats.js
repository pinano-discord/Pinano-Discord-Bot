const hd = require('humanize-duration')

module.exports.load = (client) => {
  client.commands['stats'] = {
    run (message) {
      client.loadUserData(message.author.id, async res => {
        if (res === null) {
          client.errorMessage(message, 'Error fetching your data from our servers, please try again.')
          return
        }

        // set "semi-global" variabls
        let avatar
        let source
        let poss

        // get leaderboard pos
        await client.fetchWeeklyLeaderboardPos(message, pos => {
          poss = pos.replace(/`/g, '')
        })

        // load template
        await client.jimp.read('./assets/time_card.png')
          .then(i => {
            source = i
          })

        // checks if user has pfp because discord dosnt return default pfp url >:C
        let av
        if (message.author.avatarURL == null) {
          av = './assets/default_avatar.jpg'
        } else {
          av = message.author.avatarURL
        }

        // overlay avatar on template image
        await client.jimp.read(av)
          .then(i => {
            avatar = i
          })
        await avatar.resize(98, 98)
        await source.composite(avatar, 14, 14)

        // write the text stuff
        await client.jimp.loadFont(client.jimp.FONT_SANS_16_WHITE)
          .then(async font => {
            source.print(font, 245, 25, `${message.author.username}#${message.author.discriminator}`)
            source.print(font, 135, 90, abbreviateTime(res.current_session_playtime))
            source.print(font, 280, 90, abbreviateTime(res.overall_session_playtime))
            source.print(font, 435, 90, poss)
          })

        // send the pic as png
        await source.getBufferAsync(client.jimp.MIME_PNG)
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
