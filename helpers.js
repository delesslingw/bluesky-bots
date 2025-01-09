import { AtpAgent } from '@atproto/api'
import base64 from 'node-base64-image'
import axios from 'axios'

export async function getImageFileSize(url) {
  try {
    // Make a HEAD request to get the headers
    const response = await axios.head(url)

    // Get the Content-Length header
    const contentLength = response.headers['content-length']

    if (contentLength) {
      // Convert the size to MB, KB, etc.
      const sizeInBytes = parseInt(contentLength, 10)
      const sizeInKB = sizeInBytes / 1024
      const sizeInMB = sizeInKB / 1024

      console.log(
        `Size: ${sizeInBytes} bytes, ${sizeInKB.toFixed(
          2
        )} KB, ${sizeInMB.toFixed(2)} MB`
      )
      return sizeInKB.toFixed(2)
    } else {
      console.log('Content-Length header is not available')
      return null
    }
  } catch (error) {
    console.error('Error fetching image size:', error.message)
  }
}

export async function login(identifier, password) {
  const agent = new AtpAgent({
    service: 'https://bsky.social',
  })

  await agent.login({
    identifier,
    password,
  })
  return agent
}

export async function embedImage(agent, url, options = {}) {
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

// export async function replyToPost(agent, originalPost) {
//   // Initialize the Bsky agent
//   // const agent = new BskyAgent({
//   //   service: 'https://bsky.social', // Change if using a different server
//   // });

//   // // Authenticate the agent
//   // await agent.login({
//   //   identifier: 'your-username-or-email', // Replace with your username/email
//   //   password: 'your-password', // Replace with your password
//   // });

//   // Data of the post you want to reply to
//   // const originalPost = {
//   //   uri: 'at://did:plc:5fuzd4zdxzko42k66ktfrayu/app.bsky.feed.post/3lfaa6k662s2w',
//   //   cid: 'bafyreiatzoz7ywbm4ipmphul2bgowsinpcleb4zc7d3m4gn47sh56adnsa',
//   // };

//   // Compose the reply
//   const replyContent = {
//     text: 'This is a reply to the original post!',
//     reply: {
//       root: originalPost,
//       parent: originalPost,
//     },
//   };

//   // Post the reply
//   const result = await agent.post(replyContent);

//   console.log('Reply posted:', result);
// }
