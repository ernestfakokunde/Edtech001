import { Router } from 'express'
import {
  forgotPassword,
  login,
  logout,
  me,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail,
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { issueCsrfToken } from '../middleware/csrf.js'
import {
  csrfLimit,
  forgotPasswordAccountLimit,
  forgotPasswordIpLimit,
  loginAccountLimit,
  loginIpLimit,
  resendVerificationLimit,
  resetPasswordLimit,
  signupLimit,
  verifyEmailLimit,
} from '../middleware/rateLimit.js'

export const authRouter = Router()

// Auth responses contain identity and entitlement data; never let a shared
// cache keep them.
authRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

authRouter.get('/csrf', csrfLimit, issueCsrfToken)
authRouter.post('/signup', signupLimit, signup)
// Two budgets: one protects the account from password guessing, the other
// protects the service from a single connection spraying many addresses.
authRouter.post('/login', loginIpLimit, loginAccountLimit, login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireAuth, me)
authRouter.post('/forgot-password', forgotPasswordIpLimit, forgotPasswordAccountLimit, forgotPassword)
authRouter.post('/reset-password', resetPasswordLimit, resetPassword)
authRouter.post('/verify-email', verifyEmailLimit, verifyEmail)
authRouter.post('/resend-verification', requireAuth, resendVerificationLimit, resendVerification)
