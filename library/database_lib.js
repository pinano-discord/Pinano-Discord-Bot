let mongodb = require('mongodb')
let MongoClient = mongodb.MongoClient
let url = 'mongodb://localhost:27017/'

module.exports = (client) => {
    let db

    client.connectDB = (callback) => {
        MongoClient.connect(url, (err, client) => {
            if(err) client.log(err);
            db = client.db('pinano')
            callback(db)
        })
    }

    client.loadUserData = (discordID, callback) => {
        db.collection('users').findOne({id: discordID}, (err, res) => {
            if (err) client.log(err);
            callback(res)
        })
    }

    client.writeUserData = (discordID, obj, callback) => {
        db.collection('users').update(
            ({id: discordID}),
            obj,
            {upsert:true}
        )
        callback()
    }

    client.createGuild = id => {
        let g = {
            guild : id,
            permitted_channels : []
        }
        client.writeGuildData(id, g, () => {})
    }

    client.writeGuildData = (guildID, obj, callback) => {
        db.collection('guilds').update(
            ({guild: guildID}),
            obj,
            {upsert:true}
        )
        callback()
    }

    client.loadGuildData = (guildID, callback) => {
        db.collection('guilds').findOne({guild: guildID}, (err, res) => {
            if (err) client.log(err);
            callback(res)
        })
    }



    client.clearWeekResults = async  () => {
        let data = await db.collection('users').find({}).toArray()
        await data.forEach(entry => {
            entry.current_session_playtime = 0
        })

        await db.collection('users').remove({})
        await db.collection('users').insert(data)
    }

    client.clearOverallResults = async () => {
        let data = await db.collection('users').find({}).toArray()
        await data.forEach(entry => {
            entry.overall_session_playtime = 0
        })

        await db.collection('users').remove({})
        await db.collection('users').insert(data)
    }
}