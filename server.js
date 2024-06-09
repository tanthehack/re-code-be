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

function getToken(header) {
    if (header.includes("Bearer"))
        return header.substring(7, header.length).trim();
    return null
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

app.get('/getUserRepos', async function (req, res) {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
        return res.status(400).json({ error: "Authorization header is required" });
    }

    const token = getToken(authHeader);
    if (!token) {
        return res.status(401).json({ error: "Invalid token" });
    }

    try {
        const response = await fetch("https://api.github.com/installation/repositories", {
            method: "GET",
            headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28"
            }
        })

        if (response.status === 401) {
            return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
        } else if (response.status === 403) {
            return res.status(403).json({ error: "Forbidden: Access denied" });
        } else if (!response.ok) {
            return res.status(response.status).json({ error: `Error: ${response.statusText}` });
        }

        const data = await response.json();
        console.log("the data", data);
        res.json(data);
    } catch (error) {
        console.error("Error fetching data from GitHub API:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

app.post('/importCode', async function (req, res) {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
        return res.status(400).json({ error: "Authorization header is required" });
    }

    const token = getToken(authHeader);
    if (!token) {
        return res.status(401).json({ error: "Invalid token" });
    }

    const body = req.body;
    const { repo, owner } = body;

    if (!repo || !owner) {
        return res.status(400).json({ error: "The repo name and owner name are required!" });
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
            method: "GET",
            headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28"
            }
        })

        if (response.status === 401) {
            console.error("Unauthorized: Invalid or expired token");
            return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
        } else if (response.status === 403) {
            console.error("Forbidden: Access denied");
            return res.status(403).json({ error: "Forbidden: Access denied" });
        } else if (!response.ok) {
            console.error(`Error: ${response.statusText}`);
            return res.status(response.status).json({ error: `Error: ${response.statusText}` });
        }

        let data;
        try {
            data = await response.json();

        } catch (jsonError) {
            console.error("Invalid JSON response", jsonError);
            return res.status(502).json({ error: "Bad Gateway: Invalid JSON response from API" });
        }

        if (!data.JavaScript) {
            console.error("JavaScript code not found in the repository");
            return res.status(400).json({ error: "JavaScript code not found in the repository" });
        }

        res.json(data);
    } catch (error) {
        console.error("Error fetching data from GitHub API:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
})

app.listen(4000, function () {
    console.log("Server sunning on port 4000");
})