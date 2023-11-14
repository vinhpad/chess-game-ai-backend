import { UserEntity } from '../model/mysql.js'
import {randInt} from '../helper/randomString.js'

export async function createUser(username, passwordHash, email) {
    try {
        const user = await UserEntity.create({
            data: {
                username : username,
                password : passwordHash,
                email : email,
                token : randInt(50)
            }
        })
        return user    
    } catch (error) {
        console.log(`[ERROR]: ${error}`)
        return null
    }
}

export const findUserByUsername = async (username) => {
    const data = await UserEntity.findUnique({
        data : {
            username : username
        }
    })
    return data 
}

export const findUserByToken = async (token) => {
    const data = await UserEntity.findUnique({
        data : {
            token : token
        }
    })
    return data 
}
