import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Github, Globe2, Linkedin, Mail, Phone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import AvatarImage from '../components/AvatarImage';
import LoadingSpinner from '../components/LoadingSpinner';

const themeClass = {
  slate: {
    hero: 'from-slate-950 via-slate-900 to-amber-800',
    accent: 'text-amber-300',
    button: 'bg-amber-500 hover:bg-amber-600',
  },
  emerald: {
    hero: 'from-emerald-950 via-slate-900 to-teal-700',
    accent: 'text-emerald-300',
    button: 'bg-emerald-500 hover:bg-emerald-600',
  },
  amber: {
    hero: 'from-zinc-950 via-stone-900 to-orange-700',
    accent: 'text-orange-300',
    button: 'bg-orange-500 hover:bg-orange-600',
  },
};

const PublicPortfolio = () => {
  const { username } = useParams();
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  const decodedUsername = useMemo(() => decodeURIComponent(username || ''), [username]);
  const content = portfolio?.content || {};
  const theme = themeClass[portfolio?.theme] || themeClass.slate;

  useEffect(() => {
    let active = true;

    const loadPortfolio = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase
          .from('student_portfolios')
          .select('*')
          .ilike('username', decodedUsername)
          .eq('is_published', true)
          .maybeSingle();
        if (fetchError) throw fetchError;
        if (!active) return;
        if (!data) {
          setPortfolio(null);
          setError('This portfolio is not published yet.');
          return;
        }

        setPortfolio(data);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, core_subject, education_level, study_stream')
          .eq('id', data.user_id)
          .maybeSingle();
        if (active) setProfile(profileData || null);
      } catch (err) {
        if (!active) return;
        setError(err.message?.includes('student_portfolios') ? 'Portfolio publishing is not configured yet.' : err.message || 'Could not load portfolio.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPortfolio();
    return () => {
      active = false;
    };
  }, [decodedUsername]);

  if (loading) return <LoadingSpinner message="Opening portfolio..." />;

  if (error || !portfolio) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Globe2 size={26} />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">Portfolio unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{error || 'This portfolio could not be found.'}</p>
          <Link to="/" className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
            Go to SkillPro
          </Link>
        </div>
      </div>
    );
  }

  const links = [
    { label: 'Email', href: content.email ? `mailto:${content.email}` : '', icon: Mail },
    { label: 'Phone', href: content.phone ? `tel:${content.phone}` : '', icon: Phone },
    { label: 'LinkedIn', href: content.linkedin, icon: Linkedin },
    { label: 'GitHub', href: content.github, icon: Github },
    { label: 'Website', href: content.website, icon: ExternalLink },
  ].filter((item) => item.href);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <section className={`bg-gradient-to-br ${theme.hero} px-4 py-12 text-white sm:py-16`}>
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white">
              <Globe2 size={14} />
              SkillPro Portfolio
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">{content.headline || portfolio.title}</h1>
            <p className={`mt-4 text-xl font-bold ${theme.accent}`}>{content.role || portfolio.tagline || profile?.core_subject || 'Student'}</p>
            {content.summary ? <p className="mt-5 max-w-3xl text-base leading-8 text-slate-200">{content.summary}</p> : null}
            <div className="mt-7 flex flex-wrap gap-3">
              {links.map((item) => {
                const Icon = item.icon;
                return (
                  <a key={item.label} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={`inline-flex items-center gap-2 rounded-xl ${theme.button} px-4 py-3 text-sm font-bold text-white transition`}>
                    <Icon size={17} />
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <AvatarImage
              userId={profile?.id || portfolio.user_id}
              avatarUrl={profile?.avatar_url}
              alt={profile?.full_name || portfolio.username}
              fallbackName={profile?.full_name || portfolio.username}
              className="h-28 w-28 rounded-2xl border-2 border-white/30 object-cover"
            />
            <h2 className="mt-4 text-2xl font-black">{profile?.full_name || portfolio.username}</h2>
            <p className="mt-1 text-sm text-slate-300">@{portfolio.username}</p>
            {content.location ? <p className="mt-3 text-sm text-slate-200">{content.location}</p> : null}
            {profile?.education_level ? <p className="mt-2 text-sm text-slate-300">{profile.education_level}{profile.study_stream ? `, ${profile.study_stream}` : ''}</p> : null}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        {(content.skills || []).filter(Boolean).length ? (
          <section>
            <h2 className="text-2xl font-black">Skills</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {(content.skills || []).filter(Boolean).map((skill, index) => (
                <span key={`${skill}-${index}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {(content.projects || []).filter((project) => project?.title || project?.description).length ? (
          <section>
            <h2 className="text-2xl font-black">Projects</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(content.projects || []).filter((project) => project?.title || project?.description).map((project, index) => (
                <article key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-black">{project.title || 'Untitled Project'}</h3>
                  {project.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{project.description}</p> : null}
                  {project.link ? (
                    <a href={project.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-800">
                      View project
                      <ExternalLink size={15} />
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {(content.achievements || []).filter(Boolean).length ? (
          <section>
            <h2 className="text-2xl font-black">Achievements</h2>
            <div className="mt-4 grid gap-3">
              {(content.achievements || []).filter(Boolean).map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default PublicPortfolio;
