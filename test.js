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

// Example usage
const lintResults = [
    {
        name: "example.js",
        source: `function authenticateUser(username, password, callback) {
    database.query('SELECT * FROM users WHERE username = ?', [username], function (err, user) {
        if (err) {
            callback(err);
            return;
        }

        if (user.password === password) {
            tokenService.createToken(user.id, function (err, token) {
                if (err) {
                    callback(err);
                    return;
                }

                emailService.sendLoginNotification(user.email, function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    callback(null, token);
                });
            });
        } else {
            callback('Invalid password');
        }
    });
}

authenticateUser('user1', 'password123', function (err, token) {
    if (err) {
        console.log("Authentication failed:", err);
    } else {
        console.log("Authentication successful, token:", token);
    }
});`,
        messages: [
            {
                line: 4,
                column: 5,
                message: "Unexpected 'err'",
                ruleId: "no-unused-vars",
                fix: {
                    text: "Remove the 'err' variable"
                }
            },
            {
                line: 4,
                column: 12,
                message: "Expected ';' after variable declaration",
                ruleId: "semi",
                fix: {
                    text: "Add a semicolon"
                }
            }
        ]
    }
];

console.log(JSON.stringify(formatLintResults(lintResults), null, 2));
