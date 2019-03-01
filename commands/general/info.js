module.exports.load = (client) => {
  client.commands['info'] = {
    run (message) {
      let args = message.content.split(' ').splice(1)
      switch (args[0]) {
        case 'help':
            let msg = new client.discord.RichEmbed()
            msg.setTitle('Macro help')
            msg.setDescription( 'Heres a list of all available information macros' )
            msg.addField('Commands', `
                  \`${client.settings.prefix}info help\` - This message.
                  \`${client.settings.prefix}info chat\` - Chat channels information.
                  \`${client.settings.prefix}info vc\` - Voice chat and practice information.
                  \`${client.settings.prefix}info recital\` - Soon™
                  \`${client.settings.prefix}info beginner\` - Soon™
                  `, false)
            msg.setColor(client.settings.embed_color)
            msg.setTimestamp()

      break

        case 'chat':
            let msg = new client.discord.RichEmbed()
            msg.setTitle('Discord chat channels information')
            msg.setDescription( 'Heres a list of our chat channels' )
            msg.addField('Chat channels', `
                  \`#announcement\` - Stay up to date with the latest Pinano news with our announcements channel!
                  \`#general\` - Chat and get to know others in our general chat channel!
                  \`#classical\` - Are you looking for fellow fans of the classical genre? Find them here!
                  \`#non-classical\` - Or looking for another genre? Find any other here!
                  \`#help-and-feedback\` - Do you have any piano related queries? Don't hesitate and ask here us here.
                  \`#literature-quiz\` - Play in a 24/7 game and try to geuss the literature linked!
                  \`#practice-room-chat\` - Are you listening to someone pratice and wish to talk with the practicers or other listeners? Do that here!
                  \`#polls\` - (not-so) daily polls!
                  \`#study-hall\` - for homework of all kinds.
                  \`#hand-reveal\` - post a picture of your hand here to get @Hand Revealed role!
                  \`#repertoire-list\` - post your repertoire here to get either @classical or @Non-Classical role!
                  \`#anime-memes-games\` - As the title suggests, for all your anime, memes and games related conversations.
                  `, false)
            msg.setColor(client.settings.embed_color)
            msg.setTimestamp()

      break

          case 'vc':
            let msg = new client.discord.RichEmbed()
            msg.setTitle('Discord voice chat information')
            msg.setDescription( 'Practice on mic with our voice channels' )
            msg.addField('Voice channels', `
                  \`#Lounge\` - Hang out casually with other pianists
                  \`#Slow Practice Room\` - Taking practicing slow? Just getting started? You can do that here!
                  \`#Practice room\` - Do you want to share your practicing with others? Let us listen in!
                  \`#Other instrument room\` - Do you feel like practicing a instrument other than piano? You can do that here!
                  \`#Recital Hall\` - Want to listen in to the Bi weekly recitals? Join us when the recital channel is open!
                  `, false)
            msg.addField('Leaderboards', `
                  \`Pinano Bot\` - The pinano bot records how long you practice each day!
                  \`Leaderboards\` - Compete with others for a spot on the weekly or overall leaderboards!
                  \`Earn ranks\` - Earn \`Active Pracker\` or \`40 Hour Pracker\` roles by practicing on voice chat.
                  \`Commands\` - Use p!lb overall, p!lb weekly or p!stats to see how you're doing!
                  `, false)
            msg.setColor(client.settings.embed_color)
            msg.setTimestamp()

      break

          })
      }
    }
  }
}
