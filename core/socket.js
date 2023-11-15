import { moveString, moveNumber } from '../public/modules/constants.js'
import Timer, { msToSec } from '../public/modules/timer.js'
import { loadEngine } from '../loadEngine.js'
import { findUserByToken, updateElo, getEloFromToken } from '../service/account.js'
import randStr from '../helper/randomString.js'
import { createGame } from '../service/game.js'

var oldServerDelay = 2
var oldConnections = 0
var olfPlaying = 0
var serverDelay = 2
var playing = 0
const games = {}
const queue = {}

function oppositeColor(color) {
    return color === 'white' ? 'black' : 'white'
}

function tryToFindOpponent(socketId) {
    const queueKeys = Object.keys(queue)
    if (queueKeys.length <= 1) return
    const opponentSocketId = queueKeys[0]
    const opponentSocket = queue[opponentSocketId]
    delete queue[opponentSocketId]
    delete queue[socketId]
    let newId = randStr(10)
    while (games[newId]) newId = randStr(10)
    const roomId = newId
    games[roomId] = Game(roomId, 600, true, false)
    console.log(`> Room ${roomId}: created`)
    if (Math.random() < 0.5) {
        setTimeout(() => {
            opponentSocket.emit('match-found', roomId)
        }, 100)
        io.to(socketId).emit('match-found', roomId)
    } else {
        setTimeout(() => {
            io.to(socketId).emit('match-found', roomId)
        }, 100)
        opponentSocket.emit('match-found', roomId)
    }
}


export function initialize(socket, io) {
    console.log(`> socket connected ${socket.id}`)

    socket.emit('connections', io.engine.clientsCount)
    socket.emit('playing', playing)
    socket.emit('server-delay', serverDelay ?? 2)

    socket.on('join-room', ({ roomId, token, color }) => {
        if (games[roomId]) {
            socket.emit('join-room', 'success')
            games[roomId].join(socket, token, color)

            socket.on('disconnect', () => {
                if (games[roomId]) games[roomId].leave(socket)
            })
        } else {
            socket.emit('not-found')
        }
    })

    socket.on('get-rooms', () => {
        const rooms = []
        for (const roomId in games) {
            if (!games[roomId].isPublic) continue
            rooms.push({
                roomId,
                player: games[roomId].getOwnerInfo(),
                time: games[roomId].getTime(),
            })
        }
        socket.emit('get-rooms', rooms)
    })

    socket.on('find-room', () => {
        queue[socket.id] = socket
        tryToFindOpponent(socket.id)
    })
    socket.on('find-room-cancel', () => {
        if (queue[socket.id]) delete queue[socket.id]
    })
    socket.on('disconnect', () => {
        if (queue[socket.id]) delete queue[socket.id]
    })

    socket.on('create-room', ({ time, rated, isPublic }) => {
        if (isNaN(time)) {
            socket.emit('create-room', 'error:Time must be a number')
            return
        }
        time = +time
        if (time < 10) {
            socket.emit('create-room', 'error:Time must be greater than 10 seconds')
            return
        }
        if (time > 10800) {
            socket.emit('create-room', 'error:Time limit is 180 minutes')
            return
        }

        let newId = randStr(10)
        while (games[newId]) {
            newId = randStr(10)
        }
        const roomId = newId
        games[roomId] = Game(roomId, +time, !!rated, !!isPublic)
        console.log(`> Room created ${roomId}`)
        socket.emit('create-room', roomId)
    })

    function Game(id, time, rated = false, isPublic = false) {
        let serverDelayStart = 0
    
        let state = 0
    
        let startedDate = null
        let endedDate = null
    
        const roomOwner = {
            username: null,
            elo: null,
        }
    
        function getOwnerInfo() {
            return roomOwner
        }
    
        const gameTime = time
    
        function getTime() {
            return gameTime
        }
    
        let fen = `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`
    
        const players = {
            white: {
                id: null,
                socket: null,
                timer: new Timer(secToMs(gameTime)),
                token: null,
                info: null,
            },
            black: {
                id: null,
                socket: null,
                timer: new Timer(secToMs(gameTime)),
                token: null,
                info: null,
            },
        }
    
        setInterval(() => {
            if (state !== 1) return
            if (msToSec(players.white.timer.getTime()) <= 0) {
                win('black')
                io.to(id).emit('time-out', 'white')
                io.to(id).emit('update-timers', {
                    white: 0,
                    black: players.black.timer.getTime(),
                    running: null,
                })
            } else if (msToSec(players.black.timer.getTime()) <= 0) {
                win('white')
                io.to(id).emit('time-out', 'black')
                io.to(id).emit('update-timers', {
                    white: players.white.timer.getTime(),
                    black: 0,
                    running: null,
                })
            }
        }, 100)
    
        let turn = 'w'
        const moves = []
    
        const engine = loadEngine()
    
        engine.onmessage = (data) => {
            data = data + ''
            if (data.startsWith('Fen:')) {
                fen = data.split(':')[1].trim()
                const curTurn = data.split(' ')[2]
                if (curTurn === turn) {
                    validMove()
                } else {
                    invalidMove()
                }
            }
            if (data == 'info depth 0 score mate 0') {
                win(turn === 'b' ? 'white' : 'black')
            }
        }
    
        engine.postMessage('uci')
        engine.postMessage('isready')
    
        engine.postMessage('ucinewgame')
        engine.postMessage('position startpos')
    
        function win(color) {
            console.log(`> Room ${id}: ${color} is victorious`)
            endedDate = new Date()
            state = 2
            if (players[color].token && rated) {
                updateElo(players[color].token, players[color].info.elo + 10)
                if (players[color].socket) players[color].socket?.emit('update-elo', 10)
            }
            if (players[oppositeColor(color)].token && rated) {
                updateElo(players[color].token, players[color].info.elo - 10)
                if (players[oppositeColor(color)].socket)
                    players[oppositeColor(color)].socket?.emit('update-elo', -10)
            }
            createGame({
                started: startedDate,
                ended: endedDate,
                white_player: players.white.id ?? null,
                black_player: players.black.id ?? null,
                winner: players[color].id ?? null,
                winner_color: color,
                final_position: fen,
            })
        }
    
        function notYourTurn(color) {
            if (players[color].socket) players[color].socket?.emit('not-your-turn')
        }
    
        function invalidMove() {
            players[turn === 'w' ? 'black' : 'white'].socket?.emit('invalid-move')
            turn = turn === 'w' ? 'b' : 'w'
            moves.splice(moves.length - 1, 1)
        }
    
        function validMove() {
            const lastMove = moves[moves.length - 1]
            const lastMoveArr = lastMove.split('')
            const from = {
                x: +moveNumber[`x${lastMoveArr[0]}`],
                y: +moveNumber[`y${lastMoveArr[1]}`],
            }
            const to = {
                x: +moveNumber[`x${lastMoveArr[2]}`],
                y: +moveNumber[`y${lastMoveArr[3]}`],
            }
            if (turn === 'b') {
                players.white.timer.stop()
                players.black.timer.start()
            } else {
                players.black.timer.stop()
                players.white.timer.start()
            }
            engine.postMessage(`go depth 1`)
            players[turn === 'b' ? 'black' : 'white'].socket?.emit(
                'move',
                new Move(from.x, from.y, to.x, to.y),
            )
            io.to(id + '-spectator').emit('move', new Move(from.x, from.y, to.x, to.y))
            io.to(id).emit('update-timers', {
                white: players.white.timer.getTime(),
                black: players.black.timer.getTime(),
                running: turn === 'b' ? 'black' : 'white',
            })
            serverDelay = new Date().getTime() - serverDelayStart
        }
    
        function verifyMove(from, to, promotion = '') {
            const fromStr = moveString[`x${from.x}`] + '' + moveString[`y${from.y}`]
            const toStr = moveString[`x${to.x}`] + '' + moveString[`y${to.y}`]
    
            moves.push(fromStr + toStr + promotion)
    
            engine.postMessage('position startpos moves ' + moves.join(' '))
            engine.postMessage('d')
        }
    
        const rematch = {
            white: false,
            black: false,
        }
        const draw = {
            white: false,
            black: false,
        }
    
        async function join(socket, token, color) {
            const users = [ await findUserByToken(token) ]
            if (users.length === 0) token = undefined
            const user = users[0] ?? null
            
            if (state === 2) {
                socket.emit('join-room', 'error:Game already finished')
                return
            }
            if (token && (players.white.token === token || players.black.token === token)) {
                socket.emit('join-room', 'error:You are already in this room')
                return
            }
            let joined = false
            if (state === 0) {
                if (!color) {
                    if (players.white.socket === null) {
                        joined = true
                        players.white.socket = socket
                        players.white.timer = new Timer(secToMs(gameTime))
                        players.white.token = token
                        players.white.id = user?.id ?? null
                        socket.emit('color', 'white')
                        socket.join(id)
                    } else if (players.black.socket === null) {
                        joined = true
                        players.black.socket = socket
                        players.black.timer = new Timer(secToMs(gameTime))
                        players.black.token = token
                        players.black.id = user?.id ?? null
                        socket.emit('color', 'black')
                        socket.join(id)
                    }
                } else {
                    if (players[color].socket === null) {
                        joined = true
                        players[color].socket = socket
                        players[color].timer = new Timer(secToMs(gameTime))
                        players[color].token = token
                        players[color].id = user?.id ?? null
                        socket.emit('color', color)
                        socket.join(id)
                        if (roomOwner.username === null) {
                            if (token != null && user.username == null) {
                                players[color].socket?.emit('sign-out')
                                leave(players[color].socket)
                                return
                            }
                            roomOwner.username = user?.username ?? 'Anonymous'
                            roomOwner.elo = user?.elo ?? '800?'
                        }
                    } else if (players[oppositeColor(color)].socket === null) {
                        joined = true
                        players[oppositeColor(color)].socket = socket
                        players[oppositeColor(color)].timer = new Timer(secToMs(gameTime))
                        players[oppositeColor(color)].token = token
                        players[oppositeColor(color)].id = user?.id ?? null
                        socket.emit('color', oppositeColor(color))
                        socket.join(id)
                        if (roomOwner.username === null) {
                            roomOwner.username = user?.username ?? 'Anonymous'
                            roomOwner.elo = user?.elo ?? '800?'
                        }
                    }
                }
            }
            if (!joined) {
                socket.join(id)
                socket.join(id + '-spectator')
                socket.emit('spectator', {
                    fen: fen,
                    gameTime: gameTime,
                    players: {
                        white: players.white.info,
                        black: players.black.info,
                    },
                })
                let running = null
                if (players.white.timer.isRunning) {
                    running = 'white'
                } else if (players.black.timer.isRunning) {
                    running = 'black'
                }
                io.to(id + '-spectator').emit('update-timers', {
                    white: players.white.timer.getTime(),
                    black: players.black.timer.getTime(),
                    running: running,
                })
            } else {
                playing++
                if (players.black.socket !== null && players.white.socket !== null) {
                    start()
                }
            }
            console.log(`> Room ${id}: player joined`)
        }
    
        function leave(socket, signOut = false) {
            console.log(`> Room ${id}: player left`)
            if (socket != players.white.socket && socket != players.black.socket) return
            playing--
            if (signOut) {
                if (players.white.socket === socket) {
                    players.white.socket = null
                    players.white.token = null
                    players.white.info = null
                } else if (players.black.socket === socket) {
                    players.black.socket = null
                    players.black.token = null
                    players.black.info = null
                }
                return
            }
            if (state === 0 || state === 2) {
                if (players.white.socket === socket) players.white.socket = null
                if (players.black.socket === socket) players.black.socket = null
                /* stop()
                return */
            }
            if (players.white.socket === socket) {
                if (state === 1) {
                    state = 2
                    players.white.socket = null
                    players.white.token = null
                    io.to(id).emit('player-disconnected', 'white')
                    win('black')
                }
            } else if (players.black.socket === socket) {
                if (state === 1) {
                    state = 2
                    players.black.socket = null
                    players.black.token = null
                    io.to(id).emit('player-disconnected', 'black')
                    win('white')
                }
            }
            endGame()
        }
    
        async function start() {
            state = 1
    
            if (players.white.token) {
                players.white.info = await getEloFromToken(players.white.token)
                if (players.white.token != null && players.white.info.username == null) {
                    state = 0
                    players.white.socket.emit('sign-out')
                    leave(players.white.socket, true)
                    return
                }
            }
            if (players.black.token) {
                players.black.info = await getEloFromToken(players.black.token)
                if (players.black.token != null && players.black.info.username == null) {
                    state = 0
                    players.black.socket.emit('sign-out')
                    leave(players.black.socket, true)
                    return
                }
            }
    
            startedDate = new Date()
    
            io.to(id).emit('start', {
                gameTime,
                players: {
                    white: players.white.info,
                    black: players.black.info,
                },
            })
    
            players.white.socket?.on('move', ({ from, to, promotion }) => {
                if (turn === 'b') {
                    notYourTurn('white')
                    return
                }
                serverDelayStart = new Date().getTime()
                turn = 'b'
                verifyMove(from, to, promotion ? 'q' : '')
            })
            players.black.socket?.on('move', ({ from, to, promotion }) => {
                if (turn === 'w') {
                    notYourTurn('black')
                    return
                }
                serverDelayStart = new Date().getTime()
                turn = 'w'
                verifyMove(from, to, promotion ? 'q' : '')
            })
    
            players.white.socket?.on('request-rematch', () => {
                rematch.white = true
                checkRematch()
            })
    
            players.black.socket?.on('request-rematch', () => {
                rematch.black = true
                checkRematch()
            })
    
            players.white.socket?.on('draw', () => {
                draw.white = true
                checkDraw()
            })
            players.black.socket?.on('draw', () => {
                draw.black = true
                checkDraw()
            })
    
            players.white.socket?.on('resign', () => {
                win('black')
                io.to(id).emit('resign', 'white')
            })
            players.black.socket?.on('resign', () => {
                win('white')
                io.to(id).emit('resign', 'black')
            })
        }
    
        function checkDraw() {
            if (draw.white && draw.black) {
                state = 2
                console.log(`> Draw in room ${id}`)
            }
        }
    
        function checkRematch() {
            if (rematch.white && rematch.black) {
                turn = 'w'
                moves.length = 0
                engine.postMessage('ucinewgame')
                engine.postMessage('position startpos')
    
                rematch.white = false
                rematch.black = false
    
                players.white.timer?.stop()
                players.black.timer?.stop()
    
                players.white.timer?.reset()
                players.black.timer?.reset()
    
                state = 1
    
                io.to(id).emit('update-timers', {
                    white: secToMs(gameTime),
                    black: secToMs(gameTime),
                    running: null,
                })
    
                io.to(id).emit('accepted-rematch')
            }
        }
    
        function endGame() {
            if (players.black.socket === null && players.white.socket === null) {
                stop()
            }
        }
    
        function stop() {
            console.log(`> Room ${id}: closed`)
            if (players.white.socket) players.white.socket?.emit('reset')
            if (players.black.socket) players.black.socket?.emit('reset')
            engine.terminate()
            delete games[id]
        }
    
        return {
            join,
            leave,
            stop,
            isPublic,
            getOwnerInfo,
            getTime,
        }
    }
    
    function secToMs(sec) {
        return sec * 1000
    }
    
    class Move {
        from = {
            x: null,
            y: null,
        }
        to = {
            x: null,
            y: null,
        }
        promotion
        constructor(fromX, fromY, toX, toY, promotion = null) {
            this.from.x = fromX
            this.from.y = fromY
            this.to.x = toX
            this.to.y = toY
            this.promotion = promotion
        }
    }
    
    setInterval(() => {
        if (serverDelay !== oldServerDelay) {
            oldServerDelay = serverDelay
            io.sockets.emit('server-delay', serverDelay ?? 2)
        }
        if (io.engine.clientsCount !== oldConnections) {
            oldConnections = io.engine.clientsCount
            io.sockets.emit('connections', oldConnections)
        }
        if (playing !== olfPlaying) {
            olfPlaying = playing
            io.sockets.emit('playing', playing)
        }
    }, 5000)

}

