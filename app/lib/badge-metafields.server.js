import { normalizeBadgeMappings } from "./badge-mappings.js";

export const BADGE_METAFIELD_NAMESPACE = "badges_by_tag";
export const BADGE_METAFIELD_KEY = "mappings";
export const BADGE_METAFIELD_TYPE = "json";

export async function getBadgeMappings(admin) {
  const response = await admin.graphql(
    `#graphql
    query GetBadgeMappings($namespace: String!, $key: String!) {
      shop {
        metafield(namespace: $namespace, key: $key) {
          value
        }
      }
    }`,
    {
      variables: {
        namespace: BADGE_METAFIELD_NAMESPACE,
        key: BADGE_METAFIELD_KEY,
      },
    },
  );

  const result = await response.json();
  const rawValue = result?.data?.shop?.metafield?.value;
  if (!rawValue) return [];

  try {
    return normalizeBadgeMappings(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export async function setBadgeMappings(admin, mappings) {
  const cleaned = normalizeBadgeMappings(mappings);
  const shopIdResponse = await admin.graphql(
    `#graphql
    query ShopId {
      shop {
        id
      }
    }`,
  );
  const shopIdResult = await shopIdResponse.json();
  const ownerId = shopIdResult?.data?.shop?.id;

  if (!ownerId) {
    return {
      ok: false,
      mappings: cleaned,
      errors: [{ message: "Could not resolve the shop ID for saving badge mappings." }],
    };
  }

  const response = await admin.graphql(
    `#graphql
    mutation SetBadgeMappings($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
          code
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: BADGE_METAFIELD_NAMESPACE,
            key: BADGE_METAFIELD_KEY,
            type: BADGE_METAFIELD_TYPE,
            value: JSON.stringify(cleaned),
          },
        ],
      },
    },
  );

  const result = await response.json();
  const errors = result?.data?.metafieldsSet?.userErrors ?? [];

  return {
    ok: errors.length === 0,
    mappings: cleaned,
    errors,
  };
}