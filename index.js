import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { hourlyWikiPost } from "./wikiDaily.js";
import { postACard } from "./rateThisCard.js";
bindToPort();

await post();
setInterval(async () => {
    await post();
}, 60 * 60 * 1000);

async function post() {
    await postACard({
        username: process.env.RATETHISCARD_USERNAME,
        password: process.env.RATETHISCARD_PASSWORD,
    });
    await hourlyWikiPost({
        username: process.env.CHRONICLEBOT_USERNAME,
        password: process.env.CHRONICLEBOT_PASSWORD,
    });
}
function bindToPort() {
    var app = express();
    app.set("port", process.env.PORT || 5000);
    //For avoidong Heroku $PORT error
    app.get("/", function (request, response) {
        var result = "App is running";
        response.send(result);
    }).listen(app.get("port"), function () {
        console.log("App is running, server is listening on port ", app.get("port"));
    });
}
