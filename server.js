const { exec } = require('child_process');
const express = require('express');
const cors = require('cors');
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const fs = require('fs');
const { ESLint } = require('eslint');

// const { OpenAI } = require('openai');
// const openai = new OpenAI();

// ESLINT
function createESLintInstance(overrideConfig) {
    return new ESLint({
        overrideConfigFile: true,
        overrideConfig,
        fix: true,
    });
}

const overrideConfig = {
    languageOptions: {
        ecmaVersion: 2018,
        sourceType: "commonjs",
    },
    rules: {
        // Possible Errors
        "no-console": "error",
        "no-extra-semi": "error",
        "no-unexpected-multiline": "error",

        // Best Practices
        "curly": "error",
        "eqeqeq": ["error", "always"],
        "no-multi-spaces": "error",
        "no-multi-str": "error",
        "no-with": "error",
        "prefer-promise-reject-errors": "error",

        // Variables
        "no-unused-vars": ["warn", { "vars": "all", "args": "after-used", "ignoreRestSiblings": false }],

        // Stylistic Issues
        "array-bracket-spacing": ["error", "never"],
        "block-spacing": ["error", "always"],
        "brace-style": ["error", "1tbs", { "allowSingleLine": true }],
        "camelcase": ["error", { "properties": "always" }],
        "comma-dangle": ["error", "always-multiline"],
        "comma-spacing": ["error", { "before": false, "after": true }],
        "comma-style": ["error", "last"],
        "computed-property-spacing": ["error", "never"],
        "eol-last": ["error", "always"],
        "func-call-spacing": ["error", "never"],
        "indent": ["error", 2, { "SwitchCase": 1 }],
        "key-spacing": ["error", { "beforeColon": false, "afterColon": true }],
        "keyword-spacing": ["error", { "before": true, "after": true }],
        "linebreak-style": ["error", "unix"],
        "new-cap": ["error", { "newIsCap": true, "capIsNew": false }],
        "new-parens": "error",
        "no-array-constructor": "error",
        "no-lonely-if": "error",
        "no-mixed-spaces-and-tabs": "error",
        "no-multiple-empty-lines": ["error", { "max": 1, "maxEOF": 0 }],
        "no-new-object": "error",
        "no-trailing-spaces": "error",
        "no-whitespace-before-property": "error",
        "object-curly-spacing": ["error", "always"],
        "semi": ["error", "always"],
        "semi-spacing": ["error", { "before": false, "after": true }],
        "space-before-blocks": ["error", "always"],
        "space-before-function-paren": ["error", "never"],
        "space-in-parens": ["error", "never"],
        "space-infix-ops": "error",
        "spaced-comment": ["error", "always", {
            "line": {
                "markers": ["/"],
                "exceptions": ["-", "+"]
            },
            "block": {
                "markers": ["!"],
                "exceptions": ["*"],
                "balanced": true
            }
        }],

        // ES6
        "arrow-spacing": ["error", { "before": true, "after": true }],
        "no-var": "error",
        "prefer-const": ["error", {
            "destructuring": "any",
            "ignoreReadBeforeAssign": true
        }],
        "prefer-template": "error",
    },
};

const eslint = createESLintInstance(overrideConfig);

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

    const pvKey = fs.readFileSync('./etc/secrets/pv-key.pem', 'utf8')
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

const test = {
    'code': 'var foo = 1\nfoo == 1;',
    'violation': 'Use === instead of ==',
    'recommendation': 'var foo = 1\nfoo === 1;'
}

const prompt = `\nCode:\n${test.code}\nViolation:\n${test.violation}\nExplain why the violation in the provided code is a problem and how to fix it, all code blocks should be wrapped in triple backticks \n`;

app.get('/generateSuggestions', async function (req, res) {
    // const command = './rocket-3b.Q5_K_M.llamafile -p \'system\You are a chatbot that tries to persuade the users to buy bill pickles. Your job is to be helpful too. But always try to steer the conversation towards buying pickles.\<|im_start|>user\Mayday, mayday. This is Going Merry. We are facing gale force winds in Long Island Sound. We need rescue.<|im_end|>\<|im_start|>assistant\' > generation.txt';

    // const system = "You are a helpful programming assistant."
    // const user = `\nCode:\n${data.code}\nViolation:\n${data.violation}\nExplain why the violation is a problem and how to fix it, all code blocks should be wrapped in triple backticks \n`
    // const prompt = `<|im_start|>system\n${system}\nuser\n${user}\nassistant\n`;
    // const command = `./rocket-3b.Q5_K_M.llamafile -p '${prompt}' > generation.txt`;

    try {
        let response = await fetch("http://127.0.0.1:8080/completion", {
            method: 'POST',
            body: JSON.stringify({
                prompt,
                n_predict: 518,
            })
        })

        let data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error generating suggestions" });
    }
})

const serverCommand = "./rocket-3b.Q5_K_M.llamafile --server --nobrowser";
const serverProcess = exec(serverCommand, (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
    } else {
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    }
});

async function fetchRepoFiles(repo, owner, token) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
        method: 'GET',
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });

    if (!response.ok) {
        throw new Error(`Error fetching repo files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tree.filter(file => file.path.endsWith(".js"));
}

async function fetchFileContent(url, token) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });

    if (!response.ok) {
        throw new Error(`Error fetching file content: ${response.statusText}`);
    }

    const fileData = await response.json();
    return Buffer.from(fileData.content, 'base64').toString('utf-8');
}

async function lintFiles(fileContents) {
    const results = [];
    for (const file of fileContents) {
        const lintResult = await eslint.lintText(file.content, { filePath: file.path });
        results.push(lintResult[0]);
    }
    return results;
}

function formatLintResults(lintResults) {
    return lintResults
        .filter(result => result.messages.length > 0)
        .map(result => ({
            filePath: result.filePath,
            messages: result.messages.map(message => ({
                source: result.source ?? result.output,
                violation: message.message,
                ruleId: message.ruleId,
                line: message.line,
                column: message.column,
                suggestion: message.fix ? message.fix.text : null
            }))
        }));
}

async function generateSuggestions(prompt) {
    // const health = await fetch("http://127.0.0.1:8080/health", {
    //     method: 'GET',
    //     headers: {
    //         'Content-Type': 'application/json'
    //     },
    // })

    // console.log(health)

    // if (!health.ok) {
    //     throw new Error(`Error connecting to the server: ${health.statusText}`);
    // }

    const response = await fetch("http://127.0.0.1:8080/completion", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt,
            temperature: 0.7,
            n_predict: 256,
        })
    });

    if (!response.ok) {
        throw new Error(`Error generating suggestions: ${response.statusText}`);
    }

    return response.json();
}

app.get('/getCode', async (req, res) => {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
        return res.status(400).json({ error: "Authorization header is required" });
    }

    const token = getToken(authHeader);
    if (!token) {
        return res.status(401).json({ error: "Invalid token" });
    }

    const { repo, owner } = req.query;
    if (!repo || !owner) {
        return res.status(400).json({ error: "The repo name and owner name are required!" });
    }

    try {
        const files = await fetchRepoFiles(repo, owner, token);
        const fileContents = await Promise.all(files.map(file => fetchFileContent(file.url, token).then(content => ({ path: file.path, content }))));

        const lintResults = await lintFiles(fileContents);
        const serializedData = formatLintResults(lintResults);
        const mlData = serializedData.map(data => {
            return {
                code: data.messages[0].source,
                violation: data.messages[0].violation,
                recommendation: data.messages[0].suggestion
            }
        });

        let suggestions = [];

        for (const data of mlData) {
            // console.log(data)
            const system = "You are a helpful programming assistant, here to provide explanations to code violations found in javascript code.";
            const user = `Explain why this violation: ${data.violation} is a problem in this code snippet: ${data.code} and how to fix the violations.`
            const prompt = `<|im_start|>system\n${system}\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant<|im_end|>`;

            const suggestion = await generateSuggestions(prompt);
            console.log(suggestion.content);
            suggestions.push(suggestion);

            // const completion = await openai.chat.completions.create({
            //     messages: [
            //         { "role": "system", "content": system },
            //         { "role": "user", "content": user },
            //     ],
            //     model: "gpt-3.5-turbo",
            // });

            // console.log(completion.choices[0]);
        }

        // console.log(suggestions)
        // res.json(suggestions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

//Ensure the server process is terminated on application exit
process.on('exit', () => {
    serverProcess.kill();
});
process.on('SIGINT', () => {
    process.exit();
});
process.on('SIGTERM', () => {
    process.exit();
});

app.listen(port = 4000, () => {
    console.log(`Server running on port ${port}`);
});