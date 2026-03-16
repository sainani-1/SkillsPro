import React, { useEffect, useRef, useState } from 'react';

const MONACO_BASE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs';

let monacoLoadPromise = null;

function loadMonaco() {
  if (window.monaco?.editor) {
    return Promise.resolve(window.monaco);
  }

  if (monacoLoadPromise) {
    return monacoLoadPromise;
  }

  monacoLoadPromise = new Promise((resolve, reject) => {
    const onReady = () => {
      window.require.config({ paths: { vs: MONACO_BASE_URL } });
      window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject);
    };

    if (window.require) {
      onReady();
      return;
    }

    const script = document.createElement('script');
    script.src = `${MONACO_BASE_URL}/loader.min.js`;
    script.async = true;
    script.onload = onReady;
    script.onerror = () => reject(new Error('Failed to load Monaco Editor assets.'));
    document.body.appendChild(script);
  });

  return monacoLoadPromise;
}

const MonacoCdnEditor = ({ value, language, onChange, height = 420, markers = [] }) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const modelRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;

    loadMonaco()
      .then((monaco) => {
        if (disposed || !containerRef.current) return;

        modelRef.current = monaco.editor.createModel(value || '', language || 'javascript');
        editorRef.current = monaco.editor.create(containerRef.current, {
          model: modelRef.current,
          automaticLayout: true,
          theme: 'vs-dark',
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          roundedSelection: false,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoClosingDelete: 'always',
          autoClosingOvertype: 'always',
          autoSurround: 'languageDefined',
          matchBrackets: 'always',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true },
          padding: { top: 16, bottom: 16 },
        });

        editorRef.current.onDidChangeModelContent(() => {
          onChange?.(editorRef.current?.getValue?.() || '');
        });
      })
      .catch(() => {
        setFailed(true);
      });

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      modelRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!modelRef.current) return;
    if (modelRef.current.getLanguageId() !== language) {
      window.monaco.editor.setModelLanguage(modelRef.current, language);
    }
  }, [language]);

  useEffect(() => {
    if (!editorRef.current || typeof value !== 'string') return;
    const current = editorRef.current.getValue();
    if (current !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (!window.monaco?.editor || !modelRef.current) return;
    window.monaco.editor.setModelMarkers(modelRef.current, 'exam-code-markers', markers || []);
  }, [markers]);

  if (failed) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        style={{ height }}
        className="w-full rounded-2xl border border-slate-300 bg-slate-950 p-4 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    );
  }

  return <div ref={containerRef} style={{ height }} className="overflow-hidden rounded-2xl border border-slate-300" />;
};

export default MonacoCdnEditor;
