function log (message) {
  console.log(`[${new Date().toUTCString()}] ${message}`)
}

function logError (message) {
  console.error(`[${new Date().toUTCString()}] ${message}`)
}

function resolveUntaggedMember (guild, fullyQualifiedName) {
  const tokenized = fullyQualifiedName.split('#')
  if (tokenized.length !== 2) {
    throw new Error('Unable to parse name of form username#discriminator')
  }

  const member = guild.members.cache.find(m => m.user.username === tokenized[0] && m.user.discriminator === tokenized[1])
  if (member == null) {
    throw new Error(`Unable to find user ${tokenized[0]}#${tokenized[1]}.`)
  }

  return member
}

function requireParameterCount (args, argCount, usageStr) {
  if (args.length !== argCount) {
    throw new Error(`Usage: \`${usageStr}\``)
  }
}

function requireParameterFormat (arg, formatFn, usageStr) {
  if (!formatFn(arg)) {
    throw new Error(`Usage: \`${usageStr}\``)
  }
}

function requireRole (member, role, errorMessage = 'Missing Permissions') {
  if (!member.roles.cache.has(role.id)) {
    throw new Error(errorMessage)
  }
}

// picks a random token from list. If given a list of tokens to avoid, retries
// a number of times to pick another token that isn't on the avoid list. n.b.
// retries = 2 means three attempts (initial attempt plus two retries).
function pickRandomFromList (list, avoidList = [], retries = 2) {
  let result = list[Math.floor(Math.random() * list.length)]
  for (let i = 0; i < retries; i++) {
    if (avoidList.includes(result)) {
      result = list[Math.floor(Math.random() * list.length)]
    }
  }
  return result
}

module.exports = {
  log: log,
  logError: logError,
  resolveUntaggedMember: resolveUntaggedMember,
  requireParameterCount: requireParameterCount,
  requireParameterFormat: requireParameterFormat,
  requireRole: requireRole,
  pickRandomFromList: pickRandomFromList
}
