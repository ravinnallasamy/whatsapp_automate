const aiService = require('../services/aiService');
const formatter = require('../services/formatter');
const twilio = require('twilio');
const reportGenerator = require('../services/reportGenerator');
const fs = require('fs');
const path = require('path');

// Initialize Twilio Client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.handleIncomingMessage = async (req, res) => {
    // 1. Respond to Twilio immediately
    res.status(200).send('<Response></Response>');

    const { From, Body } = req.body;
    if (!From || !Body) {
        console.error("Invalid Twilio Request:", req.body);
        return;
    }

    const phoneNumber = From.replace('whatsapp:', '');
    const userMessage = Body;

    console.log(`Received message from ${phoneNumber}: ${userMessage}`);

    try {
        // 2. Process via AI Service
        const aiData = await aiService.processUserMessage(phoneNumber, userMessage);

        // 3. Inspect Data for Tables (Dynamic Media Logic)
        let tableData = null;

        // Helper to find table in hybrid formats
        if (aiData.tables && aiData.tables.length > 0) tableData = aiData.tables[0];
        else if (aiData.answer && aiData.answer.blocks) {
            const tableBlock = aiData.answer.blocks.find(b => b.type === 'table');
            if (tableBlock) tableData = tableBlock;
        }

        // 4. Generate & Send Response (Media vs Text)
        if (tableData) {
            try {
                // Generate PDF or Image
                const media = await reportGenerator.generateTableMedia(tableData);

                // Save to public/reports
                const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const filename = `report_${uniqueId}.${media.mime === 'application/pdf' ? 'pdf' : 'png'}`;
                const reportsDir = path.join(__dirname, '../public/reports');

                if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

                fs.writeFileSync(path.join(reportsDir, filename), media.buffer);

                const mediaUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reports/${filename}`;

                // Format Text Body (Omitting Table)
                const formattedData = formatter.formatResponse(aiData, { omitTables: true });

                // Send Message 1: Context + Media
                let caption = formattedData.body;
                if (media.message) caption += `\n\n${media.message}`;
                caption += `\n🔗 Link: ${mediaUrl}`;

                await client.messages.create({
                    from: req.body.To,
                    to: From,
                    body: caption,
                    mediaUrl: [mediaUrl]
                });

                // Send Message 2: Suggestions (Separate for better UX)
                if (formattedData.suggestions && formattedData.suggestions.length > 0) {
                    const suggestionsText = formattedData.suggestions
                        .map((s, i) => `*${i + 1}.* ${s}`)
                        .join('\n');

                    await client.messages.create({
                        from: req.body.To,
                        to: From,
                        body: `*💡 Suggested Questions:*\n_Reply with key words or number:_\n\n${suggestionsText}`
                    });
                }

                return; // Done

            } catch (genError) {
                console.error("Media Generation Failed, falling back to text:", genError);
                // Fallback to standard flow below
            }
        }

        // Standard Text Logic (Fallback or No Table)
        const formattedData = formatter.formatResponse(aiData);
        let messageBody = formattedData.body;

        // Append Suggestions
        if (formattedData.suggestions && formattedData.suggestions.length > 0) {
            const suggestionsText = formattedData.suggestions
                .map((s, i) => `*${i + 1}.* ${s}`)
                .join('\n');
            messageBody += `\n\n────────────────\n\n*💡 Suggested Questions:*\n_Reply with key words or number:_\n\n${suggestionsText}`;
        }

        await client.messages.create({
            from: req.body.To,
            to: From,
            body: messageBody
        });

    } catch (error) {
        console.error('Error in processing flow:', error);
        try {
            await client.messages.create({
                from: req.body.To,
                to: From,
                body: "We are currently unavailable. Please try again later."
            });
        } catch (sendError) {
            console.error("Failed to send error message:", sendError);
        }
    }
};
