import * as WebBrowser from 'expo-web-browser';

// Ensure browser sessions are completed when redirected back
WebBrowser.maybeCompleteAuthSession();

const API_URL = 'https://botmate-api-production.up.railway.app';
const APP_SCHEME = 'reili';

/**
 * Open Facebook OAuth via the backend (backend-routed flow).
 *
 * Flow:
 * 1. App opens backend URL in a browser
 * 2. Backend redirects to Facebook OAuth (with HTTPS callback URL that Facebook accepts)
 * 3. Facebook redirects back to backend with auth code
 * 4. Backend exchanges code for access token (server-side, keeps app secret secure)
 * 5. Backend redirects to reili://auth?access_token=...
 * 6. openAuthSessionAsync intercepts the custom scheme and returns the URL
 *
 * @param mode 'login' for sign-in, 'connect-pages' for page connection
 * @param userId Optional Supabase user ID (for connect-pages mode)
 * @returns The Facebook access token, or null if cancelled/failed
 */
export async function facebookAuth(
  mode: 'login' | 'connect-pages' = 'login',
  userId?: string,
): Promise<string | null> {
  const params = new URLSearchParams({ mode });
  if (userId) params.set('user_id', userId);

  const authUrl = `${API_URL}/connect/mobile-auth?${params.toString()}`;
  const redirectUrl = `${APP_SCHEME}://auth`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

  if (result.type !== 'success') {
    return null;
  }

  // Parse the redirect URL: reili://auth?access_token=...&mode=...
  const url = result.url;
  const queryString = url.split('?')[1];
  if (!queryString) return null;

  const params2 = new URLSearchParams(queryString);

  // Check for errors
  const error = params2.get('error');
  if (error) return null;

  return params2.get('access_token');
}
