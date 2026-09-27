import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Returns `{ ready, getToken }`.
 *
 * `ready` is true only after Clerk has fully initialised the session AND
 * `getToken()` returns a non-null JWT.  This is necessary because Clerk
 * sets isLoaded + isSignedIn + user to truthy values before the session
 * JWT is actually mintable, which causes the first API request on a hard
 * page refresh to fail silently (getToken returns null → early return →
 * effect never re-runs because deps didn't change).
 *
 * The hook polls getToken() every 200 ms until a token is obtained or
 * the user logs out.  Once ready, it stays ready for the lifetime of the
 * component unless the user signs out.
 */
export function useReadyAuth() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [ready, setReady] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Clear any in-flight poll first
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Not logged-in or still booting – reset and wait
    if (!isLoaded || !isSignedIn || !user) {
      setReady(false);
      return;
    }

    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const token = await getToken();
        if (!active) return;
        if (token) {
          setReady(true);
        } else {
          // Token not yet available – try again in 200 ms
          timerRef.current = setTimeout(poll, 200);
        }
      } catch {
        if (active) {
          timerRef.current = setTimeout(poll, 200);
        }
      }
    };

    poll();

    return () => {
      active = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  // getToken is intentionally omitted from deps: it is a stable function reference
  // from Clerk and re-polling when it changes would cause infinite loops.
  // The poll is driven entirely by isLoaded/isSignedIn/user transitions.
  }, [isLoaded, isSignedIn, user]); // eslint-disable-line

  return { ready, getToken };
}
