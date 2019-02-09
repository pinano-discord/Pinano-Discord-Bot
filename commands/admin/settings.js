/* eslint-disable no-inner-declarations */
// Re-enable when we re-factor into proper objects
module.exports.load = (client) => {
  client.commands['settings'] = {
    run (message) {
      let args = message.content.split(' ').splice(1)
      if (!message.member.roles.find('name', 'Bot Manager')) {
        return client.errorMessage(message, `You require the bot manager role to use this command.`)
      }

      client.loadGuildData(message.guild.id, res => {
        if (res === null) {
          client.createGuild(message.guild.id)
          client.errorMessage(message, 'Creating a database for this guild, please try again.')
          client.log('Created new guild.')
          return
        }

        if (args.length === 0) {
          let msg = new client.discord.RichEmbed()
          msg.setTitle('Settings')
          msg.addField('Toggles {On/Off}', `\`\`\`welcomes leaves dm_welcomes\`\`\``, false)
          msg.addField('Channels {<#ChannelID>}', `\`\`\`welcome_channel leave_channel\`\`\``, false)
          msg.addField('Strings {String}', `\`\`\`welcome_message leave_message dm_welcome_message\`\`\``, false)
          msg.addField('Other', `\`\`\`practice_channels\`\`\``, false)
          msg.setColor(client.settings.embed_color)
          msg.setFooter(`${message.author.username}#${message.author.discriminator}`, message.author.avatarURL)
          msg.setTimestamp()
          message.channel.send(msg)
          return
        }

        switch (args[0]) {
          case 'welcomes':
            return interpretOnOffToggle('welcome_toggle', args, `Welcomes can be either toggled on or off. Example: ${client.settings.prefix}settings welcomes on`)

          case 'practice_channels':
            if (args.length !== 3) {
              return client.errorMessage(message, `Practice channels can be added by using \`${client.settings.prefix}settings practice_channels add <#channel>\` and removed with \`del <#channel>\``)
            }

            switch (args[1]) {
              case 'add':
                if (isValidChannel(args[2])) {
                  return addChannelPractice(args[2])
                }
                break
              case 'del':
                if (isValidChannel(args[2])) {
                  return delChannelPractice(args[2])
                }
                break
              default:
                return client.errorMessage(message, `Practice channels can be add by using \`${client.settings.prefix}settings practice_channels add <#channel>\` and removed with \`del <#channel>\``)
            }

            break

          case 'dm_welcomes':
            return interpretOnOffToggle('dm_welcome_toggle', args, `dm_welcomes can be either toggled on or off. Example: ${client.settings.prefix}settings dm_welcomes on`)

          case 'leaves':
            return interpretOnOffToggle('leave_toggle', args, `Leaves can be either toggled on or off. Example: ${client.settings.prefix}settings leaves on`)

          case 'welcome_channel':
            if (args.length !== 2) {
              return client.errorMessage(message, `Welcome_channel can be set to a channel id. Example: ${client.settings.prefix}settings welcome_channel <#1234>`)
            }

            if (isValidChannel(args[1])) {
              return setChannel(args[1], 'welcome_channel')
            }

            break

          case 'leave_channel':
            if (args.length !== 2) {
              return client.errorMessage(message, `Leave_channel can be set to a channel id. Example: ${client.settings.prefix}settings leave_channel <#1234>`)
            }

            if (isValidChannel(args[1])) {
              return setChannel(args[1], 'leave_channel')
            }

            break

          case 'welcome_message':
            return interpretStringSetting('welcome_message', args, `Welcome_message can be set to a string. Example: ${client.settings.prefix}settings welcome_message hello {user}!`)

          case 'leave_message':
            return interpretStringSetting('leave_message', args, `Leave_message can be set to a string. Example: ${client.settings.prefix}settings leave_message bye {user}!`)

          case 'dm_welcome_message':
            return interpretStringSetting('dm_welcome_message', args, `dm_welcome_message can be set to a string. Example: ${client.settings.prefix}settings dm_welcome_message hi {user}!`)
        }

        // helper functions

        // for toggle switches that are just on and off, this function interprets the second argument
        // and yells at the user if there are too many/not enough arguments, or the argument is not 'on' or 'off'.
        function interpretOnOffToggle (toggle, args, usageString) {
          if (args.length !== 2) {
            return client.errorMessage(message, usageString)
          }

          switch (args[1]) {
            case 'on':
              return toggleSwitch(true, toggle)
            case 'off':
              return toggleSwitch(false, toggle)
            default:
              return client.errorMessage(message, usageString)
          }
        }

        // toggle must be true or false
        function toggleSwitch (toggle, setting) {
          res[setting] = toggle
          client.writeGuildData(message.guild.id, res, () => {
            fin()
          })
        }

        // interprets a string setting and yells at the user if there isn't a second argument.
        function interpretStringSetting (setting, args, usageString) {
          if (args.length === 1) {
            return client.errorMessage(message, usageString)
          }

          res[setting] = args.splice(1).join(' ')
          client.writeGuildData(message.guild.id, res, () => {
            fin()
          })
        }

        // check if valid channel format is met
        function isValidChannel (arg) {
          return arg.startsWith('<#') && arg.endsWith('>')
        }

        // arg must be channel
        function setChannel (arg, setting) {
          res[setting] = arg.replace(/[<#>]/g, '')
          client.writeGuildData(message.guild.id, res, () => {
            fin()
          })
        }

        // del practice channel from database
        function delChannelPractice (arg) {
          if (!res['permitted_channels'].includes(arg.replace(/[<#>]/g, ''))) {
            return client.errorMessage(message, 'That channel is not in database.')
          }

          res['permitted_channels'].splice(res.permitted_channels.indexOf(arg.replace(/[<#&>]/g, '')), 1)
          client.writeGuildData(message.guild.id, res, () => {
            fin()
          })
        }

        // add practice channel to database
        function addChannelPractice (arg) {
          if (res['permitted_channels'].includes(arg.replace(/[<#>]/g, ''))) {
            return client.errorMessage(message, 'That channel is already added.')
          }

          res['permitted_channels'].push(arg.replace(/[<#>]/g, ''))
          client.writeGuildData(message.guild.id, res, () => {
            fin()
          })
        }

        function fin () {
          message.reply('Successfully updated settings!')
            .then(m => {
              setTimeout(() => {
                m.delete()
              }, client.settings.res_destruct_time * 1000)
            })
        }
      })
    }
  }
}
