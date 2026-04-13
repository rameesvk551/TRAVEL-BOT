// FILE: /bot/src/handlers/leadCapture.js
// DEPS: none (uses shared models)

const path = require('path');
const { Customer } = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const { updateSession } = require('../utils/sessionManager');
const { detectLanguage } = require('../utils/languageDetect');
const templates = require('../utils/messageTemplates');
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const leadService = require(path.resolve(__dirname, '../../../backend/src/services/leadService.ts'));

/**
 * Multi-step lead capture state machine.
 * Handles all COLLECTING_* steps and transitions.
 * @param {object} session - BotSession instance
 * @param {string} messageText - Incoming message content
 * @param {object} customer - Customer instance
 * @param {object} agency - Agency instance
 * @returns {Promise<string>} Response message to send
 */
async function handleLeadCapture(session, messageText, customer, agency) {
  const lang = customer.language || 'EN';
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const text = messageText.trim();

  switch (session.currentStep) {
    // ========== STEP: NEW ==========
    case 'NEW': {
      // Detect language from first message
      const detectedLang = detectLanguage(text);
      await Customer.update({ language: detectedLang }, { where: { id: customer.id } });

      await updateSession(session, {
        currentStep: 'COLLECTING_NAME',
        collectedData: {},
        failedAttempts: 0,
      });

      const response = templates.greeting(agency.name, detectedLang);
      await whatsappService.sendTextMessage(customer.phone, response, ctx);
      return response;
    }

    // ========== STEP: COLLECTING_NAME ==========
    case 'COLLECTING_NAME': {
      const name = text.replace(/[^\w\s]/g, '').trim();
      if (!name || name.length < 2) {
        const response = lang === 'ML'
          ? 'ദയവായി നിങ്ങളുടെ പേര് പറയുക'
          : 'Please share your name so I can assist you better 😊';
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        return response;
      }

      // Save name
      await Customer.update({ name }, { where: { id: customer.id } });
      await updateSession(session, {
        currentStep: 'COLLECTING_DESTINATION',
        collectedData: { name },
      });

      const response = templates.askDestination(name, lang);
      await whatsappService.sendTextMessage(customer.phone, response, ctx);
      return response;
    }

    // ========== STEP: COLLECTING_DESTINATION ==========
    case 'COLLECTING_DESTINATION': {
      if (text.length < 2) {
        const response = lang === 'ML'
          ? 'ദയവായി നിങ്ങളുടെ ലക്ഷ്യസ്ഥാനം പറയുക'
          : 'Please share where you\'d like to travel 🌍';
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        return response;
      }

      await updateSession(session, {
        currentStep: 'COLLECTING_DATES',
        collectedData: { destination: text },
      });

      const response = templates.askDates(lang);
      await whatsappService.sendTextMessage(customer.phone, response, ctx);
      return response;
    }

    // ========== STEP: COLLECTING_DATES ==========
    case 'COLLECTING_DATES': {
      // Accept natural date formats
      const dateText = text;

      // Basic validation: should contain some numbers
      if (!/\d/.test(dateText)) {
        const response = templates.invalidDates(lang);
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        return response;
      }

      await updateSession(session, {
        currentStep: 'COLLECTING_TRAVELLERS',
        collectedData: { dates: dateText },
      });

      const response = templates.askTravellers(lang);
      await whatsappService.sendTextMessage(customer.phone, response, ctx);
      return response;
    }

    // ========== STEP: COLLECTING_TRAVELLERS ==========
    case 'COLLECTING_TRAVELLERS': {
      // Extract number from text like "2 adults 1 child", "3", "4 people"
      const numbers = text.match(/\d+/g);
      if (!numbers) {
        const response = templates.invalidTravellers(lang);
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        return response;
      }

      const totalTravellers = numbers.reduce((sum, n) => sum + parseInt(n, 10), 0);
      if (totalTravellers < 1 || totalTravellers > 50) {
        const response = templates.invalidTravellers(lang);
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        return response;
      }

      await updateSession(session, {
        currentStep: 'COLLECTING_BUDGET',
        collectedData: { travellers: totalTravellers },
      });

      const response = templates.askBudget(lang);
      await whatsappService.sendTextMessage(customer.phone, response, ctx);
      return response;
    }

    // ========== STEP: COLLECTING_BUDGET ==========
    case 'COLLECTING_BUDGET': {
      // Extract budget: strip ₹, Rs, commas, spaces
      const cleaned = text.replace(/[₹,\s]|rs\.?/gi, '').trim();
      const budget = parseInt(cleaned, 10);

      if (isNaN(budget) || budget <= 0) {
        const response = templates.invalidBudget(lang);
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        return response;
      }

      await updateSession(session, {
        currentStep: 'CONFIRMING',
        collectedData: { budget: budget.toLocaleString('en-IN') },
      });

      const data = {
        name: session.collectedData.name,
        destination: session.collectedData.destination,
        dates: session.collectedData.dates,
        travellers: session.collectedData.travellers,
        budget: budget.toLocaleString('en-IN'),
      };

      const response = templates.confirmSummary(data, lang);
      await whatsappService.sendTextMessage(customer.phone, response, ctx);
      return response;
    }

    // ========== STEP: CONFIRMING ==========
    case 'CONFIRMING': {
      const upper = text.toUpperCase().trim();

      if (upper === 'YES' || upper === 'Y' || upper === 'CONFIRM' || upper === 'OK') {
        // Create lead in DB
        const data = session.collectedData;
        const budgetPaise = parseInt(String(data.budget).replace(/[,\s]/g, ''), 10) * 100;

        const lead = await leadService.createLead({
          customerId: customer.id,
          destination: data.destination,
          travelDates: data.dates,
          travellers: data.travellers,
          budgetPerPerson: budgetPaise,
          notes: `Collected via WhatsApp bot`,
        }, agency.id);

        // Assign to least-busy agent
        const agent = await leadService.findLeastBusyAgent(agency.id);
        if (agent) {
          await leadService.updateLead(lead.id, agency.id, { assignedAgentId: agent.id });

          // Notify agent
          const agentNotif = templates.agentNewLead(
            data.name, customer.phone, data.destination,
            data.dates, data.travellers, data.budget
          );
          if (agent.phone) {
            await whatsappService.sendTextMessage(agent.phone, agentNotif, ctx);
          }
        }

        await updateSession(session, { currentStep: 'COMPLETE' });

        const response = templates.leadCreated(data.name, agency.phone, lang);
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        return response;
      }

      if (upper === 'EDIT' || upper === 'CHANGE' || upper === 'MODIFY') {
        await updateSession(session, { currentStep: 'COLLECTING_DESTINATION' });
        const response = templates.askDestination(session.collectedData.name || 'there', lang);
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        return response;
      }

      // Unrecognized input
      const response = templates.confirmOrEdit(lang);
      await whatsappService.sendTextMessage(customer.phone, response, ctx);
      return response;
    }

    // ========== STEP: COMPLETE ==========
    case 'COMPLETE': {
      // Customer messaged after completing — restart flow or forward
      const response = lang === 'ML'
        ? 'നന്ദി! നിങ്ങൾക്ക് പുതിയ ഒരു യാത്ര ആസൂത്രണം ചെയ്യണോ? ദയവായി വിവരങ്ങൾ പറയുക.'
        : 'Would you like to plan a new trip? Just share your destination and I\'ll help you! 🌟';
      await whatsappService.sendTextMessage(customer.phone, response, ctx);

      // Reset session for new conversation
      await updateSession(session, {
        currentStep: 'COLLECTING_DESTINATION',
        collectedData: { name: customer.name },
      });

      return response;
    }

    default: {
      // Unknown step — reset to NEW
      await updateSession(session, { currentStep: 'NEW' });
      return handleLeadCapture(session, messageText, customer, agency);
    }
  }
}

module.exports = { handleLeadCapture };
