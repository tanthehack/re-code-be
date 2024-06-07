const express = require('express');
const cors = require('cors');
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));
const bodyParser = require('body-parser');
require('dotenv').config()

const app = express();

app.use(cors());
app.use(bodyParser.json());

//GH - Get Access Token
app.get('/getAccessToken', async function (req, res) {
    req.query.code;
    await fetch(`https://github.com/login/oauth/access_token?client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&code=${req.query.code}`, {
        method: "POST",
        headers: {
            "Accept": "application/json"
        }
    }).then((response) => {
        return response.json();
    }).then((data) => {
        console.log(data);
        res.json(data);
    });
});

//GH - Get user data
app.get('/getUserData', async function (req, res) {
    req.get("Authorization");
    await fetch("https://api.githum.com/user", {
        method: "GET",
        headers: {
            "Authorization": req.get("Authorization")
        }
    }).then((response) => {
        return response.json()
    }).then((data) => {
        console.log(data);
        res.json(data);
    })
})

app.listen(4000, function () {
    console.log("Server sunning on port 4000");
})
