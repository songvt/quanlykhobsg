import { supabase } from './_utils/supabase.js';
// Helper to normalize search query (remove accents, lowercase)
const normalizeStr = (str) => {
    if (!str)
        return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase().trim();
};
// Simple stop-words list for Vietnamese search tokenization
const STOP_WORDS = new Set([
    'co', 'bao', 'nhieu', 'tim', 'cho', 'toi', 'o', 'ai', 'dang', 'giu', 'su', 'dung',
    'nao', 'bi', 'hong', 'mat', 'vat', 'tu', 'cai', 'chiec', 'la', 'nhung', 'cac',
    'cua', 'va', 'trong', 'app', 'ung', 'dung', 'he', 'thong', 'kho', 'tai', 'san',
    'chuc', 'nang', 'trang', 'huong', 'dan', 'lam', 'the', 'nao', 'kiem', 'tra',
    'xem', 'danh', 'sach', 'co'
]);
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE' || apiKey.trim() === '') {
        return res.status(200).json({
            text: `⚠️ **Thiếu cấu hình API Key cho Trợ lý AI!**

Hiện tại trong file cấu hình \`.env\` của bạn đang sử dụng mã mẫu mặc định (\`YOUR_GEMINI_API_KEY_HERE\`).

Để kích hoạt Trợ lý AI:
1. Bạn hãy truy cập [Google AI Studio](https://aistudio.google.com/) để lấy mã API Key miễn phí (mất khoảng 1 phút).
2. Mở file \`.env\` ở thư mục gốc của dự án.
3. Cập nhật khóa này:
   \`\`\`env
   GEMINI_API_KEY="Mã_API_Key_của_bạn_ở_đây"
   \`\`\`
4. Khởi động lại dự án để thay đổi có hiệu lực!`
        });
    }
    try {
        // Extract the user's latest query
        const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user')?.text || '';
        const normQuery = normalizeStr(lastUserMsg);
        // --- RETRIEVAL ENGINE (RAG) ---
        // 1. Gather general statistics
        const [{ count: totalAssets }, { data: assetStatusCounts }, { count: totalProducts }] = await Promise.all([
            supabase.from('assets').select('*', { count: 'exact', head: true }),
            supabase.from('assets').select('status'),
            supabase.from('products').select('*', { count: 'exact', head: true })
        ]);
        // Compute asset status breakdown
        const statusMap = {};
        if (assetStatusCounts) {
            assetStatusCounts.forEach((a) => {
                const s = a.status || 'Chưa phân loại';
                statusMap[s] = (statusMap[s] || 0) + 1;
            });
        }
        // 2. Query specific entities based on keywords
        let contextualDataText = '';
        const queryTokens = normQuery.split(/\s+/).map(t => t.replace(/[^a-zA-Z0-9]/g, '')).filter(t => t && !STOP_WORDS.has(t) && t.length > 1);
        if (queryTokens.length > 0) {
            // Let's search database for matches on assets & products
            // Create ILIKE search patterns
            const searchPromises = queryTokens.map(async (token) => {
                const pattern = `%${token}%`;
                const [assetsRes, productsRes] = await Promise.all([
                    supabase.from('assets')
                        .select('asset_code, asset_name, status, user_employee_name, user_department_name, location_name, serial_number, specifications, manager_name')
                        .or(`asset_name.ilike.${pattern},asset_code.ilike.${pattern},user_employee_name.ilike.${pattern},serial_number.ilike.${pattern},manager_name.ilike.${pattern}`)
                        .limit(10),
                    supabase.from('products')
                        .select('item_code, name, category, unit, unit_price')
                        .or(`name.ilike.${pattern},item_code.ilike.${pattern}`)
                        .limit(10)
                ]);
                return {
                    assets: assetsRes.data || [],
                    products: productsRes.data || []
                };
            });
            const searchResults = await Promise.all(searchPromises);
            // Deduplicate lists
            const matchedAssetsMap = new Map();
            const matchedProductsMap = new Map();
            searchResults.forEach(res => {
                res.assets.forEach(a => matchedAssetsMap.set(a.asset_code, a));
                res.products.forEach(p => matchedProductsMap.set(p.item_code, p));
            });
            const matchedAssets = Array.from(matchedAssetsMap.values()).slice(0, 15);
            const matchedProducts = Array.from(matchedProductsMap.values()).slice(0, 15);
            if (matchedAssets.length > 0) {
                contextualDataText += `\n[KẾT QUẢ TRA CỨU TÀI SẢN TRONG DB KHOẢNG ${matchedAssets.length} BẢN GHI]:\n` +
                    matchedAssets.map((a, i) => `${i + 1}. Mã TS: ${a.asset_code} | Tên: ${a.asset_name} | Trạng thái: ${a.status} | Người sử dụng: ${a.user_employee_name || 'Không'} | Đơn vị: ${a.user_department_name || 'Không'} | Vị trí: ${a.location_name || 'Không'} | S/N: ${a.serial_number || 'Không'}`).join('\n');
            }
            if (matchedProducts.length > 0) {
                contextualDataText += `\n[KẾT QUẢ TRA CỨU HÀNG HÓA TRONG DB KHOẢNG ${matchedProducts.length} BẢN GHI]:\n` +
                    matchedProducts.map((p, i) => `${i + 1}. Mã Hàng: ${p.item_code} | Tên: ${p.name} | Loại: ${p.category} | Đơn vị: ${p.unit} | Đơn giá: ${p.unit_price}`).join('\n');
            }
        }
        // 3. Assemble Context & Instructions
        const systemInstruction = `Bạn là Trợ lý AI (Gemini AI) tích hợp trong ứng dụng Quản Lý Kho & Tài Sản của GGS.
Nhiệm vụ của bạn là hỗ trợ người dùng giải đáp thông tin, tìm kiếm, tra cứu tài sản, hàng hóa, thiết bị và hướng dẫn sử dụng chức năng hệ thống một cách chuyên nghiệp.

Dưới đây là một số thông tin thống kê hiện tại từ cơ sở dữ liệu để bạn tham khảo trực tiếp:
- Tổng số lượng tài sản (Assets) đang quản lý: ${totalAssets || 0}
- Thống kê tài sản theo trạng thái:
${Object.entries(statusMap).map(([k, v]) => `  + ${k}: ${v} tài sản`).join('\n')}
- Tổng số loại sản phẩm hàng hóa (Products) trong danh mục: ${totalProducts || 0}

${contextualDataText ? `Dưới đây là các dữ liệu khớp với nội dung câu hỏi tìm kiếm của người dùng trong DB:${contextualDataText}` : 'Không tìm thấy dữ liệu tìm kiếm khớp trực tiếp. Trả lời dựa trên thông tin tổng quát và hướng dẫn của bạn.'}

LƯU Ý KHI TRẢ LỜI:
1. Hãy thân thiện, chuyên nghiệp, súc tích và chính xác. Trả lời bằng tiếng Việt.
2. Nếu người dùng hỏi các câu liên quan đến số lượng tài sản, trạng thái hỏng/mất/sử dụng, hãy dựa vào số liệu thống kê được cung cấp ở trên để trả lời trực tiếp.
3. Nếu người dùng hỏi hướng dẫn mở các phân hệ, ví dụ: 'xuất kho', 'đặt hàng', 'báo cáo', 'tài sản', hãy hướng dẫn họ nhấp vào các menu tương ứng trên thanh điều hướng bên trái (ModernSidebar).
4. Định dạng câu trả lời bằng Markdown đẹp mắt (dùng emoji thích hợp, bullet points, hoặc bảng nếu cần).`;
        // Format history for Gemini API
        // Convert array to Gemini contents structure
        const contents = messages.map((m) => {
            return {
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: typeof m.text === 'string' ? m.text : 'Yêu cầu tra cứu' }]
            };
        });
        // Call Gemini API REST Endpoint
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1000
                }
            })
        });
        if (!response.ok) {
            const errBody = await response.text();
            console.error('Gemini API request failed:', errBody);
            if (response.status === 400 || errBody.includes('API_KEY_INVALID') || errBody.includes('API key not valid')) {
                return res.status(200).json({
                    text: `⚠️ **Mã API Key của Gemini AI không hợp lệ!**

Hệ thống nhận được phản hồi lỗi từ Google: *"API key not valid"*.

Vui lòng kiểm tra lại mã \`GEMINI_API_KEY\` trong file \`.env\` ở thư mục gốc của bạn. Đảm bảo rằng mã đã được sao chép chính xác từ [Google AI Studio](https://aistudio.google.com/) và không chứa ký tự thừa.`
                });
            }
            if (response.status === 429) {
                return res.status(429).json({ error: 'Mã API Key của bạn đang vượt quá giới hạn lượt gọi miễn phí (Rate Limit - 429). Vui lòng thử lại sau khoảng 1 phút.' });
            }
            throw new Error(`Gemini API returned status ${response.status}`);
        }
        const resData = await response.json();
        const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || 'Không nhận được phản hồi từ AI.';
        return res.status(200).json({ text: responseText });
    }
    catch (err) {
        console.error('Gemini proxy error:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}
