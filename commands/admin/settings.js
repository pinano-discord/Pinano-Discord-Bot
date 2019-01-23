module.exports.load = (client) => {
    client.commands['settings'] = {
        async run(message){
            let args = message.content.split(' ').splice(1)
            if(message.member.hasPermission("BAN_MEMBERS") == false){client.errorMessage(message, `You must have \`BAN_MEMBERS\` permission to use.`); return}
            client.loadGuildData(message.guild.id, res =>{
                if(res == null){
                    client.createGuild(message.guild.id)
                    client.errorMessage(message, 'Creating a database for this guild, please try again.')
                    client.log('Created new guild.')
                    return
                }
                if(args.length == 0){
                    let msg = new client.discord.RichEmbed()
                    msg.setTitle('Settings')
                    msg.setDescription(`
                    \`${client.settings.prefix}settings\`
                    \`${client.settings.prefix}settings view\`
                    \`${client.settings.prefix}settings p_add {#channel}\`
                    \`${client.settings.prefix}settings p_del {#channel}\`
                    `)
                    msg.setColor(client.settings.embed_color)
                    msg.setTimestamp()
                    message.channel.send(msg)
                    .then(m => {
                        setTimeout(()=>{
                            m.delete()
                        }, client.settings.res_destruct_time * 1000)
                    })
                } else if(args[0] == 'view'){
                    client.loadGuildData(message.guild.id, res => {
                        let msg = new client.discord.RichEmbed()
                        msg.setTitle('Settings')
                        msg.setDescription(`Here is a list of all settings for the guild.`)
                        msg.addField('Member Count', `\`${message.channel.guild.members.size}\``, true)
                        msg.addField('Created', `\`${client.moment(message.channel.guild.createdTimestamp).fromNow(client.moment().unix())} ago\``, true)
                        if(res.permitted_channels.length == 0){msg.addField('Practice Channels', `None`, true)}
                        else {msg.addField('Practice Channels', `${res.permitted_channels.join('\n')}`, true)}
                        msg.addField('Region', `\`${message.channel.guild.region}\``, true)
                        msg.setColor(client.settings.embed_color)
                        msg.setTimestamp()
                        message.channel.send(msg)
                    })

                } else if(args[0] == 'p_add' && args[1].startsWith('<#') && args[1].includes('>')){
                    client.loadGuildData(message.guild.id, res => {
                        if(res.permitted_channels.includes(args[1].replace(/[<#&>]/g, ''))){
                            client.errorMessage(message, 'That channel is already added as a practice channel.')
                        } else {
                            res.permitted_channels.push(args[1].replace(/[<#&>]/g, ''))
                            client.writeGuildData(message.guild.id, res, ()=> client.successMessage(message, 'Successfully updated settings.'))
                        }
                    })

                } else if(args[0] == 'p_del'){
                    client.loadGuildData(message.guild.id, res => {
                        if(res.permitted_channels.includes(args[1])){
                            res.permitted_channels.splice(res.permitted_channels.indexOf(args[1].replace(/[<#&>]/g, '')), 1)
                            client.writeGuildData(message.guild.id, res, ()=> client.successMessage(message, 'Successfully updated settings.'))
                        } else {
                            client.errorMessage(message, 'That channel isnt a practice channel.')
                        }
                    })

                } else {
                    client.errorMessage(message, 'Invalid usage.')
                }
            })
        }
    }
}