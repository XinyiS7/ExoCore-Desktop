import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useTagSuggestionsQuery } from './queries';
import { addTag, canonicalTag, specialTagConflict } from './rules';

/**
 * Chip input shared by the Conversation and Project dialogs.
 *
 * Enter / suggestion click turns the draft into a chip, Backspace on an empty
 * draft removes the last chip. Suggestions come from tags already used by
 * conversations or projects plus the fixed special candidates. A special-tag
 * conflict is shown inline; blocking submit stays with the owning dialog.
 */
export function TagInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const listId = useId();
  const prefix = canonicalTag(draft) ?? '';
  const suggestions = useTagSuggestionsQuery(prefix, focused && !disabled);
  const options = (suggestions.data ?? []).filter((name) => !value.includes(name));
  const conflict = specialTagConflict(value);

  const commit = (raw: string) => {
    onChange(addTag(value, raw));
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Enter adds a chip; it must never submit the surrounding form.
      event.preventDefault();
      if (draft.trim() !== '') commit(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="app-field">
      <label className="app-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="tag-input">
        {value.map((name) => (
          <span key={name} className="tag-chip">
            #{name}
            <button
              type="button"
              className="tag-chip-remove"
              aria-label={`删除 #${name}`}
              disabled={disabled}
              onClick={() => onChange(value.filter((item) => item !== name))}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          className="tag-input-field"
          placeholder={value.length === 0 ? '输入 tag，回车添加' : ''}
          value={draft}
          disabled={disabled}
          aria-controls={focused && options.length > 0 ? listId : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      {focused && options.length > 0 ? (
        <ul id={listId} className="tag-suggest-list" aria-label="tag 联想">
          {options.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="tag-suggest-item"
                // mousedown keeps input focus so the list does not close first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(name)}
              >
                #{name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {conflict ? (
        <span className="app-field-error" role="alert">
          {conflict}
        </span>
      ) : null}
    </div>
  );
}
