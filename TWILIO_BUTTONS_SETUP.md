# 📱 Setting Up WhatsApp Interactive Buttons (Twilio Content API)

This guide explains how to enable **clickable buttons** for your AI suggestions in WhatsApp using Twilio's **Content API**.

---

## 1️⃣ Create the Template in Twilio Console

1.  **Log in to Twilio**: Go to [console.twilio.com](https://console.twilio.com/).
2.  Navigate to **Messaging** > **Content Editor**.
3.  Click **Create new content**.
4.  **Friendly Name**: Enter `AI Report Response`.
5.  **Language**: Select `English (en)`.
6.  **Content Type**: Choose **Quick Reply**.

### Configure Body & Variables
7.  **Body**: Enter `{{1}}` in the message text box.
    *   *This placeholder `{{1}}` will be dynamically replaced by your AI's main response.*
8.  **Actions (Buttons)**:
    *   Click **Add Action** -> **Quick Reply**.
        *   **Title**: `{{2}}`
        *   **Payload**: `suggestion_1`
    *   Click **Add Action** -> **Quick Reply**.
        *   **Title**: `{{3}}`
        *   **Payload**: `suggestion_2`
    *   Click **Add Action** -> **Quick Reply**.
        *   **Title**: `{{4}}`
        *   **Payload**: `suggestion_3`
    *   *(You can add more if needed, but 3 is standard for Quick Reply).*

9.  **Save & Submit**:
    *   Click **Save**.
    *   (Optional now, mandatory for Production): Click **Submit for WhatsApp Approval**.
    *   Since you are likely testing in Sandbox or internal numbers, creating it is enough to get the ID.

10. **Copy the SID**:
    *   Go back to the **Content Editor** list.
    *   Find your new template.
    *   Copy the **SID** (It looks like `HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`).

---

## 2️⃣ Update Your Code

Once you have the `HX...` SID, we need to update `whatsappController.js` to use it instead of plain text.

**Let me know your SID**, and I will generate the code update for you automatically!

### Example Code Logic (Preview)

```javascript
// Instead of sending body: "Text", we send contentSid:
await client.messages.create({
  from: 'whatsapp:+14155238886',
  to: 'whatsapp:+1234567890',
  contentSid: 'HX12345...', // Your Template ID
  contentVariables: JSON.stringify({
    1: aiResponseText, // {{1}}
    2: suggestion1,    // {{2}}
    3: suggestion2,    // {{3}}
    4: suggestion3     // {{4}}
  })
});
```

---

## 3️⃣ Handling Fewer Suggestions
If the AI only returns 2 suggestions, we just fill `{{4}}` with an empty string or handle logic to pick a different template. For simplicity, we usually stick to 3 slots or use a generic "List Picker" for variable length.

### Alternative: List Picker (Menu)
If you want a **Menu** instead of buttons (easier logic for variable suggestions):
1.  Create Content Type: **List Picker**.
2.  Body: `{{1}}`.
3.  Button Label: `View Options`.
4.  List Items: Add 10 items with labels `{{2}}`, `{{3}}`, etc.

**Recommended**: Stick to **Quick Reply** (3 Buttons) for best UX.

---

## 🚀 Next Steps
1.  Follow Step 1 above to get your `HX` SID.
2.  **Paste the SID here** in the chat.
3.  I will update your backend code to seamlessly use this template!
