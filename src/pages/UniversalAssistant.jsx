import React, { useEffect, useRef, useState } from 'react';
import { Bot, Brain, Send, Sparkles, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateAssistantReply } from '../utils/aiAssistant';

const SUGGESTIONS = [
  'Explain time management for students',
  'Give me a 30-day coding roadmap',
  'How do I prepare for interviews?',
  'Best way to improve communication skills',
];

const FALLBACK_REPLY = (question) => {
  const text = String(question || '').toLowerCase();

  if (text.includes('interview')) {
    return 'Start with role basics, common questions, 2-3 strong project stories, and daily mock practice. Focus on clarity, structure, and examples from your own work.';
  }

  if (text.includes('roadmap') || text.includes('plan')) {
    return 'Break the goal into weekly milestones, practice every day, build one small project per stage, and review progress every weekend.';
  }

  if (text.includes('communication')) {
    return 'Improve by speaking daily, reading aloud, recording yourself, and answering one topic in a clear start-middle-end structure.';
  }

  return 'Ask a specific question and include your goal, current level, and deadline. That usually gives the most useful answer.';
};

const UniversalAssistant = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Ask anything: study plans, careers, skills, productivity, interviews, communication, projects, or general learning guidance.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const value = String(text || input).trim();
    if (!value || loading) return;

    const userMessage = {
      role: 'user',
      content: value,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const reply =
        (await generateAssistantReply({
          systemInstruction: `
You are a universal assistant inside an edtech platform.
Answer clearly and directly.
Help with study plans, productivity, interview prep, career guidance, communication, project ideas, and general learning support.
Prefer practical answers over theory.
Keep replies concise, useful, and easy to scan.
If the user asks something broad, give a structured answer with actionable steps.
`,
          history: messages.slice(-4),
          message: value,
        })) || FALLBACK_REPLY(value);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: FALLBACK_REPLY(value),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-7rem)] rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#fff7ed_0%,#ffffff_38%,#eff6ff_100%)] shadow-xl overflow-hidden">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
              <Brain size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Universal Assistant</h1>
              <p className="text-sm text-slate-500">
                Fast help for studies, careers, projects, interviews, and general questions.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Signed in as <span className="font-semibold">{profile?.full_name || 'User'}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => sendMessage(suggestion)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-slate-900"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 py-6 md:px-6">
        <div className="max-h-[58vh] overflow-y-auto pr-1 space-y-4">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-3xl gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    message.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white'
                  }`}
                >
                  {message.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div
                  className={`rounded-3xl px-4 py-3 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                  <p className={`mt-2 text-[11px] ${message.role === 'user' ? 'text-slate-300' : 'text-slate-400'}`}>
                    {message.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {loading ? (
            <div className="flex justify-start">
              <div className="flex max-w-md gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
                  <Sparkles size={16} />
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0.1s' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
          className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={2}
              placeholder="Ask anything..."
              className="min-h-[56px] flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 font-semibold text-white shadow-lg transition hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UniversalAssistant;
