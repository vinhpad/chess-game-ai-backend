import { createBoard } from '../modules/board.js'

import { ping } from '../modules/ping.js'

import { serverDelay } from '../modules/serverDelay.js'

const socket = io('/')

const pingConfig = {
    good: {
        color: '#00bb00',
        min: 0,
        max: 170,
    },
    medium: {
        color: '#ffcc00',
        min: 171,
        max: 400,
    },
    bad: {
        color: '#cc0000',
        min: 401,
        max: 800,
    },
    veryBad: {
        color: '#770000',
        min: 801,
        max: Infinity,
    },
}

ping.config(document.querySelector('.ping-wrapper .ping-value'), 5000, pingConfig)
serverDelay.config(socket, document.querySelector('.ping-wrapper .server-value'), pingConfig)

if (localStorage.getItem('token') && localStorage.getItem('username')) {
    const signOutBtn = document.querySelector('header button.sign-out')
    document.querySelector('header a.sign-in').classList.add('hidden')

    signOutBtn.onclick = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        location.reload()
    }

    signOutBtn.textContent = `${localStorage.getItem('username')} | Sign out`

    signOutBtn.classList.remove('hidden')
}

const searchParams = new URLSearchParams(location.search)

const form = document.querySelector('.filters form')
const minRating = form.querySelector('input.min')
const maxRating = form.querySelector('input.max')
const toggleBtns = form.querySelectorAll('.toggle')


if (searchParams.has('minRating')) {
    minRating.value = searchParams.get('minRating')
}
if (searchParams.has('maxRating')) {
    maxRating.value = searchParams.get('maxRating')
}
if (searchParams.has('themes')) {
    toggleBtns.forEach((btn) => {
        const theme = btn.getAttribute('data-theme')
        if (searchParams.get('themes').includes(theme)) {
            btn.classList.add('selected')
        }
    })
}

toggleBtns.forEach((btn) => {
    btn.onclick = () => {
        btn.classList.toggle('selected')
    }
})

form.onsubmit = (e) => {
    e.preventDefault()

    const selectedButtons = form.querySelectorAll('.toggle.selected')

    let themeStr = ''

    if (selectedButtons.length > 0) {
        selectedButtons.forEach((button, i) => {
            themeStr += `${button.getAttribute('data-theme')}`
            if (i !== selectedButtons.length - 1) {
                themeStr += ','
            }
        })
    }

    location.search = `?minRating=${minRating.value}&maxRating=${maxRating.value}&themes=${themeStr}`
}

