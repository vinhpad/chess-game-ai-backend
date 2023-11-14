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
