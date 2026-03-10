import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Brain,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Clock3,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user, loading } = useAuth();
  const highlights = [
    'Verified Certificates',
    '1-on-1 Mentorship',
    'Live Doubt Sessions',
    'AI Learning Guidance',
  ];
  const stats = [
    { value: '50+', label: 'premium courses' },
    { value: '24/7', label: 'guided access' },
    { value: '100%', label: 'career-focused paths' },
  ];
  const featureCards = [
    {
      icon: BookOpen,
      title: 'Structured Learning',
      description: 'Follow curated course tracks with lessons, practice, exams, and certificates in one flow.',
    },
    {
      icon: Brain,
      title: 'AI + Mentor Support',
      description: 'Use AI learning assistance together with teacher support when you need direction or doubt clearing.',
    },
    {
      icon: Briefcase,
      title: 'Career Preparation',
      description: 'Prepare for interviews, improve communication, and build job-ready confidence with guided modules.',
    },
    {
      icon: ShieldCheck,
      title: 'Trusted Assessments',
      description: 'Secure tests, certificate verification, and tracked progress make outcomes visible and credible.',
    },
  ];
  const journey = [
    {
      title: 'Choose a plan',
      description: 'Start with a public membership plan that fits your learning pace and goals.',
    },
    {
      title: 'Learn with guidance',
      description: 'Access courses, live sessions, doubt clearing, and practical assignments from one dashboard.',
    },
    {
      title: 'Get certified',
      description: 'Complete exams, verify your certificate, and build a stronger profile for future opportunities.',
    },
  ];

  if (loading) {
    return <LoadingSpinner message="Checking session..." />;
  }

  if (user?.id) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fde68a_0%,#fff8e1_18%,#f8fafc_52%,#e2e8f0_100%)] text-slate-900">
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full shadow-sm overflow-hidden">
            <img
              src="/skillpro-logo.png"
              alt="SkillPro logo"
              className="h-full w-full rounded-full object-contain mix-blend-multiply"
            />
          </div>
          <div className="font-serif font-bold text-2xl text-nani-dark">SkillPro</div>
        </div>
        <div className="space-x-4">
          <Link to="/login" className="text-slate-600 hover:text-nani-dark font-medium">Login</Link>
          <Link to="/register" className="btn-gold">Get Started</Link>
        </div>
      </nav>

      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-14 md:pt-16 md:pb-24 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm">
              <Rocket size={16} />
              Career-first learning platform
            </div>
            <h1 className="mt-6 text-5xl md:text-6xl font-serif font-bold text-nani-dark leading-tight">
              Shape Your Career
              <br />
              <span className="text-gold-500">With Professional Guidance</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 max-w-2xl">
              Access premium courses, guided practice, live support, and certificate-ready assessments from one platform built for serious learners.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link to="/register" className="btn-primary px-8 py-4 text-lg inline-flex items-center justify-center gap-2">
                Start Learning Now
                <ArrowRight size={18} />
              </Link>
              <Link to="/plans" className="px-8 py-4 text-lg border border-slate-300 rounded bg-white/80 hover:bg-white transition inline-flex items-center justify-center gap-2">
                View Plans
                <ChevronRight size={18} />
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              {highlights.map((feat) => (
                <div key={feat} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 shadow-sm">
                  <CheckCircle className="text-gold-500" size={20} />
                  <span className="font-semibold text-slate-700">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_top,#fbbf24_0%,rgba(251,191,36,0.12)_32%,transparent_70%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-900 p-8 text-white shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.35),transparent_30%)]" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                  <BadgeCheck size={14} />
                  Premium experience
                </div>
                <h2 className="mt-5 text-3xl font-serif font-bold leading-tight">
                  Learn faster with a platform that combines mentoring, exams, and outcomes.
                </h2>
                <div className="mt-8 grid grid-cols-3 gap-3">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 text-center">
                      <div className="text-2xl font-bold text-gold-400">{stat.value}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-slate-200">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-2xl border border-white/15 bg-slate-950/30 p-5">
                  <p className="text-sm text-slate-200">
                    Includes course access, mentor interaction, practice tests, certificate verification, and growth tools from a single account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 md:p-8 shadow-lg">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Platform features</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-serif font-bold text-nani-dark">Everything on the index page now reflects the full product better</h2>
              <p className="mt-3 text-slate-600">
                The landing page now presents the platform as a complete learning system instead of a single hero block.
              </p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {featureCards.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">How it works</p>
            <h2 className="mt-3 text-3xl font-serif font-bold text-nani-dark">A simple path from signup to outcomes</h2>
            <div className="mt-8 space-y-5">
              {journey.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nani-dark text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-8 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Why learners stay</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-white p-5 border border-slate-200">
                <Users className="text-nani-accent" size={24} />
                <h3 className="mt-4 text-lg font-bold text-slate-900">Mentor access</h3>
                <p className="mt-2 text-sm text-slate-600">Support is available beyond video content through doubt clearing and teacher interaction.</p>
              </div>
              <div className="rounded-3xl bg-white p-5 border border-slate-200">
                <Clock3 className="text-nani-accent" size={24} />
                <h3 className="mt-4 text-lg font-bold text-slate-900">Flexible pace</h3>
                <p className="mt-2 text-sm text-slate-600">Students can learn, revise, and attempt assessments according to their own schedule.</p>
              </div>
              <div className="rounded-3xl bg-white p-5 border border-slate-200 sm:col-span-2">
                <h3 className="text-lg font-bold text-slate-900">Useful public actions</h3>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Link to="/verify" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50">
                    Verify Certificate
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-r from-nani-dark via-slate-900 to-nani-accent px-6 py-10 md:px-10 shadow-2xl text-white">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Start now</p>
                <h2 className="mt-3 text-3xl md:text-4xl font-serif font-bold">Build a stronger learning routine with one account.</h2>
                <p className="mt-3 text-slate-200">Create your account, pick a plan, and move into guided learning without switching between scattered tools.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 py-3 font-bold text-nani-dark hover:bg-gold-500 transition-colors">
                  Create Account
                  <ArrowRight size={18} />
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/15 transition-colors">
                  Existing User Login
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
