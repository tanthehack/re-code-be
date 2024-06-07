const express = require('express');
const cors = require('cors');
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const fs = require('fs');

const app = express();

app.use(cors());
app.use(bodyParser.json());

function createJWT() {
    const payload = {
        //issued at time, 60 seconds in the past to allow for clock drift
        iat: Math.floor(Date.now() / 1000) - 60,

        //JWT expiration time (10 minute maximum)
        exp: Math.floor(Date.now() / 1000) + (10 * 60),

        //GitHub App's client ID
        iss: process.env.CLIENT_ID
    }

    const pvKey = fs.readFileSync('/etc/secrets/pv-key.pem', 'utf8')
    const encoded_jwt = jwt.sign(payload, pvKey, { algorithm: 'RS256' })

    return encoded_jwt;
}

app.get('/getInstallations', async function (req, res) {
    req.get("Authorization");
    const jwt = createJWT();

    await fetch(`https://api.github.com/app/installations`, {
        method: "GET",
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${jwt}`,
            "X-GitHub-Api-Version": "2022-11-28"
        }
    }).then((response) => {
        return response.json();
    }).then((data) => {
        res.json(data);
    })
})

app.get('/getAccessToken', async function (req, res) {
    req.query.id;
    const jwt = createJWT();
    await fetch(`https://api.github.com/app/installations/${req.query.id}/access_tokens`, {
        method: "POST",
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${jwt}`,
            "X-GitHub-Api-Version": "2022-11-28"
        }
    }).then((response) => {
        return response.json();
    }).then((data) => {
        console.log(data);
        res.json(data);
    });
});

app.listen(4000, function () {
    console.log("Server sunning on port 4000");
})