import fetch from "node-fetch";

async function getArt(clientID, clientSecret) {
    const tokenUrl = "https://api.artsy.net/api/tokens/xapp_token";
    let xappToken;

    try {
        // Fetch xapp token
        const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: clientID,
                client_secret: clientSecret,
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error("Failed to fetch xapp token");
        }

        const tokenData = await tokenResponse.json();
        xappToken = tokenData.token;

        // Fetch the total number of artworks
        const countResponse = await fetch("https://api.artsy.net/api/artworks?size=1", {
            headers: {
                "X-Xapp-Token": xappToken,
                Accept: "application/vnd.artsy-v2+json",
            },
        });

        if (!countResponse.ok) {
            throw new Error("Failed to fetch artwork count");
        }

        const countData = await countResponse.json();
        const totalArtworks = countData.total_count;

        // Randomly select a page and fetch artworks
        const randomPage = Math.floor((Math.random() * totalArtworks) / 10) + 1;

        const artworksResponse = await fetch(`https://api.artsy.net/api/artworks?size=10&page=${randomPage}`, {
            headers: {
                "X-Xapp-Token": xappToken,
                Accept: "application/vnd.artsy-v2+json",
            },
        });

        if (!artworksResponse.ok) {
            throw new Error("Failed to fetch artworks");
        }

        const artworksData = await artworksResponse.json();
        const artworks = artworksData._embedded.artworks;

        // Randomly select an artwork
        const randomArtwork = artworks[Math.floor(Math.random() * artworks.length)];

        // Fetch detailed artwork info
        const artworkResponse = await fetch(randomArtwork._links.self.href, {
            headers: {
                "X-Xapp-Token": xappToken,
                Accept: "application/vnd.artsy-v2+json",
            },
        });

        if (!artworkResponse.ok) {
            throw new Error("Failed to fetch artwork details");
        }

        const artwork = await artworkResponse.json();

        // Fetch artist details
        const artistResponse = await fetch(artwork._links.artists.href, {
            headers: {
                "X-Xapp-Token": xappToken,
                Accept: "application/vnd.artsy-v2+json",
            },
        });

        if (!artistResponse.ok) {
            throw new Error("Failed to fetch artist details");
        }

        const artistData = await artistResponse.json();
        const artist = artistData._embedded.artists[0];

        // Prepare the final result
        const name = artwork.title;
        const artistName = artist ? artist.name : "Unknown Artist";
        const year = artwork.date;
        const imageUrl = artwork._links.image.href.replace("{image_version}", "large");

        return {
            name,
            artistName,
            year,
            imageUrl,
        };
    } catch (error) {
        console.error("Error fetching random artwork:", error);
        throw error;
    }
}

export default getArt;
