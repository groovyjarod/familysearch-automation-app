export default function handleAuditResult(resultData) {
    return resultData.split('|||').pop()
}