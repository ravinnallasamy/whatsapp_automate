const axios = require('axios');
const { jwtDecode } = require('jwt-decode');
const User = require('../models/User');

const ACCESS_TOKEN_API_URL = process.env.ACCESS_TOKEN_API_URL;
const AI_CHAT_API_URL = process.env.AI_CHAT_API_URL;

/**
 * Fetches a new access token from the external API.
 */
async function getAccessToken(phoneNumber) {
    try {
        const response = await axios.post(ACCESS_TOKEN_API_URL, { phoneNumber });
        // Assuming response.data.access_token exists
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
 * Helper to check if token is expired or expires soon (e.g., within 5 minutes)
 */
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const decoded = jwtDecode(token);
        if (!decoded.exp) return false; // No expiry set, assume valid until 401

        const now = Date.now() / 1000;
        // Check if expired or expiring in next 60 seconds (buffer)
        return decoded.exp < (now + 60);
    } catch (e) {
        console.warn("Token decode failed, treating as valid until 401", e.message);
        return false;
    }
}

/**
 * Calls the AI Chat API.
 * Returns the raw JSON response.
 */
async function callAIChat(accessToken, conversationId, question) {
    try {
        const payload = {
            conversation_id: conversationId,
            question,
            enable_cache: true // Added per user request
        };
        const config = {
            headers: { Authorization: `Bearer ${accessToken}` }
        };

        const response = await axios.post(AI_CHAT_API_URL, payload, config);
        return response.data; // Expected format: { text, metrics, tables, ... }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            throw new Error('AUTH_FAILURE');
        }
        // Also handle possible AI explicit rejection of conversation_id if API returns specific error
        if (error.response && error.response.data && error.response.data.error === 'INVALID_CONVERSATION_ID') {
            throw new Error('INVALID_CONVERSATION_ID');
        }
        throw error;
    }
}

/**
 * Initializes a new conversation with the AI system.
 */
async function createConversationId(accessToken) {
    try {
        // Placeholder: Assuming AI API has an endpoint to start a conversation or returns a new ID
        // Or if we need to call the chat API with a specific flag.
        // Based on typical patterns:
        const response = await axios.post(`${AI_CHAT_API_URL}/new`, {}, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return response.data.conversation_id;
    } catch (e) {
        // console.warn("Failed to create conversation explicitly...", e.message);
        // Fallback for demo purposes if endpoint doesn't exist yet
        return `conv_${Date.now()}`;
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
        // New User
        console.log(`New user: ${phoneNumber}`);
        accessToken = await getAccessToken(phoneNumber);
        accessToken = await getAccessToken(phoneNumber);
        conversationId = null; // Let AI API generate it

        user = new User({
            phoneNumber,
            accessToken,
            conversationId,
            tokenLastRefreshedAt: new Date()
        });
        await user.save();
    } else {
        // Existing User
        console.log(`Existing user: ${phoneNumber}`);
        accessToken = user.accessToken;
        conversationId = user.conversationId;

        // ** PROACTIVE REFRESH LOGIC **
        // Check if token is expired based on JWT 'exp' claim
        if (isTokenExpired(accessToken)) {
            console.log('Token expired (time check). Refreshing proactively...');
            try {
                const newAccessToken = await getAccessToken(phoneNumber);
                user.accessToken = newAccessToken;
                user.tokenLastRefreshedAt = new Date();
                await user.save();
                accessToken = newAccessToken; // Update local variable for use below
            } catch (authErr) {
                console.error("Failed to refresh token proactively:", authErr.message);
                // We could throw or try to proceed and let 401 handle it, 
                // but usually better to fail fast or try fallback.
                // We'll proceed in case checking time was wrong (e.g. clock drift)
            }
        }
    }

    // 2. AI Interaction with Retry Logic
    try {
        const aiResponse = await callAIChat(accessToken, conversationId, messageText);

        // Capture Conversation ID from AI Response
        if (aiResponse.conversation_id && aiResponse.conversation_id !== user.conversationId) {
            user.conversationId = aiResponse.conversation_id;
            await user.save();
        }
        return aiResponse;
    } catch (error) {
        if (error.message === 'AUTH_FAILURE') {
            console.log('Auth failed (401). Refreshing token...');
            // Token invalid despite time check (e.g. revoked). Refresh.
            try {
                const newAccessToken = await getAccessToken(phoneNumber);

                // Update User
                user.accessToken = newAccessToken;
                user.tokenLastRefreshedAt = new Date();
                await user.save();

                // Retry ONCE
                console.log('Retrying AI call with new token...');
                const retryResponse = await callAIChat(newAccessToken, conversationId, messageText);

                // Capture Conversation ID from Retry Response
                if (retryResponse.conversation_id && retryResponse.conversation_id !== user.conversationId) {
                    user.conversationId = retryResponse.conversation_id;
                    await user.save();
                }
                return retryResponse;
            } catch (retryError) {
                console.error('Retry failed:', retryError.message);
                throw new Error('AI_SERVICE_UNAVAILABLE');
            }
        } else if (error.message === 'INVALID_CONVERSATION_ID') {
            // Regenerate Conversation ID Logic
            console.log('Conversation ID rejected. Regenerating...');
            console.log('Conversation ID rejected. Requesting new one from API...');

            // Reset to null and request new
            const retryResponse = await callAIChat(accessToken, null, messageText);

            if (retryResponse.conversation_id) {
                user.conversationId = retryResponse.conversation_id;
                await user.save();
            }
            return retryResponse;
        }

        // Other errors
        throw error;
    }
}

module.exports = { processUserMessage };
