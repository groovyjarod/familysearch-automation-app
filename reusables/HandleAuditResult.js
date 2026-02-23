export default function handleAuditResult(resultData) {
    // Result is now a JSON object, not a string with |||
    if (typeof resultData === 'object') {
        return JSON.stringify(resultData, null, 2);
    }
    return resultData;
}