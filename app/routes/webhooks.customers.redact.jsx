import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log(
    JSON.stringify({
      event: "privacy_customer_redact",
      shop,
      customerId: payload?.customer?.id ?? null,
      message: "No customer-level data is stored by this app.",
    }),
  );

  return new Response(null, { status: 200 });
};