import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData();
  const { errors } = loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Open from Shopify">
          <p>
            Install and open Badges by Tag from Shopify admin or the Shopify App Store listing.
          </p>
          {errors.shop ? <p>{errors.shop}</p> : null}
        </s-section>
      </s-page>
    </AppProvider>
  );
}
