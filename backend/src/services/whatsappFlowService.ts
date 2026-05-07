const {
  decryptFlowRequest,
  encryptFlowResponse,
} = require('../utils/flowEncryption');
const { Agency, Package, Property } = require('../models');

const PACKAGE_BROWSE_LIMIT = Math.max(1, parseInt(process.env.WHATSAPP_PACKAGE_BROWSE_LIMIT || '20', 10) || 20);
const PROPERTY_BROWSE_LIMIT = Math.max(1, parseInt(process.env.WHATSAPP_PROPERTY_BROWSE_LIMIT || '20', 10) || 20);

function normalizeCategory(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'domestic') return 'DOMESTIC';
  if (normalized === 'international') return 'INTERNATIONAL';
  return null;
}

function categoryLabel(value = '') {
  return normalizeCategory(value) === 'INTERNATIONAL' ? 'International' : 'Domestic';
}

function parseFlowToken(token = '') {
  const parts = String(token || '').split('|');

  if (parts[0] === 'pkg') {
    return {
      type: 'PACKAGE',
      agencyId: parts[1] || null,
      category: normalizeCategory(parts[2]) || null,
      customerId: parts[3] || null,
    };
  }

  if (parts[0] === 'prop') {
    return {
      type: 'PROPERTY',
      agencyId: parts[1] || null,
      category: null,
      customerId: parts[2] || null,
    };
  }

  if (parts[0] === 'campaign-prop') {
    return {
      type: 'PROPERTY',
      agencyId: parts[1] || null,
      category: null,
      campaignId: parts[2] || null,
      customerId: parts[3] || null,
    };
  }

  if (parts[0] === 'review') {
    return {
      type: 'REVIEW',
      agencyId: parts[1] || null,
      category: null,
      customerId: parts[2] || null,
      bookingId: parts[3] || null,
    };
  }

  return {
    type: null,
    agencyId: null,
    category: null,
    customerId: null,
  };
}

function escapeMarkdown(text = '') {
  return String(text || '').replace(/\*/g, '').trim();
}

function formatCurrency(amountPaise) {
  const amount = Number(amountPaise || 0) / 100;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function inferPackageCategory(pkg) {
  const explicit = normalizeCategory(pkg?.category);
  if (explicit) return explicit;

  const searchable = [
    pkg?.name,
    pkg?.summary,
    ...(Array.isArray(pkg?.destinations) ? pkg.destinations : []),
    ...(Array.isArray(pkg?.inclusions) ? pkg.inclusions : []),
  ].join(' ').toLowerCase();

  const domesticKeywords = [
    'india', 'goa', 'kerala', 'munnar', 'alleppey', 'kochi', 'cochin', 'kovalam',
    'himachal', 'manali', 'shimla', 'kashmir', 'srinagar', 'gulmarg', 'pahalgam',
    'jaipur', 'udaipur', 'leh', 'ladakh', 'andaman', 'lakshadweep', 'delhi', 'mumbai',
  ];

  return domesticKeywords.some((keyword) => searchable.includes(keyword))
    ? 'DOMESTIC'
    : 'INTERNATIONAL';
}

function packageMatchesCategory(pkg, category) {
  const normalized = normalizeCategory(category);
  if (!normalized) return true;
  return inferPackageCategory(pkg) === normalized;
}

async function buildPackageOptions(agencyId, category, limit = PACKAGE_BROWSE_LIMIT) {
  if (!agencyId) return [];

  const packages = await Package.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    order: [['createdAt', 'DESC']],
  });

  return packages
    .filter((pkg) => packageMatchesCategory(pkg, category))
    .slice(0, limit)
    .map((pkg) => ({
      id: pkg.id,
      title: escapeMarkdown(pkg.name).slice(0, 30) || 'Travel Package',
      description: `${formatCurrency(pkg.basePrice)} • ${escapeMarkdown(pkg.duration || 'Custom itinerary')}\n${escapeMarkdown(pkg.summary || '')}`.slice(0, 300),
      metadata: escapeMarkdown(categoryLabel(inferPackageCategory(pkg))).slice(0, 20),
      image: pkg.imageUrl || '',
    }));
}

async function buildPropertyOptions(agencyId, limit = PROPERTY_BROWSE_LIMIT) {
  if (!agencyId) return [];

  const properties = await findPropertyRecords(agencyId, {}, limit);
  return mapPropertyOptions(properties);
}

function mapPropertyOptions(properties) {
  if (!properties.length) {
    return [{
      id: '__no_results',
      title: 'No matching stays',
      description: 'Try another location or contact our team for more options.',
      metadata: 'No results',
      image: '',
    }];
  }

  return properties.map((property) => ({
    id: property.id,
    title: escapeMarkdown(property.name).slice(0, 30) || 'Property',
    description: `${property.pricePerNight ? `${formatCurrency(property.pricePerNight)}/night` : 'Price on request'} - ${escapeMarkdown(property.location || 'Selected destination')}\n${escapeMarkdown(property.description || `${property.propertyType || 'Property'} stay with curated support`)}`.slice(0, 300),
    metadata: escapeMarkdown([property.propertyType || 'Property', property.location || ''].filter(Boolean).join(' - ')).slice(0, 20),
    image: property.imageUrl || '',
  }));
}

async function findPropertyRecords(agencyId, filters = {}, limit = PROPERTY_BROWSE_LIMIT) {
  if (!agencyId) return [];

  const properties = await Property.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    order: [['createdAt', 'DESC']],
  });

  const locationFilter = String(filters.propertyLocation || filters.location || '').trim().toLowerCase();
  return properties
    .filter((property) => {
      if (!locationFilter || locationFilter === 'all') return true;
      return String(property.location || '').trim().toLowerCase() === locationFilter;
    })
    .slice(0, limit);
}

async function buildPropertyLocationOptions(agencyId) {
  if (!agencyId) return [{ id: 'ALL', title: 'All locations' }];

  const properties = await Property.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    attributes: ['location'],
    order: [['location', 'ASC']],
  });

  const seen = new Set();
  const locations = [];
  for (const property of properties) {
    const location = escapeMarkdown(property.location || '').trim();
    if (!location) continue;
    const key = location.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push({
      id: location,
      title: location.slice(0, 30),
    });
  }

  return [
    { id: 'ALL', title: 'All locations' },
    ...locations,
  ];
}

function getNestedFlowBody(payload = {}) {
  if (payload?.encrypted_flow_data || payload?.action === 'ping') {
    return payload;
  }

  const nestedValue = payload?.entry?.[0]?.changes?.[0]?.value;
  if (nestedValue?.encrypted_flow_data || nestedValue?.action === 'ping') {
    return nestedValue;
  }

  return payload;
}

function buildEncryptedResponse(decryptedBody = {}) {
  const action = String(decryptedBody?.action || '').toUpperCase();
  if (action === 'PING') {
    return { data: { status: 'active' } };
  }

  const flowToken = decryptedBody?.flow_token || decryptedBody?.flowToken || decryptedBody?.token || '';
  const tokenInfo = parseFlowToken(flowToken);
  const responseData = decryptedBody?.data && typeof decryptedBody.data === 'object'
    ? decryptedBody.data
    : {};

  return {
    data: {
      category_label: responseData.category_label || categoryLabel(tokenInfo.category),
      package_options: Array.isArray(responseData.package_options) && responseData.package_options.length > 0
        ? responseData.package_options
        : [],
      property_options: Array.isArray(responseData.property_options) && responseData.property_options.length > 0
        ? responseData.property_options
        : [],
      property_locations: Array.isArray(responseData.property_locations) && responseData.property_locations.length > 0
        ? responseData.property_locations
        : [{ id: 'ALL', title: 'All locations' }],
      screen: decryptedBody?.screen || 'PACKAGE_SELECTOR',
      version: '3.0',
    },
  };
}

async function handleFlowRequest(payload = {}) {
  const body = getNestedFlowBody(payload);

  if (String(body?.action || '').toUpperCase() === 'PING') {
    return {
      statusCode: 200,
      isEncrypted: false,
      body: { data: { status: 'active' } },
    };
  }

  const { encrypted_flow_data, encrypted_aes_key, initial_vector } = body || {};
  if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
    return {
      statusCode: 400,
      isEncrypted: false,
      body: { error: 'Missing encrypted flow payload' },
    };
  }

  const {
    decryptedBody,
    aesKeyBuffer,
    initialVectorBuffer,
  } = decryptFlowRequest(encrypted_aes_key, encrypted_flow_data, initial_vector);

  const flowToken = decryptedBody?.flow_token || decryptedBody?.flowToken || decryptedBody?.token || '';
  const tokenInfo = parseFlowToken(flowToken);
  const agencyId = decryptedBody?.agency_id || decryptedBody?.agencyId || tokenInfo.agencyId;

  if (agencyId) {
    const [agency, packageOptions, propertyOptions, propertyLocations] = await Promise.all([
      Agency.findOne({ where: { id: agencyId } }),
      buildPackageOptions(agencyId, tokenInfo.category, PACKAGE_BROWSE_LIMIT),
      buildPropertyOptions(agencyId, PROPERTY_BROWSE_LIMIT),
      buildPropertyLocationOptions(agencyId),
    ]);

    if (agency) {
      const action = String(decryptedBody?.action || '').toUpperCase();
      const screen = String(decryptedBody?.screen || '').toUpperCase();
      const data = decryptedBody?.data && typeof decryptedBody.data === 'object' ? decryptedBody.data : {};

      if (tokenInfo.type === 'PROPERTY' && action === 'DATA_EXCHANGE' && screen === 'PROPERTY_FILTER') {
        const filteredProperties = await findPropertyRecords(agencyId, data, PROPERTY_BROWSE_LIMIT);
        const propertyLocation = String(data.propertyLocation || data.location || 'ALL').trim() || 'ALL';
        const responsePayload = {
          screen: 'PROPERTY_SELECTOR',
          data: {
            propertyLocation: propertyLocation.toLowerCase() === 'all' ? 'All locations' : propertyLocation,
            checkInDate: String(data.checkInDate || data.check_in_date || '').trim(),
            checkOutDate: String(data.checkOutDate || data.check_out_date || '').trim(),
            guests: String(data.guests || data.travellers || '').trim(),
            property_options: mapPropertyOptions(filteredProperties),
          },
        };

        return {
          statusCode: 200,
          isEncrypted: true,
          body: encryptFlowResponse(responsePayload, aesKeyBuffer, initialVectorBuffer),
        };
      }

      const category = tokenInfo.category || normalizeCategory(decryptedBody?.data?.category || decryptedBody?.screen || '') || 'DOMESTIC';
      const isPropertyFlow = tokenInfo.type === 'PROPERTY'
        || String(decryptedBody?.screen || '').toUpperCase().includes('PROPERTY')
        || Array.isArray(decryptedBody?.data?.property_options);
      const responsePayload = {
        data: {
          ...(isPropertyFlow
            ? {
                property_locations: propertyLocations,
                property_options: propertyOptions,
              }
            : {
                category_label: categoryLabel(category),
                package_options: packageOptions,
              }),
        },
      };

      return {
        statusCode: 200,
        isEncrypted: true,
        body: encryptFlowResponse(responsePayload, aesKeyBuffer, initialVectorBuffer),
      };
    }
  }

  const responsePayload = buildEncryptedResponse(decryptedBody);
  return {
    statusCode: 200,
    isEncrypted: true,
    body: encryptFlowResponse(responsePayload, aesKeyBuffer, initialVectorBuffer),
  };
}

module.exports = {
  handleFlowRequest,
};
