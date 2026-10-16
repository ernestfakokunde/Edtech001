import { Router } from 'express'
import { getPaymentStatus, getProPricing, initializeProCheckout } from '../controllers/payment.controller.js'
import { requireAuth } from '../middleware/auth.js'

export const paymentRouter = Router()
paymentRouter.use(requireAuth)
paymentRouter.get('/pricing', getProPricing)
paymentRouter.post('/checkout', initializeProCheckout)
paymentRouter.get('/status', getPaymentStatus)
