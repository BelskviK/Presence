import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Notifications deep-link to the record that triggered them via `?highlight=<id>`
// (plus `?date=` where the page needs it to know which month to load). This hook
// hands the page that id, flashes it for a few seconds, then strips the params
// from the URL so a refresh — or a back-navigation later — doesn't re-flash a
// record the user has already seen. Whatever the page derived from `date`
// (selected month/day) stays put, because it was copied into state on mount.
export function useHighlight(durationMs = 4000) {
  const [params, setParams] = useSearchParams();
  const param = params.get('highlight');
  const [highlightId, setHighlightId] = useState(param);

  useEffect(() => {
    if (!param) return undefined;
    setHighlightId(param);

    const timer = setTimeout(() => {
      setHighlightId(null);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('highlight');
          next.delete('date');
          return next;
        },
        { replace: true }
      );
    }, durationMs);

    return () => clearTimeout(timer);
  }, [param, durationMs, setParams]);

  return highlightId;
}

export default useHighlight;
