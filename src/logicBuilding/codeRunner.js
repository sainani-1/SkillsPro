// Simple code runner using Judge0 API
// Supports C, C++, Java, Python
import { executeJudge0Code } from '../utils/judge0';


const oneCompilerLangs = {
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
};

export async function runCode(language, code, testCases) {
  // testCases: [{input, output, hidden}]
  const results = [];
  for (const tc of testCases) {
    try {
      const resp = await executeJudge0Code({
        language: oneCompilerLangs[language] || 'python',
        sourceCode: code,
        stdin: tc.input,
      });
      const actualOutput = String(resp?.stdout || '').trim();
      const expectedOutput = (tc.output || '').trim();
      const errorText = [resp?.stderr, resp?.compileOutput, resp?.message].filter(Boolean).join('\n').trim();
      const passed = !errorText && actualOutput === expectedOutput;
      results.push({
        input: tc.input,
        output: tc.output,
        status: errorText ? 'Error' : passed ? 'Accepted' : 'Wrong Answer',
        hidden: tc.hidden,
        actualOutput,
        expectedOutput,
        error: errorText || '',
      });
    } catch (e) {
      results.push({
        input: tc.input,
        output: tc.output,
        status: 'Error',
        hidden: tc.hidden,
        error: e.message,
      });
    }
  }
  return results;
}
