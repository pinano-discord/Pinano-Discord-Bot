module.exports = client => {
    
    client.log = (string) => {
        console.log(`${client.moment().format('MMMM Do YYYY, h:mm:ss a')} :: ${string}`)
    }

    client.commandExist = (message) => {
        if(message.content.split(' ')[0].replace(client.settings.prefix, '').replace(/[<@!>]/g, '') == client.user.id) message.content = message.content.split(' ').splice(1).join(' ')
        if(client.commands[message.content.split(' ')[0].replace(client.settings.prefix, '')]) return true
        return false
    }

    client.isValidCommand = (message) => {
        if(message.content.startsWith(client.settings.prefix) || message.content.replace(/[<@!>]/g, '').startsWith(`${client.user.id}`)){
            return true
        } else {
            return false
        }
    }

    client.loadCommands = (callback) => {
        client.commands = {}
        client.fs.readdir('./commands/general/', (err, files) => {
            if(err){
                client.log(`Error loading general commands : ${err}`)
                return;
            }
            files.forEach(file => {
                    require(`../commands/general/${file}`).load(client)
            })
        })

        client.fs.readdir('./commands/admin/', (err, files) => {
            if(err){
                client.log(`Error loading admin commands : ${err}`)
                return;
            }
            files.forEach(file => {
                    require(`../commands/admin/${file}`).load(client)
            })
        })
        callback()
    }

    client.successMessage = (message, msg) => {
        message.channel.send({
            embed: {
                title : 'Success',
                description : msg,
                color : client.settings.embed_color,
                timestamp : new Date()
            } 
         })
         .then(m => {
            setTimeout(()=>{
                m.delete()
            }, client.settings.res_destruct_time * 1000)
        })
    }

    client.errorMessage = (message, msg) => {
        message.channel.send({
            embed: {
                title : 'Error',
                description : msg,
                color : client.settings.embed_color,
                timestamp : new Date()
            } 
         })
         .then(m => {
            setTimeout(()=>{
                m.delete()
            }, client.settings.res_destruct_time * 1000)
        })
    }
    
}