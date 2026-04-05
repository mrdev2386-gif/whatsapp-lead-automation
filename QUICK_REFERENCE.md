# 🔥 QUICK REFERENCE: SALES CLOSER FEATURES

## FEATURE 1: HARD CLOSE OVERRIDE
**Trigger:** User says "price", "cost", "kitna"
**Response:** Pricing + Setup offer + Close question
**Stage:** → closing

## FEATURE 2: SCORE SYSTEM
```
interest    = +10
pricing     = +20
confirm     = +30
demo_request= +15
rejection   = -20
```

## FEATURE 3: AUTO CLOSE TRIGGER
**Trigger:** Score >= 40
**Response:** \"Let's get this started. Confirm to proceed?\"
**Stage:** → closing

## FEATURE 4: FINAL PAYMENT PUSH
**Trigger:** Stage = closing + user confirms
**Response:** \"I'm locking your setup. Team will contact you.\"
**Stage:** → converted (DEAD)

## FEATURE 5: URGENCY PUSH
**Trigger:** Stage = interested + score > 20
**Response:** \"Limited slots this week. Reserve one?\"
**Effect:** Creates FOMO

---

## CONVERSATION FLOW

```
START (new)
  ↓
User shows interest (+10 score)
  ↓
User asks price (+20 score) → HARD CLOSE
  ↓
Score >= 40 → AUTO CLOSE TRIGGER
  ↓
User confirms → FINAL PAYMENT PUSH
  ↓
CONVERTED ✅
```

---

## LOG INDICATORS

- `[SCORE] Hot lead detected!` = Auto-close triggered
- `[CONVERTED] Lead closed!` = Deal locked
- `[URGENCY] Sending limited slots` = FOMO activated

---

## PRICING RULES

Dynamic pricing based on country code:
- India (91, 92): ₹25,000 one-time + ₹2,000/month
- US/UAE (1, 971): $800 one-time + $200/month
- Others: $700 one-time + $200/month

---

## REPLY STYLE

✅ DO:
- Short (1-3 lines)
- Confident
- Push decision
- Hinglish tone
- End with question

❌ DON'T:
- Long explanations
- Support tone
- Say "we will contact you"
- Delay closing
- Use emojis/symbols

---

## STAGE PROGRESSION

new → interested → qualified → confirm_start → converted

With scoring:
- 0-20: Low interest
- 20-40: Medium interest
- 40+: HOT LEAD (auto-close)

---

## ADMIN COMMANDS

Send to bot: `START BULK`
→ Initiates bulk outreach from sheet

---

## ENVIRONMENT VARIABLES

```
OPENAI_API_KEY=sk-...
SESSION_ID=9155604591
SHEET_URL=https://...
ADMIN_NUMBER=919999999999@c.us
```

---

## TESTING

Send these messages to test:

1. "Hi" → Greeting response
2. "What's the price?" → HARD CLOSE
3. "Interested" → Score +10
4. "Yes, let's do it" → FINAL PUSH
5. "No thanks" → Rejection (-20 score)

---

## PERFORMANCE METRICS

Track in logs:
- Total leads: Check state.json
- Converted: stage = 'converted'
- Average score: Sum scores / count
- Conversion rate: converted / total

---

**Last Updated:** 2024
**Status:** Production Ready ✅
