# Agent Operations Guide

## 👨‍💼 For Travel Agents Using WhatsApp

---

## 📥 What You'll Receive

### When a Customer Starts a Chat

```
Hi there! 👋
A new customer just messaged us on WhatsApp.
Their lead has been created and assigned to you.
```

**Monitor your WhatsApp** - You'll receive notifications automatically.

---

## 📌 Lead Notification Format (After Enquiry)

You'll receive a message that looks like this:

```
🔥 New Enquiry

Name: Ramees Khan
Phone: +91-98765-43210
📍 Package: Bali Adventure
📍 Date: May 10-20
👥 People: 2
💰 Budget: ₹25,000
📝 Notes: Honeymoon trip preferred

[📞 Call Now]
[✅ Mark as Contacted]  
[🎉 Mark as Booked]
[Add Note]
```

---

## 🎯 Actions You Can Take

### 1. Call the Customer

**Click:** [📞 Call Now]

You'll see:
```
📞 Call this customer

Name: Ramees Khan
Phone: +91-98765-43210
Package: Bali Adventure
Date: May 10-20
People: 2
```

- Tap the phone number to call
- Have the customer's details ready during call
- After call, update the lead status

---

### 2. Mark as Contacted

**Click:** [✅ Mark as Contacted]

```
✅ Lead updated to CONTACTED
```

**When to use:**
- After you've called the customer
- When they confirm interest
- When you've sent them a quote

**Lead Status Changes:**
- Before: `ENQUIRY`
- After: `CONTACTED`

---

### 3. Mark as Booked

**Click:** [🎉 Mark as Booked]

```
🎉 Lead updated to BOOKED
```

**When to use:**
- Customer confirms final booking
- Payment received
- Itinerary sent to customer

**Lead Status Changes:**
- Before: `CONTACTED` or `QUOTED`
- After: `BOOKED`

---

### 4. Add a Note

**Send:** `NOTE: Customer wants AC room only`

The system will:
```
Note added to the lead
```

**Examples of good notes:**
- `NOTE: Prefers vegetarian meals`
- `NOTE: Traveling with infant - needs crib`
- `NOTE: Budget can increase if dates shift`
- `NOTE: Shared room acceptable`
- `NOTE: Asked to call after 6 PM only`

---

## 💬 Chat History

When you receive a notification, you can see:
1. **Customer's enquiry details** - Name, phone, package, dates, budget
2. **Previous messages** - Full conversation history (if available)
3. **Lead timeline** - When they first contacted, each interaction

---

## 📱 WhatsApp Bot Conversation with Customer

The customer sees this flow:

```
Bot: "Hi Ramees 👋 Welcome to XYZ Travels"
     [Domestic] [International]

Customer: Clicks "Domestic"

Bot: Shows 5 domestic packages

Customer: Selects "Bali Adventure"

Bot: Shows package details
     [Enquire Now] [Call Now]

Customer: Clicks "Enquire Now"

Bot: Shows form (name, date, people, budget)

Customer: Fills form → "Name: Ramees, Date: May 10-20, 2 people, ₹25k budget"

Bot: "Thanks Ramees! Our expert will contact you shortly"

🔔 YOU RECEIVE NOTIFICATION 🔔
```

---

## ✅ Daily Agents Workflow

### Morning
1. Check WhatsApp for overnight enquiries
2. Prioritize high-budget leads
3. Call customers with fresh enquiries (< 1 hour old)

### During Business Hours
1. **React immediately** to new notifications
2. **Segment leads:**
   - Hot leads (₹30k+ budget) → Call within 15 mins
   - Warm leads (₹15k-30k) → Call within 1 hour
   - Cool leads (< ₹15k) → Call within 24 hours

3. **Keep track:**
   - Mark as CONTACTED when called
   - Add notes about next steps
   - Quote within 24 hours of contact

### Follow-up Actions
- If customer says "NO" → Add note, don't mark as booked
- If customer wants to think → Set reminder callback
- If customer agrees → Mark as BOOKED, send itinerary link
- If customer is hard to reach → Try calling at different times

---

## 📊 Lead Status Progression

```
JUST_CONTACTED (Initial)
    ↓
   NEW (Menu shown)
    ↓
  ENQUIRY (Customer submitted details)
    ↓
  YOU ACT HERE ↓
    ↓
 CONTACTED (You called them)
    ↓
 QUOTED (Price sent)
    ↓
NEGOTIATING (Back & forth on price/dates)
    ↓
  BOOKED (Confirmed & paid)
    ↓
 COMPLETED (Trip finished)
```

---

## 🎙️ What to Say During Calls

### Opening
```
"Hi Ramees! This is [Your Name] from XYZ Travels.
I'm calling regarding your enquiry for Bali Adventure.
Do you have 2 minutes?"
```

### Information Gathering
- Confirm travel dates flexibility
- Check if ₹25k/person is fixed or negotiable
- Ask any special requirements
- Check if companion has any preferences
- Confirm preferred mode of travel

### Closing
```
"Great! I'll prepare a customized quote.
Expect it in your WhatsApp within 2 hours.
Any questions for now? Sounds good? Thanks!"
```

---

## 💰 Handling Budget Questions

**Customer says:** "Budget is too high"

**Response:**
- "What's your ideal budget?"
- "We can suggest dates that are cheaper"
- "Off-season pricing is ₹20k/person"
- "Group discounts available for 4+ people"

**After negotiation:**
- Add note: `NOTE: Customer negotiated to ₹20k from ₹25k`
- Send customized quote

---

## 📞 What Happens When You're Offline

1. Customer message comes in → Bot handles it
2. Bot shows packages & takes enquiry
3. When enquiry completes → Notification sent to you
4. When you come online → See all pending leads in notification history

**Tip:** Set WhatsApp online hours in your profile to manage customer expectations

---

## 🔔 Notification Tips

### Turn ON Notifications For:
- ✅ New Enquiries (`ENQUIRY` status)
- ✅ Customer replies
- ✅ Important agent notes

### What to Do:
1. Tap notification → Should open WhatsApp chat
2. See lead details
3. Click action buttons (Call, Mark as Contacted, etc.)
4. Or reply with `NOTE:` to add notes

---

## ⚡ Quick Commands

Instead of clicking buttons, you can type:

| Command | Action |
|---------|--------|
| `NOTE: Customer very interested` | Add note |
| `contacted` | Mark as Contacted |
| `booked` | Mark as Booked |
| `call now` | Show call details |

---

## 🎯 Performance Metrics You'll Be Judged On

1. **Response Time**
   - Hot leads: < 15 min
   - Warm leads: < 1 hour
   - Cool leads: < 24 hours

2. **Conversion Rate**
   - % of ENQUIRY → BOOKED

3. **Customer Satisfaction**
   - Reply to questions promptly
   - Professional communication
   - Follow-up as promised

4. **Accuracy**
   - Correct lead status updates
   - No duplicate enquiries
   - Proper note documentation

---

## ❓ Troubleshooting

### "I didn't get a notification"
- **Check:** WhatsApp notifications are enabled
- **Check:** Do Not Disturb is off
- **Try:** Restart WhatsApp app
- **Fallback:** Check Bot Dashboard for your leads

### "Can't see customer's phone number"
- **Check:** You have permission to view customer details
- **Check:** Contact your admin to verify access

### "Lead shows wrong status"
- **Wait:** Might be syncing (usually < 5 seconds)
- **Refresh:** Close and reopen WhatsApp

### "Customer got wrong info from bot"
- **Take note:** `NOTE: Bot showed wrong price, corrected to ₹X`
- **Call customer:** Confirm correct details
- **Inform admin:** About bot configuration issue

---

## 📝 Template Responses

### For First Call
```
Hi [Name], this is [Your Name] from XYZ Travels.
You were interested in [Package Name] for [Dates].
I have 3 options for you:
- Deluxe package at ₹X
- Premium package at ₹Y  
- Economy package at ₹Z

Which options work for you?
```

### For Quote Follow-up
```
[Name], I just sent you a customized quote for [Package].
It includes [Flights/Hotel/Meals/Activities].
The total is ₹X for 2 people.
Can you share it with your travel companion?
I'll call tomorrow to confirm.
```

### For Closing
```
[Name], booking your Bali trip is just one click.
I'll send payment link via WhatsApp now.
Once paid, you're all set!
Questions? Call me anytime.
```

---

## 📅 Sample Weekly Schedule

### Monday
- Call Fri/Sat leads first thing AM
- Follow up on pending quotes

### Tuesday-Thursday
- Quick response to new enquiries
- Quote preparation
- Customer callbacks

### Friday
- Final follow-ups before weekend
- Prepare weekend packages
- Plan Monday campaign

### Weekends/Evenings
- Only urgent callbacks
- Prepare for next week

---

## 🏆 Tips to Succeed

1. **Respond FAST** - First call within 15 mins if possible
2. **Be Personal** - Use customer's name, remember preferences
3. **Send Visual Content** - Share package images/videos
4. **Give Options** - 3 pricing tiers = higher conversion
5. **Create Urgency** - "Only 2 rooms left at this price"
6. **Follow Through** - Do exactly what you promised
7. **Get Reviews** - After trip, ask for rating/testimonial

---

## 📞 Get Help

- **Tech Issue:** Contact Tech Support
- **Lead Question:** Check CRM dashboard
- **Customer Complaint:** Escalate to Manager
- **System Down:** Use email as backup

---

**Remember:** Every lead represents a potential customer. Fast, professional responses = more bookings = higher commission! 🚀

---

**Last Updated:** April 17, 2024
**Version:** 1.0
