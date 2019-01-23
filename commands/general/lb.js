module.exports.load = (client) => {
    client.commands['lb'] = {
        run(message){
            client.commands['leaderboard'].run(message)
        }
    }
}