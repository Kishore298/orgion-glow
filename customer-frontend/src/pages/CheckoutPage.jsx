import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MapPin, Plus, ShieldCheck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../lib/api';
import { formatINR, handleImageError, isFallbackLogo, resolveImageUrl } from '../lib/format';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import PincodeAddressForm from '../components/common/PincodeAddressForm';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const { items, subtotal, totalWeight, loadCart, clearCart } = useCartStore();

  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addingNewAddress, setAddingNewAddress] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [inlineAddress, setInlineAddress] = useState(null);
  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [shippingQuote, setShippingQuote] = useState({
    serviceable: true,
    charge: 0,
    message: '',
  });
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    loadCart(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const addrs = user?.addresses || [];
    if (addrs.length > 0 && !selectedAddressId && !addingNewAddress && !inlineAddress) {
      const def = addrs.find((a) => a.isDefault) || addrs[0];
      setSelectedAddressId(def._id);
    } else if (addrs.length === 0 && !inlineAddress && selectedAddressId !== 'inline') {
      setAddingNewAddress(true);
    }
    if (user?.email) setEmailInput(user.email);
  }, [user?.addresses, user?.email, selectedAddressId, addingNewAddress, inlineAddress]);

  const activeAddress = addingNewAddress
    ? inlineAddress
    : selectedAddressId === 'inline'
    ? inlineAddress
    : (user?.addresses || []).find((a) => a._id === selectedAddressId);

  const fetchShippingQuote = async ({ pincode, state }) => {
    try {
      const res = await api.post('/v1/shipping/calculate', {
        pincode,
        state,
        subtotal,
        weight: totalWeight,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
      });
      if (res.data?.data) {
        setShippingQuote(res.data.data);
      }
    } catch {
      // ignore transient error
    }
  };

  useEffect(() => {
    if (activeAddress?.pincode) {
      fetchShippingQuote({ pincode: activeAddress.pincode, state: activeAddress.state });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress?.pincode, activeAddress?.state, subtotal]);

  const handleSaveInlineAddress = async (values) => {
    if (saveToProfile) {
      try {
        const res = await api.post('/v1/addresses', values);
        const created = res.data?.data?.address;
        const updatedAddresses = res.data?.data?.addresses;
        if (updatedAddresses) {
          useAuthStore.setState((s) => ({
            user: s.user ? { ...s.user, addresses: updatedAddresses } : s.user,
          }));
        } else {
          await hydrate();
        }
        setInlineAddress(null);
        setSelectedAddressId(created?._id || '');
        setAddingNewAddress(false);
        toast.success('Address saved to your profile');
      } catch (err) {
        toast.error(getErrorMessage(err));
        return;
      }
    } else {
      setInlineAddress(values);
      setSelectedAddressId('inline');
      setAddingNewAddress(false);
    }
    fetchShippingQuote({ pincode: values.pincode, state: values.state });
  };

  const handlePayNow = async () => {
    if (paying) return;
    if (items.length === 0) {
      toast.error('Your bag is empty');
      return;
    }
    if (items.some((i) => i.inStock === false)) {
      toast.error('Please remove out-of-stock items from your bag first.');
      return;
    }
    if (!user?.email && (!emailInput || !emailInput.includes('@'))) {
      toast.error('Please enter a valid email address for your order confirmation.');
      return;
    }
    if (!activeAddress) {
      toast.error('Please select or enter a delivery address.');
      return;
    }
    if (!shippingQuote.serviceable) {
      toast.error(shippingQuote.message || 'Delivery unavailable to this pincode.');
      return;
    }

    if (typeof window.Razorpay !== 'function') {
      toast.error('Razorpay checkout failed to load. Please refresh and try again.');
      return;
    }

    setPaying(true);
    try {
      const payload = {
        cartItems: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        ...(selectedAddressId && selectedAddressId !== 'inline'
          ? { addressId: selectedAddressId }
          : { address: inlineAddress, saveAddress: saveToProfile }),
        ...(!user?.email ? { email: emailInput.trim() } : {}),
      };

      const res = await api.post('/v1/orders/checkout', payload);
      const { order, razorpay, prefill } = res.data.data;

      if (saveToProfile && selectedAddressId === 'inline') {
        hydrate();
      }

      const rzp = new window.Razorpay({
        key: razorpay.keyId,
        amount: razorpay.amountPaise,
        currency: razorpay.currency,
        name: 'ORGION',
        description: `Order ${order.orderNumber}`,
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
            clearCart();
            navigate(`/order-success/${order.orderNumber}`, { replace: true });
          } catch {
            // Network drop or verify delay -> poll on success page while webhook confirms
            navigate(`/order-success/${order.orderNumber}?verifying=1`, { replace: true });
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            navigate(`/order-failed?order=${order.orderNumber}&reason=cancelled`);
          },
        },
      });

      rzp.on('payment.failed', () => {
        setPaying(false);
        navigate(`/order-failed?order=${order.orderNumber}&reason=failed`);
      });

      rzp.open();
    } catch (err) {
      setPaying(false);
      toast.error(getErrorMessage(err));
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-primary-dark">Your bag is empty</h1>
        <Link to="/shop" className="btn-primary mt-6">
          Return to Shop
        </Link>
      </div>
    );
  }

  const grandTotal = Number(subtotal || 0) + Number(shippingQuote.charge || 0);

  return (
    <>
      <Helmet>
        <title>Checkout — ORGION</title>
      </Helmet>

      <div className="mx-auto max-w-6xl px-6 pt-5 pb-14">
        <span className="label-micro">Secure Checkout</span>
        <h1 className="mt-1 font-serif text-4xl font-semibold text-primary-dark">Complete Your Order</h1>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Email (if missing) + Step 1 Address */}
          <div className="lg:col-span-7 space-y-6">
            {!user?.email && (
              <div className="luxury-card p-6 border-amber-300 bg-amber-50/50">
                <h2 className="font-serif text-xl font-semibold text-text">
                  Add Your Email Address
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  Required to send your order confirmation, GST invoice, and ST Courier tracking updates.
                </p>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field mt-3"
                />
              </div>
            )}

            <div className="luxury-card p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <MapPin size={19} className="text-primary" />
                  <h2 className="font-serif text-2xl font-semibold text-text">1. Delivery Address</h2>
                </div>
                {!addingNewAddress && (
                  <button
                    type="button"
                    onClick={() => setAddingNewAddress(true)}
                    className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Plus size={14} /> Add New
                  </button>
                )}
              </div>

              {!addingNewAddress ? (
                <div className="space-y-3">
                  {(user?.addresses || []).map((addr) => (
                    <label
                      key={addr._id}
                      className={`flex items-start gap-3.5 rounded-2xl border p-4 cursor-pointer transition ${
                        selectedAddressId === addr._id
                          ? 'border-primary bg-primary-soft/30'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedAddress"
                        checked={selectedAddressId === addr._id}
                        onChange={() => setSelectedAddressId(addr._id)}
                        className="mt-1 text-primary focus:ring-primary"
                      />
                      <div className="text-sm">
                        <p className="font-semibold text-text">
                          {addr.fullName}{' '}
                          <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase text-text-muted">
                            {addr.type}
                          </span>
                        </p>
                        <p className="mt-1 text-text-muted">
                          {addr.line1}
                          {addr.line2 ? `, ${addr.line2}` : ''}
                          {addr.landmark ? `, Near ${addr.landmark}` : ''}
                        </p>
                        <p className="text-text-muted">
                          {addr.city}, {addr.state} - {addr.pincode} · {addr.mobile}
                        </p>
                      </div>
                    </label>
                  ))}

                  {inlineAddress && (
                    <label
                      className={`flex items-start gap-3.5 rounded-2xl border p-4 cursor-pointer transition ${
                        selectedAddressId === 'inline'
                          ? 'border-primary bg-primary-soft/30'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedAddress"
                        checked={selectedAddressId === 'inline'}
                        onChange={() => setSelectedAddressId('inline')}
                        className="mt-1 text-primary focus:ring-primary"
                      />
                      <div className="text-sm">
                        <p className="font-semibold text-text">
                          {inlineAddress.fullName}{' '}
                          <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase text-text-muted">
                            {inlineAddress.type || 'Home'}
                          </span>
                        </p>
                        <p className="mt-1 text-text-muted">
                          {inlineAddress.line1}
                          {inlineAddress.line2 ? `, ${inlineAddress.line2}` : ''}
                          {inlineAddress.landmark ? `, Near ${inlineAddress.landmark}` : ''}
                        </p>
                        <p className="text-text-muted">
                          {inlineAddress.city}, {inlineAddress.state} - {inlineAddress.pincode} ·{' '}
                          {inlineAddress.mobile}
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              ) : (
                <PincodeAddressForm
                  submitLabel="Use This Address"
                  showDefaultCheckbox={false}
                  onCancel={
                    (user?.addresses || []).length > 0 || inlineAddress
                      ? () => setAddingNewAddress(false)
                      : undefined
                  }
                  onPincodeCityStateChange={fetchShippingQuote}
                  onSubmit={handleSaveInlineAddress}
                  extraControls={
                    <label className="inline-flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveToProfile}
                        onChange={(e) => setSaveToProfile(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span>Save this address to my profile</span>
                    </label>
                  }
                />
              )}
            </div>
          </div>

          {/* Right: Step 2 Summary & Step 3 Pay */}
          <div className="lg:col-span-5">
            <div className="luxury-card bg-surface-muted p-6 sm:p-8 space-y-5 sticky top-24">
              <h2 className="font-serif text-2xl font-semibold text-text">2. Order Summary</h2>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 text-sm">
                    <img
                      src={resolveImageUrl(item.image, 150)}
                      alt={item.name}
                      onError={handleImageError}
                      className={`h-12 w-12 rounded-xl border border-border bg-surface ${
                        isFallbackLogo(item.image) ? 'object-contain p-1.5' : 'object-cover'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-text">{item.name}</p>
                      <p className="text-xs text-text-muted">Qty {item.qty}</p>
                    </div>
                    <span className="font-medium text-text">
                      {formatINR(item.price * item.qty)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Subtotal</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Shipping</span>
                  <span>
                    {shippingQuote.charge === 0 ? 'Free' : formatINR(shippingQuote.charge)}
                  </span>
                </div>
                {!shippingQuote.serviceable && (
                  <p className="flex items-center gap-1.5 text-xs text-status-danger">
                    <AlertCircle size={14} />
                    {shippingQuote.message || 'Not serviceable for this pincode'}
                  </p>
                )}
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-serif text-2xl text-primary">{formatINR(grandTotal)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={paying || !activeAddress || !shippingQuote.serviceable}
                onClick={handlePayNow}
                className="btn-primary w-full h-12 text-base"
              >
                {paying ? 'Opening Razorpay...' : `Pay ${formatINR(grandTotal)}`}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
                <ShieldCheck size={14} className="text-primary" />
                Secured by Razorpay · UPI, Cards, Netbanking
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
