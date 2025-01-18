import dotenv from "dotenv";
dotenv.config();
import { createCanvas, loadImage } from "canvas";
import axios from "axios";
import fs from "fs";
import path from "path";
import getArt from "./getArt.js";

function sanitizeFilename(input, replacement = "_") {
    // Define prohibited characters for different systems
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g; // Windows reserved characters and control characters
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i; // Windows reserved names
    const maxLength = 255;

    // Replace invalid characters
    let sanitized = input.replace(invalidChars, replacement);

    // Trim and truncate the string
    sanitized = sanitized.trim().substring(0, maxLength);

    // Ensure the name is not a reserved name
    if (reservedNames.test(sanitized)) {
        sanitized = `_${sanitized}`;
    }

    // Return sanitized filename
    return sanitized;
}

// Function to download the image and save it locally
async function downloadImage(imageUrl, outputPath) {
    const response = await axios({
        url: imageUrl,
        method: "GET",
        responseType: "stream",
    });

    const contentType = response.headers["content-type"];
    let extension;

    if (contentType.includes("image/jpeg")) {
        extension = "jpg";
    } else if (contentType.includes("image/png")) {
        extension = "png";
    } else if (contentType.includes("image/gif")) {
        extension = "gif";
    } else if (contentType.includes("image/webp")) {
        extension = "webp";
    } else {
        throw new Error("Unsupported image type");
    }

    const finalOutputPath = path.resolve(outputPath + "." + extension);

    const writer = fs.createWriteStream(finalOutputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", () => {
            resolve(finalOutputPath); // Return the full path of the downloaded image
        });
        writer.on("error", reject);
    });
}

// Function to fetch art data
// async function getArt() {
//     return new Promise((resolve, reject) => {
//         let clientID = process.env.ARTSY_ID,
//             clientSecret = process.env.ARTSY_SECRET,
//             apiUrl = "https://api.artsy.net/api/tokens/xapp_token",
//             xappToken;

//         request
//             .post(apiUrl)
//             .send({ client_id: clientID, client_secret: clientSecret })
//             .end(function (err, res) {
//                 if (err) {
//                     console.error("Error fetching xapp token!");
//                     reject(err);
//                 }

//                 xappToken = res.body.token;
//                 traverson.registerMediaType(JsonHalAdapter.mediaType, JsonHalAdapter);
//                 const api = traverson.from("https://api.artsy.net/api").jsonHal();

//                 api.newRequest()
//                     .follow("artworks")
//                     .withRequestOptions({
//                         headers: {
//                             "X-Xapp-Token": xappToken,
//                             Accept: "application/vnd.artsy-v2+json",
//                         },
//                     })
//                     .getResource(async function (error, artworks) {
//                         if (error) {
//                             console.error("Error fetching artworks:", error);
//                             return;
//                         }

//                         const randomArtwork =
//                             artworks._embedded.artworks[Math.floor(Math.random() * artworks._embedded.artworks.length)];

//                         const artworkDetails = await request
//                             .get(randomArtwork._links.self.href)
//                             .set("X-Xapp-Token", xappToken)
//                             .set("Accept", "application/vnd.artsy-v2+json");

//                         const artwork = artworkDetails.body;

//                         const artistDetails = await request
//                             .get(artwork._links.artists.href)
//                             .set("X-Xapp-Token", xappToken)
//                             .set("Accept", "application/vnd.artsy-v2+json");

//                         const artist = artistDetails.body._embedded.artists[0];

//                         const name = artwork.title;
//                         const artistName = artist.name;
//                         const year = artwork.date;
//                         const imageUrl = artwork._links.image.href.replace("{image_version}", "large");

//                         resolve({
//                             name,
//                             artistName,
//                             year,
//                             imageUrl,
//                         });
//                     });
//             });
//     });
// }

// Function to download the image and prepare the resources
async function prepareResources() {
    const artData = await getArt(process.env.ARTSY_ID, process.env.ARTSY_SECRET); // Get art data
    console.log("Art Data:", artData);

    // Download the image locally before using it in the sketch
    const fileName =
        "./famousGradients/bin/" + sanitizeFilename(`${artData.name}___${artData.artistName}___${artData.year}`);
    const localPath = await downloadImage(artData.imageUrl, fileName);

    return { localPath, artData }; // Return the full path of the downloaded image and art data
}

// Create and manipulate the image using node-canvas
async function createCanvasArt() {
    const { localPath, artData } = await prepareResources();

    const image = await loadImage(localPath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");

    // Draw the image onto the canvas
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Manipulate the image pixels row by row
    for (let y = 0; y < canvas.height; y++) {
        let r = 0,
            g = 0,
            b = 0,
            a = 0;
        for (let x = 0; x < canvas.width; x++) {
            const index = (x + y * canvas.width) * 4;
            r += pixels[index];
            g += pixels[index + 1];
            b += pixels[index + 2];
            a += pixels[index + 3];
        }
        r = Math.round(r / canvas.width);
        g = Math.round(g / canvas.width);
        b = Math.round(b / canvas.width);
        a = Math.round(a / canvas.width);
        for (let x = 0; x < canvas.width; x++) {
            const index = (x + y * canvas.width) * 4;
            pixels[index] = r;
            pixels[index + 1] = g;
            pixels[index + 2] = b;
            pixels[index + 3] = a;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    // Save the final canvas as an image
    const outputFileName = `./famousGradients/bin/output_${artData.name}.png`;
    const out = fs.createWriteStream(outputFileName);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    out.on("finish", () => {
        console.log(`Saved the canvas as ${outputFileName}`);
    });
}

createCanvasArt().catch(console.error);
