import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { CreditCard, Check, X, AlertCircle } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import LoadingSpinner from '../components/LoadingSpinner';

// Razorpay configuration - Add your keys here later
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || ''; // Add to .env file
const RAZORPAY_KEY_SECRET = import.meta.env.VITE_RAZORPAY_KEY_SECRET || '';

const Payment = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [premiumCost, setPremiumCost] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const razorpayInstanceRef = React.useRef(null);

  // Load premium cost from settings
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

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Add visibility change listener to reset loading if user closes Razorpay
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && loading) {
        // Check if Razorpay modal exists
        const razorpayModal = document.querySelector('.razorpay-container');
        if (!razorpayModal) {
          console.log('Razorpay modal not found, resetting loading state');
          setTimeout(() => setLoading(false), 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loading]);

  const handlePayment = async () => {
    // Check if Razorpay keys are configured
    if (!RAZORPAY_KEY_ID) {
      setAlertModal({
        show: true,
        title: 'Payment Gateway Not Configured',
        message: 'Razorpay API keys are not configured. Please contact administrator or add VITE_RAZORPAY_KEY_ID to environment variables.',
        type: 'warning'
      });
      return;
    }

    setLoading(true);

    // Add a safety timeout to reset loading state if Razorpay fails silently
    const safetyTimeout = setTimeout(() => {
      console.log('Safety timeout - resetting loading state');
      setLoading(false);
    }, 30000); // Reset after 30 seconds if nothing happens

    try {
      // Create order on your backend (you'll need to create this endpoint)
      const orderData = {
        amount: premiumCost * 100, // Amount in paise (₹ to paise conversion)
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
      };

      // For now, create a local order ID (in production, call your backend)
      const orderId = `order_${Date.now()}`;

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'SkillPro',
        description: 'Premium Access - 6 Months',
        image: '/skillpro-logo.png', // Add your logo
        order_id: orderId,
        handler: async function (response) {
          // Payment successful
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
          ondismiss: function () {
            console.log('Razorpay modal dismissed');
            clearTimeout(safetyTimeout);
            // Force reset loading and enable scrolling
            setLoading(false);
            document.body.style.overflow = 'auto';
          }
        },
      };

      try {
        const razorpay = new window.Razorpay(options);
        razorpayInstanceRef.current = razorpay;
        
        // Handle payment failure
        razorpay.on('payment.failed', function (response) {
          console.log('Payment failed event triggered');
          clearTimeout(safetyTimeout);
          razorpayInstanceRef.current = null;
          document.body.style.overflow = 'auto';
          handlePaymentFailure(response.error);
        });
        
        // Open Razorpay modal
        razorpay.open();
        
        // Aggressive check: Reset if modal fails to open or closes unexpectedly
        const checkInterval = setInterval(() => {
          const razorpayModal = document.querySelector('.razorpay-container');
          if (!razorpayModal && loading) {
            console.log('Razorpay modal not found, force resetting');
            clearInterval(checkInterval);
            clearTimeout(safetyTimeout);
            setLoading(false);
            document.body.style.overflow = 'auto';
          }
        }, 500);
        
        // Clear interval after 10 seconds
        setTimeout(() => clearInterval(checkInterval), 10000);
      } catch (razorpayError) {
        console.error('Razorpay initialization error:', razorpayError);
        clearTimeout(safetyTimeout);
        document.body.style.overflow = 'auto';
        setAlertModal({
          show: true,
          title: 'Payment Gateway Error',
          message: 'Invalid API key or payment gateway configuration. Please contact administrator.',
          type: 'error'
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
        type: 'error'
      });
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (response) => {
    try {
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 6);

      // Update profile with premium
      await supabase.from('profiles').update({
        premium_until: validUntil.toISOString()
      }).eq('id', profile.id);

      // Create payment record
      await supabase.from('payments').insert({
        user_id: profile.id,
        amount: premiumCost,
        currency: 'INR',
        status: 'success',
        gateway_ref: response.razorpay_payment_id,
        valid_until: validUntil.toISOString(),
        created_at: new Date().toISOString()
      });

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
        message: 'Payment successful but failed to activate premium. Please contact support.',
        type: 'error'
      });
      setLoading(false);
    }
  };

  const handlePaymentFailure = (error) => {
    console.error('Payment failed:', error);
    setPaymentFailed(true);
    setLoading(false);
    document.body.style.overflow = 'auto';
  };

  if (paymentFailed) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <X className="text-red-600" size={48} />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-red-800 mb-2">Payment Failed ✗</h1>
            <p className="text-slate-600 text-lg mb-2">Unfortunately, your payment could not be processed.</p>
            <p className="text-slate-500">Please check your API key configuration or try again.</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Common reasons:</strong><br/>
              • Invalid Razorpay API key<br/>
              • Network connection issue<br/>
              • Payment was cancelled<br/>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setPaymentFailed(false);
                document.body.style.overflow = 'auto';
              }}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/app/courses'}
              className="flex-1 bg-slate-300 text-slate-900 py-3 rounded-lg hover:bg-slate-400 font-semibold"
            >
              Go to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="text-green-600" size={48} />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-green-800 mb-2">Welcome to Premium! 🎉</h1>
            <h2 className="text-2xl font-bold text-green-700 mb-4">Payment Successful!</h2>
            <p className="text-slate-600 text-lg mb-2">Thank you for upgrading to SkillPro Premium</p>
            <p className="text-slate-500">Your premium access is now active for 6 months.</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
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
              Payment gateway is not configured. Add <code className="bg-yellow-100 px-1 rounded">VITE_RAZORPAY_KEY_ID</code> to your .env file to enable payments.
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
          Powered by Razorpay - India's most trusted payment gateway
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
