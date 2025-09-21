// セキュリティヘルパー - トークンマスキング機能
function maskSensitiveData(text) {
    if (!text || typeof text !== 'string') return text;
    
    return text
        // Meta Access Tokens
        .replace(/EAA[a-zA-Z0-9]{20,}/g, 'EAA***')
        
        // Google OAuth Tokens
        .replace(/ya29\.[a-zA-Z0-9\-_\.]+/g, 'ya29.***')
        
        // Generic access_token parameters
        .replace(/access_token=[^&\s]+/gi, 'access_token=***')
        
        // Generic api_key parameters
        .replace(/api_key=[^&\s]+/gi, 'api_key=***')
        
        // Chatwork tokens (32 character hex strings in specific contexts)
        .replace(/(?<=[=:][\s"']?)[a-f0-9]{32}(?=[\s"'&]|$)/gi, '***')
        
        // Bearer tokens
        .replace(/Bearer\s+[a-zA-Z0-9\-_\.]+/g, 'Bearer ***')
        
        // AWS keys
        .replace(/AKIA[A-Z0-9]{16}/g, 'AKIA***')
        .replace(/(?<=[=:][\s"']?)[a-zA-Z0-9/+=]{40}(?=[\s"'&]|$)/g, '***');
}

// オブジェクトやJSONのマスキング
function maskObject(obj) {
    if (!obj) return obj;
    
    const sensitiveKeys = [
        'token', 'access_token', 'api_key', 'apiKey', 
        'password', 'secret', 'authorization', 
        'chatwork_token', 'meta_token'
    ];
    
    const masked = JSON.stringify(obj, (key, value) => {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
            return '***';
        }
        if (typeof value === 'string') {
            return maskSensitiveData(value);
        }
        return value;
    });
    
    return JSON.parse(masked);
}

module.exports = {
    maskSensitiveData,
    maskObject
};