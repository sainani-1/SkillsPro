import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const Home = () => {
  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
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

      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-5xl md:text-6xl font-serif font-bold text-nani-dark mb-6 leading-tight">
          Shape Your Career <br/><span className="text-gold-500">With Professional Guidance</span>
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mb-8">
          Access 50+ premium courses, get certified, and connect with expert mentors. 
          One subscription, unlimited learning.
        </p>
        <div className="space-x-4 mb-12">
          <Link to="/register" className="btn-primary px-8 py-4 text-lg">Start Learning Now</Link>
          <Link to="/plans" className="px-8 py-4 text-lg border border-slate-300 rounded hover:bg-white transition inline-block">View Plans</Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-4xl">
           {['Verified Certificates', '1-on-1 Mentorship', 'Live Doubt Sessions'].map((feat, i) => (
             <div key={i} className="flex items-center space-x-3">
               <CheckCircle className="text-gold-500" />
               <span className="font-bold text-slate-700">{feat}</span>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
