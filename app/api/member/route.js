import { createClient, OAuthStrategy } from '@wix/sdk';
import { contacts } from '@wix/contacts';
import { orders } from '@wix/pricing-plans';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get('contactId');

  if (!contactId) {
    return Response.json({ error: 'contactId is required' }, { status: 400 });
  }

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(contactId)) {
    return Response.json({ error: 'Invalid contact ID format' }, { status: 400 });
  }

  const clientId = process.env.NEXT_PUBLIC_WIX_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: 'Wix client ID not configured' }, { status: 500 });
  }

  try {
    const wixClient = createClient({
      modules: { contacts, orders },
      auth: OAuthStrategy({ clientId }),
    });

    // Parallel fetch: contact info + plan orders
    const [contactResult, ordersResult] = await Promise.allSettled([
      wixClient.contacts.getContact(contactId),
      wixClient.orders.listOrders({ buyerIds: [contactId], limit: 20 }),
    ]);

    // Contact is required
    if (contactResult.status === 'rejected') {
      const err = contactResult.reason;
      if (err?.details?.applicationError?.code === 'NOT_FOUND' || err?.httpStatus === 404) {
        return Response.json({ error: 'Contact not found' }, { status: 404 });
      }
      throw err;
    }

    const contact = contactResult.value.contact ?? contactResult.value;
    const ordersList = ordersResult.status === 'fulfilled'
      ? (ordersResult.value.orders ?? [])
      : [];

    // Sort: ACTIVE first
    const STATUS_ORDER = { ACTIVE: 0, PENDING_PAYMENT: 1, DRAFT: 2, ENDED: 3, CANCELED: 4 };
    ordersList.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

    return Response.json({
      contact: {
        id:    contact.id,
        name:  contact.info?.name ?? {},
        email: contact.primaryInfo?.email ?? contact.info?.emails?.[0]?.email ?? null,
        phone: contact.primaryInfo?.phone ?? contact.info?.phones?.[0]?.phone ?? null,
      },
      orders: ordersList.map(o => ({
        id:        o.id,
        planId:    o.planId,
        planName:  o.planName ?? o.plan?.name ?? null,
        status:    o.status,
        startDate: o.startDate ?? null,
        endDate:   o.endDate ?? o.validUntil ?? null,
      })),
    });

  } catch (err) {
    console.error('[8848 scanner] API error:', err);
    return Response.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
