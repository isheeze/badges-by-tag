import { redirect } from "react-router";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Badges by Tag</h1>
        <p className={styles.text}>
          Show storefront badges automatically from Shopify product tags.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Tag based rules.</strong> Map product tags to badge labels and styles.
          </li>
          <li>
            <strong>Theme app block.</strong> Add badges to product pages and product cards.
          </li>
          <li>
            <strong>Shopify native data.</strong> Badge mappings are saved in shop metafields.
          </li>
        </ul>
      </div>
    </div>
  );
}
