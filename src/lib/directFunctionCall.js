import { appParams } from '@/lib/app-params';

/**
 * Call a backend function directly via HTTP with wallet JWT auth token.
 * Uses the correct Base44 API endpoint to avoid 404s.
 */
export async function callBackendFunction(functionName, payload) {
  const authToken = localStorage.getItem('elevenx_auth_token');
  
  if (!authToken) {
    throw new Error('Wallet not connected. Please connect your Phantom wallet first.');
  }

  const appId = appParams.appId;
  if (!appId) throw new Error('App ID not found');

  const url = `/api/apps/${appId}/functions/${functionName}`;
  console.log('[callBackendFunction] POST', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-App-Id': appId,
    },
    body: JSON.stringify(payload),
  });

  console.log('[callBackendFunction] Response status:', response.status);

  const responseText = await response.text();
  if (!responseText) throw new Error(`Empty response (HTTP ${response.status})`);

  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid JSON: ${responseText.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(responseData?.error || `HTTP ${response.status}`);
  }

  return responseData;
}