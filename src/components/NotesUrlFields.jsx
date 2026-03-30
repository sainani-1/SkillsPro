import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const ensureEditableValues = (values) => {
  if (Array.isArray(values) && values.length > 0) return values;
  if (typeof values === 'string' && values.trim()) return [values];
  return [''];
};

const NotesUrlFields = ({
  label = 'Notes Links',
  values,
  onChange,
  placeholder = 'https://example.com/course-notes.pdf',
  helperText = null,
  inputClassName = 'w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
  labelClassName = 'block text-sm font-semibold text-slate-700 mb-2',
  listClassName = 'space-y-3',
  addButtonClassName = 'inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100',
  removeButtonClassName = 'inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50',
}) => {
  const noteValues = ensureEditableValues(values);

  const updateValue = (index, nextValue) => {
    onChange(noteValues.map((value, currentIndex) => (currentIndex === index ? nextValue : value)));
  };

  const addValue = () => {
    onChange([...noteValues, '']);
  };

  const removeValue = (index) => {
    const nextValues = noteValues.filter((_, currentIndex) => currentIndex !== index);
    onChange(nextValues.length > 0 ? nextValues : ['']);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className={labelClassName}>{label}</label>
        <button type="button" onClick={addValue} className={addButtonClassName}>
          <Plus size={16} />
          Add Notes
        </button>
      </div>

      <div className={listClassName}>
        {noteValues.map((value, index) => (
          <div key={index} className="flex items-start gap-2">
            <input
              type="url"
              value={value}
              onChange={(event) => updateValue(index, event.target.value)}
              placeholder={placeholder}
              className={inputClassName}
            />
            <button
              type="button"
              onClick={() => removeValue(index)}
              className={removeButtonClassName}
              aria-label={`Remove note link ${index + 1}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {helperText ? <p className="mt-2 text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
};

export default NotesUrlFields;
