import scrapeAndSaveZendeskLinks from './Audit_Logic/scrapeZendeskLinks.mjs';

const [
  nodePath,
  scriptPath,
  loginId,
  password,
  zendeskUrl,
  isViewingAudit,
  loadingTime
] = process.argv;

(async () => {
  try {
    const result = await scrapeAndSaveZendeskLinks(
      loginId,
      password,
      zendeskUrl,
      isViewingAudit,
      loadingTime
    );

    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    const errorResult = {
      success: false,
      error: err.message,
      errorLocation: 'runZendeskScrape.mjs',
      stack: err.stack
    };
    console.log(JSON.stringify(errorResult));
    process.exit(1);
  }
})();
