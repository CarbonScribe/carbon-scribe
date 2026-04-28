'use client'

import { useState } from 'react'
import { X, ShoppingCart, CreditCard, Trash2, CheckCircle, AlertCircle, Loader2, ChevronLeft } from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import { marketplaceService } from '@/services/marketplace.service'
import { PaymentMethod } from '@/types/marketplace'

type CheckoutStep = 'cart' | 'confirm' | 'processing' | 'success' | 'error'

interface CartSidebarProps {
  isOpen: boolean
  onClose: () => void
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  credit_card: '💳 Credit Card',
  wire: '🏦 Wire Transfer',
  crypto: '₿ Crypto',
}

export default function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
  const { cart, removeFromCart, clearCart } = useCorporate()
  const [step, setStep] = useState<CheckoutStep>('cart')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)

  const subtotal = cart.reduce((sum, item) => sum + item.pricePerTon * 1000, 0)
  const serviceFee = subtotal * 0.05
  const total = subtotal + serviceFee

  const handleProceedToConfirm = () => {
    setStep('confirm')
  }

  const handleConfirmPurchase = async () => {
    setStep('processing')
    setErrorMessage(null)

    try {
      // 1. Sync each cart item to the server cart
      for (const item of cart) {
        const addResult = await marketplaceService.addToCartServer(item.id, 1000)
        if (!addResult.success) {
          throw new Error(addResult.error || `Failed to add ${item.projectName} to cart`)
        }
      }

      // 2. Initiate checkout
      const checkoutResult = await marketplaceService.checkout({ paymentMethod })
      if (!checkoutResult.success || !checkoutResult.data) {
        throw new Error(checkoutResult.error || 'Checkout failed')
      }

      // 3. Confirm the purchase
      const confirmResult = await marketplaceService.confirmPurchase({
        orderId: checkoutResult.data.id,
      })
      if (!confirmResult.success) {
        throw new Error(confirmResult.error || 'Purchase confirmation failed')
      }

      setSuccessOrderId(confirmResult.data?.id ?? checkoutResult.data.id)
      clearCart()
      setStep('success')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Purchase failed. Please try again.')
      setStep('error')
    }
  }

  const handleClose = () => {
    // Reset to cart view when closing (unless in processing)
    if (step !== 'processing') {
      setStep('cart')
      setErrorMessage(null)
      setSuccessOrderId(null)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={step !== 'processing' ? handleClose : undefined}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-gray-900 z-50 shadow-2xl transform transition-transform duration-300">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {step === 'confirm' && (
                  <button
                    onClick={() => setStep('cart')}
                    className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    aria-label="Back to cart"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                <ShoppingCart className="text-corporate-blue mr-3" size={24} />
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {step === 'cart' && 'Shopping Cart'}
                    {step === 'confirm' && 'Confirm Purchase'}
                    {step === 'processing' && 'Processing…'}
                    {step === 'success' && 'Order Confirmed'}
                    {step === 'error' && 'Purchase Failed'}
                  </h2>
                  {step === 'cart' && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {cart.length} item{cart.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={step === 'processing'}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50"
                aria-label="Close cart"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* ── Cart Step ── */}
            {step === 'cart' && (
              <>
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <ShoppingCart size={64} className="text-gray-300 dark:text-gray-700 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Your cart is empty
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Add carbon credits to start your purchase
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="corporate-card p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2">
                              {item.projectName}
                            </h4>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {item.country} • {item.methodology}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400"
                            aria-label={`Remove ${item.projectName}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Price</div>
                            <div className="font-medium">${item.pricePerTon}/ton</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Quantity</div>
                            <div className="font-medium">1,000 tCO₂</div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <div className="text-gray-600 dark:text-gray-400">Subtotal</div>
                            <div className="font-bold text-lg text-gray-900 dark:text-white">
                              ${(item.pricePerTon * 1000).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Confirm Step ── */}
            {step === 'confirm' && (
              <div className="space-y-6">
                <div className="corporate-card p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Order Summary</h3>
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <span className="text-gray-700 dark:text-gray-300 line-clamp-1 flex-1 mr-4">
                        {item.projectName}
                      </span>
                      <span className="font-medium shrink-0">
                        ${(item.pricePerTon * 1000).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Payment Method</h3>
                  <div className="space-y-2">
                    {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
                      <label key={method} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method}
                          checked={paymentMethod === method}
                          onChange={() => setPaymentMethod(method)}
                          className="text-corporate-blue"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {PAYMENT_LABELS[method]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Processing Step ── */}
            {step === 'processing' && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <Loader2 size={56} className="text-corporate-blue animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Processing your order…
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Please do not close this window.
                </p>
              </div>
            )}

            {/* ── Success Step ── */}
            {step === 'success' && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <CheckCircle size={56} className="text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Purchase Complete!
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Your carbon credits have been purchased successfully.
                </p>
                {successOrderId && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Order ID: {successOrderId}
                  </p>
                )}
              </div>
            )}

            {/* ── Error Step ── */}
            {step === 'error' && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <AlertCircle size={56} className="text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Purchase Failed
                </h3>
                <p className="text-red-600 dark:text-red-400 text-sm">{errorMessage}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-6">
            {(step === 'cart' || step === 'confirm') && cart.length > 0 && (
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium">${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Service Fee (5%)</span>
                  <span className="font-medium">
                    ${serviceFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span>Total</span>
                  <span>${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {step === 'cart' && cart.length > 0 && (
              <div className="space-y-3">
                <button
                  onClick={handleProceedToConfirm}
                  className="w-full corporate-btn-primary py-3 flex items-center justify-center"
                >
                  <CreditCard size={20} className="mr-2" />
                  Proceed to Checkout
                </button>
                <button onClick={clearCart} className="w-full corporate-btn-secondary py-3">
                  Clear Cart
                </button>
                <button
                  onClick={handleClose}
                  className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 py-2"
                >
                  Continue Shopping
                </button>
              </div>
            )}

            {step === 'confirm' && (
              <div className="space-y-3">
                <button
                  onClick={handleConfirmPurchase}
                  className="w-full corporate-btn-primary py-3 flex items-center justify-center"
                >
                  <CheckCircle size={20} className="mr-2" />
                  Confirm Purchase
                </button>
                <button onClick={() => setStep('cart')} className="w-full corporate-btn-secondary py-3">
                  Back to Cart
                </button>
              </div>
            )}

            {step === 'success' && (
              <button onClick={handleClose} className="w-full corporate-btn-primary py-3">
                Close
              </button>
            )}

            {step === 'error' && (
              <div className="space-y-3">
                <button
                  onClick={() => setStep('confirm')}
                  className="w-full corporate-btn-primary py-3"
                >
                  Try Again
                </button>
                <button onClick={() => setStep('cart')} className="w-full corporate-btn-secondary py-3">
                  Edit Cart
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
