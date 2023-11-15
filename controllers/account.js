import {validadeUsername, validadePassword, validadeEmail } from '../helper/util.js'
import {createUser, findUserByUsername , verifyUser } from '../service/account.js'
import {encrypt} from '../helper/encript.js'
import {randInt} from '../helper/randomString.js'
import { sendEmail } from '../helper/email.js'

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
        console.log(user)
        console.log(passwordHash)
        if(!user || user.password !== passwordHash || !user.verified) 
            throw new Error('Error authentication!!!')   
        
        return response.json({
            success: true,
            token: user.token,
            username: user.username        
        })
    } catch (error) {
        console.log(`[ERROR]: ${error.message}`)
        response.status(400).json({
            success : false,
            error : error.message
        })
    }
}

export const verify = async (request, response) => {
    try {
        let { email, code } = request.body
        email = email.trim()
        code = code.trim()
        if (code.length !== verificationCodeLength || verifications[email] !== code)
            throw new Error('[Token] is invalid!')
        delete verifications[email]
        await verifyUser(username)
        response.json({success : true})
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        response.status(400).json({
            success : false,
            message : error.message
        })
    }
}

export const register = async (request, response) => {
    try {
        let { username, password, confirmPassword, email } = request.body
        if (username.length === 0 || password.length === 0 || email.length === 0
        || !validadeEmail(email) || !validadePassword(password) || !validadeUsername(username)
        || password !== confirmPassword)
            throw new Error('[Username] or [Password] or [Email] is invalid!')
        const passwordHash = encrypt(password)
        const data = await createUser(username, passwordHash, email)
        verifications[email] = randInt(verificationCodeLength)
        sendEmail(
            email, 
            'Chess verification',
            'Your verification code is ' + verifications[email]
            )
        if (!data) 
            throw new Error('Error authetication!!!')
        return response.json({success : true}) 
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        return response.status(400).json({
            success : false,
            error : error.message
        })
    }
}

export const resend = async (request, response) => {
    try {
        let { email } = request.body
        email = email.trim()
        if (verifications[email]) {
            verifications[email] = '' + randInt(verificationCodeLength)
            console.log(verifications[email])
            sendEmail(email, 'Chess verification', 'Your verification code is ' + verifications[email])
        }
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        response.status(400).json(error)
    }
}
