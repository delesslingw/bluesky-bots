import dotenv from 'dotenv'
dotenv.config()
import wiki from 'wikipedia'
import { login, embedImage, getImageFileSize } from './helpers.js'
import base64 from 'node-base64-image'
const maxFileSizeInKB = 976.56
export const hourlyWikiPost = async ({ username, password }) => {
  try {
    const events = await getEvents()
    const agent = await login(username, password)

    const eventsPerHour = Math.floor(events.length / 24)
    // get current hour
    const currentHour = new Date().getHours()
    const startIndex = eventsPerHour * currentHour
    console.log(startIndex)
    for (let i = startIndex; i <= startIndex + 1; i++) {
      console.log(i)
      const event = getEventData(events[i])
      const result = await postWiki({ agent, event })
    }
  } catch (e) {
    console.error(e)
  }
}

const postWiki = async ({ agent, event }) => {
  try {
    const { thumbnailLink, mimeType, size } = await uploadThumbnail(
      agent,
      event.thumbnail.source
    )
    const post = {
      $type: 'app.bsky.feed.post',
      text: `${event.year}: ${event.text}`,
      createdAt: new Date().toISOString(),
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: event.link,
          title: event.pagetitle,
          description: event.extract,
          thumb: {
            $type: 'blob',
            ref: {
              $link: thumbnailLink,
            },
            mimeType,
            size, // Use actual file size if available
          },
        },
      },
    }
    const result = await agent.post(post)
    console.log('Posted?!', event.text)
    return result
  } catch (e) {
    console.error(e)
  }
}

// console.log(event)

// ==========
// HELPERS
// ==========
async function getEvents() {
  const { events } = await wiki.onThisDay()
  return events.sort((a, b) => a.year - b.year)
}

function getEventData(event) {
  const page = getPage(event.pages)
  return {
    text: event.text,
    year: event.year,
    thumbnail: page.thumbnail,
    originalimage: page.originalimage,
    link: page.content_urls.mobile.page,
    extract: page.extract,
    pagetitle: page.titles.normalized,
  }
}
function getPage(pages) {
  let page = pages[Math.floor(Math.random() * pages.length)]
  if (page.thumbnail == undefined || page.originalimage == undefined) {
    return getPage(pages)
  } else {
    return page
  }
}

function formatEvent(extract, link) {
  const maxLength = 300 // Maximum allowed length

  const newline = '\n\n' // Two new lines
  const linkLength = link.length + newline.length // Length occupied by the link and newlines
  const maxExtractLength = maxLength - linkLength // Maximum length for the shortened extract

  // Shorten the extract if necessary
  let shortenedExtract = extract
  if (extract.length > maxExtractLength) {
    shortenedExtract = extract.slice(0, maxExtractLength - 3) + '...' // Add ellipsis
  }

  // Combine the shortened extract with the link
  const formattedString = `${shortenedExtract}${newline}${link}`

  // Calculate the byteStart and byteEnd for the hyperlink
  const byteStart = shortenedExtract.length + newline.length // Start after the extract and newlines
  const byteEnd = byteStart + link.length // End after the link's length

  // Return the formatted string and hyperlink positions
  return {
    formattedString,
    byteStart,
    byteEnd,
  }
}

async function uploadThumbnail(agent, imageUrl) {
  // Fetch the image
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()

  // Upload the image as a blob
  const uploadResult = await agent.uploadBlob(Buffer.from(buffer), {
    encoding: 'image/png', // Adjust based on the actual image type
  })

  // Log the response for debugging
  console.log('uploadBlob response:', uploadResult)

  // Extract the CID as a string
  if (
    uploadResult &&
    uploadResult.data &&
    uploadResult.data.blob &&
    uploadResult.data.blob.ref
  ) {
    return {
      mimeType: uploadResult.data.blob.mimeType,
      size: uploadResult.data.blob.size,
      thumbnailLink: uploadResult.data.blob.ref.toString(),
    }
  }

  // If the expected structure is not found, throw an error
  throw new Error(
    'Unexpected response structure from uploadBlob. Check the console for details.'
  )
}
