/**
 * Call a backend function directly via HTTP with wallet JWT auth token.
 * Uses /functions/<name> which works on both Base44 sandbox and custom domains.
 */
export async function callBackendFunction(functionName, payload) {
  const authToken = localStorage.getItem('elevenx_auth_token');

  if (!authToken) {
    throw new Error('Wallet not connected. Please connect your Phantom wallet first.');
  }

  const url = `/functions/${functionName}`;
  console.log('[callBackendFunction] POST', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
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