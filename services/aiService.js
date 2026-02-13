const axios = require('axios');
const { jwtDecode } = require('jwt-decode');
const User = require('../models/User');

const ACCESS_TOKEN_API_URL = process.env.ACCESS_TOKEN_API_URL;
const AI_CHAT_API_URL = process.env.AI_CHAT_API_URL;

// Helper to determine if we should use mock data
const isMockMode = () => {
    return process.env.USE_MOCK_AI === 'true' ||
        (ACCESS_TOKEN_API_URL && ACCESS_TOKEN_API_URL.includes('example.com'));
};

const MOCK_AI_RESPONSE = {
    "success": true,
    "status": "OK",
    "conversation_id": "c_mock_12345",
    "answer": {
        "status": "OK",
        "type": "visual",
        "summary": "Hello! I am operating in MOCK MODE since the API URL is not set. Here is sample revenue data.",
        "blocks": [
            {
                "type": "table",
                "headers": ["Month", "Net Revenue (Lacs)", "Sales Revenue (Lacs)", "Net SQM"],
                "rows": [
                    ["Oct 2025", 4127.48, 4213.52, 1477928.16],
                    ["Nov 2025", 5556.86, 5575.80, 1994092.78],
                    ["Dec 2025", 6100.96, 6141.73, 2166930.66],
                    ["Jan 2026", 5794.24, 5817.64, 2091267.38],
                    ["Feb 2026", 1396.42, 1403.66, 518763.79]
                ],
                "total_rows": 5
            },
            {
                "type": "metrics",
                "summary": "Overall Trends",
                "metrics": [
                    { "label": "Total Net Revenue", "value": "22975.96 Lacs" },
                    { "label": "Highest Month", "value": "Dec 2025" }
                ]
            },
            {
                "type": "suggestions",
                "items": [
                    "Show region-wise breakdown",
                    "Compare with last year",
                    "Download PDF report"
                ]
            }
        ]
    }
};

/**
 * Fetches a new access token from the external API.
 */
async function getAccessToken(phoneNumber) {
    if (isMockMode()) {
        console.log("⚠️ Using MOCK Access Token (Active)");
        return "mock_access_token_123";
    }

    try {
        const response = await axios.post(ACCESS_TOKEN_API_URL, { mobile_number: phoneNumber });
        if (!response.data || !response.data.access_token) {
            throw new Error('Invalid response from Access Token API');
        }
        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching access token:', error.message);
        throw error;
    }
}

/**
 * Helper to check if token is expired
 */
function isTokenExpired(token) {
    if (!token) return true;
    if (token === "mock_access_token_123") return false; // Mock token never expires

    try {
        const decoded = jwtDecode(token);
        if (!decoded.exp) return false;
        const now = Date.now() / 1000;
        return decoded.exp < (now + 60);
    } catch (e) {
        return false;
    }
}

/**
 * Calls the AI Chat API.
 */
async function callAIChat(accessToken, conversationId, question) {
    if (isMockMode()) {
        console.log("⚠️ Using MOCK AI Response (Active)");
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return MOCK_AI_RESPONSE;
    }

    try {
        const payload = {
            conversation_id: conversationId,
            question,
            enable_cache: true
        };
        const config = {
            headers: { Authorization: `Bearer ${accessToken}` }
        };

        const response = await axios.post(AI_CHAT_API_URL, payload, config);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            throw new Error('AUTH_FAILURE');
        }
        if (error.response && error.response.data && error.response.data.error === 'INVALID_CONVERSATION_ID') {
            throw new Error('INVALID_CONVERSATION_ID');
        }
        throw error;
    }
}

/**
 * Main handler for processing a message.
 */
async function processUserMessage(phoneNumber, messageText) {
    let user = await User.findOne({ phoneNumber });
    let accessToken;
    let conversationId;

    // 1. Authentication & Session Flow
    if (!user) {
        console.log(`New user: ${phoneNumber}`);
        accessToken = await getAccessToken(phoneNumber);
        conversationId = null;

        user = new User({
            phoneNumber,
            accessToken,
            conversationId,
            tokenLastRefreshedAt: new Date()
        });
        await user.save();
    } else {
        console.log(`Existing user: ${phoneNumber}`);
        accessToken = user.accessToken;
        conversationId = user.conversationId;

        if (isTokenExpired(accessToken)) {
            console.log('Token expired. Refreshing...');
            try {
                accessToken = await getAccessToken(phoneNumber);
                user.accessToken = accessToken;
                user.tokenLastRefreshedAt = new Date();
                await user.save();
            } catch (authErr) {
                console.error("Failed to refresh token:", authErr.message);
            }
        }
    }

    // 2. AI Interaction
    try {
        const aiResponse = await callAIChat(accessToken, conversationId, messageText);

        if (aiResponse.conversation_id && aiResponse.conversation_id !== user.conversationId) {
            user.conversationId = aiResponse.conversation_id;
            await user.save();
        }
        return aiResponse;
    } catch (error) {
        if (error.message === 'AUTH_FAILURE') {
            console.log('Auth failed (401). Retrying with new token...');
            // Retry logic
            try {
                accessToken = await getAccessToken(phoneNumber);
                user.accessToken = accessToken;
                user.tokenLastRefreshedAt = new Date();
                await user.save();

                const retryResponse = await callAIChat(accessToken, conversationId, messageText);
                if (retryResponse.conversation_id) {
                    user.conversationId = retryResponse.conversation_id;
                    await user.save();
                }
                return retryResponse;
            } catch (retryError) {
                throw new Error('AI_SERVICE_UNAVAILABLE');
            }
        }
        throw error;
    }
}

module.exports = { processUserMessage };
