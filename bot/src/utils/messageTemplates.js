// FILE: /bot/src/utils/messageTemplates.js
// DEPS: none

/**
 * All message templates for the bot.
 * Each function accepts parameters and returns the formatted message.
 * Supports EN (English) and ML (Malayalam) languages.
 */

const templates = {
  /** Greeting when customer first messages */
  greeting: (agencyName, lang = 'EN') => {
    if (lang === 'ML') {
      return `നമസ്കാരം! ${agencyName}-ലേക്ക് സ്വാഗതം. നിങ്ങളുടെ യാത്ര ആസൂത്രണം ചെയ്യാൻ ഞാൻ ഇവിടെയുണ്ട്. നിങ്ങളുടെ പേര് പറയാമോ?`;
    }
    return `Hi! 👋 Welcome to *${agencyName}*. I'm here to help you plan your perfect trip!\n\nMay I know your name?`;
  },

  /** Ask for destination */
  askDestination: (name, lang = 'EN') => {
    if (lang === 'ML') {
      return `നന്ദി, ${name}! നിങ്ങൾ എവിടേക്കാണ് യാത്ര ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?`;
    }
    return `Great, *${name}*! 🌟 Where would you like to travel?`;
  },

  /** Ask for dates */
  askDates: (lang = 'EN') => {
    if (lang === 'ML') {
      return `നിങ്ങളുടെ യാത്ര തീയതികൾ എന്താണ്? (ഉദാ: 15 Dec - 20 Dec)`;
    }
    return `📅 What are your travel dates?\n\nPlease share as DD MMM - DD MMM\n_(e.g. 15 Dec - 20 Dec)_`;
  },

  /** Ask for travellers */
  askTravellers: (lang = 'EN') => {
    if (lang === 'ML') {
      return `എത്ര പേർ യാത്ര ചെയ്യും? (മുതിർന്നവരും കുട്ടികളും വേറെ പറയുക)`;
    }
    return `👥 How many people are travelling?\n_(mention adults and children separately, e.g. "2 adults 1 child")_`;
  },

  /** Ask for budget */
  askBudget: (lang = 'EN') => {
    if (lang === 'ML') {
      return `ഒരാൾക്ക് ഏകദേശം എത്ര ബജറ്റ്? (₹-ൽ)`;
    }
    return `💰 What is your approximate budget per person? _(in ₹)_`;
  },

  /** Show confirmation summary */
  confirmSummary: (data, lang = 'EN') => {
    const { name, destination, dates, travellers, budget } = data;
    if (lang === 'ML') {
      return `📋 *നിങ്ങളുടെ വിവരങ്ങൾ:*\n\n📍 ലക്ഷ്യസ്ഥാനം: ${destination}\n📅 തീയതികൾ: ${dates}\n👥 യാത്രക്കാർ: ${travellers}\n💰 ബജറ്റ്: ₹${budget} ഓരോരുത്തർക്കും\n\nശരിയാണോ? *YES* എന്ന് മറുപടി നൽകുക അല്ലെങ്കിൽ *EDIT* എന്ന് മാറ്റാൻ`;
    }
    return `📋 *Here's what I have:*\n\n📍 Destination: *${destination}*\n📅 Dates: *${dates}*\n👥 Travellers: *${travellers}*\n💰 Budget: *₹${budget}* per person\n\nReply *YES* to confirm or *EDIT* to change anything`;
  },

  /** Lead created confirmation */
  leadCreated: (name, agencyPhone, lang = 'EN') => {
    if (lang === 'ML') {
      return `നന്ദി, ${name}! 🎉 ഞങ്ങളുടെ ട്രാവൽ വിദഗ്ദ്ധൻ 30 മിനിറ്റിനുള്ളിൽ നിങ്ങളെബന്ധപ്പെടും. അടിയന്തിരമായി ${agencyPhone} വിളിക്കുക.`;
    }
    return `Thank you, *${name}*! 🎉\n\nOur travel expert will contact you within *30 minutes* with the best options for you.\n\nFor urgent help, call *${agencyPhone}*`;
  },

  /** Agent handoff message to customer */
  handoffToCustomer: (agentName, lang = 'EN') => {
    if (lang === 'ML') {
      return `${agentName}-മായി നിങ്ങളെ ബന്ധിപ്പിക്കുന്നു. അവർക്ക് നിങ്ങളുടെ എല്ലാ വിവരങ്ങളും ഉണ്ട്.`;
    }
    return `Connecting you with *${agentName}* now. 🤝 They have all your details.`;
  },

  /** No agent available message */
  noAgentAvailable: (agencyPhone, lang = 'EN') => {
    if (lang === 'ML') {
      return `ഞങ്ങളുടെ ടീം ഇപ്പോൾ ലഭ്യമല്ല. 30 മിനിറ്റിനുള്ളിൽ ഞങ്ങൾ മറുപടി നൽകും. അടിയന്തിരമായി ${agencyPhone} വിളിക്കുക.`;
    }
    return `Our team is currently away. We will respond within *30 minutes*. 🕐\n\nFor urgent help, call *${agencyPhone}*`;
  },

  /** Agent notification about new lead */
  agentNewLead: (customerName, phone, destination, dates, travellers, budget) => {
    return `🆕 *NEW LEAD*\n\n👤 ${customerName} (${phone})\n📍 ${destination || 'Not specified'}\n📅 ${dates || 'Not specified'}\n👥 ${travellers || '?'} travellers\n💰 ₹${budget || '?'}/person\n\nCheck your TravelBot dashboard to respond.`;
  },

  /** Agent notification about handoff */
  agentHandoff: (customerName, phone, destination, dates, travellers, budget, reason, lastMessages) => {
    return `🔴 *NEW TRANSFER*\n\n👤 ${customerName} (${phone})\n📍 ${destination || 'N/A'} | 📅 ${dates || 'N/A'}\n👥 ${travellers || '?'} | 💰 ₹${budget || '?'}\n\n📝 Reason: ${reason}\n\n💬 Last messages:\n${lastMessages}\n\nReply via the TravelBot dashboard.`;
  },

  /** Invalid date format */
  invalidDates: (lang = 'EN') => {
    if (lang === 'ML') {
      return `ദയവായി ശരിയായ ഭാവി തീയതികൾ നൽകുക (ഉദാ: 15 Dec - 20 Dec)`;
    }
    return `Please share valid *future* dates 📅\n_e.g. 15 Dec - 20 Dec_`;
  },

  /** Invalid traveller count */
  invalidTravellers: (lang = 'EN') => {
    if (lang === 'ML') {
      return `ദയവായി 1-50 ൽ ഒരു കൺആദ\u200dായ എണ്ണം നൽകുക`;
    }
    return `Please enter a valid number of travellers (1-50) 👥`;
  },

  /** Invalid budget */
  invalidBudget: (lang = 'EN') => {
    if (lang === 'ML') {
      return `ദയവായി ശരിയായ ബജറ്റ് തുക നൽകുക (₹-ൽ)`;
    }
    return `Please enter a valid budget amount in ₹ 💰`;
  },

  /** Confirm or edit prompt */
  confirmOrEdit: (lang = 'EN') => {
    if (lang === 'ML') {
      return `ദയവായി *YES* (ശരി) അല്ലെങ്കിൽ *EDIT* (മാറ്റുക) എന്ന് മറുപടി നൽകുക`;
    }
    return `Please reply *YES* to confirm or *EDIT* to make changes ✏️`;
  },

  /** Fallback when bot fails */
  fallback: (agencyPhone, lang = 'EN') => {
    if (lang === 'ML') {
      return `നിങ്ങളുടെ സന്ദേശം ലഭിച്ചു! ഞങ്ങളുടെ ടീം ഉടൻ ബന്ധപ്പെടും. അടിയന്തിരമായി ${agencyPhone} വിളിക്കുക.`;
    }
    return `Hi! We received your message. Our team will get back to you shortly. For urgent help, call ${agencyPhone}.`;
  },

  /** Review request */
  reviewRequest: (name, destination, lang = 'EN') => {
    if (lang === 'ML') {
      return `${name}, ${destination} യാത്ര എങ്ങനെയുണ്ടായിരുന്നു? 1-5 ⭐ റേറ്റ് ചെയ്യുക.`;
    }
    return `Hi ${name}! 🌟 How was your trip to *${destination}*?\n\nPlease rate your experience from 1-5 ⭐`;
  },
};

module.exports = templates;
