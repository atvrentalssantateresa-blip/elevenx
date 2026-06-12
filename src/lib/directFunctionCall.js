/**
 * Direct HTTP client for calling backend functions with wallet JWT.
 * Bypasses Base44 SDK auth requirements for wallet-only sessions.
 */

/**
 * Call a backend function directly via HTTP with wallet JWT auth token.
 * @param {string} functionName - Name of the backend function to call
 * @param {object} payload - Function parameters
 * @returns {Promise<any>} Function response data
 */
export async function callBackendFunction(functionName, payload) {
  const authToken = localStorage.getItem('elevenx_auth_token');
  
  if (!authToken) {
    throw new Error('Wallet not connected. Please connect your Phantom wallet first.');
  }
  
  console.log('[callBackendFunction] Calling:', functionName, 'with payload:', payload);
  console.log('[callBackendFunction] Auth token exists:', !!authToken, 'length:', authToken?.length);
  
  const response = await fetch(`/api/functions/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });
  
  console.log('[callBackendFunction] Response status:', response.status, response.ok);
  
  // Try to parse response body regardless of status
  let responseData;
  try {
    responseData = await response.json();
    console.log('[callBackendFunction] Response data:', responseData);
  } catch (parseErr) {
    console.error('[callBackendFunction] Failed to parse response:', parseErr);
    const text = await response.text();
    console.error('[callBackendFunction] Raw response:', text);
    throw new Error(`Invalid response from server: ${text.slice(0, 200)}`);
  }
  
  if (!response.ok) {
    throw new Error(responseData?.error || `HTTP ${response.status}`);
  }
  
  return responseData;
}