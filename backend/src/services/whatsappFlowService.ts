const {
  decryptFlowRequest,
  encryptFlowResponse,
} = require('../utils/flowEncryption');
const { Agency, Package } = require('../models');

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

  if (parts[0] !== 'pkg') {
    return {
      agencyId: null,
      category: null,
      customerId: null,
    };
  }

  return {
    agencyId: parts[1] || null,
    category: normalizeCategory(parts[2]) || null,
    customerId: parts[3] || null,
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

async function buildPackageOptions(agencyId, category, limit = 5) {
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
    const [agency, packageOptions] = await Promise.all([
      Agency.findOne({ where: { id: agencyId } }),
      buildPackageOptions(agencyId, tokenInfo.category, 5),
    ]);

    if (agency) {
      const category = tokenInfo.category || normalizeCategory(decryptedBody?.data?.category || decryptedBody?.screen || '') || 'DOMESTIC';
      const responsePayload = {
        data: {
          category_label: categoryLabel(category),
          package_options: packageOptions,
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
