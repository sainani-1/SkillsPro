import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, CheckCircle, Lock, Video, Award, Download, ArrowLeft, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup.jsx';
import LoadingSpinner from '../components/LoadingSpinner';

const CourseDetail = () => {
    const { courseId } = useParams();
    const [activeTab, setActiveTab] = useState('overview');
    const [course, setCourse] = useState(null);
    const [enrolled, setEnrolled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const { profile, isPremium } = useAuth();
    const { popupNode, openPopup } = usePopup();
    const premium = isPremium(profile);

    useEffect(() => {
        fetchCourseData();
    }, [courseId, profile?.id]);

    const fetchCourseData = async () => {
        try {
            const { data: courseData } = await supabase
                .from('courses')
                .select('*')
                .eq('id', courseId)
                .single();

            if (courseData) {
                setCourse(courseData);
            }

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
                setEnrolled(!!data);
            }
        } catch (error) {
            console.error('Error fetching course:', error);
        } finally {
            setPageLoading(false);
        }
    };

    const handleEnroll = async () => {
        if (!course?.is_free && !premium) {
            openPopup('Premium required', 'Upgrade to Premium to enroll in this paid course.', 'warning');
            return;
        }
        if (!profile?.id) {
            openPopup('Sign in required', 'Please sign in to enroll in this course.', 'warning');
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
        } catch (error) {
            openPopup('Enroll failed', 'Error enrolling: ' + error.message, 'error');
        }
        setLoading(false);
    };

    // Parse video source from URL or iframe code
    const getVideoSource = () => {
        if (!course?.video_url) return null;

        const videoUrl = course.video_url.trim();

        // Handle iframe HTML code
        if (videoUrl.includes('<iframe')) {
            const srcMatch = videoUrl.match(/src=["']([^"']+)["']/);
            if (srcMatch?.[1]) {
                return { type: 'iframe', src: srcMatch[1] };
            }
        }

        // Handle Google Drive links
        if (videoUrl.includes('drive.google.com')) {
            // If it's an iframe code, extract src
            if (videoUrl.includes('iframe')) {
                const srcMatch = videoUrl.match(/src=["']([^"']+)["']/);
                if (srcMatch?.[1]) {
                    return { type: 'iframe', src: srcMatch[1] };
                }
            }
            // Otherwise use as-is (it might be a share link)
            return { type: 'iframe', src: videoUrl };
        }

        // Handle YouTube URLs
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
            let videoId;
            
            if (videoUrl.includes('youtu.be')) {
                videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
            } else {
                const urlParams = new URLSearchParams(new URL(videoUrl).search);
                videoId = urlParams.get('v');
            }

            if (videoId) {
                return { 
                    type: 'youtube', 
                    id: videoId,
                    src: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0` 
                };
            }
        }

        // Return as-is if we can't parse it
        return { type: 'url', src: videoUrl };
    };

    if (pageLoading) {
        return <LoadingSpinner message="Loading course..." />;
    }

    // Allow access only if premium is active or the course is free.
    if (!premium && course && !course.is_free) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center">
                <Lock className="mx-auto text-slate-400" size={32} />
                <h1 className="text-2xl font-bold text-slate-900 mt-2">Premium required</h1>
                <p className="text-slate-500 mt-1">Upgrade to Premium to access course details and content.</p>
                <Link to="/app/courses" className="mt-4 inline-block text-blue-600 font-semibold hover:text-blue-700">Back to courses</Link>
            </div>
        );
    }

    if (!course) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center">
                <Video className="mx-auto text-slate-400" size={32} />
                <h1 className="text-2xl font-bold text-slate-900 mt-2">Course not found</h1>
                <p className="text-slate-500 mt-1">The course you're looking for doesn't exist.</p>
                <Link to="/app/courses" className="mt-4 inline-block text-blue-600 font-semibold hover:text-blue-700">Back to courses</Link>
            </div>
        );
    }

    // ENROLLMENT SCREEN - Show only before enrollment
    if (!enrolled) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                {popupNode}
                <div className="max-w-3xl mx-auto px-4 py-8">
                    {/* Back button */}
                    <Link to="/app/courses" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold mb-6">
                        <ArrowLeft size={18} className="mr-2" />
                        Back to Courses
                    </Link>

                    {/* Course Card */}
                    <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl shadow-lg overflow-hidden text-white">
                        <div className="grid md:grid-cols-2 gap-8 p-8">
                            {/* Course Image */}
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

                            {/* Course Info */}
                            <div className="flex flex-col justify-center">
                                                                <div className="flex gap-2 mb-3">
                                                                    <span className="inline-block w-fit px-3 py-1 rounded-full text-sm font-medium bg-white/20">
                                                                        {course.category || 'General'}
                                                                    </span>
                                                                    <span className={`inline-block w-fit px-3 py-1 rounded-full text-xs font-bold ${course.is_free ? 'bg-green-600 text-white' : 'bg-yellow-500 text-white'}`}>{course.is_free ? 'Free' : 'Premium'}</span>
                                                                </div>
                                <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
                                <p className="text-white/90 mb-6 leading-relaxed">
                                    {course.description || 'Start learning this course now!'}
                                </p>

                                {/* Benefits List */}
                                <div className="space-y-3 mb-8">
                                    <div className="flex items-center">
                                        <CheckCircle size={20} className="mr-3 flex-shrink-0" />
                                        <span>Access all video lessons</span>
                                    </div>
                                    <div className="flex items-center">
                                        <FileText size={20} className="mr-3 flex-shrink-0" />
                                        <span>Download course materials</span>
                                    </div>
                                    <div className="flex items-center">
                                        <Award size={20} className="mr-3 flex-shrink-0" />
                                        <span>Complete exam and get certificate</span>
                                    </div>
                                </div>

                                {/* Enroll Button */}
                                <button
                                    onClick={handleEnroll}
                                    disabled={loading}
                                    className="w-full bg-white text-blue-600 hover:bg-slate-50 disabled:bg-slate-300 font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                                            Enrolling...
                                        </>
                                    ) : (
                                        <>
                                            <Play size={20} className="mr-2" />
                                            Enroll Now
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

    // FULL COURSE CONTENT - Show after enrollment
    const videoSource = getVideoSource();

    return (
        <div className="min-h-screen bg-slate-50">
            {popupNode}
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Back button */}
                <Link to="/app/courses" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold mb-6">
                    <ArrowLeft size={18} className="mr-2" />
                    Back to Courses
                </Link>

                {/* Course Header */}
                                <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-slate-100">
                                        <div className="flex gap-2 mb-2">
                                            <h1 className="text-4xl font-bold text-slate-900">{course.title}</h1>
                                            <span className={`inline-block w-fit px-3 py-1 rounded-full text-xs font-bold self-center ${course.is_free ? 'bg-green-600 text-white' : 'bg-yellow-500 text-white'}`}>{course.is_free ? 'Free' : 'Premium'}</span>
                                        </div>
                                        <p className="text-slate-600 text-lg">{course.category || 'Course'}</p>
                                </div>

                {/* Main Content Grid */}
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Video Section */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                            {/* Video Player */}
                            <div className="bg-slate-900 aspect-video flex items-center justify-center">
                                {videoSource ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={videoSource.src}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="w-full h-full"
                                    ></iframe>
                                ) : (
                                    <div className="text-center text-white">
                                        <Video size={48} className="mx-auto mb-4 text-slate-400" />
                                        <p className="text-slate-400">No video available for this course</p>
                                    </div>
                                )}
                            </div>

                            {/* Tabs */}
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

                            {/* Tab Content */}
                            <div className="p-8">
                                {activeTab === 'overview' && (
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 mb-4">About this course</h2>
                                        <p className="text-slate-600 leading-relaxed">
                                            {course.description || 'No description available'}
                                        </p>
                                    </div>
                                )}

                                {activeTab === 'notes' && (
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Course Materials</h2>
                                        {course.notes_url ? (
                                            <div className="flex items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                <FileText size={28} className="text-blue-600 mr-4 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="font-semibold text-slate-900">Course Notes & Materials</p>
                                                    <p className="text-sm text-slate-600">PDF document with all course materials</p>
                                                </div>
                                                <a
                                                    href={course.notes_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center whitespace-nowrap"
                                                >
                                                    <Download size={18} className="mr-2" />
                                                    Download
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-slate-500">
                                                <FileText size={32} className="mx-auto mb-3 text-slate-300" />
                                                <p>No course materials available yet</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'exam' && (
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">Exam Slot Booking</h2>
                                        <p className="mt-2 text-slate-600">
                                            {course.title}
                                        </p>
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

                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 sticky top-8">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Course Info</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-slate-500 uppercase font-semibold">Category</p>
                                    <p className="text-slate-900 font-semibold">{course.category || 'General'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 uppercase font-semibold">Status</p>
                                    <p className="text-green-600 font-semibold flex items-center">
                                        <CheckCircle size={18} className="mr-2" />
                                        Enrolled
                                    </p>
                                </div>
                                <div className="pt-4 border-t border-slate-200">
                                    <p className="text-sm text-slate-600">
                                        You have full access to all course materials, videos, and exams.
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
