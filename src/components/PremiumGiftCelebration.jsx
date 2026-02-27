import React, { useState, useEffect } from 'react';
import { X, Gift } from 'lucide-react';

const PremiumGiftCelebration = ({ premiumDays, onClose }) => {
  const [balloons, setBalloons] = useState([]);
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    // Create balloons
    const newBalloons = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 3 + Math.random() * 2,
      color: ['bg-red-500', 'bg-blue-500', 'bg-yellow-400', 'bg-pink-500', 'bg-purple-500', 'bg-green-500'][Math.floor(Math.random() * 6)]
    }));
    setBalloons(newBalloons);

    // Create confetti
    const newConfetti = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 2 + Math.random() * 1.5,
      rotate: Math.random() * 360,
      color: ['bg-gold-400', 'bg-gold-500', 'bg-yellow-300', 'bg-gold-600'][Math.floor(Math.random() * 4)]
    }));
    setConfetti(newConfetti);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-hidden">
      {/* Balloons */}
      {balloons.map(balloon => (
        <div
          key={`balloon-${balloon.id}`}
          className={`fixed w-12 h-14 ${balloon.color} rounded-full animate-bounce`}
          style={{
            left: `${balloon.left}%`,
            bottom: '-60px',
            animation: `float ${balloon.duration}s ease-in infinite`,
            animationDelay: `${balloon.delay}s`,
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }}
        >
          <div className="w-1 h-8 bg-black/30 mx-auto absolute -bottom-8 left-1/2 -translate-x-1/2"></div>
        </div>
      ))}

      {/* Confetti */}
      {confetti.map(conf => (
        <div
          key={`confetti-${conf.id}`}
          className={`fixed w-2 h-2 ${conf.color} rounded-full`}
          style={{
            left: `${conf.left}%`,
            top: '-10px',
            animation: `fall ${conf.duration}s linear infinite`,
            animationDelay: `${conf.delay}s`,
            transform: `rotate(${conf.rotate}deg)`
          }}
        ></div>
      ))}

      {/* Main Modal */}
      <div className="relative bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-700"
        >
          <X size={24} />
        </button>

        {/* Gift Icon Animation */}
        <div className="mb-6 flex justify-center">
          <div 
            className="text-6xl animate-bounce"
            style={{
              animation: 'bounce 1s ease-in-out infinite'
            }}
          >
            🎁
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-nani-dark mb-2">🎉 Congratulations! 🎉</h1>
        
        {/* Message */}
        <p className="text-lg text-slate-700 mb-4">
          <span className="font-semibold text-gold-600">Admin sent you a gift!</span>
        </p>

        {/* Premium Info */}
        <div className="bg-gradient-to-r from-gold-100 to-gold-50 p-4 rounded-xl mb-6 border-2 border-gold-400">
          <p className="text-sm text-slate-600 mb-2">Premium Access Granted:</p>
          <p className="text-3xl font-bold text-gold-600 mb-2">{premiumDays} Days</p>
          <p className="text-xs text-slate-600">🌟 Enjoy all premium courses and features!</p>
        </div>

        {/* Benefits */}
        <div className="space-y-2 mb-6 text-left">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <span className="text-lg">✨</span>
            <span>Access to 50+ premium courses</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <span className="text-lg">📚</span>
            <span>All learning materials and notes</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <span className="text-lg">🎓</span>
            <span>Certificates upon completion</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <span className="text-lg">👨‍🏫</span>
            <span>Mentorship from teachers</span>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white py-3 rounded-lg font-bold hover:from-gold-600 hover:to-gold-700 hover:shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Start Learning Now! 🚀
        </button>
      </div>

      <style>{`
        @keyframes float {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default PremiumGiftCelebration;
