# The Practice Room Recital Bot

## Development instructions

### Build and Run

**These instruction are for Mac, Linux and Windows machines running the Linux subsystem.**

- Create a `.env` file with your bot token. It should look something like this
```bash
export BOT_TOKEN="<token>"
```

- Then run
`npm install` and `source .env && npm run dev`

### Invite the bot to your server as an admin

- Copy and paste it this url into your browser
`https://discordapp.com/oauth2/authorize?client_id=<YOUR_CLIENT_ID>&scope=bot&permissions=8`
Replace `<YOUR_CLIENT_ID>` with your actual discord application client id in this url
- Copy and paste it into your browser
- To setup the necessary voice channels, type `<COMMAND_PREFIX> setup`. (Only admins can do this)
The default command prefix is `p!` but it can be configured with by an environment variable. Other configurable variables and their defaults can be found under `src/environment.ts`