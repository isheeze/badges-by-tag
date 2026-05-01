import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  try {
    await db.session.deleteMany({ where: { shop } });
  } catch (error) {
    console.error("Failed to delete sessions after shop redact webhook", {
      shop,
      message: error?.message,
    });
  }

  console.log(
    JSON.stringify({
      event: "privacy_shop_redact",
      shop,
      message: "Deleted app sessions for shop redact request.",
    }),
  );

  return new Response(null, { status: 200 });
};
