import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nacl from 'npm:tweetnacl@1.0.3';
import bs58 from 'npm:bs58@5.0.0';

Deno.serve(async (req) => {
  try {
    // Initialize SDK in service role mode for unauthenticated registration requests
    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;
    
    const { walletAddress, signature, message, fullName, register } = await req.json();

    if (!walletAddress) {
      return Response.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // If signature provided, verify it
    if (signature && message) {
      const publicKey = bs58.decode(walletAddress);
      const signatureBytes = bs58.decode(signature);
      const messageBytes = new TextEncoder().encode(message);

      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey);

      if (!isValid) {
        return Response.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Check if user exists by wallet address - wrap in try/catch for auth errors
    let user = null;
    if (!register) {
      // Only try to lookup existing users if NOT registering
      // During registration, we skip lookup and go straight to create
      try {
        const users = await serviceRole.entities.User.filter({ wallet_address: walletAddress });
        user = users[0] || null;
      } catch (err) {
        console.log('User lookup failed:', err.message);
        user = null;
      }
    }

    // If registering, create user with service role
    if (register && fullName) {
      const walletEmail = `${walletAddress.slice(0, 8)}@elevenx.bet`;
      
      try {
        // Create user using service role (bypasses email/password auth requirement)
        const newUser = await serviceRole.entities.User.create({
          email: walletEmail,
          full_name: fullName,
          wallet_address: walletAddress,
          role: 'user',
        });
        
        // Return success with user info
        return Response.json({
          success: true,
          needsRegistration: false,
          user: {
            id: newUser.id,
            email: newUser.email,
            full_name: newUser.full_name,
            wallet_address: newUser.wallet_address,
            role: newUser.role
          },
          walletAddress,
          isNewUser: true
        });
      } catch (createErr) {
        console.error('User creation failed:', createErr);
        return Response.json({ error: 'Failed to create user: ' + createErr.message }, { status: 500 });
      }
    }

    // If not registering and no user found, they need to register
    if (!user) {
      return Response.json({ 
        needsRegistration: true,
        walletAddress 
      }, { status: 404 });
    }

    // User exists - return user info
    return Response.json({
      success: true,
      userId: user.id,
      walletAddress: user.wallet_address,
      role: user.role,
      full_name: user.full_name
    });

  } catch (error) {
    console.error('walletAuth error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});