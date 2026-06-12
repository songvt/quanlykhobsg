export const ZALO_OPEN_API = 'https://business.openapi.zalo.me';
export const ZALO_OAUTH_API = 'https://oauth.zaloapp.com/v4/oa/access_token';

/**
 * Lấy Access Token mới bằng Refresh Token
 */
export const refreshZaloToken = async (appId: string, secretKey: string, refreshToken: string) => {
    const params = new URLSearchParams();
    params.append('app_id', appId);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const response = await fetch(ZALO_OAUTH_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'secret_key': secretKey
        },
        body: params.toString()
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(`Zalo API Error [${data.error}]: ${data.error_name} - ${data.error_description}`);
    }
    return data;
};

/**
 * Lấy danh sách Templates
 */
export const fetchZaloTemplates = async (accessToken: string, offset: number = 0, limit: number = 100) => {
    const response = await fetch(`${ZALO_OPEN_API}/template/all?offset=${offset}&limit=${limit}&status=1`, {
        method: 'GET',
        headers: {
            'access_token': accessToken
        }
    });
    
    const data = await response.json();
    return data;
};

/**
 * Gửi tin nhắn ZNS
 */
export const sendZNSMessage = async (accessToken: string, payload: any) => {
    const response = await fetch(`${ZALO_OPEN_API}/message/template`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': accessToken
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    return data;
};

/**
 * Lấy thông tin OA/Quota (để test connection)
 */
export const getOAQuota = async (accessToken: string) => {
    const response = await fetch(`${ZALO_OPEN_API}/message/quota`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': accessToken
        },
        body: JSON.stringify({}) // Some endpoints require empty body
    });
    
    const data = await response.json();
    return data;
};
