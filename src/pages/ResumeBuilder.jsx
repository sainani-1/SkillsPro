import React, { useEffect, useRef, useState } from 'react';
import { Download, Eye, FileText, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const defaultResume = {
  role: 'Frontend Developer',
  summary:
    'Career-focused learner with strong problem solving, communication, and execution skills. Builds polished user experiences, adapts quickly, and delivers work with ownership.',
  email: '',
  phone: '',
  location: 'India',
  linkedin: 'linkedin.com/in/your-profile',
  portfolio: 'portfolio.example.com',
  skills: 'React, JavaScript, HTML, CSS, Tailwind CSS, Git, Problem Solving, Communication',
  experience1Title: 'Academic Projects & Practice Work',
  experience1Company: 'Self-driven Learning',
  experience1Period: '2025 - Present',
  experience1Description:
    'Built responsive frontend projects, improved UI structure, and practiced real-world implementation through guided coursework and assignments.',
  experience2Title: 'Team Collaboration Projects',
  experience2Company: 'Student Initiatives',
  experience2Period: '2024 - Present',
  experience2Description:
    'Worked with peers on structured mini-projects, presentations, and task delivery with attention to quality and deadlines.',
  project1Title: 'Portfolio Website',
  project1Description:
    'Designed an attractive personal portfolio with project showcases, contact details, and clean visual storytelling.',
  project2Title: 'Course or Product UI Project',
  project2Description:
    'Created a polished, mobile-friendly interface with strong layout, branding, and usability decisions.',
  education:
    'Add your degree, school or college, board/university, and graduation year here.',
  achievements:
    'Mention certificates, awards, top exam scores, contests, leadership, volunteering, or notable milestones.',
};

const ResumeBuilder = () => {
  const { profile, user } = useAuth();
  const previewRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [resume, setResume] = useState(defaultResume);

  useEffect(() => {
    if (!profile && !user) return;

    const storageKey = `resume_builder_${profile?.id || user?.id || 'guest'}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setResume((prev) => ({ ...prev, ...JSON.parse(stored) }));
        return;
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    setResume((prev) => ({
      ...prev,
      email: profile?.email || user?.email || '',
      phone: profile?.phone || '',
      role: profile?.core_subject ? `${profile.core_subject} Specialist` : prev.role,
      education:
        profile?.education_level || profile?.study_stream || profile?.diploma_certificate
          ? [profile?.education_level, profile?.study_stream, profile?.diploma_certificate]
              .filter(Boolean)
              .join(' | ')
          : prev.education,
    }));
  }, [profile, user]);

  useEffect(() => {
    const storageKey = `resume_builder_${profile?.id || user?.id || 'guest'}`;
    localStorage.setItem(storageKey, JSON.stringify(resume));
  }, [resume, profile?.id, user?.id]);

  const updateField = (field, value) => {
    setResume((prev) => ({ ...prev, [field]: value }));
  };

  const downloadResume = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let remainingHeight = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position = remainingHeight - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        remainingHeight -= pageHeight;
      }

      const safeName = (profile?.full_name || user?.email || 'resume')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      pdf.save(`${safeName || 'resume'}-resume.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const skillList = resume.skills
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-nani-dark to-amber-900 p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              <Sparkles size={14} />
              Resume Builder
            </p>
            <h1 className="mt-4 text-3xl md:text-4xl font-serif font-bold">Create a resume that looks premium at first glance.</h1>
            <p className="mt-3 text-slate-200">
              Edit your details, review the live preview, and download a polished PDF in one place.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/15"
            >
              <Eye size={18} />
              Preview
            </button>
            <button
              type="button"
              onClick={downloadResume}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-5 py-3 font-bold text-nani-dark hover:bg-gold-500 disabled:opacity-60"
            >
              <Download size={18} />
              {downloading ? 'Preparing PDF...' : 'Download'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6 items-start">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-5">
          <h2 className="text-xl font-bold text-slate-900">Resume Details</h2>
          <Field label="Target Role" value={resume.role} onChange={(value) => updateField('role', value)} />
          <Textarea label="Professional Summary" value={resume.summary} onChange={(value) => updateField('summary', value)} rows={4} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Email" value={resume.email} onChange={(value) => updateField('email', value)} />
            <Field label="Phone" value={resume.phone} onChange={(value) => updateField('phone', value)} />
            <Field label="Location" value={resume.location} onChange={(value) => updateField('location', value)} />
            <Field label="LinkedIn" value={resume.linkedin} onChange={(value) => updateField('linkedin', value)} />
          </div>
          <Field label="Portfolio / Website" value={resume.portfolio} onChange={(value) => updateField('portfolio', value)} />
          <Textarea label="Skills (comma separated)" value={resume.skills} onChange={(value) => updateField('skills', value)} rows={3} />

          <SectionTitle title="Experience" />
          <Field label="Experience 1 Role" value={resume.experience1Title} onChange={(value) => updateField('experience1Title', value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Experience 1 Organization" value={resume.experience1Company} onChange={(value) => updateField('experience1Company', value)} />
            <Field label="Experience 1 Period" value={resume.experience1Period} onChange={(value) => updateField('experience1Period', value)} />
          </div>
          <Textarea label="Experience 1 Description" value={resume.experience1Description} onChange={(value) => updateField('experience1Description', value)} rows={3} />
          <Field label="Experience 2 Role" value={resume.experience2Title} onChange={(value) => updateField('experience2Title', value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Experience 2 Organization" value={resume.experience2Company} onChange={(value) => updateField('experience2Company', value)} />
            <Field label="Experience 2 Period" value={resume.experience2Period} onChange={(value) => updateField('experience2Period', value)} />
          </div>
          <Textarea label="Experience 2 Description" value={resume.experience2Description} onChange={(value) => updateField('experience2Description', value)} rows={3} />

          <SectionTitle title="Projects" />
          <Field label="Project 1 Title" value={resume.project1Title} onChange={(value) => updateField('project1Title', value)} />
          <Textarea label="Project 1 Description" value={resume.project1Description} onChange={(value) => updateField('project1Description', value)} rows={3} />
          <Field label="Project 2 Title" value={resume.project2Title} onChange={(value) => updateField('project2Title', value)} />
          <Textarea label="Project 2 Description" value={resume.project2Description} onChange={(value) => updateField('project2Description', value)} rows={3} />

          <SectionTitle title="Education & Achievements" />
          <Textarea label="Education" value={resume.education} onChange={(value) => updateField('education', value)} rows={3} />
          <Textarea label="Achievements" value={resume.achievements} onChange={(value) => updateField('achievements', value)} rows={3} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-600">
            <FileText size={18} />
            <span className="font-semibold">Live Preview</span>
          </div>
          <div className="overflow-auto rounded-[2rem] border border-slate-200 bg-slate-100 p-4 md:p-6 shadow-inner">
            <div
              ref={previewRef}
              className="mx-auto w-full max-w-[850px] bg-white min-h-[1120px] overflow-hidden rounded-[1.5rem] border border-slate-200 shadow-2xl"
            >
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-900 px-8 py-10 text-white">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Professional Resume</p>
                    <h2 className="mt-3 text-4xl font-serif font-bold">{profile?.full_name || user?.email?.split('@')[0] || 'Your Name'}</h2>
                    <p className="mt-2 text-xl text-slate-200">{resume.role}</p>
                  </div>
                  <div className="text-sm leading-7 text-slate-200 md:text-right">
                    <p>{resume.email || 'your.email@example.com'}</p>
                    <p>{resume.phone || '+91 00000 00000'}</p>
                    <p>{resume.location}</p>
                    <p>{resume.linkedin}</p>
                    <p>{resume.portfolio}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-0">
                <div className="px-8 py-8 space-y-8">
                  <ResumeSection title="Profile Summary">
                    <p className="text-slate-700 leading-7">{resume.summary}</p>
                  </ResumeSection>

                  <ResumeSection title="Experience">
                    <ExperienceCard
                      title={resume.experience1Title}
                      company={resume.experience1Company}
                      period={resume.experience1Period}
                      description={resume.experience1Description}
                    />
                    <ExperienceCard
                      title={resume.experience2Title}
                      company={resume.experience2Company}
                      period={resume.experience2Period}
                      description={resume.experience2Description}
                    />
                  </ResumeSection>

                  <ResumeSection title="Selected Projects">
                    <ProjectCard title={resume.project1Title} description={resume.project1Description} />
                    <ProjectCard title={resume.project2Title} description={resume.project2Description} />
                  </ResumeSection>
                </div>

                <div className="bg-slate-50 px-8 py-8 space-y-8 border-t md:border-t-0 md:border-l border-slate-200">
                  <ResumeSection title="Core Skills">
                    <div className="flex flex-wrap gap-2">
                      {skillList.map((skill) => (
                        <span key={skill} className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </ResumeSection>

                  <ResumeSection title="Education">
                    <p className="text-slate-700 leading-7 whitespace-pre-line">{resume.education}</p>
                  </ResumeSection>

                  <ResumeSection title="Achievements">
                    <p className="text-slate-700 leading-7 whitespace-pre-line">{resume.achievements}</p>
                  </ResumeSection>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionTitle = ({ title }) => <h3 className="pt-2 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">{title}</h3>;

const Field = ({ label, value, onChange }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
    />
  </label>
);

const Textarea = ({ label, value, onChange, rows = 4 }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
    />
  </label>
);

const ResumeSection = ({ title, children }) => (
  <section>
    <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">{title}</h3>
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const ExperienceCard = ({ title, company, period, description }) => (
  <div className="rounded-2xl border border-slate-200 p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h4 className="text-lg font-bold text-slate-900">{title}</h4>
        <p className="text-sm font-semibold text-slate-600">{company}</p>
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{period}</p>
    </div>
    <p className="mt-3 text-sm leading-7 text-slate-700">{description}</p>
  </div>
);

const ProjectCard = ({ title, description }) => (
  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
    <h4 className="text-base font-bold text-slate-900">{title}</h4>
    <p className="mt-2 text-sm leading-7 text-slate-700">{description}</p>
  </div>
);

export default ResumeBuilder;
