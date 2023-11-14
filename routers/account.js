import express from 'express'
import { login, verify, register, resend } from '../controllers/account.js'

const router = express.Router()
router.post('/login', login)
router.post('/verify', verify)
router.post('/register', register)
router.post('/verify/resend', resend)
export default router