const {
  decryptFlowRequest,
  encryptFlowResponse,
} = require('../utils/flowEncryption');
const { Agency, Package, Property } = require('../models');
const http = require('http');
const https = require('https');

const PACKAGE_BROWSE_LIMIT = Math.max(1, parseInt(process.env.WHATSAPP_PACKAGE_BROWSE_LIMIT || '20', 10) || 20);
const PROPERTY_BROWSE_LIMIT = Math.max(1, parseInt(process.env.WHATSAPP_PROPERTY_BROWSE_LIMIT || '20', 10) || 20);
const FLOW_PLACEHOLDER_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yh8cAAAAASUVORK5CYII=';
const FLOW_IMAGE_TRANSFORM = 'w_400,h_300,c_fill,f_jpg,q_auto';
const imageCache = new Map();

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
      tourType: parts[5] ? decodeURIComponent(parts[5]) : null,
    };
  }

  if (parts[0] === 'prop') {
    return {
      type: 'PROPERTY',
      agencyId: parts[1] || null,
      category: null,
      customerId: parts[2] || null,
      propertyType: parts[4] ? decodeURIComponent(parts[4]) : null,
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
  return String(text || '').replace(/\*/g, '＊').trim();
}

function packageDescriptionText(text = '') {
  return escapeMarkdown(text);
}

function formatCurrency(amountPaise) {
  const amount = Number(amountPaise || 0) / 100;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function packagePriceLabel(amountPaise) {
  const amount = Number(amountPaise || 0);
  return Number.isFinite(amount) && amount > 0 ? formatCurrency(amount) : '';
}

function packageSummaryLine(pkg, separator = ' - ') {
  return [
    packagePriceLabel(pkg?.basePrice),
    escapeMarkdown(pkg?.duration || 'Custom itinerary'),
  ].filter(Boolean).join(separator);
}

function toAbsoluteFlowImageUrl(imageUrl = '') {
  const url = String(imageUrl || '').trim();
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('/uploads/')) {
    const baseUrl = String(process.env.BASE_URL || '').trim();
    return baseUrl ? `${baseUrl.replace(/\/$/, '')}${url}` : '';
  }
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  return cloudName ? `https://res.cloudinary.com/${cloudName}/image/upload/${url.replace(/^\/+/, '')}` : '';
}

function normalizeFlowImageUrl(imageUrl = '') {
  const url = toAbsoluteFlowImageUrl(imageUrl);
  if (!url || url.startsWith('data:image/')) return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/${FLOW_IMAGE_TRANSFORM}/`);
}

function fetchBuffer(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }

    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.get(parsed, (res) => {
      if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        if (redirects <= 0 || !res.headers.location) {
          reject(new Error('Too many redirects while fetching flow image'));
          return;
        }
        fetchBuffer(new URL(res.headers.location, parsed).toString(), redirects - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Image request failed with status ${res.statusCode}`));
        return;
      }

      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) {
          req.destroy(new Error('Image too large for WhatsApp Flow payload'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function getFlowBase64Image(imageUrl) {
  const normalized = normalizeFlowImageUrl(imageUrl);
  if (!normalized) return FLOW_PLACEHOLDER_IMAGE;
  if (imageCache.has(normalized)) return imageCache.get(normalized);
  if (normalized.startsWith('data:image/')) {
    const [, payload = ''] = normalized.split(',', 2);
    const inlinePayload = payload || FLOW_PLACEHOLDER_IMAGE;
    imageCache.set(normalized, inlinePayload);
    return inlinePayload;
  }

  try {
    const buffer = await fetchBuffer(normalized);
    const encoded = buffer.length ? buffer.toString('base64') : FLOW_PLACEHOLDER_IMAGE;
    imageCache.set(normalized, encoded);
    return encoded;
  } catch (err) {
    console.warn('[WhatsAppFlow] Could not embed property image in flow:', err.message);
    imageCache.set(normalized, FLOW_PLACEHOLDER_IMAGE);
    return FLOW_PLACEHOLDER_IMAGE;
  }
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

function normalizeTourType(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function packageMatchesTourType(pkg, tourType) {
  const normalized = normalizeTourType(tourType);
  if (!normalized) return true;
  return normalizeTourType(pkg?.tourType) === normalized;
}

async function buildPackageOptions(agencyId, category, limit = PACKAGE_BROWSE_LIMIT, tourType = null) {
  if (!agencyId) return [];

  const packages = await Package.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    order: [['createdAt', 'DESC']],
  });

  return packages
    .filter((pkg) => packageMatchesCategory(pkg, category) && packageMatchesTourType(pkg, tourType))
    .slice(0, limit)
    .map((pkg) => ({
      id: pkg.id,
      title: escapeMarkdown(pkg.name).slice(0, 30) || 'Travel Package',
      description: `${packageSummaryLine(pkg)}\n${packageDescriptionText(pkg.summary || '')}`.trim().slice(0, 300),
      metadata: escapeMarkdown(categoryLabel(inferPackageCategory(pkg))).slice(0, 20),
      image: pkg.imageUrl || '',
    }));
}

async function buildPropertyOptions(agencyId, limit = PROPERTY_BROWSE_LIMIT) {
  if (!agencyId) return [];

  const properties = await findPropertyRecords(agencyId, {}, limit);
  return mapPropertyOptions(properties);
}

async function buildFilteredPropertyOptions(agencyId, filters = {}, limit = PROPERTY_BROWSE_LIMIT) {
  if (!agencyId) return [];

  const properties = await findPropertyRecords(agencyId, filters, limit);
  return mapPropertyOptions(properties);
}

async function mapPropertyOptions(properties) {
  if (!properties.length) {
    return [{
      id: '__no_results',
      title: 'No matching stays',
      description: 'Try another location or contact our team for more options.',
      metadata: 'No results',
      image: '',
    }];
  }

  return Promise.all(properties.map(async (property) => ({
    id: property.id,
    title: escapeMarkdown(property.name).slice(0, 30) || 'Property',
    description: `${property.pricePerNight ? `${formatCurrency(property.pricePerNight)}/night` : 'Price on request'} - ${escapeMarkdown(property.location || 'Selected destination')}\n${escapeMarkdown(property.description || `${property.propertyType || 'Property'} stay with curated support`)}`.slice(0, 300),
    metadata: escapeMarkdown([property.propertyType || 'Property', property.location || ''].filter(Boolean).join(' - ')).slice(0, 20),
    image: await getFlowBase64Image(property.imageUrl),
  })));
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
  const propertyTypeFilter = String(filters.propertyType || filters.type || '').trim().toLowerCase();
  return properties
    .filter((property) => {
      const locationMatches = !locationFilter
        || locationFilter === 'all'
        || String(property.location || '').trim().toLowerCase() === locationFilter;
      const typeMatches = !propertyTypeFilter
        || propertyTypeFilter === 'all'
        || String(property.propertyType || '').trim().toLowerCase() === propertyTypeFilter;
      return locationMatches && typeMatches;
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

async function buildPropertyTypeOptions(agencyId) {
  const fallback = [
    { id: 'ALL', title: 'All stay types' },
    { id: 'Villa', title: 'Villa' },
    { id: 'Resort', title: 'Resort' },
    { id: 'Hotel', title: 'Hotel' },
    { id: 'Apartment', title: 'Apartment' },
  ];

  if (!agencyId) return fallback;

  const properties = await Property.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    attributes: ['propertyType'],
    order: [['propertyType', 'ASC']],
  });

  const seen = new Set();
  const types = [];
  for (const property of properties) {
    const propertyType = escapeMarkdown(property.propertyType || '').trim();
    if (!propertyType) continue;
    const key = propertyType.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    types.push({
      id: propertyType,
      title: propertyType.slice(0, 30),
    });
  }

  return types.length ? [{ id: 'ALL', title: 'All stay types' }, ...types] : fallback;
}

async function buildFilteredPropertyTypeOptions(agencyId, filters = {}) {
  const propertyType = String(filters.propertyType || filters.type || '').trim();
  if (propertyType) {
    return [{ id: propertyType, title: propertyType.slice(0, 30) }];
  }

  return buildPropertyTypeOptions(agencyId);
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
      property_types: Array.isArray(responseData.property_types) && responseData.property_types.length > 0
        ? responseData.property_types
        : [{ id: 'ALL', title: 'All stay types' }],
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
    const tokenPropertyFilters = tokenInfo.type === 'PROPERTY' && tokenInfo.propertyType
      ? { propertyType: tokenInfo.propertyType }
      : {};
    const [agency, packageOptions, propertyOptions, propertyLocations, propertyTypes] = await Promise.all([
      Agency.findOne({ where: { id: agencyId } }),
      buildPackageOptions(agencyId, tokenInfo.category, PACKAGE_BROWSE_LIMIT, tokenInfo.tourType),
      buildFilteredPropertyOptions(agencyId, tokenPropertyFilters, PROPERTY_BROWSE_LIMIT),
      buildPropertyLocationOptions(agencyId),
      buildFilteredPropertyTypeOptions(agencyId, tokenPropertyFilters),
    ]);

    if (agency) {
      const action = String(decryptedBody?.action || '').toUpperCase();
      const screen = String(decryptedBody?.screen || '').toUpperCase();
      const data = decryptedBody?.data && typeof decryptedBody.data === 'object' ? decryptedBody.data : {};

      if (tokenInfo.type === 'PROPERTY' && action === 'DATA_EXCHANGE' && screen === 'PROPERTY_FILTER') {
        const forcedPropertyType = tokenInfo.propertyType || '';
        const filters = {
          ...data,
          ...(forcedPropertyType ? { propertyType: forcedPropertyType } : {}),
        };
        const filteredProperties = await findPropertyRecords(agencyId, filters, PROPERTY_BROWSE_LIMIT);
        const propertyLocation = String(data.propertyLocation || data.location || 'ALL').trim() || 'ALL';
        const propertyType = forcedPropertyType || String(data.propertyType || data.type || 'ALL').trim() || 'ALL';
        if (!filteredProperties.length) {
          const responsePayload = {
            screen: 'STAY_REQUEST',
            data: {
              propertyLocation: propertyLocation.toLowerCase() === 'all' ? '' : propertyLocation,
              propertyType: propertyType.toLowerCase() === 'all' ? 'Any' : propertyType,
            },
          };

          return {
            statusCode: 200,
            isEncrypted: true,
            body: encryptFlowResponse(responsePayload, aesKeyBuffer, initialVectorBuffer),
          };
        }

        const responsePayload = {
          screen: 'PROPERTY_SELECTOR',
          data: {
            propertyLocation: propertyLocation.toLowerCase() === 'all' ? 'All locations' : propertyLocation,
            propertyType: propertyType.toLowerCase() === 'all' ? 'All stay types' : propertyType,
            property_options: await mapPropertyOptions(filteredProperties),
          },
        };

        return {
          statusCode: 200,
          isEncrypted: true,
          body: encryptFlowResponse(responsePayload, aesKeyBuffer, initialVectorBuffer),
        };
      }

      if (tokenInfo.type === 'PROPERTY' && action === 'DATA_EXCHANGE' && screen === 'PROPERTY_SELECTOR') {
        const selectedPropertyId = String(data.propertyId || data.property_id || '').trim();
        const responsePayload = {
          screen: 'PROPERTY_DATES',
          data: {
            propertyId: selectedPropertyId,
            propertyLocation: String(data.propertyLocation || data.location || '').trim(),
            propertyType: String(data.propertyType || data.type || '').trim(),
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
                property_types: propertyTypes,
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
