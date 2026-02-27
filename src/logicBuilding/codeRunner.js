// Simple code runner using Judge0 API
// Supports C, C++, Java, Python
import axios from 'axios';


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
    let payload = {
      language: oneCompilerLangs[language] || 'python',
      stdin: tc.input,
      files: [
        {
          name: language === 'python' ? 'index.py' : language === 'java' ? 'Main.java' : language === 'cpp' ? 'main.cpp' : 'main.c',
          content: code,
        },
      ],
    };
    try {
      const resp = await axios.post('https://onecompiler-apis.p.rapidapi.com/api/v1/run', payload, {
        headers: {
          'x-rapidapi-key': '6c1b60a65emsh4f7371296b76e50p18a055jsn78b781957d20',
          'x-rapidapi-host': 'onecompiler-apis.p.rapidapi.com',
          'Content-Type': 'application/json',
        },
      });
      let actualOutput = (resp.data && resp.data.stdout) ? resp.data.stdout.trim() : '';
      let expectedOutput = (tc.output || '').trim();
      let passed = actualOutput === expectedOutput;
      results.push({
        input: tc.input,
        output: tc.output,
        status: passed ? 'Accepted' : 'Wrong Answer',
        hidden: tc.hidden,
        actualOutput,
        expectedOutput,
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
