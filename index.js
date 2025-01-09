import dotenv from 'dotenv'
dotenv.config()
import * as scryfall from 'scryfall-api'
import { AtpAgent } from '@atproto/api'
import base64 from 'node-base64-image'
import express from 'express'
import { hourlyWikiPost } from './wikiDaily'
bindToPort()
post()
await hourlyWikiPost({
  username: process.env.CHRONICLEBOT_USERNAME,
  password: process.env.CHRONICLEBOT_PASSWORD,
})
setInterval(async () => {
  post()
  await hourlyWikiPost({
    username: process.env.CHRONICLEBOT_USERNAME,
    password: process.env.CHRONICLEBOT_PASSWORD,
  })
}, 60 * 60 * 1000)
function post() {
  console.log(`Posting!`)
  login()
    .then(async (agent) => {
      try {
        const result = await getRandom()
        const imgURL = result.image_uris.normal
        const name = result.name
        // console.log(imgURL)

        await agent.post({
          text: generateText(result),
          embed: await embedImage(agent, imgURL, {
            alt: result.name,
          }),
          createdAt: new Date().toISOString(),
        })
        console.log(`Posted ${result.name} (${new Date().toString()})`)
        // console.log(result)
      } catch (e) {
        console.error(e)
      }
    })
    .catch(console.error)
}
function bindToPort() {
  var app = express()

  app.set('port', process.env.PORT || 5000)

  //For avoidong Heroku $PORT error
  app
    .get('/', function (request, response) {
      var result = 'App is running'
      response.send(result)
    })
    .listen(app.get('port'), function () {
      console.log(
        'App is running, server is listening on port ',
        app.get('port')
      )
    })
}
function generateText(result) {
  const { name, flavor_text, type_line, cmc, mana_cost, oracle_text } = result
  // TODO: check if there are already quote marks, if not add them
  let cardText = ''

  let flavor = ''
  if (Object.keys(result).includes('flavor_text')) {
    flavor =
      flavor_text[0] === '"' ? `${flavor_text}\n\n` : `"${flavor_text}"\n\n`
  }
  let title = name
  if (mana_cost) {
    title += ` (${mana_cost})`
  }
  cardText =
    flavor +
    `${title}\n
${oracle_text.trim()}
    `
  // console.log(oracle_text)
  // console.log('Text length:', cardText.length)
  if (cardText.length > 300) {
    cardText = cardText.slice(0, 300)
  }
  // console.log(cardText)
  return replaceSymbols(cardText)
}
async function embedImage(agent, url, options = {}) {
  const imgString = await base64.encode(url, {
    string: true, // Return the result as a string rather than a buffer
  })
  const buffer = Buffer.from(imgString, 'base64')

  // Convert Buffer to Uint8Array
  const uint8Array = new Uint8Array(buffer)
  // const dataURI = convertDataURIToUint8Array(imgString)
  const { data } = await agent.uploadBlob(uint8Array, {
    encoding: 'image/jpg',
  })
  return {
    $type: 'app.bsky.embed.images',
    images: [
      // can be an array up to 4 values
      {
        alt: 'this is a card', // the alt text
        image: data.blob,
        aspectRatio: {
          // a hint to clients
          width: 635,
          height: 889,
        },
        ...options,
      },
    ],
  }
}
async function getRandom() {
  //TODO: check if this card has already been posted\
  // TODO: make sure it has alt text
  // console.log(await agent.getProfile())
  return await scryfall.Cards.random()
}

async function login() {
  const agent = new AtpAgent({
    service: 'https://bsky.social',
  })

  await agent.login({
    identifier: process.env.BLUESKY_USERNAME,
    password: process.env.BLUESKY_PASSWORD,
  })
  return agent
}
function replaceSymbols(string) {
  let str = string
  const dictionary = {
    '{W}': '⚪',
    '{U}': '🔵',
    '{G}': '🟢',
    '{R}': '🔴',
    '{B}': '⚫',
    '{T}': 'Tap',
    '{1}': '1️⃣',
    '{2}': '2️⃣',
    '{3}': '3️⃣',
    '{4}': '4️⃣',
    '{5}': '5️⃣',
    '{6}': '6️⃣',
    '{7}': '7️⃣',
    '{8}': '8️⃣',
    '{9}': '9️⃣',
    '{10}': '🔟',
    '{X}': '✖️',
  }
  Object.keys(dictionary).forEach((key) => {
    str = str.replaceAll(key, dictionary[key])
  })
  return str
}
