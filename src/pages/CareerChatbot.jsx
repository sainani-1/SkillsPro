import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Send, Bot, User, Crown, Lock } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const CareerChatbot = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const isPremium = profile?.premium_until && new Date(profile.premium_until) > new Date();

  useEffect(() => {
    if (profile?.role !== 'student') {
      navigate('/app');
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (isPremium && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: '👋 Hello! I\'m your Career Guidance AI Assistant. I can help you with:\n\n• Career path suggestions\n• Skills to learn for your dream job\n• Interview preparation tips\n• Resume building advice\n• Industry trends and insights\n\nWhat would you like to know?',
          timestamp: new Date()
        }
      ]);
    }
  }, [isPremium]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getCareerGuidanceResponse = (userMessage) => {
    const msg = userMessage.toLowerCase();
    
    // Technical support and website issues
    if (msg.includes('error') || msg.includes('not working') || msg.includes('issue') || msg.includes('problem') || msg.includes('bug') || msg.includes('help')) {
      
      // Login/Authentication issues
      if (msg.includes('login') || msg.includes('sign in') || msg.includes('password') || msg.includes('forgot')) {
        return '🔐 **Login & Authentication Issues - Solutions:**\n\n**Can\'t Login?**\n✅ Check if email is correct (no extra spaces)\n✅ Use "Forgot Password" to reset\n✅ Clear browser cache and cookies\n✅ Try incognito/private mode\n✅ Check if Caps Lock is ON\n\n**Forgot Password?**\n1. Click "Forgot Password" on login page\n2. Enter your registered email\n3. Check inbox (also spam folder)\n4. Click reset link (expires in 1 hour)\n5. Create new password\n\n**Not Receiving Reset Email?**\n• Check spam/junk folder\n• Wait 5-10 minutes\n• Verify email address is correct\n• Contact admin if still not received\n\n**Account Locked?**\n• May be locked after suspicious activity\n• Check lock expiry time on screen\n• Contact admin to unlock early\n\n**Still Having Issues?**\nTry: Clear cache → Restart browser → Try different browser';
      }
      
      // Course/Video issues
      if (msg.includes('course') || msg.includes('video') || msg.includes('play') || msg.includes('load')) {
        return '📹 **Course & Video Issues - Solutions:**\n\n**Video Not Playing?**\n✅ Check internet connection (need 2+ Mbps)\n✅ Refresh the page (F5 or Ctrl+R)\n✅ Try different browser (Chrome recommended)\n✅ Disable ad blockers\n✅ Clear browser cache\n✅ Update browser to latest version\n\n**Video Buffering/Slow?**\n• Lower video quality (if option available)\n• Close other tabs/apps using internet\n• Connect to stable WiFi\n• Pause and wait 30 seconds, then play\n\n**Can\'t Access Course?**\n• Verify premium status (check Profile)\n• Course might require payment\n• Check if enrolled in course\n• Contact admin if payment done but no access\n\n**Course Content Not Loading?**\n1. Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)\n2. Clear browser cache\n3. Disable browser extensions\n4. Try incognito mode\n\n**Download Issues?**\n• Check if downloads are allowed for your course\n• Right-click → Save As\n• Check download folder\n• Disable download manager extensions';
      }
      
      // Exam/Test issues
      if (msg.includes('exam') || msg.includes('test') || msg.includes('quiz') || msg.includes('submit')) {
        return '📝 **Exam & Test Issues - Solutions:**\n\n**Can\'t Start Exam?**\n✅ Ensure premium membership active\n✅ Check if course is completed\n✅ Use desktop/laptop (not mobile)\n✅ Disable browser extensions\n✅ Allow camera/microphone if proctored\n\n**Exam Suddenly Stopped?**\n• Internet disconnected? Reconnect & refresh\n• Tab switched? May be flagged as suspicious\n• Answers saved automatically - don\'t panic\n• Contact admin immediately\n\n**Can\'t Submit Answers?**\n1. Check all required questions answered\n2. Refresh page (answers are auto-saved)\n3. Try different browser\n4. Screenshot your answers as backup\n5. Contact support with screenshot\n\n**Account Locked During Exam?**\n• Anti-cheat system detected suspicious activity\n• Opening new tab/window triggers lock\n• Copy-paste disabled during exam\n• Check lock duration on screen\n• Contact admin with explanation\n\n**Results Not Showing?**\n• Wait 5-10 minutes for processing\n• Check "My Certificates" or "Results" section\n• Refresh page\n• Admin might be reviewing manually\n\n**Pro Tips**:\n⚠️ Don\'t switch tabs during exam\n⚠️ Don\'t copy-paste (disabled)\n⚠️ Use stable internet connection\n⚠️ Keep only exam tab open';
      }
      
      // Payment issues
      if (msg.includes('payment') || msg.includes('premium') || msg.includes('paid') || msg.includes('money') || msg.includes('refund')) {
        return '💳 **Payment & Premium Issues - Solutions:**\n\n**Payment Failed?**\n✅ Check card details (number, CVV, expiry)\n✅ Ensure sufficient balance\n✅ Try different payment method\n✅ Check if international payments enabled\n✅ Contact your bank\n✅ Try UPI/Net Banking instead\n\n**Paid But No Premium Access?**\n1. Check payment confirmation email\n2. Refresh page or logout/login\n3. Wait 5-10 minutes for processing\n4. Check Profile → Premium Status\n5. Screenshot payment & contact admin\n\n**Premium Expired Early?**\n• Check exact expiry date in Profile\n• Timezone difference may show different date\n• Auto-renewal might have failed\n• Contact admin with payment proof\n\n**Refund Request?**\n• Check refund policy (usually 7-14 days)\n• Contact admin with:\n  - Payment screenshot\n  - Reason for refund\n  - Transaction ID\n• Processing takes 5-7 business days\n\n**Subscription Not Canceling?**\n• Go to Profile → Manage Premium\n• Click "Cancel Subscription"\n• You\'ll have access till expiry date\n• Confirm cancellation email received\n\n**Want to Upgrade?**\n• Contact admin for upgrade options\n• Difference amount may be adjusted';
      }
      
      // Profile/Account issues
      if (msg.includes('profile') || msg.includes('account') || msg.includes('photo') || msg.includes('update')) {
        return '👤 **Profile & Account Issues - Solutions:**\n\n**Can\'t Update Profile?**\n✅ Check image size (max 2MB)\n✅ Use JPG/PNG format only\n✅ Fill all required fields\n✅ Refresh page after saving\n✅ Try different browser\n\n**Profile Picture Not Showing?**\n• Image might be too large (compress it)\n• Clear browser cache\n• Wait few seconds for upload\n• Check if image format supported\n• Try uploading again\n\n**Email Not Updating?**\n• Email verification required\n• Check inbox for confirmation link\n• Old email must be verified first\n• Contact admin for email change\n\n**Can\'t Change Password?**\n1. Ensure old password is correct\n2. New password must meet requirements:\n   - At least 8 characters\n   - One uppercase letter\n   - One number\n3. Old and new can\'t be same\n4. Use "Forgot Password" if old password unknown\n\n**Account Details Wrong?**\n• Some fields locked (name, email)\n• Contact admin to change locked fields\n• Provide ID proof for verification\n\n**Data Not Saving?**\n• Check internet connection\n• Look for error message\n• Try clicking Save multiple times\n• Screenshot issue and contact admin';
      }
      
      // Performance/Speed issues
      if (msg.includes('slow') || msg.includes('lag') || msg.includes('freeze') || msg.includes('crash')) {
        return '⚡ **Performance & Speed Issues - Solutions:**\n\n**Website Loading Slow?**\n✅ Check internet speed (use fast.com)\n✅ Clear browser cache and cookies\n✅ Disable browser extensions temporarily\n✅ Close unused tabs\n✅ Try different browser (Chrome/Edge)\n✅ Restart browser\n\n**Page Freezing/Crashing?**\n• Close other applications\n• Check RAM usage (Task Manager)\n• Update browser to latest version\n• Disable hardware acceleration:\n  Chrome: Settings → Advanced → System\n• Try incognito mode\n\n**Images Not Loading?**\n1. Hard refresh: Ctrl+Shift+R\n2. Check internet connection\n3. Disable ad blocker\n4. Clear cache\n5. Check browser console for errors (F12)\n\n**Buttons Not Clicking?**\n• JavaScript might be disabled - enable it\n• Browser extension blocking clicks\n• Try incognito mode\n• Update browser\n\n**Quick Fixes**:\n🔧 Clear cache: Ctrl+Shift+Delete\n🔧 Hard refresh: Ctrl+Shift+R\n🔧 Restart browser completely\n🔧 Try incognito: Ctrl+Shift+N\n🔧 Check console errors: F12\n\n**Still Slow?**\n• Might be server issue\n• Try after some time\n• Use mobile app if available';
      }
      
      // Notification issues
      if (msg.includes('notification') || msg.includes('alert') || msg.includes('message')) {
        return '🔔 **Notification & Message Issues - Solutions:**\n\n**Not Receiving Notifications?**\n✅ Check browser notification permissions\n✅ Enable notifications in Profile settings\n✅ Check spam/junk folder for emails\n✅ Verify email address is correct\n✅ Add platform to safe senders list\n\n**Too Many Notifications?**\n• Go to Profile → Settings\n• Customize notification preferences\n• Unsubscribe from emails (link at bottom)\n• Mute specific notification types\n\n**Push Notifications Not Working?**\n1. Check browser permissions:\n   Chrome: Settings → Privacy → Site Settings → Notifications\n2. Allow notifications when prompted\n3. Check system notification settings\n4. Disable "Do Not Disturb" mode\n\n**Email Notifications Delayed?**\n• Email servers can delay 5-30 minutes\n• Check spam folder\n• Whitelist our email domain\n• Check email filters\n\n**Can\'t Read Messages?**\n• Refresh page\n• Check internet connection\n• Clear cache\n• Try different device\n\n**Mark as Read Not Working?**\n• Click the notification/message again\n• Refresh the page\n• Check internet connection';
      }
      
      // Live class issues
      if (msg.includes('live') || msg.includes('class') || msg.includes('jitsi') || msg.includes('meeting') || msg.includes('join')) {
        return '🎥 **Live Class & Meeting Issues - Solutions:**\n\n**Can\'t Join Live Class?**\n✅ Check if you\'re invited to session\n✅ Verify premium membership active\n✅ Use desktop/laptop (better experience)\n✅ Allow camera/microphone permissions\n✅ Check internet speed (3+ Mbps needed)\n\n**Camera/Microphone Not Working?**\n1. Allow browser permissions when prompted\n2. Chrome: Click 🔒 icon → Site settings → Allow camera/mic\n3. Check system settings:\n   Windows: Settings → Privacy → Camera/Microphone\n   Mac: System Preferences → Security → Camera/Microphone\n4. Close other apps using camera (Zoom, Teams)\n5. Try different browser\n\n**Audio Issues?**\n• Check if muted in meeting\n• Test speakers/headphones\n• Check system volume\n• Update audio drivers\n• Try different audio device\n\n**Video Freezing/Lagging?**\n• Close unused tabs\n• Stop video, enable audio only\n• Check bandwidth (close downloads)\n• Move closer to WiFi router\n• Disable other video streams\n\n**Kicked Out of Meeting?**\n• Might be internet disconnection\n• Refresh and rejoin\n• Teacher might have ended session\n• Check if meeting time is over\n\n**Can\'t Share Screen?**\n• Allow screen sharing permission\n• Click "Share Screen" button\n• Select window/screen to share\n• Check if feature enabled for students\n\n**Meeting Link Not Working?**\n• Copy-paste full link (don\'t type)\n• Open in desktop browser (not mobile)\n• Check if link expired\n• Contact teacher for new link';
      }
      
      // General technical issues
      return '🛠️ **General Technical Support:**\n\n**Common Quick Fixes**:\n\n**1. Clear Browser Cache**\n• Chrome: Ctrl+Shift+Delete → Clear data\n• Edge: Ctrl+Shift+Delete → Cached images\n• Firefox: Ctrl+Shift+Delete → Cookies & Cache\n\n**2. Hard Refresh Page**\n• Windows: Ctrl+Shift+R\n• Mac: Cmd+Shift+R\n• Bypasses cache, loads fresh\n\n**3. Try Incognito Mode**\n• Chrome: Ctrl+Shift+N\n• Tests without extensions/cache\n\n**4. Disable Extensions**\n• Ad blockers often cause issues\n• Disable one by one to find culprit\n\n**5. Update Browser**\n• Chrome: Settings → About Chrome\n• Always use latest version\n\n**6. Try Different Browser**\n• Recommended: Chrome, Edge, Firefox\n• Safari on Mac works well\n\n**7. Check Console Errors**\n• Press F12 → Console tab\n• Screenshot errors for support\n\n**Still Having Issues?**\n📧 Contact Support:\n• Go to Profile → Help/Support\n• Describe issue clearly\n• Include screenshots\n• Mention browser & device\n• Response within 24 hours\n\n**Can you describe your specific problem?**\nMention: login, payment, course, exam, video, etc.';
    }
    
    // School students / 10th class guidance
    if (msg.includes('10th') || msg.includes('tenth') || msg.includes('school') || msg.includes('student') && (msg.includes('class') || msg.includes('grade'))) {
      return '🎓 **Great to see you planning early! Here\'s your roadmap from 10th class:**\n\n**Immediate Steps (10th Class)**:\n1. **Focus on Basics**: Math, Science, English are foundation\n2. **Explore Interests**: Try coding, designing, writing\n3. **Build Study Habits**: Time management is key\n4. **Start Learning**: Basic computer skills, typing\n\n**After 10th - Stream Selection**:\n• **Science**: Engineering, Medicine, Research\n• **Commerce**: CA, Business, Finance\n• **Arts/Humanities**: Design, Law, Psychology\n\n**Tech Path? Start Now**:\n✅ Learn Scratch/Python basics (free on Khan Academy)\n✅ Try making simple websites (HTML/CSS)\n✅ Solve puzzles on CodeChef Schools\n✅ Watch tech career videos on YouTube\n\n**Pro Tips**:\n💡 Your 11th-12th stream isn\'t final - you can pivot\n💡 Soft skills matter: Communication, Problem-solving\n💡 Build projects, not just theory\n\nWhat interests you most? 🚀';
    }
    
    // 11th/12th class guidance
    if (msg.includes('11th') || msg.includes('12th') || msg.includes('eleventh') || msg.includes('twelfth') || msg.includes('intermediate')) {
      return '📚 **11th-12th is crucial! Here\'s your action plan:**\n\n**If you\'re in SCIENCE**:\n• **For Engineering**: Focus on JEE/BITSAT prep + coding\n• **For Medicine**: NEET prep + biology mastery\n• **For Research**: Strong conceptual clarity\n\n**If you\'re in COMMERCE**:\n• **CA Path**: Start CPT/Foundation early\n• **BBA/MBA**: Work on communication skills\n• **Economics**: Consider ISI/DSE exams\n\n**Parallel Actions (All Streams)**:\n1. **Build Digital Skills**: MS Office, basic coding\n2. **Start Projects**: Personal blog, small business\n3. **Certifications**: Google Digital Marketing, Coursera\n4. **English Proficiency**: Read, write, speak daily\n5. **Entrance Exam Prep**: Start early, stay consistent\n\n**Tech Interest?**\nStart with:\n• Python Programming (Coursera)\n• Web Development (freeCodeCamp)\n• Build a portfolio website\n\n**Timeline**:\n📅 11th: Explore & build foundation\n📅 12th: Focus on entrance exams + backup skills\n\nNeed specific stream advice?';
    }
    
    // College/graduation guidance
    if (msg.includes('college') || msg.includes('graduation') || msg.includes('degree') || msg.includes('btech') || msg.includes('engineering')) {
      return '🎓 **College Success Roadmap:**\n\n**Year 1 (Foundation)**:\n• Master programming basics (C, Python, Java)\n• Build strong DSA foundation\n• Join coding clubs, hackathons\n• Start GitHub portfolio\n• Maintain 8+ CGPA\n\n**Year 2 (Exploration)**:\n• Choose specialization (Web, AI, Mobile, etc.)\n• Do 1-2 small projects\n• Learn Git, Linux basics\n• Apply for Google Summer of Code\n• Start LeetCode (easy problems)\n\n**Year 3 (Preparation)**:\n• Build 2-3 major projects\n• Contribute to open source\n• Internship hunting (start early!)\n• Interview prep: DSA + system design\n• Attend tech conferences\n\n**Year 4 (Placement)**:\n• Complete capstone project\n• Full-time placement preparation\n• Resume polishing\n• Mock interviews\n• Multiple job applications\n\n**Beyond Academics**:\n• Internships > Certifications > Competitions\n• Network with seniors & alumni\n• Side projects show passion\n• Build online presence (LinkedIn, GitHub)\n\nCurrent year? I\'ll give specific advice!';
    }
    
    // Career change / switching
    if (msg.includes('switch') || msg.includes('change career') || msg.includes('transition')) {
      return '🔄 **Career Switch Guide:**\n\n**Step 1: Self-Assessment**\n• Why switch? (Growth, interest, salary?)\n• What skills do you have?\n• What interests you?\n• Financial runway (3-6 months savings)\n\n**Step 2: Research & Plan**\n• Research target role thoroughly\n• Identify skill gaps\n• Make learning roadmap (3-6 months)\n• Connect with people in that field\n\n**Step 3: Build Transition Bridge**\n• Learn evenings/weekends\n• Build portfolio projects\n• Freelance/intern in new field\n• Get certifications if helpful\n\n**Step 4: Apply Strategically**\n• Leverage transferable skills\n• Build narrative: "Why I\'m switching"\n• Network heavily (LinkedIn, events)\n• Consider lower initial role to break in\n\n**Common Switches**:\n• Any field → Tech: 6-12 months preparation\n• Tech → Data Science: 4-6 months\n• Marketing → Product: Leverage existing skills\n\n**Reality Check**:\n⚠️ Initial salary might dip\n✅ Long-term growth is worth it\n✅ Age is not a barrier\n\nWhat field are you considering?';
    }
    
    // Freelancing and side income
    if (msg.includes('freelance') || msg.includes('side hustle') || msg.includes('extra income') || msg.includes('part time')) {
      return '💼 **Freelancing & Side Income Guide:**\n\n**High-Demand Freelance Skills**:\n1. **Web Development** (₹500-5000/hour)\n2. **Graphic Design** (₹300-2000/project)\n3. **Content Writing** (₹1-5 per word)\n4. **Video Editing** (₹500-3000/video)\n5. **Digital Marketing** (₹10k-50k/month)\n6. **Tutoring** (₹500-2000/hour)\n\n**Best Platforms**:\n🌐 International: Upwork, Fiverr, Toptal\n🇮🇳 Indian: Internshala, Freelancer.in\n💻 Tech: GitHub Jobs, AngelList\n\n**Getting Started**:\n✅ Pick ONE skill to master\n✅ Build portfolio (3-5 projects)\n✅ Start with low rates to get reviews\n✅ Over-deliver on first projects\n✅ Gradually increase rates\n\n**Time Management**:\n• Evenings: 2-3 hours\n• Weekends: 4-6 hours\n• Set clear boundaries with clients\n\n**From Side Hustle to Full-Time**:\n📈 Year 1: Build portfolio + skills\n📈 Year 2: Increase rates + clients\n📈 Year 3: Consider full-time freelance\n\n**Pro Tips**:\n💡 Communication > Technical skills\n💡 Deliver before deadline\n💡 Build repeat client relationships\n\nWhich skill interests you?';
    }
    
    // Entrepreneurship and startup
    if (msg.includes('startup') || msg.includes('business') || msg.includes('entrepreneur') || msg.includes('own company')) {
      return '🚀 **Startup & Entrepreneurship Guide:**\n\n**Before Starting**:\n✅ Solve a real problem (not just an idea)\n✅ Validate with 10-20 potential customers\n✅ Build MVP (Minimum Viable Product)\n✅ Have 6-12 months runway\n\n**Startup Stages**:\n**Stage 1: Idea → Validation** (3-6 months)\n• Customer interviews\n• Market research\n• Competitor analysis\n• Build landing page\n\n**Stage 2: MVP → First Customers** (6-12 months)\n• Build basic product\n• Get 10-50 paying customers\n• Iterate based on feedback\n• Bootstrap if possible\n\n**Stage 3: Product-Market Fit** (12-24 months)\n• Scale what works\n• Hire small team\n• Consider funding (if needed)\n• Focus on retention\n\n**Essential Skills**:\n1. **Product**: Build/manage development\n2. **Sales**: Sell your vision\n3. **Marketing**: Growth & distribution\n4. **Finance**: Basic accounting\n\n**Funding Options**:\n💰 Bootstrapping (recommended first)\n💰 Friends & Family\n💰 Angel Investors\n💰 Incubators (Y Combinator, Sequoia Surge)\n💰 VCs (later stage)\n\n**Reality Check**:\n⚠️ 90% startups fail\n⚠️ Takes 3-5 years to see success\n✅ Learning is invaluable\n✅ Network is everything\n\n**Resources**:\n• Y Combinator Startup School (free)\n• "Zero to One" by Peter Thiel\n• "The Lean Startup" by Eric Ries\n\nWhat\'s your startup idea about?';
    }
    
    // Career path questions
    if (msg.includes('software') || msg.includes('developer') || msg.includes('programmer')) {
      return 'Great choice! Software development is one of the most in-demand careers. Here\'s a roadmap:\n\n1. **Learn the Basics**: Start with Python or JavaScript\n2. **Master Data Structures & Algorithms**: Essential for interviews\n3. **Build Projects**: GitHub portfolio is crucial\n4. **Learn Frameworks**: React, Node.js, Django\n5. **Contribute to Open Source**: Shows collaboration skills\n6. **Prepare for Interviews**: LeetCode, HackerRank\n\nAverage starting salary: ₹4-8 LPA in India\nTop companies: Google, Microsoft, Amazon, Flipkart';
    }
    
    if (msg.includes('data scien') || msg.includes('machine learning') || msg.includes('ai')) {
      return 'Data Science/AI is booming! Here\'s your learning path:\n\n1. **Math Foundation**: Statistics, Linear Algebra, Probability\n2. **Programming**: Python (NumPy, Pandas, Scikit-learn)\n3. **Machine Learning**: Supervised/Unsupervised learning\n4. **Deep Learning**: TensorFlow, PyTorch\n5. **Projects**: Kaggle competitions, real datasets\n6. **Specialization**: NLP, Computer Vision, or MLOps\n\nAverage salary: ₹6-12 LPA\nCertifications: Google ML, AWS ML, IBM Data Science';
    }
    
    if (msg.includes('web dev') || msg.includes('frontend') || msg.includes('backend')) {
      return 'Web Development offers great opportunities!\n\n**Frontend Path**:\n• HTML, CSS, JavaScript\n• React.js or Vue.js\n• Tailwind CSS or Bootstrap\n• TypeScript\n\n**Backend Path**:\n• Node.js + Express\n• Python + Django/Flask\n• Java + Spring Boot\n• Databases (SQL, MongoDB)\n\n**Full Stack**: Combine both!\n\nSalary range: ₹3-10 LPA based on skills';
    }
    
    if (msg.includes('cyber') || msg.includes('security') || msg.includes('ethical hack')) {
      return 'Cybersecurity is critical and growing fast!\n\n**Learning Path**:\n1. Networking fundamentals (TCP/IP, DNS)\n2. Operating Systems (Linux is essential)\n3. Programming: Python, Bash scripting\n4. Security concepts: Encryption, Authentication\n5. Tools: Wireshark, Metasploit, Burp Suite\n6. Certifications: CEH, CompTIA Security+, OSCP\n\nRoles: Penetration Tester, SOC Analyst, Security Engineer\nSalary: ₹5-15 LPA';
    }
    
    // Resume and interview questions
    if (msg.includes('resume') || msg.includes('cv')) {
      return '**Resume Building Tips**:\n\n✅ Keep it 1-2 pages\n✅ Use action verbs (Built, Designed, Implemented)\n✅ Quantify achievements (Improved performance by 30%)\n✅ Include projects with GitHub links\n✅ List relevant skills and technologies\n✅ Add certifications and achievements\n✅ Proofread for errors\n\n❌ Avoid: Photos, too many colors, typos, irrelevant info\n\nTools: Overleaf (LaTeX), Canva, Resume.io';
    }
    
    if (msg.includes('interview')) {
      return '**Interview Preparation Guide**:\n\n**Before Interview**:\n• Research the company thoroughly\n• Review job description\n• Prepare your projects explanation\n• Practice coding problems\n• Prepare questions to ask\n\n**During Interview**:\n• Dress professionally\n• Arrive/join 10 mins early\n• Think aloud while solving problems\n• Ask clarifying questions\n• Show enthusiasm\n\n**Common Questions**:\n• Tell me about yourself\n• Why this company?\n• Your strengths/weaknesses\n• Describe a challenging project\n\nPractice on: Pramp, interviewing.io';
    }
    
    // Skills and learning
    if (msg.includes('learn') || msg.includes('skill') || msg.includes('course')) {
      return '**Top Skills for 2026**:\n\n1. **Programming**: Python, JavaScript, Java\n2. **Cloud**: AWS, Azure, GCP\n3. **DevOps**: Docker, Kubernetes, CI/CD\n4. **AI/ML**: TensorFlow, PyTorch\n5. **Blockchain**: Web3, Smart Contracts\n6. **Mobile Dev**: React Native, Flutter\n\n**Best Learning Platforms**:\n• Coursera (University courses)\n• Udemy (Practical projects)\n• freeCodeCamp (Free coding)\n• YouTube (Traversy Media, Fireship)\n• LeetCode (Interview prep)';
    }
    
    if (msg.includes('salary') || msg.includes('pay') || msg.includes('compensation')) {
      return '**Tech Industry Salary Guide (India)**:\n\n**Freshers (0-2 years)**:\n• Software Developer: ₹3-8 LPA\n• Data Analyst: ₹4-7 LPA\n• UI/UX Designer: ₹3-6 LPA\n• QA Engineer: ₹3-5 LPA\n\n**Mid-Level (3-5 years)**:\n• Senior Developer: ₹8-20 LPA\n• ML Engineer: ₹10-25 LPA\n• DevOps Engineer: ₹8-18 LPA\n\n**Top Companies**: Product-based > Service-based\n**Location**: Bangalore > Hyderabad > Pune > Others\n\nRemember: Salary grows with skills, not just years!';
    }
    
    // Mobile app development
    if (msg.includes('mobile') || msg.includes('app dev') || msg.includes('android') || msg.includes('ios') || msg.includes('flutter') || msg.includes('react native')) {
      return '📱 **Mobile App Development Path:**\n\n**Choose Your Stack**:\n\n**1. Cross-Platform (Recommended for beginners)**\n• **Flutter** (Google): Dart language, beautiful UI\n• **React Native** (Facebook): JavaScript, large community\n• One codebase = Android + iOS\n\n**2. Native Development**\n• **Android**: Kotlin/Java + Android Studio\n• **iOS**: Swift + Xcode (needs Mac)\n• Better performance, platform-specific features\n\n**Learning Roadmap (Flutter)**:\n1. Learn Dart basics (1 week)\n2. Flutter widgets & layouts (2 weeks)\n3. State management (GetX/Provider) (1 week)\n4. APIs & Firebase (1 week)\n5. Build 3-5 apps (1-2 months)\n\n**Project Ideas**:\n• Todo app with local storage\n• Weather app using API\n• Chat app with Firebase\n• E-commerce UI clone\n\n**Monetization**:\n💰 Freelance: ₹10k-50k per app\n💰 Job: ₹4-10 LPA fresher\n💰 Publish apps (ads/in-app purchases)\n\n**Resources**:\n• Flutter documentation (best resource)\n• YouTube: The Net Ninja, Traversy Media\n• Build real apps, not tutorials!';
    }
    
    // Cloud computing and DevOps
    if (msg.includes('cloud') || msg.includes('aws') || msg.includes('azure') || msg.includes('devops') || msg.includes('docker') || msg.includes('kubernetes')) {
      return '☁️ **Cloud & DevOps Career Guide:**\n\n**Why Cloud/DevOps?**\n• Huge demand (every company needs it)\n• High salaries (₹6-25 LPA)\n• Remote work friendly\n• Continuous learning\n\n**Cloud Platforms (Pick One First)**:\n1. **AWS** (most popular, 32% market)\n2. **Azure** (Microsoft ecosystem)\n3. **GCP** (Google, ML/AI focus)\n\n**DevOps Learning Path**:\n**Month 1-2**: Linux + Bash scripting\n**Month 3**: Git & GitHub advanced\n**Month 4**: Docker (containers)\n**Month 5**: Kubernetes (orchestration)\n**Month 6**: CI/CD (Jenkins/GitLab)\n**Month 7**: Cloud (AWS basics)\n**Month 8**: Terraform (Infrastructure as Code)\n\n**Key Concepts**:\n✅ Automation > Manual work\n✅ CI/CD pipelines\n✅ Container orchestration\n✅ Monitoring & logging\n✅ Security best practices\n\n**Certifications Worth It**:\n• AWS Solutions Architect Associate\n• Azure Administrator\n• Certified Kubernetes Administrator (CKA)\n\n**Career Path**:\n📈 Junior DevOps → DevOps Engineer → SRE → Cloud Architect\n\n**Pro Tip**: Build projects! Deploy your own apps using these tools.';
    }
    
    // UI/UX Design
    if (msg.includes('design') || msg.includes('ui') || msg.includes('ux') || msg.includes('figma')) {
      return '🎨 **UI/UX Design Career Path:**\n\n**UI vs UX**:\n• **UI**: Visual design, colors, typography\n• **UX**: User research, wireframes, user flow\n• Best designers do both!\n\n**Learning Roadmap**:\n**Week 1-2**: Design principles (color, typography, layout)\n**Week 3-4**: Figma basics (must-learn tool)\n**Week 5-6**: UX research & wireframing\n**Week 7-8**: Prototyping & interactions\n**Month 3**: Build 5-10 design projects\n**Month 4+**: Real client work or redesigns\n\n**Must-Learn Tools**:\n• **Figma** (industry standard, free)\n• **Adobe XD** (alternative)\n• **Photoshop/Illustrator** (graphics)\n• **Principle/After Effects** (animations)\n\n**Portfolio Projects**:\n1. Mobile app design (3-5 screens)\n2. Website landing page\n3. Dashboard/admin panel\n4. App redesign (Uber, Zomato)\n5. Case study with process\n\n**Getting Clients**:\n💼 Freelance: Fiverr, Upwork (₹500-5000/screen)\n💼 Dribbble/Behance (showcase work)\n💼 Cold outreach to startups\n\n**Salary Range**:\n• Fresher: ₹3-6 LPA\n• 2-3 years: ₹6-12 LPA\n• Senior: ₹12-25 LPA\n\n**Free Resources**:\n• Figma Community (free templates)\n• YouTube: DesignCourse, Flux\n• Daily UI challenge (100 days)';
    }
    
    // Certifications
    if (msg.includes('certificate') || msg.includes('certification')) {
      return '📜 **Worth-It Certifications Guide:**\n\n**Most Valuable** (Actually help with jobs):\n\n**Cloud**:\n✅ AWS Solutions Architect (₹5k exam)\n✅ Azure Administrator (₹5k)\n✅ Google Cloud Engineer (₹7k)\n\n**Programming**:\n✅ Oracle Java Certification\n✅ Python Institute PCAP\n✅ Microsoft Azure Developer\n\n**Data Science/AI**:\n✅ Google Data Analytics (Coursera)\n✅ IBM Data Science (Coursera)\n✅ TensorFlow Developer Certificate\n\n**Cybersecurity**:\n✅ CompTIA Security+ (₹25k)\n✅ CEH - Certified Ethical Hacker (₹40k)\n✅ CISSP (for experienced)\n\n**Project Management**:\n✅ PMP (₹35k, needs experience)\n✅ Scrum Master (CSM)\n\n**FREE but Valuable**:\n• Google Digital Marketing\n• freeCodeCamp certifications\n• HackerRank/LeetCode badges\n• GitHub contributions\n\n**Reality Check**:\n❌ Certifications alone won\'t get jobs\n✅ Certifications + Projects + Skills = Job\n✅ Learn for knowledge, certificate is bonus\n\n**Priority**: Projects > Certifications > Degree\n\nWhich field interests you?';
    }
    
    // Remote work and work from home
    if (msg.includes('remote') || msg.includes('work from home') || msg.includes('wfh')) {
      return '🏠 **Remote Work & WFH Guide:**\n\n**Best Remote-Friendly Careers**:\n1. **Software Development** (highest demand)\n2. **Content Writing** (very flexible)\n3. **Digital Marketing** (results-based)\n4. **Graphic Design** (project-based)\n5. **Data Analysis** (async work)\n6. **Customer Support** (many openings)\n\n**Finding Remote Jobs**:\n🌍 **International**:\n• Remote.co\n• We Work Remotely\n• AngelList (startups)\n• LinkedIn (filter: Remote)\n\n🇮🇳 **Indian**:\n• Internshala (WFH filter)\n• Naukri (remote jobs)\n• Instahyre\n\n**Skills for Remote Work**:\n✅ Self-discipline & time management\n✅ Written communication (over-communicate!)\n✅ Video call etiquette\n✅ Async collaboration\n✅ Time zone awareness\n\n**Remote Setup Essentials**:\n💻 Good laptop/desktop\n🎧 Headphones with mic\n📶 Stable internet (backup 4G)\n💡 Proper lighting for calls\n🪑 Ergonomic chair\n\n**Salary Expectations**:\n• Indian companies: Same as office\n• International: 2-4x Indian salaries (USD)\n• Freelance: Project-based\n\n**Challenges**:\n⚠️ Work-life balance harder\n⚠️ Isolation (join communities)\n⚠️ Communication gaps\n\n**Pro Tip**: Start with hybrid, then full remote!';
    }
    
    // Programming languages comparison
    if (msg.includes('which language') || msg.includes('best programming') || msg.includes('python vs') || msg.includes('java vs')) {
      return '💻 **Programming Language Guide:**\n\n**For Beginners - Start With**:\n🥇 **Python**: Easy, versatile, high demand\n• Web dev, AI/ML, automation\n• Great first language\n\n**By Career Path**:\n\n**Web Development**:\n• **JavaScript** (mandatory for frontend)\n• **Python/Node.js** (backend)\n• **PHP** (WordPress, still relevant)\n\n**Mobile Apps**:\n• **Dart** (Flutter - cross-platform)\n• **Kotlin** (Android native)\n• **Swift** (iOS native)\n\n**Data Science/AI**:\n• **Python** (industry standard)\n• **R** (statistics & research)\n• **Julia** (performance)\n\n**Systems/Performance**:\n• **Rust** (modern, safe)\n• **C++** (gaming, systems)\n• **Go** (cloud, backend)\n\n**Enterprise/Jobs**:\n• **Java** (most job openings)\n• **C#** (Microsoft stack)\n• **JavaScript** (web everywhere)\n\n**Salary by Language** (India avg):\n1. Go: ₹8-15 LPA\n2. Rust: ₹7-14 LPA\n3. Python: ₹5-12 LPA\n4. Java: ₹4-10 LPA\n5. JavaScript: ₹4-10 LPA\n\n**Reality Check**:\n💡 Language doesn\'t matter much - logic does!\n💡 Learn one well > know many poorly\n💡 Focus on problem-solving\n💡 Can switch languages in 2-4 weeks\n\n**Recommendation**: Python first, then JavaScript!';
    }
    
    // Portfolio and GitHub
    if (msg.includes('portfolio') || msg.includes('github') || msg.includes('project')) {
      return '📂 **Portfolio & GitHub Guide:**\n\n**Why Portfolio Matters**:\n• Proof of skills > Certificates\n• Shows practical experience\n• Differentiates you from others\n• Talking points in interviews\n\n**GitHub Best Practices**:\n✅ **README.md**: Explain each project clearly\n✅ **Regular commits**: Show consistency\n✅ **Good commit messages**: Describe changes\n✅ **Live demos**: Deploy projects (Netlify, Vercel)\n✅ **Code quality**: Clean, commented code\n\n**Must-Have Projects** (Developer):\n1. **Personal Portfolio Website**\n   • About, projects, contact\n   • Deploy on Netlify/Vercel\n\n2. **Full-Stack CRUD App**\n   • Todo, blog, or e-commerce\n   • Frontend + Backend + Database\n\n3. **API Integration Project**\n   • Weather, movies, crypto tracker\n   • Shows API handling skills\n\n4. **Unique/Creative Project**\n   • Solves real problem\n   • Shows initiative\n\n**Portfolio Website Essentials**:\n📄 Clean design (simple > fancy)\n📄 About section (skills, experience)\n📄 Projects with live links\n📄 Contact info & resume download\n📄 Links to GitHub, LinkedIn\n\n**Common Mistakes**:\n❌ Tutorial hell (too many courses)\n❌ No live demos\n❌ Poor README files\n❌ Copying code without understanding\n\n**Tools to Build Portfolio**:\n• React/Next.js (developers)\n• WordPress (quick & easy)\n• Wix/Webflow (no-code)\n\n**Pro Tip**: Quality > Quantity\n3 great projects > 10 mediocre ones!';
    }
    
    // Networking and LinkedIn
    if (msg.includes('network') || msg.includes('linkedin') || msg.includes('connect')) {
      return '🤝 **Networking & LinkedIn Strategy:**\n\n**Why Networking Matters**:\n• 80% jobs never advertised publicly\n• Referrals = 10x better chance\n• Learn from experienced people\n• Find mentors\n\n**LinkedIn Profile Optimization**:\n✅ **Photo**: Professional, clear face\n✅ **Headline**: Role + Skills (not just "Student")\n   • Ex: "Aspiring Software Developer | Python, React | BTech CSE"\n✅ **About**: Your story, goals, skills\n✅ **Experience**: Projects, internships, achievements\n✅ **Skills**: Top 10 relevant skills\n✅ **Recommendations**: Ask mentors, peers\n\n**Content Strategy**:\n📝 Post 2-3 times per week:\n• What you\'re learning\n• Projects you built\n• Tech insights\n• Share others\' content with thoughts\n\n**Networking Tips**:\n1. **Connect with purpose**: Personalized message\n2. **Engage**: Comment on posts (add value)\n3. **DM strategy**: Help > Ask\n4. **Alumni network**: Connect with seniors\n5. **Events**: Attend meetups, hackathons\n\n**Message Template** (Cold outreach):\n"Hi [Name], I\'m a [your role] passionate about [field]. I admire your work in [specific thing]. Would love to learn from your experience. Could we connect?"\n\n**Building Relationships**:\n✅ Offer help first\n✅ Share valuable resources\n✅ Follow up occasionally\n✅ Be genuine, not transactional\n\n**Beyond LinkedIn**:\n• Twitter (tech community)\n• Dev.to (write articles)\n• Discord/Slack (developer communities)\n• Local meetups\n\n**Reality**: Networking feels awkward initially - everyone feels this! Start small, be authentic.';
    }
    
    // Study techniques and productivity
    if (msg.includes('study') || msg.includes('learn faster') || msg.includes('productive') || msg.includes('focus')) {
      return '📚 **Study Techniques & Productivity:**\n\n**Effective Learning Methods**:\n\n**1. Feynman Technique**\n• Learn concept\n• Explain to 10-year-old\n• Identify gaps\n• Review & simplify\n\n**2. Active Recall**\n• Don\'t just re-read\n• Test yourself constantly\n• Use flashcards (Anki app)\n• Explain without notes\n\n**3. Spaced Repetition**\n• Review after: 1 day → 3 days → 1 week → 1 month\n• Prevents forgetting\n• Use apps: Anki, Quizlet\n\n**4. Pomodoro Technique**\n• 25 min focused work\n• 5 min break\n• After 4 cycles: 15-30 min break\n• Use: Focus To-Do app\n\n**Daily Study Schedule**:\n🌅 **Morning (2-3 hours)**\n• Hardest topic (brain fresh)\n• Theory & concepts\n\n☀️ **Afternoon (1-2 hours)**\n• Practice problems\n• Coding/exercises\n\n🌙 **Evening (1-2 hours)**\n• Projects\n• Review day\'s learning\n\n**Productivity Tools**:\n📱 **Focus**: Forest, Freedom (block distractions)\n📝 **Notes**: Notion, Obsidian\n⏱️ **Time**: Toggl, RescueTime\n✅ **Tasks**: Todoist, TickTick\n\n**Study Environment**:\n✅ Dedicated space\n✅ Good lighting\n✅ Phone on silent/away\n✅ Comfortable but not too cozy\n\n**Avoid These**:\n❌ Multitasking (kills focus)\n❌ Passive reading/watching\n❌ All-nighters (retention drops)\n❌ Perfectionism (done > perfect)\n\n**Energy Management**:\n😴 Sleep 7-8 hours (non-negotiable)\n🏃 Exercise 30min daily\n🥗 Healthy meals\n💧 Stay hydrated\n\n**When Stuck**:\n• Take break, come back fresh\n• Explain problem to rubber duck\n• Google error messages\n• Ask in communities\n\nRemember: Consistency > Intensity!';
    }
    
    // Default response
    return 'That\'s an interesting question! Here are some ways I can help you:\n\n🎯 **Career Guidance**: Ask about specific career paths (software developer, data scientist, web developer, etc.)\n\n📚 **Learning**: Skills to learn, courses, certifications\n\n💼 **Job Prep**: Resume tips, interview preparation\n\n💰 **Salary Info**: Industry salary ranges\n\n🚀 **Roadmaps**: Step-by-step learning paths\n\nTry asking something like:\n• "How do I become a software developer?"\n• "What skills do I need for data science?"\n• "How to prepare for technical interviews?"\n• "Resume building tips?"';
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const aiResponse = {
        role: 'assistant',
        content: getCareerGuidanceResponse(input),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setLoading(false);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-white" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Premium Feature</h2>
          <p className="text-gray-600 mb-6">
            Career Guidance AI Chatbot is available exclusively for premium members. 
            Upgrade now to get personalized career advice, learning roadmaps, and interview preparation tips!
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-amber-800 font-semibold mb-2">
              <Crown size={20} />
              <span>Premium Benefits</span>
            </div>
            <ul className="text-sm text-amber-700 text-left space-y-2">
              <li>✓ 24/7 AI Career Guidance</li>
              <li>✓ Personalized Learning Roadmaps</li>
              <li>✓ Interview Preparation Tips</li>
              <li>✓ Resume & Portfolio Advice</li>
              <li>✓ Industry Insights & Trends</li>
            </ul>
          </div>
          <button
            onClick={() => navigate('/app/payment')}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition"
          >
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
              <Bot className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Career Mentorship AI</h1>
              <p className="text-sm text-gray-500">Your personal career advisor</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-semibold">
            <Crown size={16} />
            Premium
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-blue-500' 
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600'
              }`}>
                {message.role === 'user' ? (
                  <User className="text-white" size={18} />
                ) : (
                  <Bot className="text-white" size={18} />
                )}
              </div>
              <div className={`flex-1 max-w-2xl ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white shadow-md border border-gray-200'
                }`}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>
                  <p className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {message.timestamp.toLocaleTimeString('en-IN', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="text-white" size={18} />
              </div>
              <div className="bg-white shadow-md border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about career guidance, skills, interviews..."
              rows="1"
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Press Enter to send • Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default CareerChatbot;
