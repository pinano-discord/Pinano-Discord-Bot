module.exports = (client, db) => {

    /**
     * Let me provide some context for this monstrosity of a library entry
     * It was 2 am and i had to get the leaderboard finished to publish
     * the bot on christmas night, so plz no be mean :c Going to re-write
     * this entire file in the upcoming days
    */
    
    client.getOverallLeaderboard = (message, callback) => {
        let score_array = []
        let msgStr = ''
        db.collection('users').find({}).toArray()
        .then(async res => {
            await res.forEach(doc => {
                let string = `${doc.id}|${doc.overall_session_playtime}`
                score_array.push(string)
            })
            await con()
        })
        function con(){
            score_array.sort((a, b) => {
                a = a.split('|').splice(1).join('')
                b = b.split('|').splice(1).join('')
                return b - a
            })
            for(let j = 0; j < client.settings.leaderboard_size; j++){
                if(!score_array[j]){
                    msgStr += ``
                } else {
                    let user = score_array[j].split('|')[0]
                    let time = client.hd(score_array[j].split('|')[1] * 1000, { units: ['h', 'm', 's'] })
                    if(client.users.get(user)){
                        msgStr += `**${j + 1}. ${client.users.get(user).username}#${client.users.get(user).discriminator}**\n \`${time}\`\n`
                    } else {
                        msgStr += `**${j + 1}.** *${user}* \n \`${time}\`\n`
                    }
                }
            }

            client.fetchOverallLeaderboardPos(message, pos => {
                msgStr = `**${message.author.username}**, you are rank ${pos}\n ${msgStr}`
                callback(msgStr)
            })
        }
    }

    client.getWeeklyLeaderboard = (message, callback) => {
        let score_array = []
        let msgStr = ''
        db.collection('users').find({}).toArray()
        .then(async res => {
            await res.forEach(doc => {
                let string = `${doc.id}|${doc.current_session_playtime}`
                score_array.push(string)
            })
            await con()
        })
        function con(){
            score_array.sort((a, b) => {
                a = a.split('|').splice(1).join('')
                b = b.split('|').splice(1).join('')
                return b - a
            })
            for(let j = 0; j < client.settings.leaderboard_size; j++){
                if(!score_array[j]){
                    msgStr += ``
                } else {
                    let user = score_array[j].split('|')[0]
                    let time = client.hd(score_array[j].split('|')[1] * 1000, { units: ['h', 'm', 's'] })
                    if(client.users.get(user)){
                        msgStr += `**${j + 1}. ${client.users.get(user).username}#${client.users.get(user).discriminator}**\n \`${time}\`\n`
                    } else {
                        msgStr += `**${j + 1}.** *${user}* \n \`${time}\`\n`
                    }
                }
            }

            if(message != null){
                client.fetchWeeklyLeaderboardPos(message, pos => {
                    msgStr = `**${message.author.username}**, you are rank ${pos}\n ${msgStr}`
                    callback(msgStr)
                })
            } else {
                callback(msgStr)
            }
        }
    }

    client.fetchWeeklyLeaderboardPos = (message, callback) => {
        let score_array = []
        let msgStr = ''
        db.collection('users').find({}).toArray()
        .then(async res => {
            await res.forEach(doc => {
                let string = `${doc.id}|${doc.current_session_playtime}`
                score_array.push(string)
            })
            await con()
        })
        function con(){
            score_array.sort((a, b) => {
                a = a.split('|').splice(1).join('')
                b = b.split('|').splice(1).join('')
                return b - a
            })

            let pos = 0
            let true_j = 0
            for(let i = 0; i <= score_array.length; i++){
                if(score_array[i]){
                    let user = score_array[i].split('|')[0]
                    if(user == message.author.id) {pos = true_j + 1}
                    true_j++
                }
            }

            msgStr = `\`${pos}\` / \`${true_j}\``


            callback(msgStr)
        }
    }

    client.fetchOverallLeaderboardPos = (message, callback) => {
        let score_array = []
        let msgStr = ''
        db.collection('users').find({}).toArray()
        .then(async res => {
            await res.forEach(doc => {
                let string = `${doc.id}|${doc.overall_session_playtime}`
                score_array.push(string)
            })
            await con()
        })
        function con(){
            score_array.sort((a, b) => {
                a = a.split('|').splice(1).join('')
                b = b.split('|').splice(1).join('')
                return b - a
            })

            let pos = 0
            let true_j = 0
            for(let i = 0; i <= score_array.length; i++){
                if(score_array[i]){
                    let user = score_array[i].split('|')[0]
                    if(user == message.author.id) {pos = true_j + 1}
                    true_j++
                }
            }

            msgStr = `\`${pos}\` / \`${true_j}\``


            callback(msgStr)
        }
    }

    client.submitweek = () => {
        client.getWeeklyLeaderboard(null, data => {
            let msg = new client.discord.RichEmbed()
            msg.setTitle('Weekly Leaderboard')
            msg.setDescription(data)
            msg.setColor(client.settings.embed_color)
            msg.setTimestamp()
            client.fetchUser(client.settings.submit_id, true).then(m => {
                m.send(msg)
            })

        })
    }
}
