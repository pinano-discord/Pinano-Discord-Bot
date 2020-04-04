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

### Invite the bot to your server

- Copy and paste this url into your browser
    - `https://discordapp.com/oauth2/authorize?client_id=<YOUR_CLIENT_ID>&scope=bot&permissions=8`
    - Replace `<YOUR_CLIENT_ID>` with your actual discord application client id in this url
- Setup the necessary voice channels by having an admin type `p! setup` in any text channel.
    - The default command prefix is `p!` but it can be configured with by an environment variable.
    - Other configurable variables and their defaults can be found under `src/environment.ts`