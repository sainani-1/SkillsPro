import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Gift } from 'lucide-react';

const Offers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popupCoupon, setPopupCoupon] = useState(null);

  useEffect(() => {
    const fetchOffers = async () => {
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      // Fetch assigned offers
      const { data: assignments } = await supabase
        .from('offer_assignments')
        .select('*, offers(*)')
        .eq('user_id', user.id);
      const assignedOffers = (assignments || []).map(a => a.offers);

      // Fetch global offers
      const { data: globalOffers } = await supabase
        .from('offers')
        .select('*')
        .eq('applies_to_all', true);

      // Merge and deduplicate offers
      const allOffers = [...assignedOffers, ...(globalOffers || [])];
      const uniqueOffers = allOffers.filter((offer, idx, arr) => offer && arr.findIndex(o => o.id === offer.id) === idx);
      setOffers(uniqueOffers);
      setLoading(false);
    };
    fetchOffers();
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Gift className="text-pink-500" size={28} /> Discounts & Offers
      </h1>
      {loading ? (
        <div>Loading...</div>
      ) : offers.length === 0 ? (
        <div className="text-slate-500">No active offers or coupons available.</div>
      ) : (
        <div className="space-y-4">
          {offers.map(offer => (
            <div key={offer.id} className="bg-pink-50 border border-pink-200 rounded-lg p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="text-pink-500" size={24} />
                <span className="font-semibold text-pink-700 text-lg">{offer.coupon_name || offer.title}</span>
              </div>
              <div className="text-slate-700 text-sm mb-1">
                Discount: {offer.is_lifetime_free ? 'Lifetime Free' : (offer.discount_type === 'percent' ? `${offer.discount_value ?? 'N/A'}%` : (offer.discount_type === 'flat' ? `₹${offer.discount_value ?? 'N/A'}` : 'No discount'))}
              </div>
              <div className="text-xs text-slate-500 mb-1">
                Valid Until: {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString() : '—'}
              </div>
              <div className={`text-xs font-semibold mb-2 ${offer.status === 'expired' || (offer.valid_until && new Date(offer.valid_until) < new Date()) ? 'text-red-600' : 'text-green-600'}`}>Status: {offer.status === 'expired' || (offer.valid_until && new Date(offer.valid_until) < new Date()) ? 'Expired' : 'Active'}</div>
              <div className="flex gap-2 mt-2">
                <button className="bg-green-500 text-white px-4 py-2 rounded font-semibold" onClick={() => window.location.href='/app/payment'}>
                  Claim Offer
                </button>
                <button className="bg-pink-600 text-white px-4 py-2 rounded font-semibold" onClick={() => setPopupCoupon(offer.coupon_code || offer.title)}>
                  Show Coupon Code
                </button>
              </div>
                  {popupCoupon && (
                    <div className="fixed inset-0 flex items-center justify-center z-50">
                      <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-300 flex flex-col items-center">
                        <h2 className="text-lg font-bold mb-2 text-pink-700">Coupon Code</h2>
                        <div className="text-2xl font-mono mb-4">{popupCoupon}</div>
                        <button className="bg-pink-600 text-white px-4 py-2 rounded font-semibold" onClick={() => setPopupCoupon(null)}>
                          Close
                        </button>
                      </div>
                      <div className="fixed inset-0 bg-black opacity-30 z-40" onClick={() => setPopupCoupon(null)}></div>
                    </div>
                  )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Offers;
