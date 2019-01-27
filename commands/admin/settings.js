
module.exports.load = (client) => {
  client.commands['settings'] = {
    run (message) {
      let args = message.content.split(' ').splice(1)
      if (!message.member.hasPermission('BAN_MEMBERS')) return client.errorMessage(message, `You require BAN_MEMBERS to use settings.`)

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
        } else {
          if (args[0] === 'welcomes' && args[1] === 'on' && args.length === 2) return toggleSwitch(true, 'welcome_toggle')
          if (args[0] === 'welcomes' && args[1] === 'off' && args.length === 2) return toggleSwitch(false, 'welcome_toggle')
          if (args[0] === 'welcomes' && args.length !== 2) return client.errorMessage(message, `Welcomes can be either toggled on or off. Example: ${client.settings.prefix}settings welcomes on`)

          if (args[0] === 'practice_channels' && args.length === 1) return client.errorMessage(message, `Practice channels can be add by using \`${client.settings.prefix}settings practice_channels add {#channel}\` and removed with \`del {#channel}\``)
          if (args[0] === 'practice_channels' && args.length === 3 && args[1] === 'add' && isValidChannel(args[2])) return addChannelPractice(args[2])
          if (args[0] === 'practice_channels' && args.length === 3 && args[1] === 'del' && isValidChannel(args[2])) return delChannelPractice(args[2])

          if (args[0] === 'dm_welcomes' && args[1] === 'on' && args.length === 2) return toggleSwitch(true, 'dm_welcome_toggle')
          if (args[0] === 'dm_welcomes' && args[1] === 'off' && args.length === 2) return toggleSwitch(false, 'dm_welcome_toggle')
          if (args[0] === 'dm_welcomes' && args.length !== 2) return client.errorMessage(message, `dm_welcomes can be either toggled on or off. Example: ${client.settings.prefix}settings dm_welcomes on`)

          if (args[0] === 'leaves' && args[1] === 'on' && args.length === 2) return toggleSwitch(true, 'leave_toggle')
          if (args[0] === 'leaves' && args[1] === 'off' && args.length === 2) return toggleSwitch(false, 'leave_toggle')
          if (args[0] === 'leaves' && args.length !== 2) return client.errorMessage(message, `Leaves can be either toggled on or off. Example: ${client.settings.prefix}settings leaves on`)

          if (args[0] === 'welcome_channel' && args.length !== 2) return client.errorMessage(message, `Welcome_channel can be set to a channel id. Example: ${client.settings.prefix}settings welcome_channel <#1234>`)
          if (args[0] === 'welcome_channel' && args.length === 2 && isValidChannel(args[1])) return setChannel(args[1], 'welcome_channel')

          if (args[0] === 'leave_channel' && args.length !== 2) return client.errorMessage(message, `Leave_channel can be set to a channel id. Example: ${client.settings.prefix}settings leave_channel <#1234>`)
          if (args[0] === 'leave_channel' && args.length === 2 && isValidChannel(args[1])) return setChannel(args[1], 'leave_channel')

          if (args[0] === 'welcome_message' && args.length === 1) return client.errorMessage(message, `Welcome_message can be set to a string. Example: ${client.settings.prefix}settings welcome_message hello {user}!`)
          if (args[0] === 'welcome_message' && args.length >= 2) return setString(args.splice(1).join(' '), 'welcome_message')

          if (args[0] === 'leave_message' && args.length === 1) return client.errorMessage(message, `Leave_message can be set to a string. Example: ${client.settings.prefix}settings leave_message bye {user}!`)
          if (args[0] === 'leave_message' && args.length >= 2) return setString(args.splice(1).join(' '), 'leave_message')

          if (args[0] === 'dm_welcome_message' && args.length === 1) return client.errorMessage(message, `dm_welcome_message can be set to a string. Example: ${client.settings.prefix}settings dm_welcome_message hi {user}!`)
          if (args[0] === 'dm_welcome_message' && args.length >= 2) return setString(args.splice(1).join(' '), 'dm_welcome_message')

          // function stuff

          // check if valid channel format is met
          function isValidChannel (arg) {
            if (arg.includes('<#') && arg.includes('>')) return true
            return false
          }

          // check if valid role format is met
          function isValidRole (arg) {
            if (arg.includes('<@') && arg.includes('>')) return true
            return false
          }

          // arg must be a string
          function setString (arg, setting) {
            res[setting] = arg
            client.writeGuildData(message.guild.id, res, () => {
              fin()
            })
          }

          // arg must be role
          function setRole (arg, setting) {
            res[setting] = arg.replace(/[<@&>]/g, '')
            client.writeGuildData(message.guild.id, res, () => {
              fin()
            })
          }

          // arg must be channel
          function setChannel (arg, setting) {
            res[setting] = arg.replace(/[<#>]/g, '')
            client.writeGuildData(message.guild.id, res, () => {
              fin()
            })
          }

          // de; practice channel to database
          function delChannelPractice (arg) {
            if (!res['permitted_channels'].includes(arg.replace(/[<#>]/g, ''))) return client.errorMessage(message, 'That channel is not in database.')
            res['permitted_channels'].splice(res.permitted_channels.indexOf(arg.replace(/[<#&>]/g, '')), 1)
            client.writeGuildData(message.guild.id, res, () => {
              fin()
            })
          }

          // add practice channel to database
          function addChannelPractice (arg) {
            if (res['permitted_channels'].includes(arg.replace(/[<#>]/g, ''))) return client.errorMessage(message, 'That channel is already added.')
            res['permitted_channels'].push(arg.replace(/[<#>]/g, ''))
            client.writeGuildData(message.guild.id, res, () => {
              fin()
            })
          }

          // toggle must be true or false
          function toggleSwitch (toggle, setting) {
            res[setting] = toggle
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
        }
      })
    }
  }
}
