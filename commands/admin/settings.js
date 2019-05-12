/* eslint-disable no-inner-declarations */
// Re-enable when we re-factor into proper objects
module.exports.load = (client) => {
  client.commands['settings'] = {
    async run (message) {
      let args = message.content.split(' ').splice(1)
      if (!message.member.roles.find('name', 'Bot Manager')) {
        return client.errorMessage(message, `You require the bot manager role to use this command.`)
      }

      let guildInfo = await client.loadGuildData(message.guild.id)
      if (guildInfo == null) {
        await client.createGuild(message.guild.id)
        client.errorMessage(message, 'Creating a database for this guild, please try again.')
        client.log('Created new guild.')
        return
      }

      if (args.length === 0) {
        let msg = new client.discord.RichEmbed()
        msg.setTitle('Settings')
        msg.addField('Toggles {On/Off}', `\`\`\`welcomes leaves dm_welcomes voice_perm\`\`\``, false)
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

        case 'voice_perm':
          return interpretOnOffToggle('voice_perm_toggle', args, `Assigning send_msg on voice chat join can be either toggled on or off. Example: ${client.settings.prefix}settings voice_perm on`)

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
      async function toggleSwitch (toggle, setting) {
        guildInfo[setting] = toggle
        await client.writeGuildData(message.guild.id, guildInfo)
        fin()
      }

      // interprets a string setting and yells at the user if there isn't a second argument.
      async function interpretStringSetting (setting, args, usageString) {
        if (args.length === 1) {
          return client.errorMessage(message, usageString)
        }

        guildInfo[setting] = args.splice(1).join(' ')
        await client.writeGuildData(message.guild.id, guildInfo)
        fin()
      }

      // check if valid channel format is met
      function isValidChannel (arg) {
        return arg.startsWith('<#') && arg.endsWith('>')
      }

      // arg must be channel
      async function setChannel (arg, setting) {
        guildInfo[setting] = arg.replace(/[<#>]/g, '')
        await client.writeGuildData(message.guild.id, guildInfo)
        fin()
      }

      // del practice channel from database
      async function delChannelPractice (arg) {
        if (!guildInfo['permitted_channels'].includes(arg.replace(/[<#>]/g, ''))) {
          return client.errorMessage(message, 'That channel is not in database.')
        }

        guildInfo['permitted_channels'].splice(guildInfo.permitted_channels.indexOf(arg.replace(/[<#&>]/g, '')), 1)
        await client.writeGuildData(message.guild.id, guildInfo)
        fin()
      }

      // add practice channel to database
      async function addChannelPractice (arg) {
        if (guildInfo['permitted_channels'].includes(arg.replace(/[<#>]/g, ''))) {
          return client.errorMessage(message, 'That channel is already added.')
        }

        guildInfo['permitted_channels'].push(arg.replace(/[<#>]/g, ''))
        await client.writeGuildData(message.guild.id, guildInfo)
        fin()
      }

      async function fin () {
        let m = await message.reply('Successfully updated settings!')
        setTimeout(() => m.delete(), client.settings.res_destruct_time * 1000)
      }
    }
  }
}
