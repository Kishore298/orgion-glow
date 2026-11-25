import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';

export default function OrderFailedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderRef = searchParams.get('order') || searchParams.get('orderId');
  const reason = searchParams.get('reason');
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!orderRef || retrying) return;
    if (typeof window.Razorpay !== 'function') {
      toast.error('Payment script unavailable. Please refresh.');
      return;
    }
    setRetrying(true);
    try {
      const res = await api.post(`/v1/orders/${orderRef}/retry-payment`);
      const { order, razorpay, prefill } = res.data.data;

      const rzp = new window.Razorpay({
        key: razorpay.keyId,
        amount: razorpay.amountPaise,
        currency: razorpay.currency,
        name: 'ORGION',
        description: `Retry Order ${order.orderNumber}`,
        order_id: razorpay.razorpayOrderId,
        prefill,
        theme: { color: '#3D6B40' },
        handler: async (response) => {
          try {
            await api.post('/v1/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate(`/order-success/${order.orderNumber}`, { replace: true });
          } catch {
            navigate(`/order-success/${order.orderNumber}?verifying=1`, { replace: true });
          }
        },
        modal: {
          ondismiss: () => setRetrying(false),
        },
      });
      rzp.on('payment.failed', () => {
        setRetrying(false);
        toast.error('Payment failed. Please try again.');
      });
      rzp.open();
    } catch (err) {
      setRetrying(false);
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <Helmet>
        <title>Payment Incomplete — ORGION</title>
      </Helmet>
      <div className="mx-auto max-w-xl px-6 pt-8 pb-16">
        <div className="luxury-card p-8 sm:p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-status-warning border border-amber-200">
            <AlertTriangle size={28} />
          </div>
          <h1 className="mt-5 font-serif text-3xl font-semibold text-text">
            {reason === 'cancelled' ? 'Payment Cancelled' : 'Payment Could Not Be Completed'}
          </h1>
          <p className="mt-3 text-sm text-text-muted leading-relaxed">
            Your order is safely saved as pending payment. No extra charge was made—you can retry payment right away.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
            {orderRef && (
              <button
                type="button"
                disabled={retrying}
                onClick={handleRetry}
                className="btn-primary"
              >
                <RefreshCw size={16} />
                {retrying ? 'Opening Razorpay...' : 'Retry Payment'}
              </button>
            )}
            <Link to="/cart" className="btn-ghost">
              Return to Bag
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
