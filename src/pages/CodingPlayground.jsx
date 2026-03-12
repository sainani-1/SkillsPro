import React, { useEffect, useState } from 'react';
import { Clock3, Code2, Play, TerminalSquare } from 'lucide-react';
import MonacoCdnEditor from '../components/MonacoCdnEditor';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { executeJudge0Code } from '../utils/judge0';
import { trackLearningActivity } from '../utils/learningActivity';

const LANGUAGE_CONFIG = {
  python: {
    label: 'Python',
    monaco: 'python',
    template: `print("Hello from SkillPro")\nname = input()\nprint(f"Welcome, {name}!")\n`,
  },
  java: {
    label: 'Java',
    monaco: 'java',
    template: `import java.util.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    Scanner scanner = new Scanner(System.in);\n    String name = scanner.hasNextLine() ? scanner.nextLine() : "SkillPro";\n    System.out.println("Welcome, " + name + "!");\n  }\n}\n`,
  },
  javascript: {
    label: 'JavaScript',
    monaco: 'javascript',
    template: `const fs = require("fs");\nconst input = fs.readFileSync(0, "utf8").trim() || "SkillPro";\nconsole.log(\`Welcome, \${input}!\`);\n`,
  },
  c: {
    label: 'C',
    monaco: 'c',
    template: `#include <stdio.h>\n#include <string.h>\n\nint main() {\n  char name[200];\n  if (!fgets(name, sizeof(name), stdin) || name[0] == '\\n') {\n    strcpy(name, "SkillPro");\n  } else {\n    name[strcspn(name, "\\n")] = 0;\n  }\n  printf("Welcome, %s!\\n", name);\n  return 0;\n}\n`,
  },
  cpp: {
    label: 'C++',
    monaco: 'cpp',
    template: `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n  string name;\n  getline(cin, name);\n  if (name.empty()) name = "SkillPro";\n  cout << "Welcome, " << name << "!" << endl;\n  return 0;\n}\n`,
  },
};

const CodingPlayground = () => {
  const { profile } = useAuth();
  const [language, setLanguage] = useState('python');
  const [sourceCode, setSourceCode] = useState(LANGUAGE_CONFIG.python.template);
  const [stdin, setStdin] = useState('Student');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('coding_playground_runs')
      .select('id, language, status, stdout, stderr, created_at, execution_time, memory')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(6);
    setHistory(data || []);
  };

  useEffect(() => {
    loadHistory();
  }, [profile?.id]);

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    setSourceCode(LANGUAGE_CONFIG[nextLanguage].template);
    setResult(null);
  };

  const handleRun = async () => {
    if (!sourceCode.trim()) return;
    setRunning(true);
    setResult(null);

    try {
      const execution = await executeJudge0Code({ language, sourceCode, stdin });
      const payload = {
        language,
        source_code: sourceCode,
        stdin,
        stdout: execution.stdout,
        stderr: execution.stderr,
        compile_output: execution.compileOutput,
        status: execution.status,
        execution_time: execution.executionTime,
        memory: execution.memory,
      };

      if (profile?.id) {
        await supabase.from('coding_playground_runs').insert({
          user_id: profile.id,
          ...payload,
        });
        await trackLearningActivity({
          userId: profile.id,
          eventType: 'playground_run',
          pointsAwarded: 15,
          durationMinutes: 15,
          metadata: { language, status: execution.status },
        });
      }

      setResult({
        ...execution,
        success: !execution.stderr && !execution.compileOutput && !execution.message,
      });
      loadHistory();
    } catch (error) {
      setResult({
        status: 'Execution failed',
        stdout: '',
        stderr: error.message,
        compileOutput: '',
        message: '',
        success: false,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-8 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Coding Practice Playground</p>
        <h1 className="mt-3 text-3xl font-bold">Write, run, and debug code without leaving the platform.</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">
          Monaco powers the editor and Judge0 executes Python, Java, JavaScript, C, and C++ with instant output.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(LANGUAGE_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleLanguageChange(key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    language === key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play size={16} />
              {running ? 'Running...' : 'Run Code'}
            </button>
          </div>

          <MonacoCdnEditor
            language={LANGUAGE_CONFIG[language].monaco}
            value={sourceCode}
            onChange={setSourceCode}
            height={460}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Code2 size={16} />
                Standard Input
              </p>
              <textarea
                value={stdin}
                onChange={(event) => setStdin(event.target.value)}
                rows={7}
                className="mt-3 w-full rounded-xl border border-slate-300 p-3 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Type custom input here..."
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-100">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <TerminalSquare size={16} />
                Output
              </p>
              <pre className="mt-3 min-h-[168px] whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-sm text-slate-100">
                {result?.stdout || result?.stderr || result?.compileOutput || result?.message || 'Run your code to see output here.'}
              </pre>
              {result ? (
                <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
                  <div className="rounded-xl bg-white/5 px-3 py-2">Status: {result.status || 'Done'}</div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">Time: {result.executionTime || '-'}</div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">Memory: {result.memory || '-'}</div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Recent executions</p>
            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500">Your recent runs will appear here.</p>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{LANGUAGE_CONFIG[item.language]?.label || item.language}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.status || 'Completed'}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                      {item.stdout || item.stderr || 'No output captured.'}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        {new Date(item.created_at).toLocaleString('en-IN')}
                      </span>
                      <span>{item.execution_time || '-'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CodingPlayground;
