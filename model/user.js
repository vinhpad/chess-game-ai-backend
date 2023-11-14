app.post('/account/login', (req, res) => {
    let { username, password } = req.body

    username = username.trim()
    password = password.trim()

    if (username.length === 0) {
        res.status(400).json({
            success: false,
            error: 'Username cannot be empty',
        })
        return
    }
    if (password.length === 0) {
        res.status(400).json({
            success: false,
            error: 'Password cannot be empty',
        })
        return
    }

    login(username, password)
        .then((user) => {
            if (user.token) {
                res.json({
                    success: true,
                    token: user.token,
                    username: user.username,
                })
            } else {
                res.status(500).json({
                    success: false,
                })
            }
        })
        .catch((e) => {
            res.status(500).json({
                success: false,
                error: e.message,
            })
        })
})

async function getEloFromToken(token) {
    if (!token) {
        return {
            elo: null,
            username: null,
        }
    }
    const user = await mysqlQuery(`select username, elo from users where token = ?`, [token])
    if (user.length === 0) {
        return {
            elo: null,
            username: null,
        }
    }
    return {
        elo: user[0].elo,
        username: user[0].username,
    }
}


async function login(username, password) {
    return new Promise(async (resolve, reject) => {
        try {
            const encryptedPassword = encrypt(password)
            const user = await mysqlQuery(
                'select * from users where (username = ? or email = ?) and password = ?',
                [username + '', username + '', encryptedPassword + ''],
            )
            if (user.length === 0) {
                reject(new Error('Invalid username or password'))
                return
            }
            if (!user[0].verified) {
                reject(new Error('Invalid username or password'))
                return
            }
            const curToken = user[0].token
            if (curToken) {
                resolve(user[0])
                return
            }
            let newToken = randStr(40)
            const token = await mysqlQuery(`select token from users where token = ?`, [newToken])
            if (token.length > 0) {
                while (newToken === token[0].token) {
                    newToken = randStr(10)
                }
            }
            await mysqlQuery(
                `update users set token = ? where (username = ? or email = ?) and password = ?`,
                [newToken, username, username, encryptedPassword],
            )
            resolve((await mysqlQuery(`select * from users where token = ?`, [newToken]))[0])
        } catch (error) {
            reject(error)
        }
    })
}

async function insertToUsers(values) {
    console.log(values)
    return new Promise(async (resolve, reject) => {
        try {
            await insertInto('users', values)
            console.log("done")
            resolve()
        } catch (e) {
            if (e.message.includes('Duplicate entry')) {
                if (e.message.includes('username')) reject(new Error('Username already registered'))
                else if (e.message.includes('email')) reject(new Error('Email already registered'))
            } else {
                reject(e)
            }
        }
    })
}

app.post('/account/verify', async (req, res) => {
    let { email, code } = req.body
    email = email.trim()
    code = code.trim()
    if (code.length !== verificationCodeLength) {
        res.status(400).send({
            success: false,
        })
        return
    }
    if (verifications[email] !== code)
        return res.status(400).json({
            success: false,
        })

    try {
        await mysqlQuery(`update users set verified = true where email = ?`, [email])
        delete verifications[email]
        res.json({
            success: true,
        })
    } catch (e) {
        res.status(500).json({
            success: false,
        })
    }
})
app.post('/account/verify/resend', (req, res) => {
    let { email } = req.body
    email = email.trim()
    if (verifications[email]) {
        verifications[email] = '' + randInt(verificationCodeLength)
        sendEmail(email, 'Chess verification', 'Your verification code is ' + verifications[email])
    }
    res.send('sent!')
})

app.post('/account/register', (req, res) => {
    console.log(req.body)
    let { username, password, confirmPassword, email } = req.body

    username = username.trim()
    email = email.trim()

    //empty
    if (username.length === 0) {
        res.status(400).json(error('Username cannot be empty'))
        return
    }
    if (password.length === 0) {
        res.status(400).json(error('Password cannot be empty'))
        return
    }
    if (email.length === 0) {
        res.status(400).json(error('Email cannot be empty'))
        return
    }

    //validation
    if (!validadeUsername(username)) {
        res.status(400).json(
            error('Username must have only letter and numbers and be between 4 and 20 characters'),
        )
        return
    }
    if (!validadePassword(password)) {
        res.status(400).json(error('Password must be between 6 and 30 characters'))
        return
    }
    if (!validadeEmail(email)) {
        res.status(400).json(error('Email is not valid'))
        return
    }

    //password match
    if (password !== confirmPassword) {
        res.status(400).json(error("Passwords don't match"))
        return
    }

    password = encrypt(password)
    console.log("=========================")
    insertToUsers({
        username,
        password,
        email,
    })
        .then(() => {
            verifications[email] = '' + randInt(verificationCodeLength)
            sendEmail(
                email,
                'Chess verification',
                'Your verification code is ' + verifications[email],
            )
            res.json({
                success: true,
            })
        })
        .catch((e) => {
            res.status(500).json({
                success: false,
                error: e.message,
            })
        })
})
function error(message) {
    return {
        success: false,
        error: message,
    }
}

const verifications = {}

const verificationCodeLength = 4
