import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Check, CreditCard, Sparkles } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import LoadingSpinner from '../components/LoadingSpinner';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
const PAYMENT_STATUS_KEY = 'skillpro_payment_status';

const Payment = () => {
  const { profile, fetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [premiumCost, setPremiumCost] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const razorpayInstanceRef = useRef(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PAYMENT_STATUS_KEY);
      if (!raw) return;

      const stored = JSON.parse(raw);
      sessionStorage.removeItem(PAYMENT_STATUS_KEY);

      if (stored?.status === 'success') {
        setSuccess(true);
      }

      if (stored?.status === 'failed') {
        setAlertModal({
          show: true,
          title: 'Payment Failed',
          message: stored.message || 'Your payment did not complete. Please try again.',
          type: 'error',
        });
      }
    } catch {
      sessionStorage.removeItem(PAYMENT_STATUS_KEY);
    }
  }, []);

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
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && loading) {
        const razorpayModal = document.querySelector('.razorpay-container');
        if (!razorpayModal) {
          setTimeout(() => setLoading(false), 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loading]);

  const handlePayment = async () => {
    if (!RAZORPAY_KEY_ID) {
      setAlertModal({
        show: true,
        title: 'Payment Gateway Not Configured',
        message: 'Razorpay API key is missing. Add VITE_RAZORPAY_KEY_ID to enable payments.',
        type: 'warning',
      });
      return;
    }

    setLoading(true);

    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 30000);

    try {
      const orderData = {
        amount: premiumCost * 100,
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
      };

      const orderId = `order_${Date.now()}`;

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'SkillPro',
        description: 'Premium Access - 6 Months',
        image: '/skillpro-logo.png',
        order_id: orderId,
        handler: async (response) => {
          clearTimeout(safetyTimeout);
          await handlePaymentSuccess(response);
        },
        prefill: {
          name: profile.full_name,
          email: profile.email,
          contact: profile.phone || '',
        },
        notes: {
          user_id: profile.id,
          plan: 'premium_6months',
        },
        theme: {
          color: '#FFD700',
        },
        modal: {
          escape: true,
          handleback: true,
          confirm_close: false,
          ondismiss: () => {
            clearTimeout(safetyTimeout);
            setLoading(false);
            document.body.style.overflow = 'auto';
          },
        },
      };

      try {
        const razorpay = new window.Razorpay(options);
        razorpayInstanceRef.current = razorpay;

        razorpay.on('payment.failed', (response) => {
          clearTimeout(safetyTimeout);
          razorpayInstanceRef.current = null;
          document.body.style.overflow = 'auto';
          handlePaymentFailure(response.error);
        });

        razorpay.open();

        const checkInterval = setInterval(() => {
          const razorpayModal = document.querySelector('.razorpay-container');
          if (!razorpayModal && loading) {
            clearInterval(checkInterval);
            clearTimeout(safetyTimeout);
            setLoading(false);
            document.body.style.overflow = 'auto';
          }
        }, 500);

        setTimeout(() => clearInterval(checkInterval), 10000);
      } catch (razorpayError) {
        console.error('Razorpay initialization error:', razorpayError);
        clearTimeout(safetyTimeout);
        document.body.style.overflow = 'auto';
        setAlertModal({
          show: true,
          title: 'Payment Gateway Error',
          message: 'Invalid API key or payment gateway configuration. Please contact administrator.',
          type: 'error',
        });
        setLoading(false);
      }
    } catch (error) {
      console.error('Payment error:', error);
      clearTimeout(safetyTimeout);
      document.body.style.overflow = 'auto';
      setAlertModal({
        show: true,
        title: 'Payment Error',
        message: 'Failed to initialize payment. Please try again.',
        type: 'error',
      });
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (response) => {
    try {
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 6);

      await supabase
        .from('profiles')
        .update({ premium_until: validUntil.toISOString() })
        .eq('id', profile.id);

      await supabase.from('payments').insert({
        user_id: profile.id,
        amount: premiumCost,
        currency: 'INR',
        status: 'success',
        gateway_ref: response.razorpay_payment_id,
        valid_until: validUntil.toISOString(),
        created_at: new Date().toISOString(),
      });

      await fetchProfile(profile.id, { background: true });
      sessionStorage.setItem(PAYMENT_STATUS_KEY, JSON.stringify({ status: 'success' }));
      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        window.location.href = '/app/courses';
      }, 3000);
    } catch (error) {
      console.error('Error updating premium:', error);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Payment was successful, but premium activation failed. Please contact support.',
        type: 'error',
      });
      setLoading(false);
    }
  };

  const handlePaymentFailure = (error) => {
    console.error('Payment failed:', error);
    const failureMessage =
      error?.description ||
      error?.reason ||
      error?.step ||
      'Your payment did not complete. Please try again.';

    sessionStorage.setItem(
      PAYMENT_STATUS_KEY,
      JSON.stringify({
        status: 'failed',
        message: failureMessage,
      })
    );

    setAlertModal({
      show: true,
      title: 'Payment Failed',
      message: failureMessage,
      type: 'error',
    });
    setLoading(false);
    document.body.style.overflow = 'auto';
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
            <h2 className="text-2xl font-bold text-green-700">Payment Successful</h2>
            <p className="text-slate-600 text-lg">Thank you for upgrading to SkillPro Premium.</p>
            <p className="text-slate-500">Your premium access is now active for 6 months.</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-left">
            <h3 className="font-bold text-green-900 mb-2">You now have access to:</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>✓ All 50+ premium courses</li>
              <li>✓ Download notes and materials</li>
              <li>✓ Certification exams</li>
              <li>✓ Live classes daily (9-10 AM, 5-6 PM)</li>
              <li>✓ Direct teacher support</li>
              <li>✓ Career mentorship sessions</li>
            </ul>
          </div>
          <p className="text-sm text-slate-500">Redirecting to courses in 3 seconds...</p>
        </div>
      </div>
    );
  }

  if (pricingLoading || premiumCost === null) {
    return <LoadingSpinner message="Loading pricing..." />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upgrade to Premium</h1>
        <p className="text-slate-500">Get unlimited access to all courses for 6 months</p>
      </div>

      <div className="bg-gradient-to-br from-gold-400 to-gold-600 p-8 rounded-2xl text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Premium Plan</h2>
            <p className="text-gold-100">6 Months Unlimited Access</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">₹{premiumCost}</div>
            <p className="text-gold-100 text-sm">one-time payment</p>
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

      <div className="bg-white rounded-xl p-6 border">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <CreditCard className="text-blue-600" size={20} />
          Secure Payment with Razorpay
        </h3>

        {!RAZORPAY_KEY_ID && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-yellow-800">
              Payment gateway is not configured. Add <code className="bg-yellow-100 px-1 rounded">VITE_RAZORPAY_KEY_ID</code> to your `.env` file to enable payments.
            </p>
          </div>
        )}

        <div className="mb-4 space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Check className="text-green-600" size={16} />
            <span>100% Secure Payment</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="text-green-600" size={16} />
            <span>Accepts UPI, Cards, Net Banking & Wallets</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="text-green-600" size={16} />
            <span>Instant Premium Activation</span>
          </div>
        </div>

        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-all"
        >
          {loading ? 'Opening Payment Gateway...' : `Pay ₹${premiumCost} with Razorpay`}
        </button>

        <p className="text-xs text-slate-500 text-center mt-3">
          Powered by Razorpay - India&apos;s most trusted payment gateway
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-bold text-blue-900 mb-2">What happens after payment?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Instant premium activation</li>
          <li>✓ Access to all courses and materials</li>
          <li>✓ Teacher assignment within 24 hours</li>
          <li>✓ Invitation to daily live classes</li>
          <li>✓ Email reminders before premium expiry</li>
        </ul>
      </div>

      <AlertModal
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => {
          if (alertModal.title === 'Payment Failed') {
            sessionStorage.removeItem(PAYMENT_STATUS_KEY);
          }
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
