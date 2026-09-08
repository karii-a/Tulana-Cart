import { useState, useEffect } from "react";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { useNavigate } from "react-router-dom";
import { requestProductTranslation, needsTranslation } from "../lib/translateProduct";

function ProductCard({ product }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const navigate = useNavigate();

  // Local copy of the Nepali name so it can be filled in without needing
  // a full page refetch once the translation comes back.
  const [nameNp, setNameNp] = useState(product.name_np);

  useEffect(() => {
    setNameNp(product.name_np);
  }, [product.name_np]);

  useEffect(() => {
    if (lang === "np" && needsTranslation({ ...product, name_np: nameNp })) {
      requestProductTranslation(product, setNameNp);
    }
    // Only re-run when the language is switched to Nepali or the product
    // itself changes — not on every nameNp update, or this would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, product.id]);

  const displayName = lang === "en" ? product.name : (nameNp || product.name);

  const prices = product.product_prices ?? [];
  const nums = prices.map((p) => p.price);
  const minPrice = nums.length > 0 ? Math.min(...nums) : null;
  const wishlisted = isWishlisted(product.id);

  function handleWishlistClick() {
    if (!user) {
      navigate("/login");
      return;
    }
    toggleWishlist(product.id);
  }

  return (
    <div className="product-card">
      <button
        className={`product-card__wishlist ${wishlisted ? "active" : ""}`}
        onClick={handleWishlistClick}
        aria-label={lang === "en" ? "Toggle wishlist" : "इच्छासूची टगल गर्नुहोस्"}
      >
        {wishlisted ? "♥" : "♡"}
      </button>

      <div
        className="product-card__body"
        onClick={() => navigate(`/product/${product.id}`)}
        style={{ cursor: "pointer" }}
      >
        {product.image_url && (
          <img
            src={product.image_url}
            alt={displayName}
            className="product-card__image"
            loading="lazy"
          />
        )}

        <h3>{displayName}</h3>

        <p className="product-card__brand">
          {product.brand}
        </p>

        {minPrice !== null && (
          <p className="product-card__price">
            From <strong>Rs. {minPrice}</strong>
          </p>
        )}

        <div className="product-card__stores">
          {prices.map((pp, i) => (
            <a
              key={i}
              href={pp.store_product_url || "#"}
              target="_blank"
              rel="noreferrer"
              className={`store-tag ${pp.price === minPrice ? "store-tag--best" : ""} ${pp.in_stock === false ? "store-tag--oos" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!pp.store_product_url) e.preventDefault();
              }}
            >
              {pp.stores?.name} - Rs. {pp.price}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;