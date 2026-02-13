require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error("❌ MONGODB_URI is undefined in .env file!");
    process.exit(1);
}

// Ensure SSL/TLS options are correct for Atlas
const options = {
    serverSelectionTimeoutMS: 5000, // Fail fast (5s) instead of 30s
    socketTimeoutMS: 45000,
};

console.log("⏳ attempting to connect to MongoDB...");
console.log(`📡 URI Host: ${uri.split('@')[1].split('/')[0]}`); // Log only host for privacy

mongoose.connect(uri, options)
    .then(async () => {
        console.log("✅ CONNECTED to MongoDB Atlas!");

        // Test Data
        const testUser = new User({
            phoneNumber: `test_${Date.now()}`, // unique dummy number
            accessToken: "dummy_token_123",
            conversationId: "conv_test_123",
            tokenLastRefreshedAt: new Date()
        });

        console.log("📝 Inserting test user...");
        const savedUser = await testUser.save();
        console.log("🎉 SUCCESS! User inserted:");
        console.log(savedUser);

        // Clean Up
        console.log("🧹 Cleaning up (Deleting test user)...");
        await User.deleteOne({ _id: savedUser._id });
        console.log("✅ Cleanup Complete.");

        mongoose.connection.close();
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ CONNECTION FAILED!");
        console.error("---------------------------------------------------");
        console.error(err.message);
        console.error("---------------------------------------------------");

        if (err.message.includes("buffering timed out") || err.name === "MongooseServerSelectionError") {
            console.error("🚨 DIAGNOSIS: This is almost certainly an IP WHITELIST issue.");
            console.error("👉 Please go to MongoDB Atlas > Network Access > Add IP Address > 0.0.0.0/0");
        }

        process.exit(1);
    });
