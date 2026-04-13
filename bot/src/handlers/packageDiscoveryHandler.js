const path = require('path');
const { Op } = require('sequelize');
const { Package } = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const { updateSession } = require('../utils/sessionManager');
const { sendQuote } = require('./quoteHandler');

const PACKAGE_KEYWORDS = [
  'package',
  'packages',
  'tour',
  'tours',
  'holiday',
  'holidays',
  'itinerary',
];

const PACKAGE_COMMANDS = [
  'show packages',
  'show me packages',
  'list packages',
  'send packages',
  'available packages',
  'tour packages',
  'holiday packages',
];

function isPackageIntent(messageText = '') {
  const lower = messageText.toLowerCase().trim();
  if (!lower) return false;

  if (PACKAGE_COMMANDS.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  return PACKAGE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function extractSearchQuery(messageText = '') {
  let query = messageText.toLowerCase().trim();

  for (const phrase of PACKAGE_COMMANDS) {
    query = query.replace(phrase, ' ');
  }

  query = query
    .replace(/\b(show|list|find|need|want|for|me|some|available|any|a|an|please)\b/g, ' ')
    .replace(/\b(package|packages|tour|tours|trip|trips|holiday|holidays|itinerary|itineraries)\b/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return query;
}

function formatPackageList(packages, query, lang = 'EN') {
  if (lang === 'ML') {
    const lines = packages.map((pkg, index) => {
      const price = `Rs.${(pkg.basePrice / 100).toLocaleString('en-IN')}`;
      const destinations = pkg.destinations?.slice(0, 2).join(', ') || 'Multiple destinations';
      const duration = pkg.duration || 'Custom duration';
      return `${index + 1}. *${pkg.name}* - ${duration} - ${destinations} - ${price}/person`;
    });

    return [
      query ? `*${query}* നു പൊരുത്തപ്പെടുന്ന പാക്കേജുകൾ:` : 'ഞങ്ങളുടെ ലഭ്യമായ പാക്കേജുകൾ:',
      '',
      ...lines,
      '',
      'കൂടുതൽ വിവരങ്ങൾക്ക് പാക്കേജ് നമ്പർ reply ചെയ്യൂ.',
    ].join('\n');
  }

  const lines = packages.map((pkg, index) => {
    const price = `Rs.${(pkg.basePrice / 100).toLocaleString('en-IN')}`;
    const destinations = pkg.destinations?.slice(0, 2).join(', ') || 'Multiple destinations';
    const duration = pkg.duration || 'Custom duration';
    return `${index + 1}. *${pkg.name}* - ${duration} - ${destinations} - ${price}/person`;
  });

  return [
    query ? `Here are our packages for *${query}*:` : 'Here are our available packages:',
    '',
    ...lines,
    '',
    'Reply with the package number for full details.',
  ].join('\n');
}

async function findPackages(agencyId, query) {
  const baseWhere = { agencyId, isActive: true };

  if (!query) {
    return Package.findAll({
      where: baseWhere,
      order: [['createdAt', 'DESC']],
      limit: 5,
    });
  }

  const broadMatches = await Package.findAll({
    where: {
      ...baseWhere,
      [Op.or]: [
        { name: { [Op.iLike]: `%${query}%` } },
        { duration: { [Op.iLike]: `%${query}%` } },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 10,
  });

  const destinationMatches = await Package.findAll({
    where: baseWhere,
    order: [['createdAt', 'DESC']],
    limit: 25,
  });

  const combined = [...broadMatches];
  for (const pkg of destinationMatches) {
    const haystacks = [pkg.name, pkg.duration, ...(pkg.destinations || [])]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    if (haystacks.some((value) => value.includes(query.toLowerCase())) && !combined.some((item) => item.id === pkg.id)) {
      combined.push(pkg);
    }
  }

  return combined.slice(0, 5);
}

async function showPackageList(session, messageText, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const lang = customer.language || 'EN';
  const query = extractSearchQuery(messageText);
  const packages = await findPackages(agency.id, query);

  if (packages.length === 0) {
    const response = lang === 'ML'
      ? 'ആ destination ന് ഇപ്പോൾ പാക്കേജുകൾ കണ്ടില്ല. ഒരു സ്ഥലം പേര് അയക്കൂ, ഞാൻ വീണ്ടും നോക്കാം.'
      : 'I could not find packages for that yet. Send me a destination name and I will look again.';

    await updateSession(session, {
      currentStep: 'PACKAGE_BROWSING',
      collectedData: {
        packageResults: [],
        packageSearchQuery: query || '',
      },
    });
    await whatsappService.sendTextMessage(customer.phone, response, ctx);
    return response;
  }

  await updateSession(session, {
    currentStep: 'PACKAGE_BROWSING',
    collectedData: {
      packageResults: packages.map((pkg) => pkg.id),
      packageSearchQuery: query || '',
    },
  });

  const response = formatPackageList(packages, query, lang);
  await whatsappService.sendTextMessage(customer.phone, response, ctx);
  return response;
}

async function handlePackageBrowsing(session, messageText, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const lang = customer.language || 'EN';
  const text = messageText.trim();
  const selectedNumber = parseInt(text, 10);
  const resultIds = Array.isArray(session.collectedData?.packageResults)
    ? session.collectedData.packageResults
    : [];

  if (!Number.isNaN(selectedNumber) && selectedNumber >= 1 && selectedNumber <= resultIds.length) {
    const packageId = resultIds[selectedNumber - 1];

    await updateSession(session, {
      currentStep: 'QUOTED',
      collectedData: {
        selectedPackageId: packageId,
      },
    });

    await sendQuote(session, customer, agency, packageId);
    return;
  }

  if (isPackageIntent(text) || text.length >= 2) {
    await showPackageList(session, text, customer, agency);
    return;
  }

  const response = lang === 'ML'
    ? 'ദയവായി ഒരു പാക്കേജ് നമ്പർ അല്ലെങ്കിൽ destination name അയക്കൂ.'
    : 'Please reply with a package number or send a destination name.';

  await whatsappService.sendTextMessage(customer.phone, response, ctx);
}

module.exports = {
  isPackageIntent,
  showPackageList,
  handlePackageBrowsing,
};
