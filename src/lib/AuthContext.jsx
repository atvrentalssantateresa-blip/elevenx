import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { createClient } from '@base44/sdk';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // Check for wallet-based session marker (set by Login page after wallet verification)
      const walletSession = localStorage.getItem('elevenx_wallet_session');
      const isAuthenticatedMarker = localStorage.getItem('elevenx_authenticated');
      
      console.log('🔍 checkAppState: walletSession=', walletSession, 'isAuthenticatedMarker=', isAuthenticatedMarker);
      
      // If we have a wallet session marker, authenticate immediately (skip token-based checks)
      if (walletSession && isAuthenticatedMarker === 'true') {
        console.log('🔐 Wallet session detected in checkAppState, calling checkUserAuth...');
        await checkUserAuth();
        setIsLoadingPublicSettings(false);
        return;
      }
      
      // For platform auth, check app public settings
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token,
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Check for wallet auth token first (highest priority)
      const authToken = localStorage.getItem('elevenx_auth_token');
      const walletSession = localStorage.getItem('elevenx_wallet_session');
      console.log('🔑 checkUserAuth: authToken=', authToken ? 'present' : 'missing', 'walletSession=', walletSession);
      
      if (authToken) {
        console.log('Auth token found, decoding...');
        // Decode the token to get user info (base64url encoded)
        try {
          const [header, payload, sig] = authToken.split('.');
          const base64Url = payload;
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const jsonPayload = new TextDecoder().decode(bytes);
          const payloadJson = JSON.parse(jsonPayload);
          console.log('Token decoded:', payloadJson);
          
          if (payloadJson.userId && payloadJson.exp && payloadJson.exp > Math.floor(Date.now() / 1000)) {
            // Initialize SDK with auth token for backend function calls
            const axiosClient = createAxiosClient({
              baseURL: '',
              headers: {
                Authorization: `Bearer ${authToken}`,
                'X-App-Id': appParams.appId,
              },
            });
            const sdkWithAuth = createClient({ 
              axiosClient,
              appId: appParams.appId,
              functionsVersion: appParams.functionsVersion,
            });
            window.base44WithAuth = sdkWithAuth;

            // Fetch real role server-side via walletAuth
            let role = 'user';
            try {
              const walletAddress = payloadJson.walletAddress;
              if (walletAddress) {
                const roleRes = await sdkWithAuth.functions.invoke('walletAuth', { walletAddress });
                if (roleRes.data?.success) {
                  role = roleRes.data.role || roleRes.data.user?.role || 'user';
                }
              }
            } catch (roleErr) {
              console.warn('Could not fetch role from walletAuth, defaulting to user:', roleErr.message);
            }

            const userData = {
              id: payloadJson.userId,
              wallet_address: payloadJson.walletAddress,
              role,
              email: payloadJson.email || `${payloadJson.walletAddress?.slice(0, 8)}@elevenx.bet`
            };
            setUser(userData);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
            setAuthChecked(true);
            console.log('✓ SDK initialized with auth token for backend calls, role:', role);
            return;
          } else {
            console.log('Token expired or invalid');
            localStorage.removeItem('elevenx_auth_token');
          }
        } catch (decodeErr) {
          console.error('Failed to decode auth token (old base58 format detected):', decodeErr.message);
          console.error('Token was:', authToken);
          // Clear old base58 token - user needs to re-login to get new base64 token
          localStorage.removeItem('elevenx_auth_token');
          console.log('Cleared old auth token - please login again');
        }
      }
      
      if (walletSession) {
        // Wallet-based session - wallet address is stored, but auth token should exist
        // If no auth token, the user needs to re-login (walletAuth requires signature which can't be done without Phantom)
        console.log('⚠️ Wallet session exists but no auth token - user needs to re-login via Login page');
        localStorage.removeItem('elevenx_wallet_session');
        localStorage.removeItem('elevenx_authenticated');
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }
      
      // No wallet session - try platform token auth
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      
      // Don't set auth error for wallet auth - let pages handle it
      if (error.status === 401 || error.status === 403) {
        const walletSession = localStorage.getItem('elevenx_wallet_session');
        if (!walletSession) {
          setAuthError({
            type: 'auth_required',
            message: 'Authentication required'
          });
        }
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    // Clear wallet session markers
    localStorage.removeItem('elevenx_wallet_session');
    localStorage.removeItem('elevenx_authenticated');
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  const refreshUser = async () => {
    try {
      const walletSession = localStorage.getItem('elevenx_wallet_session');
      if (walletSession) {
        let address = walletSession;
        try {
          const parsed = JSON.parse(walletSession);
          address = parsed.address || walletSession;
        } catch {}
        const response = await base44.functions.invoke('walletAuth', {
          walletAddress: address
        });
        if (response.data.success) {
          const userData = {
            id: response.data.userId || response.data.user?.id,
            full_name: response.data.full_name || response.data.user?.full_name,
            username: response.data.username || response.data.user?.username,
            wallet_address: response.data.walletAddress || response.data.user?.wallet_address,
            role: response.data.role || response.data.user?.role,
            email: response.data.email || response.data.user?.email
          };
          setUser(userData);
        }
      } else {
        const currentUser = await base44.auth.me();
        console.log('refreshUser got:', currentUser);
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};