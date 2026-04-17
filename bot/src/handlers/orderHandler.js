// FILE: /bot/src/handlers/orderHandler.js
const path = require('path');
const { Package, Booking } = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const paymentService = require(path.resolve(__dirname, '../../../backend/src/services/paymentService.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const { updateSession } = require('../utils/sessionManager');

/**
 * Handles incoming Meta Commerce cart orders.
 * @param {object} session - BotSession instance
 * @param {object} incoming - Parsed incoming message (contains .order)
 * @param {object} customer - Customer instance
 * @param {object} agency - Agency instance
 */
async function handleOrder(session, incoming, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const order = incoming.order;
  
  if (!order || !order.product_items || order.product_items.length === 0) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'Your cart seems to be empty. Please browse our catalog again to select a package.',
      ctx
    );
    return;
  }

  try {
    // Notify user we are processing their cart
    await whatsappService.sendTextMessage(
      customer.phone,
      'Thank you for your order! 🛒 We are preparing your checkout link...',
      ctx
    );

    let totalAmountPaise = 0;
    const packageItems = [];

    // Process each item in the cart
    for (const item of order.product_items) {
      const pkg = await Package.findOne({
        where: { id: item.product_retailer_id, agencyId: agency.id },
      });

      if (pkg) {
        const qty = parseInt(item.quantity, 10) || 1;
        totalAmountPaise += pkg.basePrice * qty;
        packageItems.push({ package: pkg, quantity: qty });
      }
    }

    if (packageItems.length === 0) {
      await whatsappService.sendTextMessage(
        customer.phone,
        'We could not find the packages you selected. They might be temporarily unavailable.',
        ctx
      );
      return;
    }

    // For simplicity, we create a single booking for the first package in the cart
    // Since our existing Booking model ties 1 Booking to 1 Package
    // If they added multiple, we just use the first package for the primary relation
    // but the totalAmount reflects the full cart value.
    const primaryPackage = packageItems[0].package;
    const totalAdults = packageItems.reduce((acc, curr) => acc + curr.quantity, 0);

    const bookingRef = `WA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const booking = await Booking.create({
      agencyId: agency.id,
      customerId: customer.id,
      packageId: primaryPackage.id,
      agentId: session.agentId || null,
      bookingRef,
      startDate: new Date(), // We assume immediate or require manual follow-up
      adults: totalAdults,
      children: 0,
      totalAmount: totalAmountPaise,
      advancePaid: 0,
      status: 'PENDING',
    });

    // Generate the Razorpay payment link directly via paymentService
    // This will inherently send a WhatsApp template with the Razorpay URL
    await paymentService.createAndSendPaymentLink(booking.id, null);

    // Session is automatically updated to 'PAYMENT_PENDING' inside createAndSendPaymentLink

  } catch (err) {
    console.error('[OrderHandler] Error processing cart order:', err.message);
    await whatsappService.sendTextMessage(
      customer.phone,
      'We encountered an error while processing your cart. Our team will assist you shortly.',
      ctx
    );
  }
}

module.exports = { handleOrder };
