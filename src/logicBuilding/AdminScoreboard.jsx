import React, { useEffect, useMemo, useState } from 'react';
import { Award, Ban, CheckCircle, RefreshCw, Trophy, Undo2 } from 'lucide-react';
import { getLogicLeaderboardScores } from './leaderboardUtils';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';

const CERT_LABEL = 'Winner Of Weekly Logic Building';

export default function AdminScoreboard() {
  const [scores, setScores] = useState([]);
  const [winnerCertificates, setWinnerCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [message, setMessage] = useState('');

  const certificatesByUserId = useMemo(() => {
    const map = new Map();
    winnerCertificates.forEach((item) => {
      if (item.user_id) map.set(String(item.user_id), item);
    });
    return map;
  }, [winnerCertificates]);

  const rankedScores = useMemo(
    () =>
      scores.map((member, index) => ({
        ...member,
        rank: index + 1,
        winnerCertificate: member.userId ? certificatesByUserId.get(String(member.userId)) || null : null,
      })),
    [scores, certificatesByUserId]
  );

  const topFive = rankedScores.slice(0, 5);

  const loadAll = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [leaderboard, generatedResult] = await Promise.all([
        getLogicLeaderboardScores(),
        supabase
          .from('generated_certificates')
          .select(`
            id,
            user_id,
            certificate_id,
            award_type,
            award_name,
            reason,
            course_name,
            issued_at,
            user:profiles!generated_certificates_user_id_fkey(id, username, full_name, email),
            certificate:certificates(id, revoked_at, issued_at)
          `)
          .eq('award_type', 'weekly_contest_winner')
          .order('issued_at', { ascending: false }),
      ]);

      if (generatedResult.error) throw generatedResult.error;
      setScores(leaderboard);
      setWinnerCertificates(generatedResult.data || []);
    } catch (error) {
      setMessage(error.message || 'Could not load logic building scoreboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const pushNotification = async ({ userId, blocked }) => {
    if (!userId) return;
    const payload = {
      title: blocked ? 'Logic Building Winner Certificate Blocked' : 'Logic Building Winner Certificate Restored',
      content: blocked
        ? `Your ${CERT_LABEL} certificate has been blocked by admin.`
        : `Your ${CERT_LABEL} certificate has been restored by admin.`,
      type: blocked ? 'warning' : 'success',
      target_role: 'student',
      target_user_id: userId,
    };

    const { error } = await supabase.from('admin_notifications').insert(payload);
    if (error && String(error.message || '').includes('target_user_id')) {
      const { target_user_id, content, ...fallback } = payload;
      await supabase.from('admin_notifications').insert({
        ...fallback,
        content: `[target_user_id:${target_user_id}] ${content}`,
      });
    } else if (error) {
      throw error;
    }
  };

  const toggleCertificateBlock = async (winnerCert) => {
    const certId = winnerCert?.certificate_id || winnerCert?.certificate?.id;
    if (!certId) {
      setMessage('This winner record has no linked certificate row to block.');
      return;
    }

    setActionId(winnerCert.id);
    setMessage('');
    try {
      const blocked = !winnerCert?.certificate?.revoked_at;
      const revokedAt = blocked ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('certificates')
        .update({ revoked_at: revokedAt })
        .eq('id', certId);
      if (error) throw error;

      await pushNotification({ userId: winnerCert.user_id, blocked });
      await loadAll();
      setMessage(blocked ? 'Winner certificate blocked.' : 'Winner certificate restored.');
    } catch (error) {
      setMessage(error.message || 'Could not update winner certificate.');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading logic building admin scoreboard..." />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 to-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">
              <Trophy size={14} />
              Admin Scoreboard
            </div>
            <h1 className="mt-3 text-3xl font-black">Logic Building Results</h1>
            <p className="mt-2 text-sm text-indigo-100">
              Track top members, winner certificate status, and block certificates when needed.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
          {message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Award className="text-amber-600" size={22} />
            Top 5 Members
          </h2>
        </div>
        {topFive.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No logic building scores yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Tie Break</th>
                  <th className="px-4 py-3">Winner Certificate</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {topFive.map((member) => {
                  const winnerCert = member.winnerCertificate;
                  const blocked = Boolean(winnerCert?.certificate?.revoked_at);
                  return (
                    <tr key={`${member.id}-${member.rank}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-black text-slate-950">#{member.rank}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{member.username}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{member.score}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p>Complexity: {member.complexityLabel || member.complexityScore || '-'}</p>
                        <p>First solve: {member.firstSolvedAt ? new Date(member.firstSolvedAt).toLocaleString() : '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {winnerCert ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                            blocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            <CheckCircle size={13} />
                            {blocked ? 'Issued, blocked' : 'Issued'}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">Not generated</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {winnerCert ? (
                          <button
                            type="button"
                            onClick={() => toggleCertificateBlock(winnerCert)}
                            disabled={actionId === winnerCert.id}
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-60 ${
                              blocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                            }`}
                          >
                            {blocked ? <Undo2 size={14} /> : <Ban size={14} />}
                            {blocked ? 'Unblock' : 'Block'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Available after certificate generation</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-xl font-black text-slate-950">All Winner Certificates</h2>
        </div>
        {winnerCertificates.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No Logic Building winner certificates generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Certificate</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {winnerCertificates.map((cert) => {
                  const blocked = Boolean(cert?.certificate?.revoked_at);
                  return (
                    <tr key={cert.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {cert.user?.username || cert.user?.full_name || 'Student'}
                      </td>
                      <td className="px-4 py-3">{cert.award_name || CERT_LABEL}</td>
                      <td className="px-4 py-3">{cert.issued_at ? new Date(cert.issued_at).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          blocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {blocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleCertificateBlock(cert)}
                          disabled={actionId === cert.id}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-60 ${
                            blocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {blocked ? <Undo2 size={14} /> : <Ban size={14} />}
                          {blocked ? 'Unblock' : 'Block'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
