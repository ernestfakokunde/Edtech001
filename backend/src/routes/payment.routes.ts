import { Router } from 'express'
import { getPaymentStatus, getProPricing, initializeProCheckout } from '../controllers/payment.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { checkoutLimit } from '../middleware/rateLimit.js'

export const paymentRouter = Router()
paymentRouter.get('/pricing', getProPricing)
paymentRouter.use(requireAuth)
paymentRouter.post('/checkout', checkoutLimit, initializeProCheckout)
paymentRouter.get('/status', getPaymentStatus)
