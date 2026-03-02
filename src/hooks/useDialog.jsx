import { useCallback, useMemo, useRef, useState } from 'react';

const useDialog = () => {
  const resolverRef = useRef(null);
  const [dialog, setDialog] = useState({
    open: false,
    mode: 'confirm',
    title: '',
    message: '',
    value: '',
    required: false,
    placeholder: ''
  });

  const closeWith = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialog((prev) => ({ ...prev, open: false, value: '' }));
  }, []);

  const confirm = useCallback((message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        open: true,
        mode: 'confirm',
        title,
        message,
        value: '',
        required: false,
        placeholder: ''
      });
    });
  }, []);

  const prompt = useCallback(
    (message, { title = 'Enter Value', required = false, placeholder = '' } = {}) => {
      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setDialog({
          open: true,
          mode: 'prompt',
          title,
          message,
          value: '',
          required,
          placeholder
        });
      });
    },
    []
  );

  const alert = useCallback((message, title = 'Notice') => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        open: true,
        mode: 'alert',
        title,
        message,
        value: '',
        required: false,
        placeholder: ''
      });
    });
  }, []);

  const dialogNode = useMemo(() => {
    if (!dialog.open) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full">
          <h3 className="text-lg font-bold text-slate-900 mb-2">{dialog.title}</h3>
          <p className="text-sm text-slate-600 mb-4">{dialog.message}</p>
          {dialog.mode === 'prompt' && (
            <input
              autoFocus
              value={dialog.value}
              onChange={(e) => setDialog((prev) => ({ ...prev, value: e.target.value }))}
              placeholder={dialog.placeholder}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4"
            />
          )}
          <div className="flex gap-2">
            {dialog.mode !== 'alert' && (
              <button
                onClick={() => closeWith(null)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => {
                if (dialog.mode === 'prompt') {
                  const val = dialog.value.trim();
                  if (dialog.required && !val) return;
                  closeWith(val);
                  return;
                }
                closeWith(true);
              }}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }, [closeWith, dialog]);

  return { confirm, prompt, alert, dialogNode };
};

export default useDialog;
