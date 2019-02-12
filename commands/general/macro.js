module.exports.load = (client) => {
  client.commands['macro'] = {
    run (message) {
      let args = message.content.split(' ').splice(1)
      switch (args[0]) {
        case 'help':
            let msg = new client.discord.RichEmbed()
            msg.setTitle('Macro help')
            msg.setDescription( 'Heres a list of all available macros' )
            msg.addField('Commands', `
                  \`${client.settings.prefix}macro help\` - This message.
                  \`${client.settings.prefix}macro chat\` - Chat channels information.
                  \`${client.settings.prefix}macro vc\` - Voice chat and practice information.
                  \`${client.settings.prefix}macro recital\` - Soon (tm)
                  \`${client.settings.prefix}macro beginner\` - Soon (tm)
                  `, false)
            msg.setColor(client.settings.embed_color)
            msg.setTimestamp()

          break

        case 'chat':
            let msg = new client.discord.RichEmbed()
            msg.setTitle('Discord chat channels information')
            msg.setDescription( 'Heres a list of our chat channels' )
            msg.addField('Chat channels', `
                  \`#Announcement\` - Stay up to date with the latest Pinano news with our announcements channel!
                  \`#General\` - Chat and get to know others in our general chat channel!
                  \`#Classical\` - Are you looking for fellow fans of the classical genre? Find them here!
                  \`#Non-Classical\` - Or looking for another genre? Find any other here!
                  \`#help-and-feedback\` - Do you have any piano related queries? Don't hesitate and ask here us here.
                  \`#Literature-quiz\` - Play in a 24/7 game and try to geuss the literature linked!
                  \`#Practice-room-chat\` - Are you listening to someone pratice and wish to talk with the practicers or other listeners? Do that here!
                  \`#Polls\` - (not-so) daily polls!
                  \`#Study-hall\` - for homework of all kinds.
                  \`#Hand-reveal\` - post a picture of your hand here to get @Hand Revealed role!
                  \`#Repertoire-list\` - post your repertoire here to get either @classical or @Non-Classical role!
                  \`#Anime-memes-games\` - As the title suggests, for all your anime, memes and games related conversations.
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
                  \`#Recital\` - Want to listen in to the Bi weekly recitals? Join us when the recital channel is open!
                  `, false)
            msg.addField('Leaderboards', `
                  \`Pinano Bot\` - The pinano bot records how long you practice each day!
                  \`Leaderboards\` - Compete with others for a spot on the weekly or overall leaderboards!
                  \`Earn ranks\` - Earn \`Active Pracker\` or \`40 Hour Pracker\` roles by practicing on voice chat.
                  \`Commands\` - Use p!lb overall, p!lb weekly or p!lb stats to see how you're doing!
                  `, false)
            msg.setColor(client.settings.embed_color)
            msg.setTimestamp()

  //    break

  //      case 'recital':
  //          let msg = new client.discord.RichEmbed()
  //          msg.setTitle('Discord chat channels information')
  //          msg.setDescription( 'Heres a list of our chat channels' )
  //          msg.addField('Chat channels', `
  //                \`#Announcement\` - Stay up to date with the latest Pinano news with our announcements channel!
  //                \`#General\` - Chat and get to know others in our general chat channel!
  //                \`#Classical\` - Are you looking for fellow fans of the classical genre? Find them here!
  //                \`#Non-Classical\` - Or looking for another genre? Find any other here!
  //                \`#help-and-feedback\` - Do you have any piano related queries? Don't hesitate and ask here us here.
  //                \`#Literature-quiz\` - Play in a 24/7 game and try to geuss the literature linked!
  //                \`#Practice-room-chat\` - Are you listening to someone pratice and wish to talk with the practicers or other listeners? Do that here!
  //                \`#Polls\` - (not-so) daily polls!
  //                \`#Study-hall\` - for homework of all kinds.
  //                \`#Hand-reveal\` - post a picture of your hand here to get @Hand Revealed role!
  //                \`#Repertoire-list\` - post your repertoire here to get either @classical or @Non-Classical role!
  //                \`#Anime-memes-games\` - As the title suggests, for all your anime, memes and games related conversations.
  //                `, false)
  //          msg.setColor(client.settings.embed_color)
  //          msg.setTimestamp()

        //  break

            //      case 'beginner':
              //        let msg = new client.discord.RichEmbed()
                //      msg.setTitle('Useful resources for beginners')
                  //    msg.setDescription( 'Need desired information from staff' )
                    //  msg.setColor(client.settings.embed_color)
                      //msg.setTimestamp()

              //      break

          })
      }
    }
  }
}
