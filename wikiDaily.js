import dotenv from 'dotenv'
dotenv.config()
import wiki from 'wikipedia'
import { login, embedImage, getImageFileSize } from './helpers.js'

// const maxFileSizeInKB = 976.56

// await hourlyWikiPost({
//   username: process.env.TEST_USERNAME,
//   password: process.env.TEST_PASSWORD,
// })
export async function hourlyWikiPost({ username, password }) {
  try {
    const events = await getEvents()
    const agent = await login(username, password)
    const eventsPerHour = Math.floor(events.length / 24)
    // get current hour
    const currentHour = new Date().getHours()
    const startIndex = eventsPerHour * currentHour
    const now = new Date()
    console.log(
      `There are ${events.length} events.
Which means we need to post ${eventsPerHour} events per hour.
It is now ${now.toLocaleString()}.
Which means we are on hour ${currentHour}
Therefore we will start with the event at index ${startIndex}:
    ${events[startIndex].year}
    ${events[startIndex].text}
`
    )

    let lastEvent = null
    for (let i = startIndex; i < startIndex + eventsPerHour; i++) {
      const event = events[i]

      if (lastEvent == null || lastEvent.text != event.text) {
        const result = await postEvent(agent, event)
      }
      lastEvent = event
    }
  } catch (e) {
    console.error(e)
  }
}

// ==========
// HELPERS
// ==========
async function postEvent(agent, event) {
  try {
    let { page, pages } = getFirstPageWithImage(event.pages)
    const { thumbnailLink, mimeType, size } = await uploadThumbnail(
      agent,
      page.thumbnail.source
    )
    const post = {
      $type: 'app.bsky.feed.post',
      text: `${event.year}

${event.text}`,
      createdAt: new Date().toISOString(),
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: page.content_urls.mobile.page,
          title: page.titles.normalized,
          description: page.extract,
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
    const { uri, cid } = await agent.post(post)
    const root = { uri, cid }
    await recursivelyReply(agent, pages, root, root)
  } catch (e) {
    console.error(e)
  }
}
async function recursivelyReply(agent, pages, root, parent) {
  try {
    if (pages.length < 1) {
      return
    }

    let page = pages.splice(0, 1)[0]

    let keys = Object.keys(page)
    let hasPhoto = keys.includes('thumbnail')

    let thumbnailLink, mimeType, size
    if (hasPhoto) {
      let result = await uploadThumbnail(agent, page.thumbnail.source)
      thumbnailLink = result.thumbnailLink
      mimeType = result.mimeType
      size = result.size
    }

    const post = {
      $type: 'app.bsky.feed.post',
      // TODO:
      text: truncateString(page.extract),
      createdAt: new Date().toISOString(),
      reply: {
        // TODO: replace with passed props parent and root
        parent,
        root,
      },
      embed: {
        $type: 'app.bsky.embed.external',
        // TODO: create ternary to handle if there is no photo
        external: hasPhoto
          ? {
              uri: page.content_urls.mobile.page,
              title: page.titles.normalized,
              description: page.extract,
              thumb: {
                $type: 'blob',
                ref: {
                  $link: thumbnailLink,
                },
                mimeType,
                size, // Use actual file size if available
              },
            }
          : {
              uri: page.content_urls.mobile.page,
              title: page.titles.normalized,
              description: page.extract,
            },
      },
    }
    const { uri, cid } = await agent.post(post)
    parent = { uri, cid }
    if (pages.length > 0) {
      // TODO: set parent to what is returned from result
      // parent =
      recursivelyReply(agent, pages, root, parent)
    } else {
      const now = new Date()
      console.log(`Completed posting event and pages at ${now.toISOString()}`)
    }
  } catch (e) {
    console.error(e)
  }
}
function truncateString(input) {
  const maxLength = 300 // Maximum allowed length

  if (input.length <= maxLength) {
    return input // If the input is already within the limit, return as is
  }

  // Truncate to 300 characters and backtrack to the last space
  const truncated = input.slice(0, maxLength - 3) // Reserve space for "..."
  const lastSpaceIndex = truncated.lastIndexOf(' ')

  if (lastSpaceIndex === -1) {
    // No space found, just truncate directly and add ellipses
    return truncated + '...'
  }

  // Truncate at the last space to avoid breaking a word
  return truncated.slice(0, lastSpaceIndex) + '...'
}
async function getEvents() {
  const { events } = await wiki.onThisDay()
  return events.sort((a, b) => a.year - b.year)
}

function getFirstPageWithImage(pages) {
  let firstPageWithImageIndex = null

  for (let i = 0; i < pages.length; i++) {
    let keys = Object.keys(pages[i])

    if (keys.includes('thumbnail') && keys.includes('originalimage')) {
      firstPageWithImageIndex = i
      break
    }
  }

  if (firstPageWithImageIndex !== null) {
    // Remove the page from the array using splice
    let page = pages.splice(firstPageWithImageIndex, 1)[0] // Splice returns an array, take the first element

    return { page, pages, index: firstPageWithImageIndex }
  }
  return { page: null, pages, index: firstPageWithImageIndex } // Handle case where no page is found
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
  // console.log('uploadBlob success:', uploadResult.success)

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
