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

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        console.error('💡 HINT: If on Render, ensure you have whitelisted 0.0.0.0/0 (Anywhere) in MongoDB Atlas Network Access.');
    });

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

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
