import { GameEntity } from "../model/mysql.js";

export async function createGame(newGame) {
    try {
        const data = await GameEntity.create({
            data : newGame
        })
        return data
    } catch ( error ) {
        console.log(`[ERROR:] ${error.message}`)
    }
}