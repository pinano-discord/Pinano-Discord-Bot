const moment = require('moment')

module.exports = client => {
  client.on('ready', async () => {
    await client.log('Successfully connected to discord.')
    await client.user.setActivity(client.settings.activity, { type: 'Playing' }).catch(e => client.cannon.fire('Could not set activity.'))
    await client.log(`Successfully set activity to ${client.settings.activity}`)
    await client.loadCommands(() => client.log(`Successfully loaded commands!`))
    await client.connectDB(db => {
      client.log(`Connected Database`)
      require('./leaderboard_fetch.js')(client, db)
      client.log(`loaded leaderboard library`)
    })
  })

  client.on('message', async message => {
    await client.loadUserData(message.author.id, res => {
      if (res === null) {
        let user = {
          'id': message.author.id,
          'current_session_playtime': 0,
          'overall_session_playtime': 0
        }
        client.writeUserData(message.author.id, user, () => {
          client.log(`User created for ${message.author.username}#${message.author.discriminator}`)
        })
      }
    })

    if (!client.isValidCommand(message) || !client.commandExist(message)) {
      return
    }

    if (!client.settings.pinano_guilds.includes(message.guild.id)) {
      return client.errorMessage(message, 'This bot can only be used on official Pinano servers.')
    }

    await client.commands[message.content.split(' ')[0].replace(client.settings.prefix, '')].run(message)
    await setTimeout(() => {
      message.delete()
    }, client.settings.req_destruct_time * 1000)
  })

  client.on('guildMemberAdd', mem => {
    if (mem.guild === null) {
      return
    }

    client.loadGuildData(mem.guild.id, res => {
      if (res === null) {
        return
      }

      if (res.dm_welcome_toggle === true && res.dm_welcome_message !== '') {
        let msg = new client.discord.RichEmbed()
        msg.setTitle('Welcome!')
        msg.setDescription(res.dm_welcome_message)
        msg.setColor(client.settings.embed_color)
        msg.setTimestamp()
        try {
          mem.send(msg)
        } catch (e) {
          client.log(`unable to send to user ${mem.username}#${mem.discriminator}`)
        }
      }

      if (res.welcome_toggle) {
        if (res.welcome_channel !== '') {
          if (res.welcome_message === '') {
            res.welcome_message = client.settings.default_welcome
          }

          let mes = res.welcome_message.replace('{user}', `**${mem.displayName}**`)
          client.channels.get(res.welcome_channel).send(mes).catch(e => { console.log(e) })
        }
      }
    })
  })

  client.on('guildMemberRemove', mem => {
    if (mem.guild === null) {
      return
    }

    client.loadGuildData(mem.guild.id, res => {
      if (res === null || res.leave_channel === '' || !res.leave_toggle) {
        return
      }

      if (res.leave_message === '') {
        res.leave_message = client.settings.default_leave
      }

      let mes = res.leave_message.replace('{user}', `**${mem.displayName}**`)
      client.channels.get(res.leave_channel).send(mes)
    })
  })

  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (!client.settings.pinano_guilds.includes(newMember.guild.id)) {
      return
    }

    // time handler
    client.loadUserData(newMember.user.id, res => {
      // if the user doesn't exist then create a user for the person
      if (res === null) {
        let user = {
          'id': newMember.user.id,
          'current_session_playtime': 0,
          'overall_session_playtime': 0
        }
        client.writeUserData(newMember.user.id, user, () => {
          client.log(`User created for ${newMember.user.username}#${newMember.user.discriminator}`)
        })
      } else {
        client.loadGuildData(newMember.guild.id, restwo => {
          if (restwo === null) {
            client.createGuild(newMember.guild.id)
            client.log('Created new guild.')
          } else {
            // n.b. if this is the first time the bot sees a user, s_time may be undefined but *not* null. Therefore, == (and not ===)
            // comparison is critical here. Otherwise, when they finished practicing, we'll try to subtract an undefined value, and we'll
            // record that they practiced for NaN seconds. This is really bad because adding NaN to their existing time produces more NaNs.
            if (!newMember.selfMute && !newMember.serverMute && oldMember.s_time == null && restwo.permitted_channels.includes(newMember.voiceChannelID)) {
              // if they are unmuted and a start time dosnt exist and they are in a good channel
              newMember.s_time = moment().unix()
            } else if (oldMember.s_time != null) {
              // if a start time exist transfer it to new user object
              newMember.s_time = oldMember.s_time
            }

            // if user gets muted or leaves or transfers to a bad channel
            if (newMember.voiceChannelID === null || !restwo.permitted_channels.includes(newMember.voiceChannelID) || newMember.selfMute || newMember.serverMute) {
              if (newMember.s_time == null) {
                return
              }

              const playtime = moment().unix() - newMember.s_time
              res.current_session_playtime += playtime
              res.overall_session_playtime += playtime

              const hourrole = '529404918885384203'
              // const activerole = '542790691617767424'

              if (res.overall_session_playtime >= 40 * 60 * 60 && !newMember.roles.has(hourrole)) {
                newMember.addRole(hourrole)
                  .catch(e => {
                    client.log(`error granting user ${newMember.username} hourrole!`)
                  })
                  .then(() => {
                    newMember.send('You have achieved the 40 hour pracker role!')
                      .catch(e => {
                        client.log('Could not tell user they leveled! (hourrole)')
                      })
                  })
              }

              client.writeUserData(newMember.user.id, res, () => {
                client.log(`User ${newMember.user.username}#${newMember.user.discriminator} practiced for ${playtime} seconds`)
                newMember.s_time = null
                oldMember.s_time = null
              })
            }
          }
        })
      }
    })
  })
}
