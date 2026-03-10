import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Gift, MousePointerClick, Search, Ticket, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminGrowthAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    referralsRewarded: 0,
    leadsCaptured: 0,
    premiumPassClaims: 0,
    premiumIntentEvents: 0,
  });
  const [referrals, setReferrals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [passClaims, setPassClaims] = useState([]);
  const [premiumEvents, setPremiumEvents] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [
          { data: referralRows },
          { data: leadRows },
          { data: passRows },
          { data: eventRows },
        ] = await Promise.all([
          supabase
            .from('referrals')
            .select(`
              id,
              referral_code,
              status,
              reward_days,
              rewarded_at,
              created_at,
              referred_email,
              qualified_payment_id,
              referrer:profiles!referrals_referrer_user_id_fkey(full_name, email),
              referred:profiles!referrals_referred_user_id_fkey(full_name, email)
            `)
            .order('created_at', { ascending: false }),
          supabase
            .from('marketing_leads')
            .select('id, name, email, phone, interest_type, source, notes, status, admin_response, responded_at, created_at')
            .order('created_at', { ascending: false }),
          supabase
            .from('premium_pass_claims')
            .select('id, email, pass_days, status, claimed_at, premium_until_after')
            .order('claimed_at', { ascending: false }),
          supabase
            .from('premium_event_logs')
            .select('id, event_name, source, metadata, created_at')
            .order('created_at', { ascending: false })
            .limit(200),
        ]);

        setReferrals(referralRows || []);
        setLeads(leadRows || []);
        setPassClaims(passRows || []);
        setPremiumEvents(eventRows || []);
        setStats({
          referralsRewarded: (referralRows || []).filter((row) => row.status === 'rewarded').length,
          leadsCaptured: leadRows?.length || 0,
          premiumPassClaims: passRows?.length || 0,
          premiumIntentEvents: eventRows?.filter((row) => row.event_name === 'upgrade_click' || row.event_name === 'payment_attempt_started').length || 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredLeads = useMemo(
    () =>
      !normalizedSearch
        ? leads
        : leads.filter((lead) =>
            [lead.name, lead.email, lead.phone, lead.interest_type, lead.source, lead.notes]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(normalizedSearch))
          ),
    [leads, normalizedSearch]
  );

  const filteredReferrals = useMemo(
    () =>
      !normalizedSearch
        ? referrals
        : referrals.filter((row) =>
            [
              row.referral_code,
              row.status,
              row.referred_email,
              row.referrer?.full_name,
              row.referrer?.email,
              row.referred?.full_name,
              row.referred?.email,
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(normalizedSearch))
          ),
    [referrals, normalizedSearch]
  );

  const filteredPassClaims = useMemo(
    () =>
      !normalizedSearch
        ? passClaims
        : passClaims.filter((row) =>
            [row.email, row.status, row.pass_days]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(normalizedSearch))
          ),
    [passClaims, normalizedSearch]
  );

  const filteredEvents = useMemo(
    () =>
      !normalizedSearch
        ? premiumEvents
        : premiumEvents.filter((row) =>
            [row.event_name, row.source, JSON.stringify(row.metadata || {})]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(normalizedSearch))
          ),
    [premiumEvents, normalizedSearch]
  );

  if (loading) {
    return <LoadingSpinner message="Loading growth analytics..." />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-nani-dark to-emerald-900 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <BarChart3 size={28} />
          <div>
            <h1 className="text-2xl font-bold">Growth Analytics</h1>
            <p className="text-slate-200">Track referrals, leads, premium trials, and upgrade intent from one admin page.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<Gift className="text-emerald-600" />} label="Rewarded Referrals" value={stats.referralsRewarded} bgColor="bg-emerald-50" />
        <StatCard icon={<Users className="text-blue-600" />} label="Leads Captured" value={stats.leadsCaptured} bgColor="bg-blue-50" />
        <StatCard icon={<Ticket className="text-amber-600" />} label="Premium Pass Claims" value={stats.premiumPassClaims} bgColor="bg-amber-50" />
        <StatCard icon={<MousePointerClick className="text-indigo-600" />} label="Premium Intent Events" value={stats.premiumIntentEvents} bgColor="bg-indigo-50" />
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search analytics data..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <AnalyticsSection
        title={`Referrals (${filteredReferrals.length})`}
        subtitle="Joined, rewarded, and payment-qualified referrals"
      >
        <Table
          headers={['Referrer', 'Referred', 'Code', 'Status', 'Reward', 'Payment', 'Created']}
          rows={filteredReferrals.map((row) => [
            row.referrer?.full_name || row.referrer?.email || 'Unknown',
            row.referred?.full_name || row.referred?.email || row.referred_email || 'Pending signup',
            row.referral_code,
            <StatusPill key={`${row.id}-status`} value={row.status} />,
            `${row.reward_days || 0} days`,
            row.qualified_payment_id || '—',
            new Date(row.created_at).toLocaleString('en-IN'),
          ])}
          emptyMessage="No referrals found."
        />
      </AnalyticsSection>

      <AnalyticsSection
        title={`Marketing Leads (${filteredLeads.length})`}
        subtitle="Homepage free-resource and premium-interest submissions"
      >
        <Table
          headers={['Name', 'Email', 'Phone', 'Interest', 'Source', 'Status', 'Notes', 'Response', 'Created']}
          rows={filteredLeads.map((row) => [
            row.name || '—',
            row.email,
            row.phone || '—',
            row.interest_type,
            row.source,
            <StatusPill key={`${row.id}-lead`} value={row.status || 'pending'} />,
            row.notes || '—',
            row.admin_response || '—',
            new Date(row.created_at).toLocaleString('en-IN'),
          ])}
          emptyMessage="No leads found."
        />
      </AnalyticsSection>

      <AnalyticsSection
        title={`Premium Pass Claims (${filteredPassClaims.length})`}
        subtitle="One-time 3-day premium pass activations"
      >
        <Table
          headers={['Email', 'Days', 'Status', 'Premium Until', 'Claimed At']}
          rows={filteredPassClaims.map((row) => [
            row.email || '—',
            row.pass_days,
            <StatusPill key={`${row.id}-pass`} value={row.status} />,
            row.premium_until_after ? new Date(row.premium_until_after).toLocaleString('en-IN') : '—',
            new Date(row.claimed_at).toLocaleString('en-IN'),
          ])}
          emptyMessage="No premium pass claims found."
        />
      </AnalyticsSection>

      <AnalyticsSection
        title={`Premium Events (${filteredEvents.length})`}
        subtitle="Upgrade clicks, payment attempts, shares, and pass actions"
      >
        <Table
          headers={['Event', 'Source', 'Metadata', 'Created']}
          rows={filteredEvents.map((row) => [
            row.event_name,
            row.source || '—',
            <code key={`${row.id}-meta`} className="text-xs text-slate-600 whitespace-pre-wrap">{JSON.stringify(row.metadata || {})}</code>,
            new Date(row.created_at).toLocaleString('en-IN'),
          ])}
          emptyMessage="No premium events found."
        />
      </AnalyticsSection>
    </div>
  );
};

const StatCard = ({ icon, label, value, bgColor }) => (
  <div className={`${bgColor} rounded-xl border p-4`}>
    <div className="flex items-center justify-between gap-3">
      {icon}
      <span className="text-2xl font-bold text-slate-900">{value}</span>
    </div>
    <p className="mt-2 text-sm font-medium text-slate-700">{label}</p>
  </div>
);

const AnalyticsSection = ({ title, subtitle, children }) => (
  <section className="rounded-xl border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    <div className="mt-4">{children}</div>
  </section>
);

const StatusPill = ({ value }) => {
  const normalized = String(value || '').toLowerCase();
  const className =
    normalized === 'rewarded' || normalized === 'claimed'
      ? 'bg-emerald-100 text-emerald-700'
      : normalized === 'joined'
      ? 'bg-blue-100 text-blue-700'
      : normalized === 'qualified'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-700';

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{value}</span>;
};

const Table = ({ headers, rows, emptyMessage }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          {headers.map((header) => (
            <th key={header} className="px-4 py-3 text-left font-semibold text-slate-700">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} className="px-4 py-6 text-center text-slate-500">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200 align-top">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="px-4 py-3 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export default AdminGrowthAnalytics;
