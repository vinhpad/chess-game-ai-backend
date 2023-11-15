import express from 'express'
import { Server } from 'socket.io'
import { createServer } from 'http'
import path from 'path'
import { initialize } from './core/socket.js'
import accountRouter from './routers/account.js'

const __dirname = path.resolve()
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer)
// cors enable
app.use((req, res, next) => {
    if (
        req.headers.accept.includes('text/html') ||
        req.url.includes('worker') ||
        req.url.includes('stockfish.js')
    ) {
        res.header('Cross-Origin-Opener-Policy', 'same-origin')
        res.header('Cross-Origin-Embedder-Policy', 'require-corp')
        res.header('Cross-Origin-Resource-Policy', 'cross-origin')
    }
    next()
})

// use html home page
app.use(express.static('public'))
app.use(express.json())

// ping to server
app.get('/ping', (request, response) => {
    console.log('ping server!!!')
    response.send('pong')
})

// api account [login, register, send-mail]
app.use('/account', accountRouter)


// game socket
io.on('connection', (socket) => initialize(socket,io))

// api 404
app.get('*', (req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile('public/404.html', { root: __dirname })
        return
    }

    if (req.accepts('json')) {
        res.status(404).send({ error: 'Not found' })
        return
    }

    res.type('txt').send('Not found')
})

// host server
const port = process.env.PORT || 3000
httpServer.listen(port, () => {
    console.log(`> Server listening on port ${port}`)
})
