import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Check, CreditCard, Sparkles, Ticket } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import LoadingSpinner from '../components/LoadingSpinner';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const buildPricing = (baseAmount, offer) => {
  if (!offer) {
    return {
      discountAmount: 0,
      finalAmount: roundMoney(baseAmount),
      isLifetimeFree: false,
    };
  }

  if (offer.is_lifetime_free || offer.discount_type === 'lifetime_free') {
    return {
      discountAmount: roundMoney(baseAmount),
      finalAmount: 0,
      isLifetimeFree: true,
    };
  }

  const rawValue = Number(offer.discount_value || 0);
  const discountAmount = offer.discount_type === 'percent'
    ? roundMoney((baseAmount * Math.min(Math.max(rawValue, 0), 100)) / 100)
    : roundMoney(Math.min(Math.max(rawValue, 0), baseAmount));

  return {
    discountAmount,
    finalAmount: roundMoney(Math.max(0, baseAmount - discountAmount)),
    isLifetimeFree: false,
  };
};

const getOfferLabel = (offer) => {
  if (!offer) return '';
  if (offer.is_lifetime_free || offer.discount_type === 'lifetime_free') return 'Lifetime Free';
  if (offer.discount_type === 'percent') return `${offer.discount_value}% off`;
  return `₹${offer.discount_value} off`;
};

const Payment = () => {
  const { profile, fetchProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [premiumCost, setPremiumCost] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offers, setOffers] = useState([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [successMessage, setSuccessMessage] = useState('Your premium access is now active.');
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const razorpayInstanceRef = useRef(null);
  const paymentAttemptRef = useRef({ paymentId: null, finalizing: false, finalized: false });

  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) || null;
  const pricing = buildPricing(premiumCost || 0, selectedOffer);

  useEffect(() => {
    const loadPremiumCost = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'premium_cost')
          .single();

        if (data) {
          const parsedCost = parseInt(data.value, 10);
          setPremiumCost(Number.isFinite(parsedCost) ? parsedCost : 199);
        } else {
          setPremiumCost(199);
        }
      } catch (error) {
        console.error('Error loading premium cost:', error);
        setPremiumCost(199);
      } finally {
        setPricingLoading(false);
      }
    };

    loadPremiumCost();
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    const loadOffers = async () => {
      setOffersLoading(true);
      try {
        const [{ data: assignments }, { data: globalOffers }, { data: redemptions }] = await Promise.all([
          supabase
            .from('offer_assignments')
            .select('offers(*)')
            .eq('user_id', profile.id),
          supabase
            .from('offers')
            .select('*')
            .eq('applies_to_all', true),
          supabase
            .from('offer_redemptions')
            .select('offer_id, status')
            .eq('user_id', profile.id),
        ]);

        const assignedOffers = (assignments || []).map((entry) => entry.offers).filter(Boolean);
        const redeemedOfferIds = new Set(
          (redemptions || [])
            .filter((entry) => entry.status === 'redeemed')
            .map((entry) => entry.offer_id)
        );

        const deduped = [...assignedOffers, ...(globalOffers || [])].filter((offer, index, source) => {
          if (!offer) return false;
          return source.findIndex((candidate) => candidate?.id === offer.id) === index;
        });

        const activeOffers = deduped.filter((offer) => {
          const expired = offer.status === 'expired' || (offer.valid_until && new Date(offer.valid_until) < new Date());
          return !expired && !redeemedOfferIds.has(offer.id);
        });

        setOffers(activeOffers);

        const preselectedOfferId = searchParams.get('offer');
        if (preselectedOfferId && activeOffers.some((offer) => offer.id === preselectedOfferId)) {
          setSelectedOfferId(preselectedOfferId);
        }
      } catch (error) {
        console.error('Error loading offers:', error);
      } finally {
        setOffersLoading(false);
      }
    };

    loadOffers();
  }, [profile?.id, searchParams]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const resetAttemptState = () => {
    paymentAttemptRef.current = { paymentId: null, finalizing: false, finalized: false };
  };

  const finalizePayment = async (payload, fallbackFailureMessage) => {
    if (!paymentAttemptRef.current.paymentId || paymentAttemptRef.current.finalizing || paymentAttemptRef.current.finalized) {
      return null;
    }

    paymentAttemptRef.current.finalizing = true;

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          payment_id: paymentAttemptRef.current.paymentId,
          ...payload,
        },
      });

      if (error) {
        throw new Error(error.message || fallbackFailureMessage || 'Failed to finalize payment.');
      }

      paymentAttemptRef.current.finalized = true;
      if (payload.status === 'success') {
        await fetchProfile(profile.id, { background: true });
      }
      return data;
    } catch (error) {
      console.error('Payment finalization failed:', error);
      if (payload.status === 'success') {
        setAlertModal({
          show: true,
          title: 'Payment Verification Failed',
          message: error.message || 'Payment was completed but verification failed. Please contact support.',
          type: 'error',
        });
      } else {
        setAlertModal({
          show: true,
          title: 'Payment Failed',
          message: fallbackFailureMessage || error.message || 'Your payment did not complete. Please try again.',
          type: 'error',
        });
      }
      return null;
    } finally {
      paymentAttemptRef.current.finalizing = false;
      setLoading(false);
      document.body.style.overflow = 'auto';
    }
  };

  const handleDirectActivationSuccess = async (data) => {
    await fetchProfile(profile.id, { background: true });
    setSuccessMessage(
      data?.is_lifetime_free
        ? 'Your lifetime premium access is active. No Razorpay payment was needed.'
        : 'Your coupon covered the full amount. Premium is active now.'
    );
    setSuccess(true);
    setLoading(false);
    setSelectedOfferId('');
    resetAttemptState();
  };

  const handleGatewaySuccess = async (response) => {
    const result = await finalizePayment(
      {
        status: 'success',
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      },
      'Payment verification failed.'
    );

    if (!result) return;

    setSuccessMessage('Payment successful. Premium access is active now.');
    setSuccess(true);
    setSelectedOfferId('');
    resetAttemptState();
  };

  const handleGatewayFailure = async (error, defaultMessage = 'Your payment did not complete. Please try again.') => {
    const failureMessage = error?.description || error?.reason || error?.step || defaultMessage;

    await finalizePayment(
      {
        status: 'failed',
        razorpay_payment_id: error?.metadata?.payment_id || null,
        failure_reason: failureMessage,
      },
      failureMessage
    );

    resetAttemptState();
  };

  const handlePayment = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
          offer_id: selectedOfferId || null,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create payment order.');
      }

      if (!data?.payment_id) {
        throw new Error('Payment record was not created.');
      }

      paymentAttemptRef.current = {
        paymentId: data.payment_id,
        finalizing: false,
        finalized: false,
      };

      if (data.mode === 'coupon' || Number(data.final_amount || 0) <= 0) {
        await handleDirectActivationSuccess(data);
        return;
      }

      const effectiveKeyId = data.key_id || RAZORPAY_KEY_ID;
      if (!effectiveKeyId) {
        throw new Error('Razorpay API key is missing.');
      }

      const options = {
        key: effectiveKeyId,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'SkillPro',
        description: 'Premium Access - 6 Months',
        image: '/skillpro-logo.png',
        order_id: data.order_id,
        handler: handleGatewaySuccess,
        prefill: {
          name: profile?.full_name || '',
          email: profile?.email || '',
          contact: profile?.phone || '',
        },
        notes: {
          user_id: profile?.id,
          local_payment_id: data.payment_id,
          coupon_code: data.coupon_code || '',
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          escape: true,
          handleback: true,
          confirm_close: false,
          ondismiss: () => {
            handleGatewayFailure(null, 'Payment window was closed before completion.');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpayInstanceRef.current = razorpay;
      razorpay.on('payment.failed', (response) => {
        razorpayInstanceRef.current = null;
        handleGatewayFailure(response?.error, 'Razorpay reported a failed payment.');
      });
      razorpay.open();
    } catch (error) {
      console.error('Payment initialization error:', error);
      setAlertModal({
        show: true,
        title: 'Payment Error',
        message: error.message || 'Failed to initialize payment. Please try again.',
        type: 'error',
      });
      setLoading(false);
      resetAttemptState();
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-3xl rounded-[2rem] border border-green-200 bg-[radial-gradient(circle_at_top,#dcfce7_0%,#ffffff_45%,#f8fafc_100%)] p-8 md:p-10 text-center shadow-2xl space-y-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-lg">
            <Check className="text-green-600" size={48} />
          </div>
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
              <Sparkles size={14} />
              Premium activated
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-green-800">Welcome to Premium!</h1>
            <p className="text-slate-600 text-lg">{successMessage}</p>
            <p className="text-slate-500">You can now access all premium courses and features.</p>
          </div>
        </div>
      </div>
    );
  }

  if (pricingLoading || premiumCost === null || offersLoading) {
    return <LoadingSpinner message="Loading payment details..." />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upgrade to Premium</h1>
        <p className="text-slate-500">Apply one coupon, review the final amount, and pay only that amount.</p>
      </div>

      <div className="bg-gradient-to-br from-gold-400 to-gold-600 p-8 rounded-2xl text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Premium Plan</h2>
            <p className="text-gold-100">6 Months Unlimited Access</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">₹{premiumCost}</div>
            <p className="text-gold-100 text-sm">base price</p>
          </div>
        </div>
        <div className="space-y-2">
          <FeatureItem text="Access to 50+ premium courses" />
          <FeatureItem text="Watch unlimited course videos" />
          <FeatureItem text="Download course notes and materials" />
          <FeatureItem text="Take certification exams" />
          <FeatureItem text="Earn verified certificates" />
          <FeatureItem text="Career mentorship sessions" />
          <FeatureItem text="Direct teacher support via chat" />
          <FeatureItem text="Daily live classes (9-10 AM, 5-6 PM)" />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border space-y-4">
        <div className="flex items-center gap-2">
          <Ticket className="text-pink-600" size={20} />
          <h3 className="text-lg font-bold text-slate-900">Coupon Selection</h3>
        </div>
        <p className="text-sm text-slate-500">Only one coupon can be used in a payment.</p>

        <label className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer">
          <input
            type="radio"
            name="coupon"
            checked={!selectedOfferId}
            onChange={() => setSelectedOfferId('')}
          />
          <div>
            <p className="font-semibold text-slate-900">No coupon</p>
            <p className="text-sm text-slate-500">Pay the full premium amount.</p>
          </div>
        </label>

        {offers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
            No active coupons are available for your account.
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <label key={offer.id} className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:border-pink-300">
                <input
                  type="radio"
                  name="coupon"
                  checked={selectedOfferId === offer.id}
                  onChange={() => setSelectedOfferId(offer.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{offer.coupon_name || offer.title}</p>
                    <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-700">
                      {getOfferLabel(offer)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{offer.description || 'Coupon discount applied at checkout.'}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Code: {offer.title} {offer.valid_until ? `• Valid till ${new Date(offer.valid_until).toLocaleDateString('en-IN')}` : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <h3 className="text-lg font-bold mb-4">Payable Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span>Base premium amount</span>
            <span>₹{roundMoney(premiumCost)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Coupon discount</span>
            <span>- ₹{pricing.discountAmount}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-lg font-bold text-slate-900">
            <span>Final payable amount</span>
            <span>₹{pricing.finalAmount}</span>
          </div>
          {pricing.isLifetimeFree && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              This coupon gives lifetime premium. Razorpay will be skipped and access will activate immediately.
            </div>
          )}
          {!pricing.isLifetimeFree && pricing.finalAmount <= 0 && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              Your coupon covers the full amount. No online payment is required.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <CreditCard className="text-blue-600" size={20} />
          Payment Processing
        </h3>

        {!RAZORPAY_KEY_ID && pricing.finalAmount > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-yellow-800">
              Razorpay client key is missing. Add <code className="bg-yellow-100 px-1 rounded">VITE_RAZORPAY_KEY_ID</code> to enable paid checkouts.
            </p>
          </div>
        )}

        <div className="mb-4 space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Check className="text-green-600" size={16} />
            <span>Only the final discounted amount is sent to Razorpay</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="text-green-600" size={16} />
            <span>Successful and failed payment attempts are both stored</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="text-green-600" size={16} />
            <span>Redeemed coupons cannot be used again</span>
          </div>
        </div>

        <button
          onClick={handlePayment}
          disabled={loading || (pricing.finalAmount > 0 && !RAZORPAY_KEY_ID)}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-all"
        >
          {loading
            ? 'Processing...'
            : pricing.finalAmount > 0
              ? `Pay ₹${pricing.finalAmount} with Razorpay`
              : 'Activate Premium Now'}
        </button>
      </div>

      <AlertModal
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => {
          setAlertModal({ show: false, title: '', message: '', type: 'info' });
          setLoading(false);
        }}
      />
    </div>
  );
};

const FeatureItem = ({ text }) => (
  <div className="flex items-center gap-2">
    <Check className="text-gold-100" size={18} />
    <span className="text-white">{text}</span>
  </div>
);

export default Payment;
