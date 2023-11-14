import {validadeUsername, validadePassword, validadeEmail } from '../helper/util.js'
import {createUser, findUserByUsername, findUserByToken } from '../service/account.js'
import {encrypt} from '../helper/encript.js'
import {randInt} from '../helper/randomString.js'

const verifications = {}
const verificationCodeLength = 10

export const login = async (request, response) => {
    try {
        let { username, password } = request.body
        username = username.trim()
        password = password.trim()
        if (username.length === 0 || password.length == 0) 
            throw new Error('[Username] or [Password] is invalid!')   
        const passwordHash = encrypt(password)
        const user = await findUserByUsername(username)
        if(!user) 
            throw new Error('[Username] dose not exist!')
        if(user.password !== passwordHash) 
            throw new Error('[Password] incorrect!')
        response.json(user)
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        response.status(error.status).json(error)
    }
}

export const verify = async (request, response) => {
    try {
        let { email, code } = request.body
        email = email.trim()
        code = code.trim()
        if (code.length !== verificationCodeLength || verifications[email] !== code)
            throw new Error('[Token] is invalid!')
        const data = await verifyUserByEmail(email)
        delete verification[email]
        response.json(data)
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        response.status(error.status).json(error)
    }
}

export const register = async (request, response) => {
    try {
        let { username, password, confirmPassword, email } = request.body
        if (username.length === 0 || password.length === 0 || email.length === 0
        || !validadeEmail(email) || !validadePassword(password) || !validadeUsername(username)
        || password !== confirmPassword)
            throw new Error('[Username] or [Password] or [Email] is invalid!')
        console.log( `${username} ${password} ${confirmPassword} ${email}`)
        const passwordHash = encrypt(password)
        const data = await createUser(username, passwordHash, email)
        response.json(data) 
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        response.status(error.status).json(error)
    }
}

export const resend = async (request, response) => {
    try {
        let { email } = request.body
        email = email.trim()
        if (verifications[email]) {
            verifications[email] = '' + randInt(verificationCodeLength)
            sendEmail(email, 'Chess verification', 'Your verification code is ' + verifications[email])
        }
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        response.status(error.status).json(error)
    }
}
