# 🤖 AI Auto-Reply + Lead Closing System - Production Ready

## ✅ System Overview

A production-grade AI-powered WhatsApp sales agent that:
- ✅ Replies ONLY to outbound leads (contacted via automation)
- ✅ Qualifies clinic owners intelligently
- ✅ Pitches service (patient growth via website + WhatsApp automation)
- ✅ Handles objections (price, trust, demo)
- ✅ Closes deals in ₹4000–₹7000 range
- ✅ Sends demo links when asked
- ✅ Auto follow-up after 5–10 minutes if no response
- ✅ Human-like behavior (delays, tone, variation)

---

## 🏗️ Architecture

### **Components**

1. **Contact Tracking** (`contactedUsers` Set)
   - Tracks all users contacted via outbound system
   - Only replies to tracked users
   - Prevents spam/unsolicited replies

2. **Message Listener** (`messages.upsert` event)
   - Listens for incoming messages
   - Filters by contacted users
   - Extracts message text

3. **AI Brain** (OpenAI GPT-4o-mini)
   - System prompt with sales strategy
   - Generates human-like responses
   - Handles objections intelligently

4. **Human-like Behavior**
   - Random 4-8 second delays
   - Natural conversation flow
   - Varied responses

5. **Follow-up System**
   - Schedules follow-up after 5-10 minutes
   - Prevents duplicate follow-ups
   - Tracks timers per user

---

## 📊 System Prompt (AI Brain)

```
You are a professional WhatsApp sales expert helping clinic owners get more patients.

GOAL: Convert leads into paying clients (₹4000–₹7000 service).

SERVICE: We help clinics increase patients using:
1. High-converting website
2. WhatsApp automation (lead handling + follow-ups)

STYLE:
* Short messages (2–4 lines)
* Friendly, human tone
* No long paragraphs
* No AI-like language
* Ask questions to engage

FLOW:
1. If user shows interest: Explain benefit
2. If user asks "how": Explain simply
3. If user asks price: Say ₹4000–₹7000
4. If user asks demo: Send demo links
5. If user says yes: Move to close
6. If user ignores: Ask qualifying question
7. If user says no: Polite exit
```

---

## 🔄 Message Flow

```
1. Outbound System Sends Message
   ↓
2. Contact Added to contactedUsers Set
   ↓
3. User Replies
   ↓
4. Message Listener Detects Reply
   ↓
5. Check if User in contactedUsers
   ↓
6. Wait 4-8 seconds (human-like delay)
   ↓
7. Generate AI Reply via OpenAI
   ↓
8. Send Reply
   ↓
9. Schedule Follow-up (5-10 min)
```

---

## 💻 Code Implementation

### **Key Functions**

#### 1. Track Contacted User
```typescript
export function addContactedUser(jid: string): void {
  contactedUsers.add(jid);
  console.log('[AI] Tracked contacted user:', jid);
}
```

#### 2. Generate AI Reply
```typescript
async function generateAIReply(userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 150
  });
  return response.choices[0].message.content || 'Thanks for your message!';
}
```

#### 3. Schedule Follow-up
```typescript
function scheduleFollowUp(from: string, sock: WASocket): void {
  const delayMs = (Math.floor(Math.random() * (10 - 5 + 1)) + 5) * 60 * 1000;
  const timer = setTimeout(async () => {
    await sock.sendMessage(from, {
      text: 'Just checking 🙂 are you interested in getting more patient inquiries for your clinic?'
    });
  }, delayMs);
  followUpTimers.set(from, timer);
}
```

#### 4. Message Listener
```typescript
sock.ev.on('messages.upsert', async (m) => {
  const msg = m.messages[0];
  if (!msg.message || msg.key.fromMe) return;
  
  const from = msg.key.remoteJid || '';
  if (!contactedUsers.has(from)) return;
  
  const text = msg.message.conversation || '';
  
  // Human-like delay
  const delay = Math.floor(Math.random() * (8 - 4 + 1)) + 4;
  await new Promise(r => setTimeout(r, delay * 1000));
  
  // Generate and send reply
  const reply = await generateAIReply(text);
  await sock.sendMessage(from, { text: reply });
  
  // Schedule follow-up
  scheduleFollowUp(from, sock);
});
```

---

## 🚀 How It Works

### **Step 1: Outbound Message Sent**
```
[OUTBOUND] Sending to 919155604591
[BAILEYS] Message sent to 919155604591
[AI] Tracked contacted user: 919155604591@s.whatsapp.net
```

### **Step 2: User Replies**
```
[AI] Incoming from 919155604591@s.whatsapp.net: Hi, tell me more
```

### **Step 3: AI Generates Reply**
```
[AI] Generating reply...
[AI] Reply: We help clinics get more patient inquiries using a simple website + WhatsApp automation. Would you like to see how it works?
```

### **Step 4: Reply Sent**
```
[AI] Replied to 919155604591@s.whatsapp.net
```

### **Step 5: Follow-up Scheduled**
```
[FOLLOWUP] Scheduled for 919155604591@s.whatsapp.net (in 7 minutes)
```

### **Step 6: Follow-up Sent**
```
[FOLLOWUP] Sent to 919155604591@s.whatsapp.net
```

---

## 📈 Sales Flow Examples

### **Example 1: Interested Lead**
```
User: Hi, how can this help my clinic?
AI: We help clinics get more patient inquiries using website + WhatsApp automation. 
    Every inquiry is handled automatically. Interested?
User: Yes, tell me the price
AI: It usually comes between ₹4000–₹7000 depending on setup.
User: Sounds good, let's do it
AI: Should I set this up for your clinic this week?
```

### **Example 2: Price Objection**
```
User: That's expensive
AI: I understand. But think about it - you'll get more patients automatically.
    Most clinics make back the investment in 2-3 weeks. Worth a try?
User: Maybe, can I see a demo?
AI: Sure! Check these out:
    https://ayaan-wellness-care.netlify.app/
    https://suchitratental.netlify.app/
```

### **Example 3: No Response**
```
[After 5-10 minutes of silence]
AI: Just checking 🙂 are you interested in getting more patient inquiries for your clinic?
```

---

## ⚙️ Configuration

### **AI Model**
- Model: `gpt-4o-mini` (fast, cost-effective)
- Temperature: 0.7 (balanced creativity)
- Max tokens: 150 (concise responses)

### **Delays**
- Message reply delay: 4-8 seconds (human-like)
- Follow-up delay: 5-10 minutes (random)

### **Demo Links**
```
https://ayaan-wellness-care.netlify.app/
https://suchitratental.netlify.app/
```

### **Price Range**
- ₹4000–₹7000 (adjustable)

---

## 🔐 Safety Features

### **Contact Filtering**
- Only replies to contacted users
- Prevents spam/unsolicited replies
- Tracks all contacted users

### **Error Handling**
- Graceful fallback messages
- Try-catch blocks
- Detailed logging

### **Rate Limiting**
- Human-like delays
- Follow-up timer management
- Prevents duplicate follow-ups

---

## 📊 Logging

All actions are logged with prefixes:

| Prefix | Meaning |
|--------|---------|
| `[AI]` | AI system events |
| `[FOLLOWUP]` | Follow-up messages |
| `[BAILEYS]` | WhatsApp client |
| `[OUTBOUND]` | Outbound messages |

---

## 🎯 Key Features

✅ **Intelligent Replies**
- Understands context
- Handles objections
- Qualifies leads

✅ **Human-like Behavior**
- Random delays
- Natural tone
- Varied responses

✅ **Sales Focused**
- Pitches service
- Handles price objections
- Sends demo links
- Closes deals

✅ **Automated Follow-up**
- Schedules after 5-10 min
- Prevents duplicates
- Tracks per user

✅ **Production Ready**
- Error handling
- Logging
- Contact filtering
- Safe to deploy

---

## 🚀 Running the System

```bash
# Compile TypeScript
npx tsc

# Run the system
npm start

# Or directly
node demo/dist/index.js
```

---

## 📝 Expected Output

```
[BOOT] Baileys WhatsApp Automation Started
[BOOT] Connected to WhatsApp
[ENGINE] Multi-sheet outbound engine started
[BOOT] System Ready

[OUTBOUND] Sending to 919155604591
[BAILEYS] Message sent to 919155604591
[AI] Tracked contacted user: 919155604591@s.whatsapp.net

[AI] Incoming from 919155604591@s.whatsapp.net: Hi, tell me more
[AI] Replied to 919155604591@s.whatsapp.net
[FOLLOWUP] Scheduled for 919155604591@s.whatsapp.net (in 7 minutes)
```

---

## 🔧 Customization

### **Change System Prompt**
Edit `systemPrompt` in `demo/baileys-client.ts`

### **Change Demo Links**
Update URLs in system prompt

### **Change Price Range**
Update ₹4000–₹7000 in system prompt

### **Change Follow-up Delay**
Modify `Math.random() * (10 - 5 + 1) + 5` (currently 5-10 minutes)

### **Change Message Delay**
Modify `Math.random() * (8 - 4 + 1) + 4` (currently 4-8 seconds)

---

## ✨ Benefits

- ✅ **24/7 Sales Agent** - Replies automatically
- ✅ **Human-like** - Doesn't sound like a bot
- ✅ **Intelligent** - Handles objections
- ✅ **Scalable** - Works with unlimited leads
- ✅ **Cost-effective** - Uses GPT-4o-mini
- ✅ **Trackable** - Detailed logging
- ✅ **Safe** - Only replies to contacted users

---

## 📞 Support

For issues or customization:
1. Check logs for errors
2. Verify OpenAI API key is set
3. Ensure contacted users are tracked
4. Check message format

---

**Status**: ✅ PRODUCTION READY

**Last Updated**: 2024
**Version**: 1.0
