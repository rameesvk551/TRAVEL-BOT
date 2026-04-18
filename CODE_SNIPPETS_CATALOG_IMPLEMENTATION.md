# Code Snippets for Catalog Implementation

> Note: This implementation assumes WhatsApp is already connected and authenticated via the existing provider. Only the Meta Catalog ID is required in Settings; API token and business account ID are not needed for the simplified flow.

## 1. Database Migrations

### PostgreSQL Migration File
**File:** `backend/migrations/[timestamp]_add_catalog_fields.sql`

```sql
-- Add catalog config fields to agencies
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS catalog_config JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS catalog_sync_status VARCHAR DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS last_catalog_sync TIMESTAMP DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_agencies_catalog_status 
ON agencies(catalog_sync_status);

-- Add catalog fields to packages
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS catalog_product_id VARCHAR DEFAULT NULL,
ADD COLUMN IF NOT EXISTS catalog_sync_status VARCHAR DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_catalog_sync TIMESTAMP DEFAULT NULL;

-- Add index for catalog lookups
CREATE INDEX IF NOT EXISTS idx_packages_catalog_product_id 
ON packages(catalog_product_id);

CREATE INDEX IF NOT EXISTS idx_packages_catalog_sync_status 
ON packages(catalog_sync_status);

-- Add catalog order fields to leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS catalog_order_data JSONB DEFAULT NULL;

-- Add catalog fields to bookings
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS catalog_order_id VARCHAR DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual';

-- Add index for catalog orders
CREATE INDEX IF NOT EXISTS idx_bookings_catalog_order_id 
ON bookings(catalog_order_id);

CREATE INDEX IF NOT EXISTS idx_leads_source 
ON leads(source);
```

### Run Migration
```bash
npx sequelize-cli db:migrate
# or
npm run migrate:up
```

---

## 2. Agency Model Update

**File:** `backend/src/models/Agency.ts`

```typescript
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface CatalogConfig {
  whatsappCatalogId: string;
  enableCatalogSync: boolean;
  catalogSyncStatus: 'active' | 'inactive' | 'error';
  lastSyncTime?: Date;
  syncErrorMessage?: string;
}

interface AgencyAttributes {
  id: string;
  name: string;
  // ... existing fields ...
  catalogConfig?: CatalogConfig;
  catalogSyncStatus?: string;
  lastCatalogSync?: Date;
}

class Agency extends Model<AgencyAttributes> implements AgencyAttributes {
  public id: string;
  public name: string;
  // ... existing fields ...
  public catalogConfig?: CatalogConfig;
  public catalogSyncStatus?: string;
  public lastCatalogSync?: Date;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
}

Agency.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // ... existing fields ...
    catalogConfig: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    catalogSyncStatus: {
      type: DataTypes.ENUM('active', 'inactive', 'error'),
      defaultValue: 'inactive',
    },
    lastCatalogSync: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'agencies',
    timestamps: true,
  }
);

export default Agency;
```

---

## 3. Catalog Sync Service

**File:** `backend/src/services/catalogSyncService.ts`

```typescript
import axios from 'axios';
import Agency from '../models/Agency';
import Package from '../models/Package';
import { encryptString, decryptString } from '../utils/encryption';
import logger from '../utils/logger';

interface CatalogProduct {
  name: string;
  description?: string;
  price: number;
  currency: string;
  image_url?: string;
  url?: string;
  category?: string;
  rich_description?: string;
}

class CatalogSyncService {
  private metaApiVersion = 'v18.0';
  private metaApiBaseUrl = 'https://graph.instagram.com';

  /**
   * Sync a single package to Meta Catalog
   */
  async syncPackageToCatalog(
    packageId: string,
    agencyId: string
  ): Promise<{ success: boolean; catalogProductId?: string; error?: string }> {
    try {
      // Get package and agency
      const pkg = await Package.findByPk(packageId);
      if (!pkg) throw new Error('Package not found');

      const agency = await Agency.findByPk(agencyId);
      if (!agency) throw new Error('Agency not found');

      // Check catalog config
      const catalogConfig = agency.catalogConfig as any;
      if (!catalogConfig?.whatsappCatalogId || !catalogConfig?.enableCatalogSync) {
        throw new Error('Catalog not configured or disabled');
      }

      // Map package to catalog product
      const catalogProduct = this.mapPackageToCatalogProduct(pkg);

      // Call Meta API using the existing WhatsApp integration and configured Catalog ID
      let response;
      if (pkg.catalogProductId) {
        // Update existing
        response = await this.updateCatalogProduct(
          catalogConfig.whatsappCatalogId,
          pkg.catalogProductId,
          catalogProduct
        );
      } else {
        // Create new
        response = await this.createCatalogProduct(
          catalogConfig.whatsappCatalogId,
          catalogProduct
        );
      }

      // Save catalog product ID to package
      await pkg.update({
        catalogProductId: response.id,
        catalogSyncStatus: 'synced',
        lastCatalogSync: new Date(),
      });

      logger.info('Catalog sync success', {
        packageId,
        catalogProductId: response.id,
      });

      // Update agency sync status
      await agency.update({
        catalogSyncStatus: 'active',
        lastCatalogSync: new Date(),
      });

      return { success: true, catalogProductId: response.id };
    } catch (error) {
      logger.error('Catalog sync failed', {
        packageId,
        agencyId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Update sync status
      try {
        const agency = await Agency.findByPk(agencyId);
        if (agency) {
          await agency.update({
            catalogSyncStatus: 'error',
            lastCatalogSync: new Date(),
          });
        }

        const pkg = await Package.findByPk(packageId);
        if (pkg) {
          await pkg.update({
            catalogSyncStatus: 'failed',
            lastCatalogSync: new Date(),
          });
        }
      } catch (updateError) {
        logger.error('Failed to update sync status', updateError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Sync all packages for an agency
   */
  async syncAllPackages(
    agencyId: string
  ): Promise<{
    totalPackages: number;
    successCount: number;
    failedCount: number;
    errors: Array<{ packageId: string; error: string }>;
  }> {
    const packages = await Package.findAll({ where: { agencyId } });
    const errors: Array<{ packageId: string; error: string }> = [];
    let successCount = 0;

    for (const pkg of packages) {
      const result = await this.syncPackageToCatalog(pkg.id, agencyId);
      if (result.success) {
        successCount++;
      } else {
        errors.push({ packageId: pkg.id, error: result.error || 'Unknown error' });
      }
    }

    return {
      totalPackages: packages.length,
      successCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * Remove package from catalog
   */
  async removePackageFromCatalog(
    packageId: string,
    agencyId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pkg = await Package.findByPk(packageId);
      if (!pkg || !pkg.catalogProductId) {
        throw new Error('Package not found or not synced');
      }

      const agency = await Agency.findByPk(agencyId);
      if (!agency) throw new Error('Agency not found');

      const catalogConfig = agency.catalogConfig as any;
      if (!catalogConfig?.whatsappCatalogId) {
        throw new Error('Catalog not configured');
      }

      await this.deleteCatalogProduct(
        pkg.catalogProductId
      );

      await pkg.update({
        catalogProductId: null,
        catalogSyncStatus: null,
      });

      logger.info('Catalog product removed', { packageId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to remove catalog product', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Map package data to Meta Catalog product format
   */
  private mapPackageToCatalogProduct(pkg: Package): CatalogProduct {
    return {
      name: pkg.name,
      description: pkg.description?.substring(0, 120), // Max 120 chars
      price: Math.round(pkg.basePrice * 100) / 100, // To 2 decimals
      currency: 'INR',
      image_url: pkg.image || undefined,
      url: `${process.env.FRONTEND_URL}/packages/${pkg.id}`,
      category: 'Travel',
      rich_description: JSON.stringify({
        destinations: pkg.destinations,
        duration: pkg.duration,
        highlights: pkg.highlights,
      }),
    };
  }

  /**
   * Create product in Meta Catalog
   */
  private async createCatalogProduct(
    catalogId: string,
    product: CatalogProduct,
    accessToken: string
  ): Promise<any> {
    const url = `${this.metaApiBaseUrl}/${this.metaApiVersion}/${catalogId}/products`;

    const response = await axios.post(url, product, {
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data;
  }

  /**
   * Update product in Meta Catalog
   */
  private async updateCatalogProduct(
    catalogId: string,
    productId: string,
    product: CatalogProduct,
    accessToken: string
  ): Promise<any> {
    const url = `${this.metaApiBaseUrl}/${this.metaApiVersion}/${productId}`;

    const response = await axios.post(url, product, {
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data;
  }

  /**
   * Delete product from Meta Catalog
   */
  private async deleteCatalogProduct(
    productId: string,
    accessToken: string
  ): Promise<any> {
    const url = `${this.metaApiBaseUrl}/${this.metaApiVersion}/${productId}`;

    const response = await axios.delete(url, {
      params: { access_token: accessToken },
    });

    return response.data;
  }

  /**
   * Get catalog sync status for agency
   */
  async getCatalogSyncStatus(agencyId: string) {
    const agency = await Agency.findByPk(agencyId);
    if (!agency) throw new Error('Agency not found');

    const packages = await Package.findAll({
      where: { agencyId },
      attributes: ['id', 'catalogSyncStatus', 'lastCatalogSync'],
    });

    const synced = packages.filter((p) => p.catalogSyncStatus === 'synced').length;
    const failed = packages.filter((p) => p.catalogSyncStatus === 'failed').length;
    const pending = packages.filter((p) => !p.catalogSyncStatus).length;

    return {
      catalogConfig: agency.catalogConfig,
      catalogSyncStatus: agency.catalogSyncStatus,
      lastCatalogSync: agency.lastCatalogSync,
      packagesTotal: packages.length,
      packagesSynced: synced,
      packagesFailed: failed,
      packagesPending: pending,
    };
  }
}

export default new CatalogSyncService();
```

---

## 4. Catalog Order Handler

**File:** `bot/src/handlers/catalogOrderHandler.js`

```javascript
const Lead = require('../../../backend/src/models/Lead');
const Booking = require('../../../backend/src/models/Booking');
const Package = require('../../../backend/src/models/Package');
const Customer = require('../../../backend/src/models/Customer');
const Agency = require('../../../backend/src/models/Agency');
const whatsappService = require('../utils/whatsappService');
const logger = require('../../../backend/src/utils/logger');

async function handleCatalogOrder(message, session) {
  try {
    const {
      from,
      id: messageId,
      timestamp,
      order: { catalog_id, product_items, text: customerMessage },
    } = message;

    const { agencyId, agencyPhoneId } = session;

    logger.info('Handling catalog order', {
      orderId: messageId,
      customerPhone: from,
      catalogId: catalog_id,
      itemCount: product_items?.length,
    });

    // 1. Get agency
    const agency = await Agency.findByPk(agencyId);
    if (!agency) throw new Error('Agency not found');

    // 2. Find or create customer
    let customer = await Customer.findOne({
      where: { phoneNumber: from, agencyId },
    });

    if (!customer) {
      customer = await Customer.create({
        agencyId,
        phoneNumber: from,
        name: `Customer ${from.slice(-4)}`, // Temp name
        source: 'catalog',
      });
    }

    // 3. Process order items
    const orderItems = [];
    let totalAmount = 0;
    let currency = 'INR';

    for (const item of product_items) {
      const pkg = await Package.findOne({
        where: { catalogProductId: item.product_retailer_id, agencyId },
      });

      if (!pkg) {
        logger.warn('Package not found for catalog product', {
          catalogProductId: item.product_retailer_id,
        });
        continue;
      }

      const itemTotal = item.item_price * item.quantity;
      totalAmount += itemTotal;
      currency = item.currency || 'INR';

      orderItems.push({
        packageId: pkg.id,
        packageName: pkg.name,
        catalogProductId: item.product_retailer_id,
        quantity: item.quantity,
        price: item.item_price,
        currency,
      });
    }

    if (orderItems.length === 0) {
      throw new Error('No valid items in order');
    }

    // 4. Create Lead
    const lead = await Lead.create({
      agencyId,
      customerId: customer.id,
      phoneNumber: from,
      source: 'catalog_order',
      status: 'just_contacted',
      stage: 'catalog_inquiry',
      catalogOrderData: {
        catalogOrderId: messageId,
        items: orderItems,
        totalAmount,
        currency,
        customerMessage: customerMessage || '',
        orderedAt: new Date(timestamp * 1000),
      },
      notes: `Order from WhatsApp Catalog: ${orderItems
        .map((i) => i.packageName)
        .join(', ')}`,
    });

    logger.info('Lead created from catalog order', {
      leadId: lead.id,
      totalAmount,
    });

    // 5. Create Booking
    const packageIds = orderItems.map((item) => item.packageId);
    const booking = await Booking.create({
      agencyId,
      leadId: lead.id,
      packageIds,
      status: 'pending',
      totalPrice: totalAmount,
      source: 'catalog',
      catalogOrderId: messageId,
    });

    logger.info('Booking created from catalog order', {
      bookingId: booking.id,
      packageCount: packageIds.length,
    });

    // 6. Send confirmation message to customer
    await sendCatalogOrderConfirmation(
      from,
      customer,
      lead,
      booking,
      orderItems,
      agency,
      agencyPhoneId
    );

    // 7. Notify agent
    await notifyAgentCatalogOrder(lead, booking, orderItems, agency);

    return {
      success: true,
      leadId: lead.id,
      bookingId: booking.id,
    };
  } catch (error) {
    logger.error('Error handling catalog order', {
      error: error.message,
      message,
    });

    // Send error message to customer
    try {
      await whatsappService.sendText(
        message.from,
        'We received your order but encountered an issue processing it. Please try again or contact our support.',
        session
      );
    } catch (msgError) {
      logger.error('Failed to send error message', msgError);
    }

    throw error;
  }
}

async function sendCatalogOrderConfirmation(
  phoneNumber,
  customer,
  lead,
  booking,
  orderItems,
  agency,
  agencyPhoneId
) {
  try {
    const itemsList = orderItems
      .map((item) => `${item.packageName} x${item.quantity} - ₹${item.price}`)
      .join('\n');

    const message = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        name: 'order_confirmation',
        language: { code: 'en_US' },
        parameters: {
          body: {
            parameters: [
              { type: 'text', text: customer.name || 'there' },
              { type: 'text', text: booking.id },
              { type: 'text', text: `₹${booking.totalPrice}` },
              { type: 'text', text: itemsList },
            ],
          },
          buttons: [
            {
              type: 'url',
              text: 'View Details',
              url: `${process.env.FRONTEND_URL}/bookings/${booking.id}`,
            },
          ],
        },
      },
    };

    await whatsappService.sendMessage(message, agency.whatsappAccessToken);

    logger.info('Order confirmation sent', {
      leadId: lead.id,
      phoneNumber,
    });
  } catch (error) {
    logger.error('Failed to send confirmation message', {
      leadId: lead.id,
      error: error.message,
    });
    // Don't throw - order already created successfully
  }
}

async function notifyAgentCatalogOrder(lead, booking, orderItems, agency) {
  try {
    // Send notification to assigned agent (if any)
    // This could be via email, in-app notification, or WhatsApp

    const itemSummary = orderItems
      .map((item) => `${item.packageName} x${item.quantity}`)
      .join(', ');

    const notificationMessage = {
      type: 'catalog_order',
      leadId: lead.id,
      bookingId: booking.id,
      customerName: lead.customerName || 'New Customer',
      phoneNumber: lead.phoneNumber,
      totalAmount: booking.totalPrice,
      itemSummary,
      timestamp: new Date(),
    };

    // Emit to WebSocket for real-time dashboard update
    // io.to(`agency:${agency.id}`).emit('new_lead', notificationMessage);

    logger.info('Agent notified of catalog order', {
      agencyId: agency.id,
      leadId: lead.id,
    });
  } catch (error) {
    logger.error('Failed to notify agent', error);
    // Don't throw - order processing already complete
  }
}

module.exports = {
  handleCatalogOrder,
};
```

---

## 5. Webhook Router Update

**File:** `bot/src/botRouter.js` (Snippet)

```javascript
const { handleCatalogOrder } = require('./handlers/catalogOrderHandler');

async function routeMessage(message, session) {
  try {
    // ... existing checks ...

    // NEW: Check for catalog order
    if (message.order) {
      return await handleCatalogOrder(message, session);
    }

    // ... rest of routing ...
  } catch (error) {
    logger.error('Message routing failed', error);
  }
}

module.exports = {
  routeMessage,
  // ... rest of exports ...
};
```

---

## 6. Package Controller Update

**File:** `backend/src/controllers/packageController.ts` (Snippet)

```typescript
import { Request, Response } from 'express';
import catalogSyncService from '../services/catalogSyncService';
import catalogSyncQueue from '../queues/catalogSyncQueue'; // Optional: for async jobs

export class PackageController {
  static async createPackage(req: Request, res: Response) {
    try {
      // ... existing validation ...

      const agencyId = req.user.agencyId;
      const packageData = req.body;

      // Save package
      const package = await Package.create({
        ...packageData,
        agencyId,
      });

      // Trigger catalog sync if enabled and checkbox is checked
      const agency = await Agency.findByPk(agencyId);
      const catalogConfig = agency?.catalogConfig as any;

      if (catalogConfig?.enableCatalogSync && req.body.syncToCatalog !== false) {
        // Option 1: Use async queue (recommended)
        try {
          await catalogSyncQueue.add(
            {
              packageId: package.id,
              agencyId,
              action: 'sync',
            },
            {
              attempts: 3,
              backoff: 'exponential',
            }
          );
        } catch (queueError) {
          // If queue fails, do sync directly
          await catalogSyncService.syncPackageToCatalog(package.id, agencyId);
        }

        // Option 2: Direct sync (simpler, can block for a few seconds)
        // await catalogSyncService.syncPackageToCatalog(package.id, agencyId);
      }

      return res.status(201).json({
        success: true,
        package,
        catalogSyncStatus:
          catalogConfig?.enableCatalogSync && req.body.syncToCatalog !== false
            ? 'syncing'
            : 'not_synced',
      });
    } catch (error) {
      logger.error('Failed to create package', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async updatePackage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const agencyId = req.user.agencyId;

      const pkg = await Package.findOne({ where: { id, agencyId } });
      if (!pkg) {
        return res.status(404).json({ success: false, error: 'Package not found' });
      }

      // Update package
      await pkg.update(req.body);

      // Trigger catalog sync if enabled
      const agency = await Agency.findByPk(agencyId);
      const catalogConfig = agency?.catalogConfig as any;

      if (catalogConfig?.enableCatalogSync && req.body.syncToCatalog !== false) {
        // Queue sync
        try {
          await catalogSyncQueue.add({
            packageId: pkg.id,
            agencyId,
            action: 'sync',
          });
        } catch (queueError) {
          await catalogSyncService.syncPackageToCatalog(pkg.id, agencyId);
        }
      }

      return res.json({
        success: true,
        package: pkg,
        catalogSyncStatus: catalogConfig?.enableCatalogSync ? 'syncing' : 'not_synced',
      });
    } catch (error) {
      logger.error('Failed to update package', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default PackageController;
```

---

## 7. API Routes

**File:** `backend/src/routes/catalogSettings.ts`

```typescript
import { Router, Request, Response } from 'express';
import Agency from '../models/Agency';
import catalogSyncService from '../services/catalogSyncService';
import { authMiddleware, agencyOwnerMiddleware } from '../middleware/auth';
import { encryptString, decryptString } from '../utils/encryption';
import logger from '../utils/logger';
import axios from 'axios';

const router = Router();

/**
 * GET /api/v1/agencies/:agencyId/catalog-settings
 * Get catalog configuration
 */
router.get(
  '/agencies/:agencyId/catalog-settings',
  authMiddleware,
  agencyOwnerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { agencyId } = req.params;
      const agency = await Agency.findByPk(agencyId);

      if (!agency) {
        return res.status(404).json({ error: 'Agency not found' });
      }

      res.json({
        success: true,
        catalogConfig: agency.catalogConfig,
        catalogSyncStatus: agency.catalogSyncStatus,
        lastCatalogSync: agency.lastCatalogSync,
        // Don't expose the API token
      });
    } catch (error) {
      logger.error('Failed to get catalog settings', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/v1/agencies/:agencyId/catalog-settings
 * Save catalog configuration
 */
router.put(
  '/agencies/:agencyId/catalog-settings',
  authMiddleware,
  agencyOwnerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { agencyId } = req.params;
      const {
        whatsappCatalogId,
        enableCatalogSync,
      } = req.body;

      // Validate required fields
      if (!whatsappCatalogId) {
        return res.status(400).json({
          error: 'Missing required Catalog ID',
        });
      }

      const agency = await Agency.findByPk(agencyId);
      if (!agency) {
        return res.status(404).json({ error: 'Agency not found' });
      }

      // Save config
      await agency.update({
        catalogConfig: {
          whatsappCatalogId,
          enableCatalogSync: enableCatalogSync ?? true,
          catalogSyncStatus: 'active',
        },
        catalogSyncStatus: 'active',
        lastCatalogSync: new Date(),
      });

      res.json({
        success: true,
        message: 'Catalog settings saved',
        catalogConfig: agency.catalogConfig,
      });
    } catch (error) {
      logger.error('Failed to save catalog settings', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

/**
 * POST /api/v1/agencies/:agencyId/sync-all-packages
 * Sync all packages to catalog
 */
router.post(
  '/agencies/:agencyId/sync-all-packages',
  authMiddleware,
  agencyOwnerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { agencyId } = req.params;

      const result = await catalogSyncService.syncAllPackages(agencyId);

      res.json({
        success: true,
        result,
        message: `Synced ${result.successCount}/${result.totalPackages} packages`,
      });
    } catch (error) {
      logger.error('Failed to sync packages', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

/**
 * GET /api/v1/agencies/:agencyId/catalog-status
 * Get catalog sync status
 */
router.get(
  '/agencies/:agencyId/catalog-status',
  authMiddleware,
  agencyOwnerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { agencyId } = req.params;
      const status = await catalogSyncService.getCatalogSyncStatus(agencyId);

      res.json({
        success: true,
        status,
      });
    } catch (error) {
      logger.error('Failed to get catalog status', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

export default router;
```

---

## 8. Frontend - Catalog Settings Component

**File:** `frontend/src/components/CatalogSettingsForm.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';

const CatalogSettingsForm = ({ agencyId, onSave }) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: {
      enableCatalogSync: false,
      whatsappCatalogId: '',
    },
  });

  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(
          `/api/v1/agencies/${agencyId}/catalog-settings`
        );
        if (response.data.catalogConfig) {
          reset({
            whatsappCatalogId: response.data.catalogConfig.whatsappCatalogId,
            enableCatalogSync: response.data.catalogConfig.enableCatalogSync,
          });
          setSyncStatus(response.data.catalogSyncStatus);
        }
      } catch (err) {
        console.error('Failed to fetch settings', err);
      }
    };

    fetchSettings();
  }, [agencyId, reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await axios.put(
        `/api/v1/agencies/${agencyId}/catalog-settings`,
        data
      );

      setSuccess(true);
      setSyncStatus(response.data.catalogConfig.catalogSyncStatus);

      if (onSave) {
        onSave(response.data.catalogConfig);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">WhatsApp Catalog Settings</h2>

      {syncStatus && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm font-medium text-blue-800">
            Status: <span className="font-bold">{syncStatus}</span>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            WhatsApp Catalog ID
          </label>
          <input
            type="text"
            {...register('whatsappCatalogId', {
              required: 'Catalog ID is required',
            })}
            placeholder="123456789"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
          />
          {errors.whatsappCatalogId && (
            <p className="text-red-500 text-sm mt-1">
              {errors.whatsappCatalogId.message}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <input
            id="enableCatalogSync"
            type="checkbox"
            {...register('enableCatalogSync')}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <label htmlFor="enableCatalogSync" className="text-sm text-gray-700">
            Enable package sync to WhatsApp catalog
          </label>
        </div>

        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}

        {success && (
          <div className="text-sm text-green-600">Settings saved successfully.</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};

export default CatalogSettingsForm;
```

---

## 9. Environment Variables

**File:** `.env`

```bash
# Catalog Configuration
META_CATALOG_API_VERSION=v18.0
MAX_CATALOG_SYNC_RETRIES=3
CATALOG_SYNC_TIMEOUT_MS=30000

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# Frontend URL (for catalog product link)
FRONTEND_URL=http://localhost:5173
```

---

## 10. Database Seed (Test Data)

**File:** `backend/seeds/test-catalog.ts` (Optional)

```typescript
import Agency from '../src/models/Agency';

async function seedCatalog() {
  try {
    const agency = await Agency.findOne({
      where: { name: 'Test Agency' },
    });

    if (agency) {
      await agency.update({
        catalogConfig: {
          whatsappCatalogId: '123456789',
          enableCatalogSync: true,
          catalogSyncStatus: 'active',
        },
      });

      console.log('✅ Test catalog config seeded');
    }
  } catch (error) {
    console.error('Failed to seed catalog', error);
  }
}

export default seedCatalog;
```

---

These code snippets provide a complete foundation for implementing the catalog management feature. Start with the database migration, then implement the service layer, webhook handlers, and finally the frontend components.

