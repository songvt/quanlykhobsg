import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, fetchAll } from './utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const data = await fetchAll('asset_logs', '*', (q) => q.order('created_at', { ascending: false }));
        return res.status(200).json(data);
    } catch (error: any) {
        console.error('API Error (Asset Logs):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
