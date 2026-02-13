require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const whatsappController = require('./controllers/whatsappController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false })); // Twilio sends form-urlencoded data
app.use(bodyParser.json());

// Routes
// Verification Endpoint (Optional for manual testing or Facebook verification)
app.get('/', (req, res) => {
    res.send('WhatsApp Chatbot Backend is running.');
});

const fs = require('fs');
const path = require('path');

// Serve Static Files for Reports (Twilio needs public URL to fetch media)
app.use('/reports', express.static(path.join(__dirname, 'public/reports')));

// Optional: Scheduled Cleanup for old reports (every 1 hour)
setInterval(() => {
    const reportDir = path.join(__dirname, 'public/reports');
    if (!fs.existsSync(reportDir)) return;

    fs.readdir(reportDir, (err, files) => {
        if (err) return;
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(reportDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                // Delete files older than 15 minutes
                if (now - stats.mtimeMs > 15 * 60 * 1000) {
                    fs.unlink(filePath, () => { });
                }
            });
        });
    });
}, 60 * 60 * 1000);

// Twilio Webhook Endpoint
app.post('/whatsapp', whatsappController.handleIncomingMessage);

// --- Database Connection & Server Startup ---
// Step 3: Disable Mongoose buffering
mongoose.set('bufferCommands', false);

console.log("⏳ Initializing Database Connection...");

// Step 1: Connect MongoDB ONCE
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
    .then(() => {
        console.log('✅ Connected to MongoDB Atlas');

        // Step 2: Start server ONLY after DB is connected
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Startup Connection Error:', err);
        console.error('💡 HINT: Check IP Whitelist in Atlas/Network Access.');
        process.exit(1); // Exit process if DB fails
    });
