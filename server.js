const express = require('express');
const cors = require('cors');
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const fs = require('fs');
const { ESLint } = require('eslint');
const { error } = require('console');

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
        // "no-console": "error",
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
        "no-unused-vars": ["error", { "vars": "all", "args": "after-used", "ignoreRestSiblings": false }],

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

    const pvKey = fs.readFileSync('./secrets/pv-key.pem', 'utf8')
    const encoded_jwt = jwt.sign(payload, pvKey, { algorithm: 'RS256' })

    return encoded_jwt;
}

function getToken(header) {
    if (header?.includes("Bearer"))
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

    if (typeof fileContents == 'string') {
        const lintResult = await eslint.lintText(fileContents, { filePath: "code" });
        console.log(lintResult)
        return [lintResult[0]];
    }

    const results = [];
    for (const file of fileContents) {
        const lintResult = await eslint.lintText(file.content, { filePath: file.name });
        lintResult[0].name = file.name;
        results.push(lintResult[0]);
    }
    return results;
}

function formatLintResults(lintResults) {
    return lintResults
        .filter(result => result.messages.length > 0)
        .map(result => {
            let source = result.source ?? result.output;
            let lines = source.split('\n');
            let messages = result.messages;

            let formattedCodeBlocks = [];
            let currentLine = 0;

            while (messages.length > 0) {
                let message = messages.shift();
                let startLineNumber = currentLine + 1; // Convert to one-based index
                let errorLineNumber = message.line - 1; // Convert to zero-based index
                let codeBlock = "";

                // Extract code block from current line to error line + 1
                for (let i = currentLine; i <= errorLineNumber + 1 && i < lines.length; i++) {
                    codeBlock += lines[i] + '\n';
                }

                let violations = [
                    {
                        violation: message.message,
                        ruleId: message.ruleId,
                        line: message.line,
                        column: message.column,
                        suggestion: message.fix ? message.fix.text : null
                    }
                ];

                // Check if the next messages have the same error line number
                while (messages.length > 0 && messages[0].line === message.line) {
                    let nextMessage = messages.shift();
                    violations.push({
                        violation: nextMessage.message,
                        ruleId: nextMessage.ruleId,
                        line: nextMessage.line,
                        column: nextMessage.column,
                        suggestion: nextMessage.fix ? nextMessage.fix.text : null
                    });
                }

                formattedCodeBlocks.push({
                    code: codeBlock.trim(),
                    errorLineNumbers: violations.map(v => v.line),
                    startLineNumber: startLineNumber,
                    violations: violations
                });

                // Move currentLine to the line after the error line
                currentLine = errorLineNumber + 2;
            }

            return {
                name: result.name,
                codeBlocks: formattedCodeBlocks
            };
        });
}


async function generateSuggestions({ violation, code, recommendation }) {
    const response = await fetch("http://127.0.0.1:8000/generate", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            violation: violation,
            code: code,
            recommendation: recommendation
        })
    });

    if (!response.ok) {
        throw new Error(`Error generating suggestions: ${response.statusText}`);
    }

    return response.json();
}

function extractCodeBlocks(text) {
    const codeBlockRegex = /```(?:[^\n]*)\n([^`]+)```/g; // Capture the content inside triple backticks, ignoring optional language identifiers
    const matches = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        matches.push(match[1].trim()); // Push the captured content without backticks and trim whitespace
    }

    return matches; // Return an array of matched code blocks without backticks
}

function removeCodeBlocksFromSuggestion(suggestion) {
    const codeBlockRegex = /```[^`]+```/g; // Regular expression to match code blocks enclosed in triple backticks
    return suggestion.replace(codeBlockRegex, ''); // Replace code blocks with an empty string
}


app.post('/reviewCode', async (req, res) => {
    const authHeader = req.get("Authorization");
    const token = getToken(authHeader);

    const { repo, owner, code } = req.body;
    const type = req.query.type;

    if ((type == "git")) {
        if (!repo || !owner) return res.status(400).json({ error: "The repo name and owner name are required!" });
        if (!authHeader) return res.status(400).json({ error: "Authorization header is required" });
        if (!token) return res.status(401).json({ error: "Invalid token" });
    } else if (type == "manual" && (!code)) {
        return res.status(400).json({ error: "JavasScript code is required!" });
    }

    try {
        let fileContents
        if (type == "git") {
            const files = await fetchRepoFiles(repo, owner, token);
            fileContents = await Promise.all(files.map(file => fetchFileContent(file.url, token).then(content => ({ name: file.path, content }))));
        } else {
            fileContents = code;
        }

        const lintResults = await lintFiles(fileContents);
        const serializedData = formatLintResults(lintResults);

        for (const data of serializedData) {
            for (const codeBlock of data.codeBlocks) {
                for (const violation of codeBlock.violations) {
                    const suggestion = await generateSuggestions({
                        code: codeBlock.code,
                        violation: violation,
                        recommendation: violation.suggestion
                    });
                    violation.suggestion = removeCodeBlocksFromSuggestion(suggestion.review);
                    codeBlock.correctedCode = extractCodeBlocks(suggestion.review)
                }
            }
        }

        res.json(serializedData)
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(port = 4000, () => {
    console.log(`Server running on port ${port}`);
});