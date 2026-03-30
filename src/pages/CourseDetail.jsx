import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  Lock,
  Video,
  Award,
  ArrowLeft,
  Play,
  ShieldAlert,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchCourseProtectedAssets } from '../utils/courseProtectedAssets';
import { readBrowserState, upsertRecentItem, writeBrowserState } from '../utils/browserState';

const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const VIDEO_PROGRESS_SAVE_INTERVAL_SECONDS = 5;
const COURSE_TAB_KEY_PREFIX = 'course_detail_active_tab_';
const RECENTLY_VIEWED_COURSES_KEY = 'recently_viewed_courses';

const extractIframeSrc = (value) => {
  const srcMatch = value.match(/src=["']([^"']+)["']/i);
  return srcMatch?.[1] || null;
};

const extractGoogleFileId = (value) => {
  const pathMatch = value.match(/\/d\/([a-zA-Z0-9_-]+)/i);
  if (pathMatch?.[1]) return pathMatch[1];

  try {
    const url = new URL(value);
    return url.searchParams.get('id');
  } catch (error) {
    return null;
  }
};

const appendPdfViewerFlags = (url) => {
  if (!url) return url;
  if (!/\.pdf(\?|#|$)/i.test(url)) return url;
  const [base, hash = ''] = url.split('#');
  const hashParts = hash ? hash.split('&').filter(Boolean) : [];
  const required = ['toolbar=0', 'navpanes=0', 'scrollbar=0', 'view=FitH'];
  required.forEach((part) => {
    if (!hashParts.includes(part)) hashParts.push(part);
  });
  return `${base}#${hashParts.join('&')}`;
};

const normalizeYouTubeEmbed = (value) => {
  try {
    const directValue = value.includes('<iframe') ? extractIframeSrc(value) || value : value;
    let videoId = null;

    if (directValue.includes('youtu.be/')) {
      videoId = directValue.split('youtu.be/')[1]?.split(/[?&]/)[0];
    } else {
      const url = new URL(directValue);
      if (url.pathname.includes('/embed/')) {
        videoId = url.pathname.split('/embed/')[1]?.split('/')[0];
      } else if (url.pathname.includes('/shorts/')) {
        videoId = url.pathname.split('/shorts/')[1]?.split('/')[0];
      } else {
        videoId = url.searchParams.get('v');
      }
    }

    if (!videoId) return null;

    const originParam = APP_ORIGIN ? `&origin=${encodeURIComponent(APP_ORIGIN)}` : '';
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1${originParam}`;
  } catch (error) {
    return null;
  }
};

const normalizeGoogleDrivePreview = (value) => {
  const fileId = extractGoogleFileId(value);
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
};

const normalizeGoogleDriveVideoStream = (value) => {
  const fileId = extractGoogleFileId(value);
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

const normalizeGoogleDocsPreview = (value) => {
  const fileId = extractGoogleFileId(value);
  if (!fileId) return null;

  if (value.includes('/document/')) {
    return `https://docs.google.com/document/d/${fileId}/preview`;
  }
  if (value.includes('/presentation/')) {
    return `https://docs.google.com/presentation/d/${fileId}/embed`;
  }
  if (value.includes('/spreadsheets/')) {
    return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
  }

  return value;
};

const parseVideoSource = (rawValue) => {
  if (!rawValue) return null;

  const value = rawValue.trim();
  if (!value) return null;

  if (value.includes('<iframe')) {
    const src = extractIframeSrc(value);
    if (src) {
      return { type: 'iframe', src };
    }
  }

  if (value.includes('youtube.com') || value.includes('youtu.be')) {
    const src = normalizeYouTubeEmbed(value);
    if (src) {
      return {
        type: 'youtube',
        src,
        blocked: true,
        message: 'YouTube is blocked in the protected player because it can reveal the source video outside SkillPro. Use Google Drive preview or a direct hosted video URL instead.'
      };
    }
    return {
      type: 'youtube',
      blocked: true,
      message: 'This YouTube link is invalid or not embeddable.'
    };
  }

  if (value.includes('drive.google.com')) {
    const fileId = extractGoogleFileId(value);
    const src = normalizeGoogleDriveVideoStream(value);
    if (!fileId || !src) {
      return {
        type: 'drive',
        blocked: true,
        message: 'This Google Drive video link is not a valid file link. Paste a file URL like /file/d/... or an embed code.'
      };
    }
    return {
      type: 'drive-video',
      src,
      fileId,
      previewSrc: normalizeGoogleDrivePreview(value)
    };
  }

  return { type: 'url', src: value };
};

const parseNotesSource = (rawValue) => {
  if (!rawValue) return null;

  const value = rawValue.trim();
  if (!value) return null;

  if (value.includes('<iframe')) {
    const src = extractIframeSrc(value);
    if (src) {
      if (src.includes('drive.google.com')) {
        const previewSrc = normalizeGoogleDrivePreview(src);
        if (!previewSrc) {
          return {
            type: 'drive',
            blocked: true,
            message: 'This Google Drive notes link is not a valid file link. Paste a file URL like /file/d/... or a valid embed code.'
          };
        }
        return { type: 'drive', src: previewSrc };
      }
      if (src.includes('docs.google.com')) {
        const previewSrc = normalizeGoogleDocsPreview(src);
        if (!previewSrc) {
          return {
            type: 'docs',
            blocked: true,
            message: 'This Google Docs notes link is not a valid document/presentation/sheet link.'
          };
        }
        return { type: 'docs', src: previewSrc };
      }
      return { type: 'iframe', src };
    }
  }

  if (value.includes('drive.google.com')) {
    const src = normalizeGoogleDrivePreview(value);
    if (!src) {
      return {
        type: 'drive',
        blocked: true,
        message: 'This Google Drive notes link is not a valid file link. Paste a file URL like /file/d/... or a valid embed code.'
      };
    }
    return { type: 'drive', src };
  }

  if (value.includes('docs.google.com')) {
    const src = normalizeGoogleDocsPreview(value);
    if (!src) {
      return {
        type: 'docs',
        blocked: true,
        message: 'This Google Docs notes link is not a valid document/presentation/sheet link.'
      };
    }
    return { type: 'docs', src };
  }

  return { type: 'url', src: appendPdfViewerFlags(value) };
};

const ContentProtectionNotice = () => (
  <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
    <div className="flex items-start gap-3">
      <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold">Protected premium content</p>
        <p className="mt-1 text-amber-800">
          Viewing is limited to the logged-in premium account inside SkillPro. Right click, print, copy,
          common devtool shortcuts, and direct note downloads are blocked here.
        </p>
      </div>
    </div>
  </div>
);

const AssetBlockedState = ({ icon: Icon, title, message }) => (
  <div className="text-center text-white px-6">
    <Icon size={44} className="mx-auto mb-4 text-amber-400" />
    <p className="font-semibold">{title}</p>
    <p className="mt-2 text-sm text-slate-300">{message}</p>
  </div>
);

const buildVideoProgressKey = (userId, courseId) => `course_video_progress_${userId || 'guest'}_${courseId}`;

const readVideoProgress = (userId, courseId) => {
  if (typeof window === 'undefined' || !courseId) return null;
  try {
    const raw = window.localStorage.getItem(buildVideoProgressKey(userId, courseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.currentTime !== 'number') return null;
    return parsed;
  } catch (error) {
    return null;
  }
};

const writeVideoProgress = (userId, courseId, payload) => {
  if (typeof window === 'undefined' || !courseId) return;
  try {
    window.localStorage.setItem(buildVideoProgressKey(userId, courseId), JSON.stringify(payload));
  } catch (error) {
    // Ignore storage failures.
  }
};

const CourseDetail = () => {
  const { courseId } = useParams();
  const [activeTab, setActiveTab] = useState(() => readBrowserState(`${COURSE_TAB_KEY_PREFIX}${courseId}`, 'overview'));
  const [course, setCourse] = useState(null);
  const [protectedAssets, setProtectedAssets] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [driveVideoFallback, setDriveVideoFallback] = useState(false);
  const [savedVideoProgress, setSavedVideoProgress] = useState(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const { user, profile, isPremium } = useAuth();
  const { popupNode, openPopup } = usePopup();
  const premium = isPremium(profile);
  const videoRef = useRef(null);
  const resumeAppliedRef = useRef(false);
  const lastSavedTimeRef = useRef(0);

  useEffect(() => {
    fetchCourseData();
  }, [courseId, profile?.id, premium]);

  useEffect(() => {
    setActiveTab(readBrowserState(`${COURSE_TAB_KEY_PREFIX}${courseId}`, 'overview'));
  }, [courseId]);

  useEffect(() => {
    setDriveVideoFallback(false);
    resumeAppliedRef.current = false;
    lastSavedTimeRef.current = 0;
  }, [courseId, protectedAssets?.video_url]);

  useEffect(() => {
    const progress = readVideoProgress(profile?.id || user?.id, courseId);
    setSavedVideoProgress(progress);
    setResumePromptOpen(Boolean(progress?.currentTime > 0));
  }, [profile?.id, user?.id, courseId, protectedAssets?.video_url]);

  useEffect(() => {
    writeBrowserState(`${COURSE_TAB_KEY_PREFIX}${courseId}`, activeTab);
  }, [courseId, activeTab]);

  useEffect(() => {
    if (!course?.id) return;
    upsertRecentItem(
      RECENTLY_VIEWED_COURSES_KEY,
      {
        id: course.id,
        title: course.title,
        category: course.category || 'General',
        viewedAt: new Date().toISOString(),
      },
      10
    );
  }, [course?.id, course?.title, course?.category]);

  useEffect(() => {
    const shouldProtect = Boolean(user?.id && premium && enrolled && (activeTab === 'notes' || activeTab === 'overview'));
    if (!shouldProtect) return undefined;

    const preventDefault = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    };

    const keyHandler = (event) => {
      const key = String(event.key || '').toLowerCase();
      const code = String(event.code || '').toLowerCase();
      const usesModifier = event.ctrlKey || event.metaKey;
      const blocked =
        key === 'printscreen' ||
        key === 'f12' ||
        (usesModifier && key === 'p') ||
        (usesModifier && key === 's') ||
        (usesModifier && key === 'u') ||
        (usesModifier && key === 'c') ||
        (usesModifier && key === 'x') ||
        (usesModifier && event.shiftKey && ['i', 'j', 'c', 's'].includes(key)) ||
        ((key === 'g' || code === 'keyg') && event.metaKey);

      if (blocked) {
        preventDefault(event);
      }
    };

    const beforePrintHandler = () => {
      document.body.setAttribute('data-skillpro-print-blocked', 'true');
    };

    const afterPrintHandler = () => {
      document.body.removeAttribute('data-skillpro-print-blocked');
    };

    document.addEventListener('copy', preventDefault, true);
    document.addEventListener('cut', preventDefault, true);
    document.addEventListener('paste', preventDefault, true);
    document.addEventListener('dragstart', preventDefault, true);
    document.addEventListener('selectstart', preventDefault, true);
    document.addEventListener('keydown', keyHandler, true);
    window.addEventListener('keydown', keyHandler, true);
    window.addEventListener('beforeprint', beforePrintHandler);
    window.addEventListener('afterprint', afterPrintHandler);

    return () => {
      document.removeEventListener('copy', preventDefault, true);
      document.removeEventListener('cut', preventDefault, true);
      document.removeEventListener('paste', preventDefault, true);
      document.removeEventListener('dragstart', preventDefault, true);
      document.removeEventListener('selectstart', preventDefault, true);
      document.removeEventListener('keydown', keyHandler, true);
      window.removeEventListener('keydown', keyHandler, true);
      window.removeEventListener('beforeprint', beforePrintHandler);
      window.removeEventListener('afterprint', afterPrintHandler);
      document.body.removeAttribute('data-skillpro-print-blocked');
    };
  }, [user?.id, premium, enrolled, activeTab]);

  const fetchCourseData = async () => {
    try {
      setPageLoading(true);
      setProtectedAssets(null);

      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseData) {
        setCourse(courseData);
      }

      let isEnrolled = false;
      if (profile?.id) {
        const { data, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', profile.id)
          .eq('course_id', courseId)
          .maybeSingle();
        if (enrollmentError) {
          console.error('Error checking enrollment:', enrollmentError);
        }
        isEnrolled = !!data;
        setEnrolled(isEnrolled);
      } else {
        setEnrolled(false);
      }

      if (courseData && isEnrolled && premium) {
        setAssetsLoading(true);
        try {
          const assets = await fetchCourseProtectedAssets(courseId);
          setProtectedAssets(assets);
        } catch (assetError) {
          console.error('Error fetching protected course assets:', assetError);
          openPopup('Access blocked', 'Protected course files are not available for this account.', 'warning');
        } finally {
          setAssetsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error fetching course:', error);
    } finally {
      setPageLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!premium) {
      openPopup('Premium required', 'Only logged-in premium students can access course videos and notes.', 'warning');
      return;
    }
    if (!profile?.id) {
      openPopup('Sign in required', 'Please sign in with your premium student account.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await supabase.from('enrollments').insert({
        student_id: profile.id,
        course_id: courseId,
        progress: 0,
        completed: false
      });
      setEnrolled(true);
      openPopup('Enrolled', 'You have been enrolled successfully.', 'success');
      const assets = await fetchCourseProtectedAssets(courseId);
      setProtectedAssets(assets);
    } catch (error) {
      openPopup('Enroll failed', `Error enrolling: ${error.message}`, 'error');
    }
    setLoading(false);
  };

  const videoSource = useMemo(() => parseVideoSource(protectedAssets?.video_url), [protectedAssets?.video_url]);
  const notesSource = useMemo(() => parseNotesSource(protectedAssets?.notes_url), [protectedAssets?.notes_url]);

  const persistVideoProgress = (currentTime, duration) => {
    const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
    const safeDuration = Number.isFinite(duration) ? duration : 0;
    const progress = {
      currentTime: safeCurrentTime,
      duration: safeDuration,
      updatedAt: new Date().toISOString(),
    };
    writeVideoProgress(profile?.id || user?.id, courseId, progress);
    setSavedVideoProgress(progress);
  };

  const persistCurrentVideoProgress = () => {
    const element = videoRef.current;
    if (!element) return;
    persistVideoProgress(element.currentTime, element.duration);
  };

  const clearSavedVideoProgress = () => {
    writeVideoProgress(profile?.id || user?.id, courseId, {
      currentTime: 0,
      duration: savedVideoProgress?.duration || 0,
      updatedAt: new Date().toISOString(),
    });
    setSavedVideoProgress((prev) => ({
      currentTime: 0,
      duration: prev?.duration || 0,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleVideoLoadedMetadata = (event) => {
    const element = event.currentTarget;
    if (!Number.isFinite(element.duration)) return;
    if (!savedVideoProgress?.currentTime || resumeAppliedRef.current) return;
    if (!resumePromptOpen) return;
    element.currentTime = 0;
  };

  const handleResumeAccepted = () => {
    const element = videoRef.current;
    const savedTime = savedVideoProgress?.currentTime || 0;
    const duration = Number.isFinite(element?.duration) ? element.duration : 0;

    if (element && savedTime > 0 && duration > 0) {
      element.currentTime = Math.min(savedTime, Math.max(duration - 2, 0));
      resumeAppliedRef.current = true;
    }
    setResumePromptOpen(false);
  };

  const handleResumeDeclined = () => {
    resumeAppliedRef.current = true;
    setResumePromptOpen(false);
    clearSavedVideoProgress();
  };

  const handleVideoTimeUpdate = (event) => {
    const element = event.currentTarget;
    if (!Number.isFinite(element.currentTime)) return;
    if (element.currentTime - lastSavedTimeRef.current < VIDEO_PROGRESS_SAVE_INTERVAL_SECONDS) return;

    lastSavedTimeRef.current = element.currentTime;
    persistVideoProgress(element.currentTime, element.duration);
  };

  const handleVideoPause = (event) => {
    const element = event.currentTarget;
    persistVideoProgress(element.currentTime, element.duration);
  };

  const handleVideoEnded = () => {
    persistVideoProgress(0, videoRef.current?.duration || 0);
    lastSavedTimeRef.current = 0;
  };

  const handleBackToCourses = () => {
    persistCurrentVideoProgress();
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      persistCurrentVideoProgress();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistCurrentVideoProgress();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [courseId, profile?.id, user?.id, savedVideoProgress?.duration]);

  if (pageLoading) {
    return <LoadingSpinner message="Loading course..." />;
  }

  if (!course) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center">
        <Video className="mx-auto text-slate-400" size={32} />
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Course not found</h1>
        <p className="text-slate-500 mt-1">The course you're looking for doesn't exist.</p>
        <Link to="/app/courses" className="mt-4 inline-block text-blue-600 font-semibold hover:text-blue-700">
          Back to courses
        </Link>
      </div>
    );
  }

  if (!enrolled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {popupNode}
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link to="/app/courses" onClick={handleBackToCourses} className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold mb-6">
            <ArrowLeft size={18} className="mr-2" />
            Back to Courses
          </Link>

          <div className="bg-gradient-to-br from-blue-600 to-slate-900 rounded-2xl shadow-lg overflow-hidden text-white">
            <div className="grid md:grid-cols-2 gap-8 p-8">
              <div className="flex items-center justify-center">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-64 object-cover rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="w-full h-64 bg-white/20 rounded-lg flex items-center justify-center">
                    <Video size={64} className="text-white/50" />
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center">
                <div className="flex gap-2 mb-3">
                  <span className="inline-block w-fit px-3 py-1 rounded-full text-sm font-medium bg-white/20">
                    {course.category || 'General'}
                  </span>
                  <span className="inline-block w-fit px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white">
                    Premium Only
                  </span>
                </div>
                <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
                <p className="text-white/90 mb-6 leading-relaxed">
                  {course.description || 'Start learning this course now!'}
                </p>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center">
                    <CheckCircle size={20} className="mr-3 flex-shrink-0" />
                    <span>Watch protected premium videos</span>
                  </div>
                  <div className="flex items-center">
                    <FileText size={20} className="mr-3 flex-shrink-0" />
                    <span>Read protected notes inside SkillPro</span>
                  </div>
                  <div className="flex items-center">
                    <EyeOff size={20} className="mr-3 flex-shrink-0" />
                    <span>Right click, copy, and print blocked during access</span>
                  </div>
                </div>

                <button
                  onClick={handleEnroll}
                  disabled={loading}
                  className="w-full bg-white text-blue-700 hover:bg-slate-50 disabled:bg-slate-300 font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                      Enrolling...
                    </>
                  ) : (
                    <>
                      <Play size={20} className="mr-2" />
                      Enroll With Premium Access
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {popupNode}
      {resumePromptOpen && Boolean(savedVideoProgress?.currentTime > 0) && videoSource?.type === 'drive-video' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900">Resume Video?</h2>
            <p className="mt-3 text-slate-600">
              Do you want to continue from {Math.floor(savedVideoProgress?.currentTime || 0)} seconds where you left off?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleResumeDeclined}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Start Over
              </button>
              <button
                type="button"
                onClick={handleResumeAccepted}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/app/courses" onClick={handleBackToCourses} className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold mb-6">
          <ArrowLeft size={18} className="mr-2" />
          Back to Courses
        </Link>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-slate-100">
          <div className="flex gap-2 mb-2">
            <h1 className="text-4xl font-bold text-slate-900">{course.title}</h1>
            <span className="inline-block w-fit px-3 py-1 rounded-full text-xs font-bold self-center bg-amber-500 text-white">
              Premium Content
            </span>
          </div>
          <p className="text-slate-600 text-lg">{course.category || 'Course'}</p>
        </div>

        <ContentProtectionNotice />

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
              <div className="bg-slate-950 aspect-video flex items-center justify-center">
                {!premium ? (
                  <AssetBlockedState
                    icon={Lock}
                    title="Premium membership required"
                    message="Videos and notes are available only to logged-in premium students."
                  />
                ) : assetsLoading ? (
                  <LoadingSpinner message="Unlocking protected content..." />
                ) : videoSource?.blocked ? (
                  <AssetBlockedState
                    icon={ShieldAlert}
                    title="Protected video blocked"
                    message={videoSource.message}
                  />
                ) : videoSource?.type === 'drive-video' ? (
                  driveVideoFallback && videoSource.previewSrc ? (
                    <div className="relative w-full h-full">
                      <iframe
                        title={`${course.title} video`}
                        width="100%"
                        height="100%"
                        src={videoSource.previewSrc}
                        frameBorder="0"
                        allow="autoplay; encrypted-media"
                        className="w-full h-full"
                      />
                      <div
                        className="absolute top-0 right-0 z-10 h-16 w-24 bg-slate-950"
                        onContextMenu={(event) => event.preventDefault()}
                      />
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      className="w-full h-full"
                      src={videoSource.src}
                      controls
                      controlsList="nodownload noplaybackrate noremoteplayback"
                      disablePictureInPicture
                      disableRemotePlayback
                      playsInline
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onPause={handleVideoPause}
                      onEnded={handleVideoEnded}
                      onContextMenu={(event) => event.preventDefault()}
                      onError={() => setDriveVideoFallback(true)}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )
                ) : videoSource ? (
                  <iframe
                    title={`${course.title} video`}
                    width="100%"
                    height="100%"
                    src={videoSource.src}
                    frameBorder="0"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <div className="text-center text-white">
                    <Video size={48} className="mx-auto mb-4 text-slate-400" />
                    <p className="text-slate-400">No protected video available for this course</p>
                  </div>
                )}
              </div>

              <div className="border-b border-slate-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 px-6 py-4 font-semibold border-b-2 transition-colors ${
                      activeTab === 'overview'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex-1 px-6 py-4 font-semibold border-b-2 transition-colors ${
                      activeTab === 'notes'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Notes
                  </button>
                  <button
                    onClick={() => setActiveTab('exam')}
                    className={`flex-1 px-6 py-4 font-semibold border-b-2 transition-colors ${
                      activeTab === 'exam'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Exam
                  </button>
                </div>
              </div>

              <div className="p-8">
                {activeTab === 'overview' && (
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">About this course</h2>
                    <p className="text-slate-600 leading-relaxed">
                      {course.description || 'No description available'}
                    </p>
                    {videoSource?.type === 'drive-video' && savedVideoProgress?.currentTime > 0 ? (
                      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                        Resume available from {Math.floor(savedVideoProgress.currentTime)} seconds.
                      </div>
                    ) : null}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">Protected Course Notes</h2>
                    {!premium ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                        <Lock size={28} className="mx-auto text-amber-600" />
                        <p className="mt-3 font-semibold text-amber-900">Premium access required</p>
                        <p className="mt-1 text-sm text-amber-800">
                          Only logged-in premium students can open notes.
                        </p>
                      </div>
                    ) : assetsLoading ? (
                      <LoadingSpinner message="Loading protected notes..." />
                    ) : notesSource?.blocked ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                        <ShieldAlert size={28} className="mx-auto text-amber-600" />
                        <p className="mt-3 font-semibold text-amber-900">Protected notes blocked</p>
                        <p className="mt-1 text-sm text-amber-800">{notesSource.message}</p>
                      </div>
                    ) : notesSource ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          Notes are previewed inside SkillPro only. Direct download and print actions are intentionally removed.
                        </div>
                        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950">
                          <iframe
                            title={`${course.title} notes`}
                            src={notesSource.src}
                            className="h-[70vh] w-full bg-white"
                            sandbox="allow-same-origin allow-scripts"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <FileText size={32} className="mx-auto mb-3 text-slate-300" />
                        <p>No protected notes available yet</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'exam' && (
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Exam Slot Booking</h2>
                    <p className="mt-2 text-slate-600">{course.title}</p>
                    <p className="mt-2 mb-6 text-sm text-slate-500">
                      Book your exam slot first. After booking, you can write the exam only on your scheduled slot date and time.
                    </p>
                    <Link
                      to={`/app/live-exams?courseId=${courseId}`}
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Award size={20} className="mr-2" />
                      Book Exam Slot
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 sticky top-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Course Access</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 uppercase font-semibold">Category</p>
                  <p className="text-slate-900 font-semibold">{course.category || 'General'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 uppercase font-semibold">Enrollment</p>
                  <p className="text-green-600 font-semibold flex items-center">
                    <CheckCircle size={18} className="mr-2" />
                    Enrolled
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 uppercase font-semibold">Premium status</p>
                  <p className={`font-semibold flex items-center ${premium ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {premium ? <CheckCircle size={18} className="mr-2" /> : <Lock size={18} className="mr-2" />}
                    {premium ? 'Verified premium access' : 'Upgrade required for notes and video'}
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    Protected materials are bound to this logged-in session inside {APP_ORIGIN || 'SkillPro'}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
