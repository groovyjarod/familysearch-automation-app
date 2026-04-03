import zendeskLogin from './Audit_Logic/zendeskLogin.mjs';

const [,, loginId, password, isViewingAudit, loadingTime] = process.argv;

if (!loginId || !password) {
  console.error('Usage: node runZendeskLogin.mjs <loginId> <password> <isViewingAudit> <loadingTime>');
  console.log(JSON.stringify({
    success: false,
    error: 'Missing required parameters'
  }));
  process.exit(1);
}

async function performLogin() {
  try {
    const result = await zendeskLogin(
      loginId,
      password,
      isViewingAudit,
      loadingTime
    );

    console.error('Login successful');
    // Output ONLY the JSON result to stdout for parent to parse
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error(`Login failed: ${err.message}`);
    console.error(`Stack: ${err.stack}`);

    // Build comprehensive error response
    const errorResponse = {
      success: false,
      error: err.message || 'Unknown error in runZendeskLogin.mjs',
      errorLocation: err.location || 'runZendeskLogin.mjs - performLogin',
      friendlyMessage: err.friendlyMessage || 'Failed to complete Zendesk login',
      suggestion: err.suggestion || 'Check your credentials and connection, then try again',
      url: err.url || 'familysearch.zendesk.com',
      stack: err.stack,
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(errorResponse));
    process.exit(1);
  }
}

performLogin();
