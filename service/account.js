import { UserEntity } from '../model/mysql.js'
import {randInt} from '../helper/randomString.js'

export async function createUser(username, passwordHash, email) {
    try {
        const newUser = {
            username : username,
            password : passwordHash,
            email : email,
            token : randInt(50)
        }
        console.log(newUser)
        const user = await UserEntity.create({data: newUser})
        return user    
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        return null
    }
}

export const findUserByUsername = async (username) => {
    const data = await UserEntity.findUnique({
        where : {
            username : username
        }
    })
    return data 
}

export const findUserByToken = async (token) => {
    try {
        const data = await UserEntity.findUnique({
            where : {
                token : token
            }
        })
        return data 
    } catch (error) {
        console.log(`[ERROR]: ${error.message}`)
    }
}

export async function verifyUser(username) {
    try {
        const data = await UserEntity.update({
            where : {
                username : username
            },
            data : {
                verified : true
            }
        })
        return data
    } catch( error ) {
        console.log(error.message)
    }
}

export async function updateElo(token, elo) {
    try {
        const data = await UserEntity.update({
            where : {
                token : token
            },
            data : {
                elo : elo
            }
        })
        return data
    } catch( error ) {
        console.log(`[ERROR]: ${error.message}`)
    }
}

export async function getEloFromToken(token) {
    try {
        const data = await UserEntity.findUnique({
            where : {
                token : token
            }
        })
        return data
    } catch( error ) {
        console.log(`[ERROR]: ${error.message}`)
        return null
    }
}